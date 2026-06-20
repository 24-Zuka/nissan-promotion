/**
 * クライアント差分同期の純ロジック（IO非依存）。
 *
 * Web 側(Dexie)とサーバ /sync は別実装だが、ここに「アウトボックス→イベント変換」と
 * 「サーバからの changes をローカルへ適用する reducer」を集約し、shared の vitest で固める。
 * これにより端末間同期の中核ロジックをブラウザ無しで検証できる。
 *
 * サーバ契約（apps/api/src/sync/index.ts）:
 *   pull → { changes: Record<table, Entity[]>, sync_token }
 *   push → { applied, rejected, changes, sync_token }
 * 衝突解決はサーバ側（LWW, 優先度 削除>更新>作成）。クライアントは素直に反映する。
 */

export type SyncOp = 'create' | 'update' | 'delete';

/** 同期対象テーブル（サーバの SYNC_TABLES と一致）。 */
export const CLIENT_SYNC_TABLES = [
  'contacts',
  'vehicles',
  'notes',
  'tasks',
  'templates',
  'settings',
] as const;
export type ClientSyncTable = (typeof CLIENT_SYNC_TABLES)[number];

/** ローカルで発生した変更（アウトボックス1件）。 */
export interface OutboxEntry {
  /** ローカル採番の連番（適用順）。 */
  seq: number;
  table: ClientSyncTable;
  op: SyncOp;
  /** 少なくとも id を含むエンティティ。create/update は変更後の全/部分フィールド。 */
  entity: { id: string; [k: string]: unknown };
}

/** push に送る1イベント。 */
export interface SyncEvent {
  table: ClientSyncTable;
  op: SyncOp;
  entity: { id: string; [k: string]: unknown };
}

/**
 * 同一 (table,id) の複数アウトボックスを1イベントに畳み込む。
 * - 連続する create/update はフィールドをマージして 'update'（既存なら update 扱いでも可、
 *   サーバは create を update に自然に畳み込む）。最初が create なら 'create' を維持。
 * - 途中/末尾に delete があれば最終的に 'delete'（中間の編集は無意味）。
 * 出力は元の出現順（最小 seq）を保つ。
 */
export function coalesceOutbox(entries: OutboxEntry[]): SyncEvent[] {
  const order: string[] = [];
  const byKey = new Map<string, { firstSeq: number; op: SyncOp; entity: Record<string, unknown> }>();

  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  for (const e of sorted) {
    const key = `${e.table}:${e.entity.id}`;
    let cur = byKey.get(key);
    if (!cur) {
      cur = { firstSeq: e.seq, op: e.op, entity: {} };
      byKey.set(key, cur);
      order.push(key);
    }
    if (e.op === 'delete') {
      cur.op = 'delete';
      cur.entity = { id: e.entity.id };
    } else {
      // create/update: フィールドをマージ。create が先行していれば create を維持。
      cur.entity = { ...cur.entity, ...e.entity };
      if (cur.op !== 'create') cur.op = e.op === 'create' ? 'create' : 'update';
    }
  }

  return order.map((key) => {
    const { op, entity } = byKey.get(key)!;
    const [table] = key.split(':') as [ClientSyncTable];
    return { table, op, entity: entity as { id: string } };
  });
}

/** changes 1件をローカルコレクション(Map id→entity)へ適用。deleted_at 付きは削除。 */
export function applyEntity<T extends { id: string; deleted_at?: string | null }>(
  map: Map<string, T>,
  entity: T,
): void {
  if (entity.deleted_at) {
    map.delete(entity.id);
  } else {
    map.set(entity.id, entity);
  }
}

/** サーバ changes をテーブルごとにローカルへ適用する（純粋・新しい Map を返す）。 */
export function applyChanges<T extends { id: string; deleted_at?: string | null }>(
  current: Record<string, T[]>,
  changes: Partial<Record<ClientSyncTable, T[]>>,
): Record<string, T[]> {
  const next: Record<string, T[]> = {};
  for (const table of CLIENT_SYNC_TABLES) {
    const map = new Map<string, T>((current[table] ?? []).map((e) => [e.id, e]));
    for (const entity of changes[table] ?? []) applyEntity(map, entity);
    next[table] = [...map.values()];
  }
  return next;
}

/** sync_token は単調増加。受信トークンと現在値の大きい方を採用。 */
export function maxSyncToken(current: number, incoming: number): number {
  return Math.max(current | 0, incoming | 0);
}
