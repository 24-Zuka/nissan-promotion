/**
 * SQLite 接続とスキーマ。better-sqlite3（同期API・単一ユーザー向けに十分）。
 * 全テーブルに共通メタ（created_at/updated_at/deleted_at/seq）を持たせ、
 * 差分同期とソフトデリートを全面サポートする。
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS seq_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  value INTEGER NOT NULL
);
INSERT OR IGNORE INTO seq_counter (id, value) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,        -- scrypt(KDF) 由来。平文PINは保存しない。
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  seq INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  rank TEXT NOT NULL,
  family TEXT,
  usage TEXT,
  budget TEXT,
  desired_equipment TEXT,
  rival_car TEXT,
  insurance_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  seq INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  name TEXT,
  model_code TEXT,
  condition TEXT NOT NULL,
  registration_date TEXT,
  delivery_date TEXT,
  shaken_expiry_date TEXT,
  inspection_profile TEXT NOT NULL DEFAULT 'standard',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  seq INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  date TEXT NOT NULL,
  summary TEXT NOT NULL,
  reaction TEXT,
  next_action TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  seq INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  vehicle_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  notify INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'manual',
  generation_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  seq INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  seq INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  notify_offsets_days TEXT NOT NULL DEFAULT '[30,7,1,0]',
  long_session INTEGER NOT NULL DEFAULT 0,
  calendar_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  seq INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS calendar_sync_state (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  calendar_event_id TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id, seq);
CREATE INDEX IF NOT EXISTS idx_vehicles_contact ON vehicles(contact_id, seq);
CREATE INDEX IF NOT EXISTS idx_notes_contact ON notes(contact_id, seq);
CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks(contact_id, seq);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date, status);
CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id, seq);
`;

/** 既存テーブルに列が無ければ追加する（CREATE TABLE IF NOT EXISTS は列追加をしないため）。 */
function ensureColumn(db: DB, table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

/** 後付けカラムのマイグレーション（定数DEFAULTのみ＝SQLiteのADD COLUMN制約に適合）。 */
function migrate(db: DB): void {
  ensureColumn(db, 'vehicles', 'inspection_profile', "inspection_profile TEXT NOT NULL DEFAULT 'standard'");
}

export function openDb(filename: string): DB {
  if (filename !== ':memory:') {
    mkdirSync(dirname(filename), { recursive: true });
  }
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** 全エンティティ共通の単調増加カーソル。書き込みごとに採番し sync_token に使う。 */
export function nextSeq(db: DB): number {
  const row = db
    .prepare('UPDATE seq_counter SET value = value + 1 WHERE id = 1 RETURNING value')
    .get() as { value: number };
  return row.value;
}
