/**
 * 差分同期(Sync) ルート。  [担当: Sub C — SYNC]
 *
 * このルータは /api/v1/sync にマウント済み（パスはこのプレフィックス相対）。
 *   GET  /pull?sync_token=<n>
 *        - sync_token は「クライアントが受信済みの最大 seq」。0 で全件。
 *        - 全同期テーブルから seq > sync_token の行（削除済み含む）を user スコープで返す。
 *   POST /push
 *        - body: { sync_token?, events: [{ table, op, entity }] }
 *        - 衝突解決(conflict.resolve)に従い単一トランザクションで反映。
 *        - 反映後、incoming sync_token でプル相当の changes/sync_token を併せて返す。
 *
 * 規約:
 *   - すべて user スコープ（req.userId 経由で所有データのみ）。
 *   - 反映時は nextSeq(db) を採番し、サーバの seq を単調増加に保つ。
 *   - 1件の不正イベントで全体を落とさず、rejected に収集して返す。
 */
import { Router } from 'express';
import { nextSeq, type DB } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import {
  getRow,
  mapTaskRow,
  mapSettingRow,
  nowIso,
  type SyncTable,
} from '../repo.js';
import { resolve, type SyncOp } from './conflict.js';

const SYNC_TABLES: SyncTable[] = [
  'contacts',
  'vehicles',
  'notes',
  'tasks',
  'templates',
  'settings',
];

/** 各テーブルの「同期で扱う」列（id/メタ列は別管理）。INSERT/UPDATE 対象。 */
const COLUMNS: Record<SyncTable, string[]> = {
  contacts: [
    'user_id',
    'name',
    'phone',
    'email',
    'rank',
    'family',
    'usage',
    'budget',
    'desired_equipment',
    'rival_car',
    'insurance_status',
  ],
  vehicles: [
    'contact_id',
    'name',
    'model_code',
    'condition',
    'registration_date',
    'delivery_date',
    'shaken_expiry_date',
  ],
  notes: ['contact_id', 'date', 'summary', 'reaction', 'next_action'],
  tasks: [
    'contact_id',
    'vehicle_id',
    'type',
    'title',
    'detail',
    'due_date',
    'status',
    'notify',
    'source',
    'generation_key',
  ],
  templates: ['user_id', 'category', 'name', 'body'],
  settings: [
    'user_id',
    'notifications_enabled',
    'notify_offsets_days',
    'long_session',
    'calendar_enabled',
  ],
};

/** boolean(0/1)へ正規化する列。 */
const BOOL_COLUMNS: Partial<Record<SyncTable, Set<string>>> = {
  tasks: new Set(['notify']),
  settings: new Set(['notifications_enabled', 'long_session', 'calendar_enabled']),
};

/** JSON文字列として保存する列。 */
const JSON_COLUMNS: Partial<Record<SyncTable, Set<string>>> = {
  settings: new Set(['notify_offsets_days']),
};

interface MetaRow {
  id: string;
  user_id?: string;
  contact_id?: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  seq: number;
  [key: string]: unknown;
}

/** テーブルに応じた所有スコープの WHERE 句（:uid バインドを使用）。 */
function ownershipWhere(table: SyncTable): string {
  if (table === 'contacts' || table === 'templates' || table === 'settings') {
    return 'user_id = :uid';
  }
  // vehicles / notes / tasks は contact 経由で所有。
  return 'contact_id IN (SELECT id FROM contacts WHERE user_id = :uid)';
}

/** ある行(id)が user スコープに属するかを検証（削除済みも含めて判定）。 */
function ownsRow(db: DB, table: SyncTable, row: MetaRow, userId: string): boolean {
  if (table === 'contacts' || table === 'templates' || table === 'settings') {
    return row.user_id === userId;
  }
  const cid = row.contact_id;
  if (!cid) return false;
  const owner = db
    .prepare('SELECT user_id FROM contacts WHERE id = ?')
    .get(cid) as { user_id: string } | undefined;
  return !!owner && owner.user_id === userId;
}

