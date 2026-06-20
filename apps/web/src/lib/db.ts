/**
 * ローカル永続層（Dexie / IndexedDB）。  [Phase 2 — オフライン同期]
 *
 * - エンティティをテーブルごとに id キーで保持（オフライン読み取りの源泉）。
 * - outbox: オフライン中の書き込みを順序付きで貯め、オンライン復帰時に /sync/push で送る。
 * - meta: sync_token などの同期カーソルを保持。
 *
 * 顧客情報を含むため、ログには出さない（ここでは保存のみ／メタ操作のみログ可）。
 */
import Dexie, { type Table } from 'dexie';
import { CLIENT_SYNC_TABLES, type ClientSyncTable, type SyncOp } from '@crm/shared';

export interface StoredEntity {
  id: string;
  deleted_at?: string | null;
  updated_at?: string;
  [k: string]: unknown;
}

export interface OutboxRow {
  /** Dexie 自動採番（= 適用順 seq）。 */
  seq?: number;
  table: ClientSyncTable;
  op: SyncOp;
  entity: StoredEntity;
  created_at: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

class CrmDexie extends Dexie {
  contacts!: Table<StoredEntity, string>;
  vehicles!: Table<StoredEntity, string>;
  notes!: Table<StoredEntity, string>;
  tasks!: Table<StoredEntity, string>;
  templates!: Table<StoredEntity, string>;
  settings!: Table<StoredEntity, string>;
  outbox!: Table<OutboxRow, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('crm');
    this.version(1).stores({
      contacts: 'id, updated_at',
      vehicles: 'id, contact_id, updated_at',
      notes: 'id, contact_id, updated_at',
      tasks: 'id, contact_id, vehicle_id, due_date, status, updated_at',
      templates: 'id, category, updated_at',
      settings: 'id, user_id',
      outbox: '++seq, table',
      meta: 'key',
    });
  }

  entityTable(table: ClientSyncTable): Table<StoredEntity, string> {
    return this[table];
  }
}

export const db = new CrmDexie();

const SYNC_TOKEN_KEY = 'sync_token';

export async function getSyncToken(): Promise<number> {
  const row = await db.meta.get(SYNC_TOKEN_KEY);
  return typeof row?.value === 'number' ? row.value : 0;
}

export async function setSyncToken(value: number): Promise<void> {
  await db.meta.put({ key: SYNC_TOKEN_KEY, value });
}

/** すべてのローカルデータを消す（ログアウト時など）。 */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', [...CLIENT_SYNC_TABLES, 'outbox', 'meta'], async () => {
    for (const t of CLIENT_SYNC_TABLES) await db.entityTable(t).clear();
    await db.outbox.clear();
    await db.meta.clear();
  });
}
