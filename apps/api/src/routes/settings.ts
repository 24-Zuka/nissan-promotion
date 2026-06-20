/**
 * 設定(Setting) ルート。  [担当: Sub A — CRM_CORE]
 *
 * このルータは /api/v1/settings にマウント済み（パスはこのプレフィックス相対）。
 * 実装する契約:
 *   GET    /        ユーザーの設定を1件返す（mapSettingRow で変換）
 *   PATCH  /        settingUpdateSchema で部分更新。
 *                   notify_offsets_days は JSON 文字列で保存。
 */
import { Router } from 'express';
import { settingUpdateSchema } from '@crm/shared';
import { nextSeq, type DB } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { mapSettingRow, nowIso } from '../repo.js';

interface SettingRow {
  id: string;
  user_id: string;
  [key: string]: unknown;
}

function getSettings(db: DB, userId: string): SettingRow | undefined {
  return db
    .prepare(`SELECT * FROM settings WHERE user_id = ? AND deleted_at IS NULL`)
    .get(userId) as SettingRow | undefined;
}

export function settingsRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);

  // GET / — ユーザーの単一設定行。
  r.get('/', (req: AuthedRequest, res) => {
    const row = getSettings(db, req.userId!);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(mapSettingRow(row));
  });

  // PATCH / — 部分更新。boolean→0/1、offsets は JSON 文字列で保存。
  r.patch('/', (req: AuthedRequest, res) => {
    const existing = getSettings(db, req.userId!);
    if (!existing) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const parsed = settingUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (d.notifications_enabled !== undefined) {
      fields.push('notifications_enabled = ?');
      values.push(d.notifications_enabled ? 1 : 0);
    }
    if (d.notify_offsets_days !== undefined) {
      fields.push('notify_offsets_days = ?');
      values.push(JSON.stringify(d.notify_offsets_days));
    }
    if (d.long_session !== undefined) {
      fields.push('long_session = ?');
      values.push(d.long_session ? 1 : 0);
    }
    if (d.calendar_enabled !== undefined) {
      fields.push('calendar_enabled = ?');
      values.push(d.calendar_enabled ? 1 : 0);
    }
    fields.push('updated_at = ?', 'seq = ?');
    values.push(nowIso(), nextSeq(db), existing.id);
    db.prepare(`UPDATE settings SET ${fields.join(', ')} WHERE id = ?`).run(
      ...(values as never[]),
    );
    res.json(mapSettingRow(getSettings(db, req.userId!)!));
  });

  return r;
}
