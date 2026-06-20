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
import type { DB } from '../db.js';
import { requireAuth } from '../auth.js';

export function contactsRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);
  void db;
  r.all('*', (_req, res) => res.status(501).json({ error: 'not_implemented' }));
  return r;
}
