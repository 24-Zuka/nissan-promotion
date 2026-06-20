/**
 * 初期データ投入。海さん用の単一ユーザーと既定設定を冪等に用意する。
 * 初期PINは 1206（仕様0）。ただし保存は scrypt ハッシュ（平文禁止・仕様9章）。
 */
import { nextSeq, type DB } from './db.js';
import { hashPin } from './auth.js';
import { newId, nowIso } from './repo.js';

const DEFAULT_USERNAME = 'kai';
const DEFAULT_PIN = '1206';

export function seed(db: DB): string {
  const existing = db
    .prepare(`SELECT id FROM users WHERE username = ?`)
    .get(DEFAULT_USERNAME) as { id: string } | undefined;
  if (existing) return existing.id;

  const userId = newId();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO users (id, username, pin_hash, created_at, updated_at, deleted_at, seq)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
  ).run(userId, DEFAULT_USERNAME, hashPin(DEFAULT_PIN), ts, ts, nextSeq(db));

  db.prepare(
    `INSERT INTO settings
       (id, user_id, notifications_enabled, notify_offsets_days, long_session, calendar_enabled, created_at, updated_at, deleted_at, seq)
     VALUES (?, ?, 1, '[30,7,1,0]', 0, 0, ?, ?, NULL, ?)`,
  ).run(newId(), userId, ts, ts, nextSeq(db));

  return userId;
}