/** 入力 entity から、所有予定の user スコープを満たすか検証する。 */
function entityOwned(
  db: DB,
  table: SyncTable,
  entity: Record<string, unknown>,
  userId: string,
): boolean {
  if (table === 'contacts' || table === 'templates' || table === 'settings') {
    // user_id 未指定なら自分のものとして扱う（後段で userId をセット）。
    return entity.user_id === undefined || entity.user_id === userId;
  }
  const cid = entity.contact_id;
  if (typeof cid !== 'string' || !cid) return false;
  const owner = db
    .prepare('SELECT user_id FROM contacts WHERE id = ?')
    .get(cid) as { user_id: string } | undefined;
  return !!owner && owner.user_id === userId;
}

function mapRow(table: SyncTable, row: Record<string, unknown>): Record<string, unknown> {
  if (table === 'tasks') return mapTaskRow(row);
  if (table === 'settings') return mapSettingRow(row);
  return row;
}

interface PullResult {
  changes: Record<SyncTable, Record<string, unknown>[]>;
  sync_token: number;
}

/** sync_token より新しい行を user スコープで集約する（pull / push 共通）。 */
function computeChanges(db: DB, userId: string, sinceToken: number): PullResult {
  const changes = {} as Record<SyncTable, Record<string, unknown>[]>;
  let maxSeq = sinceToken;

  for (const table of SYNC_TABLES) {
    const rows = db
      .prepare(
        `SELECT * FROM ${table}
         WHERE (${ownershipWhere(table)}) AND seq > :since
         ORDER BY seq ASC`,
      )
      .all({ uid: userId, since: sinceToken }) as MetaRow[];

    changes[table] = rows.map((row) => {
      if (typeof row.seq === 'number' && row.seq > maxSeq) maxSeq = row.seq;
      return mapRow(table, row);
    });
  }

  return { changes, sync_token: maxSeq };
}

/** entity の値を列ごとに正規化（boolean→0/1, JSON→文字列）。 */
function normalizeValue(table: SyncTable, col: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (BOOL_COLUMNS[table]?.has(col)) {
    return value ? 1 : 0;
  }
  if (JSON_COLUMNS[table]?.has(col)) {
    if (typeof value === 'string') return value;
    return JSON.stringify(value ?? null);
  }
  return value;
}

interface RejectedEvent {
  index: number;
  table?: string;
  id?: string;
  reason: string;
}

