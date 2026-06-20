/**
 * テンプレート(Template) CRUD ルート。  [担当: Sub A — CRM_CORE]
 *
 * このルータは /api/v1/templates にマウント済み（パスはこのプレフィックス相対）。
 * 実装する契約:
 *   GET    /?category=maintenance|followup
 *   POST   /            templateCreateSchema
 *   PATCH  /:id         templateUpdateSchema
 *   DELETE /:id         ソフトデリート
 */
import { Router } from 'express';
import type { DB } from '../db.js';
import { requireAuth } from '../auth.js';

export function templatesRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);
  void db;
  r.all('*', (_req, res) => res.status(501).json({ error: 'not_implemented' }));
  return r;
}
