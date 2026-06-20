/**
 * リポジトリ共通ヘルパ。各ルートはこのヘルパでメタ列(seq/timestamps/soft delete)を
 * 一貫して扱う。行→API表現の変換（boolean/JSON）もここに集約。
 */
import { randomUUID } from 'node:crypto';
import { nextSeq, type DB } from './db.js';

export const nowIso = (): string => new Date().toISOString();
export const newId = (): string => randomUUID();

/** 同期可能テーブル（ソフトデリート対象）。 */
export type SyncTable =
  | 'contacts'
  | 'vehicles'
  | 'notes'
  | 'tasks'
  | 'templates'
  | 'settings';

/** 既存IDの所有権チェック等に使う単純取得（削除済みも含む）。 */
export function getRow<T = Record<string, unknown>>(
  db: DB,
  table: SyncTable,
  id: string,
): T | undefined {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as T | undefined;
}

/** 未削除のみ取得。 */
export function getActiveRow<T = Record<string, unknown>>(
  db: DB,
  table: SyncTable,
  id: string,
): T | undefined {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id) as
    | T
    | undefined;
}

/** ソフトデリート。updated_at と seq を更新して同期で削除を伝播。 */
export function softDelete(db: DB, table: SyncTable, id: string): boolean {
  const res = db
    .prepare(
      `UPDATE ${table} SET deleted_at = ?, updated_at = ?, seq = ?
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .run(nowIso(), nowIso(), nextSeq(db), id);
  return res.changes > 0;
}

/** tasks 行の boolean/型変換。 */
export function mapTaskRow(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, notify: !!row.notify };
}

/** settings 行の boolean/JSON 変換。 */
export function mapSettingRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    notifications_enabled: !!row.notifications_enabled,
    long_session: !!row.long_session,
    calendar_enabled: !!row.calendar_enabled,
    notify_offsets_days: JSON.parse(String(row.notify_offsets_days ?? '[]')),
  };
}