export function syncRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);

  // GET /pull — 差分取得。
  r.get('/pull', (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const raw = Number(req.query.sync_token);
    const sinceToken = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
    const result = computeChanges(db, userId, sinceToken);
    res.json(result);
  });

  // POST /push — 差分反映 + 反映後の差分返却。
  r.post('/push', (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const body = (req.body ?? {}) as {
      sync_token?: number;
      events?: Array<{ table?: string; op?: string; entity?: Record<string, unknown> }>;
    };

    const rawToken = Number(body.sync_token);
    const sinceToken =
      Number.isFinite(rawToken) && rawToken >= 0 ? Math.floor(rawToken) : 0;
    const events = Array.isArray(body.events) ? body.events : [];

    const rejected: RejectedEvent[] = [];
    let applied = 0;

    const runAll = db.transaction(() => {
      events.forEach((ev, index) => {
        const table = ev.table as SyncTable | undefined;
        const op = ev.op as SyncOp | undefined;
        const entity = ev.entity;

        if (!table || !SYNC_TABLES.includes(table)) {
          rejected.push({ index, table: ev.table, reason: 'unknown_table' });
          return;
        }
        if (op !== 'create' && op !== 'update' && op !== 'delete') {
          rejected.push({ index, table, reason: 'unknown_op' });
          return;
        }
        if (!entity || typeof entity !== 'object') {
          rejected.push({ index, table, reason: 'missing_entity' });
          return;
        }
        const id = entity.id;
        if (typeof id !== 'string' || !id) {
          rejected.push({ index, table, reason: 'missing_id' });
          return;
        }

        const existing = getRow<MetaRow>(db, table, id);

        // 既存行の所有権チェック（他人のデータには触れない）。
        if (existing && !ownsRow(db, table, existing, userId)) {
          rejected.push({ index, table, id, reason: 'not_owned' });
          return;
        }
        // 新規/更新の入力エンティティの所有権チェック。
        if (!existing && !entityOwned(db, table, entity, userId)) {
          rejected.push({ index, table, id, reason: 'not_owned' });
          return;
        }
        // 既存行に対する update でも、contact 付け替え等が来た場合は拒否。
        if (existing && op !== 'delete' && !entityOwned(db, table, entity, userId)) {
          rejected.push({ index, table, id, reason: 'not_owned' });
          return;
        }

        const decision = resolve(
          { op, updated_at: (entity.updated_at as string | undefined) ?? undefined },
          existing
            ? { updated_at: existing.updated_at, deleted_at: existing.deleted_at }
            : undefined,
        );

        if (decision === 'skip') {
          rejected.push({ index, table, id, reason: 'conflict_skipped' });
          return;
        }

        const ts = nowIso();
        const seq = nextSeq(db);

        if (decision === 'apply-delete') {
          db.prepare(
            `UPDATE ${table} SET deleted_at = ?, updated_at = ?, seq = ? WHERE id = ?`,
          ).run(ts, ts, seq, id);
          applied += 1;
          return;
        }

        if (decision === 'apply-create') {
          const cols = COLUMNS[table];
          const insertCols: string[] = ['id'];
          const placeholders: string[] = ['?'];
          const values: unknown[] = [id];

          for (const col of cols) {
            insertCols.push(col);
            placeholders.push('?');
            if (col === 'user_id') {
              values.push(userId);
            } else {
              const v = normalizeValue(table, col, entity[col]);
              values.push(v === undefined ? null : v);
            }
          }

          const createdAt =
            typeof entity.created_at === 'string' ? entity.created_at : ts;
          const updatedAt =
            typeof entity.updated_at === 'string' ? entity.updated_at : ts;
          const deletedAt =
            typeof entity.deleted_at === 'string' ? entity.deleted_at : null;

          insertCols.push('created_at', 'updated_at', 'deleted_at', 'seq');
          placeholders.push('?', '?', '?', '?');
          values.push(createdAt, updatedAt, deletedAt, seq);

          try {
            db.prepare(
              `INSERT INTO ${table} (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`,
            ).run(...(values as never[]));
            applied += 1;
          } catch (err) {
            rejected.push({
              index,
              table,
              id,
              reason: `insert_failed:${(err as Error).message}`,
            });
          }
          return;
        }

        // apply-update — 提供された列のみ部分更新。
        const cols = COLUMNS[table];
        const setFragments: string[] = [];
        const values: unknown[] = [];
        for (const col of cols) {
          if (col === 'user_id') continue; // 所有者は付け替えない。
          if (entity[col] === undefined) continue;
          setFragments.push(`${col} = ?`);
          values.push(normalizeValue(table, col, entity[col]));
        }
        const updatedAt =
          typeof entity.updated_at === 'string' ? entity.updated_at : ts;
        setFragments.push('updated_at = ?', 'seq = ?');
        values.push(updatedAt, seq, id);

        try {
          db.prepare(`UPDATE ${table} SET ${setFragments.join(', ')} WHERE id = ?`).run(
            ...(values as never[]),
          );
          applied += 1;
        } catch (err) {
          rejected.push({
            index,
            table,
            id,
            reason: `update_failed:${(err as Error).message}`,
          });
        }
      });
    });

    runAll();

    const result = computeChanges(db, userId, sinceToken);
    res.json({ applied, rejected, changes: result.changes, sync_token: result.sync_token });
  });

  return r;
}
