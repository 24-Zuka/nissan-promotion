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
import type { DB } from '../db.js';
import { requireAuth } from '../auth.js';

export function settingsRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);
  void db;
  r.all('*', (_req, res) => res.status(501).json({ error: 'not_implemented' }));
  return r;
}
