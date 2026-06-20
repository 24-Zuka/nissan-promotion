/**
 * メモ(Note) CRUD ルート。  [担当: Sub A — CRM_CORE]
 *
 * このルータは /api/v1/notes にマウント済み（パスはこのプレフィックス相対）。
 * 実装する契約:
 *   GET    /?contact_id=<id>    顧客配下の未削除一覧（date 降順）
 *   POST   /                    noteCreateSchema で検証 → 作成（contact_id は body）。
 *                               body.task があれば同時にタスクも作成
 *                               （時短UI・仕様3.3）。両方をトランザクションで。
 *   PATCH  /:id                 noteUpdateSchema で部分更新
 *   DELETE /:id                 ソフトデリート
 */
import { Router } from 'express';
import type { DB } from '../db.js';
import { requireAuth } from '../auth.js';

export function notesRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);
  void db;
  r.all('*', (_req, res) => res.status(501).json({ error: 'not_implemented' }));
  return r;
}
