/**
 * 同期エンジン（IO）。  [Phase 2 — オフライン同期]
 *
 * - push(): outbox を coalesce して /sync/push、成功後に outbox を掃除し changes を取り込む。
 * - pull(): /sync/pull で差分を取得し Dexie へ適用、sync_token を更新。
 * - sync(): push → pull。online 復帰 / 可視化 / 一定間隔 で起動。
 *
 * 純ロジック（coalesce / applyEntity / token）は @crm/shared/syncing で単体テスト済み。
 * ここはそれを Dexie と REST に結線するだけに留める。
 */
import {
  applyEntity,
  coalesceOutbox,
  maxSyncToken,
  type ClientSyncTable,
  type OutboxEntry,
  type SyncOp,
} from '@crm/shared';
import { api } from './api.js';
import {
  db,
  getSyncToken,
  setSyncToken,
  type OutboxRow,
  type StoredEntity,
} from './db.js';

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/** ローカル書き込み: Dexie に反映しつつ outbox に積む。オンラインなら即 flush。 */
export async function enqueueWrite(
  table: ClientSyncTable,
  op: SyncOp,
  entity: StoredEntity,
): Promise<void> {
  await db.transaction('rw', [table, 'outbox'], async () => {
    if (op === 'delete') {
      await db.entityTable(table).delete(entity.id);
    } else {
      const prev = (await db.entityTable(table).get(entity.id)) ?? {};
      await db.entityTable(table).put({ ...prev, ...entity });
    }
    await db.outbox.add({
      table,
      op,
      entity,
      created_at: new Date().toISOString(),
    } as OutboxRow);
  });
  if (isOnline()) void sync();
}

/** changes をローカルへ適用する（テーブル横断）。 */
async function applyServerChanges(changes: Record<string, StoredEntity[]>): Promise<void> {
  const tables = Object.keys(changes) as ClientSyncTable[];
  if (tables.length === 0) return;
  await db.transaction('rw', tables, async () => {
    for (const table of tables) {
      const rows = changes[table] ?? [];
      const map = new Map<string, StoredEntity>();
      const existing = await db.entityTable(table).bulkGet(rows.map((r) => r.id));
      existing.forEach((e, i) => {
        if (e) map.set(rows[i].id, e);
      });
      const toDelete: string[] = [];
      for (const entity of rows) {
        applyEntity(map, entity);
        if (entity.deleted_at) toDelete.push(entity.id);
      }
      if (toDelete.length) await db.entityTable(table).bulkDelete(toDelete);
      const upserts = rows.filter((r) => !r.deleted_at);
      if (upserts.length) await db.entityTable(table).bulkPut(upserts);
    }
  });
}

let inFlight: Promise<void> | null = null;

/** push→pull。多重起動は直列化する。 */
export function sync(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      if (!isOnline()) return;
      await push();
      await pull();
    } catch {
      // ネットワーク不調などは次トリガで再試行（顧客情報はログに出さない）。
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** outbox を /sync/push で送る。 */
export async function push(): Promise<void> {
  const rows = await db.outbox.orderBy('seq').toArray();
  if (rows.length === 0) return;

  const entries: OutboxEntry[] = rows.map((r) => ({
    seq: r.seq as number,
    table: r.table,
    op: r.op,
    entity: r.entity as { id: string },
  }));
  const events = coalesceOutbox(entries);
  const sync_token = await getSyncToken();

  const res = await api.syncPush({ sync_token, events });

  // 送信済み outbox を削除（push 中に積まれた新規分は seq が大きいので残る）。
  const maxSeq = Math.max(...rows.map((r) => r.seq as number));
  await db.outbox.where('seq').belowOrEqual(maxSeq).delete();

  await applyServerChanges(res.changes as Record<string, StoredEntity[]>);
  await setSyncToken(maxSyncToken(sync_token, res.sync_token));
}

/** /sync/pull で差分を取り込む。 */
export async function pull(): Promise<void> {
  const sync_token = await getSyncToken();
  const res = await api.syncPull(sync_token);
  await applyServerChanges(res.changes as Record<string, StoredEntity[]>);
  await setSyncToken(maxSyncToken(sync_token, res.sync_token));
}

let started = false;

/** オンライン復帰・フォアグラウンド復帰・一定間隔で同期を回す。 */
export function startSyncLoop(intervalMs = 30_000): () => void {
  if (started) return () => undefined;
  started = true;

  const trigger = () => void sync();
  const onVisible = () => {
    if (document.visibilityState === 'visible') trigger();
  };

  window.addEventListener('online', trigger);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(trigger, intervalMs);
  trigger(); // 起動直後に1回。

  return () => {
    started = false;
    window.removeEventListener('online', trigger);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
}
