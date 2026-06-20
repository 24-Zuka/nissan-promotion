/**
 * 顧客(Contact) CRUD ルート。  [担当: Sub A — CRM_CORE]
 *
 * このルータは /api/v1/contacts にマウント済み（パスはこのプレフィックス相対）。
 * 実装する契約:
 *   GET    /            未削除一覧（最近更新順）
 *   POST   /            contactCreateSchema で検証 → 作成
 *   GET    /:id         1件（車両/直近メモ/未完タスクは別エンドポイントでも可）
 *   PATCH  /:id         contactUpdateSchema で部分更新
 *   DELETE /:id         ソフトデリート(softDelete)
 *
 * 規約:
 *   - user_id は req.userId（requireAuth 済み）を使用。所有者以外は 404。
 *   - 作成/更新時は created_at/updated_at と nextSeq(db) を必ずスタンプ。
 *   - ヘルパは ../repo.ts（newId/nowIso/softDelete/getActiveRow）を利用。
 */
import { Router } from 'express';
import { contactCreateSchema, contactUpdateSchema } from '@crm/shared';
import { nextSeq, type DB } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { getActiveRow, newId, nowIso, softDelete } from '../repo.js';

interface ContactRow {
  id: string;
  user_id: string;
  [key: string]: unknown;
}

/** 顧客行を取得し、所有者(req.userId)のものでなければ undefined。 */
function getOwnedContact(db: DB, id: string, userId: string): ContactRow | undefined {
  const row = getActiveRow<ContactRow>(db, 'contacts', id);
  if (!row || row.user_id !== userId) return undefined;
  return row;
}

export function contactsRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);

  // GET / — 自分の未削除顧客を更新順（新しい順）で一覧。
  r.get('/', (req: AuthedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT * FROM contacts
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY updated_at DESC, seq DESC`,
      )
      .all(req.userId);
    res.json(rows);
  });

  // POST / — 新規作成。
  r.post('/', (req: AuthedRequest, res) => {
    const parsed = contactCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    const id = newId();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO contacts
         (id, user_id, name, phone, email, rank, family, usage, budget,
          desired_equipment, rival_car, insurance_status,
          created_at, updated_at, deleted_at, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).run(
      id,
      req.userId,
      d.name,
      d.phone ?? null,
      d.email || null,
      d.rank,
      d.family ?? null,
      d.usage ?? null,
      d.budget ?? null,
      d.desired_equipment ?? null,
      d.rival_car ?? null,
      d.insurance_status ?? null,
      ts,
      ts,
      nextSeq(db),
    );
    res.status(201).json(getActiveRow(db, 'contacts', id));
  });

  // GET /:id — 1件。
  r.get('/:id', (req: AuthedRequest, res) => {
    const row = getOwnedContact(db, req.params.id, req.userId!);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  });

  // PATCH /:id — 部分更新。
  r.patch('/:id', (req: AuthedRequest, res) => {
    const existing = getOwnedContact(db, req.params.id, req.userId!);
    if (!existing) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const parsed = contactUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];
    const cols: Array<keyof typeof d> = [
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
    ];
    for (const col of cols) {
      if (d[col] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(col === 'email' ? (d.email || null) : d[col]);
      }
    }
    fields.push('updated_at = ?', 'seq = ?');
    values.push(nowIso(), nextSeq(db), req.params.id);
    db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(...(values as never[]));
    res.json(getActiveRow(db, 'contacts', req.params.id));
  });

  // DELETE /:id — ソフトデリート。
  r.delete('/:id', (req: AuthedRequest, res) => {
    const existing = getOwnedContact(db, req.params.id, req.userId!);
    if (!existing) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    softDelete(db, 'contacts', req.params.id);
    res.json({ ok: true });
  });

  return r;
}
