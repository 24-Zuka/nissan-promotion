/**
 * タスク(Task) CRUD ルート。  [担当: Sub A — CRM_CORE]
 *
 * このルータは /api/v1/tasks にマウント済み（パスはこのプレフィックス相対）。
 * 実装する契約:
 *   GET    /?status=&due_from=&due_to=&rank=&contact_id=
 *            - status: open|done|hold、rank: 顧客ランクで絞り込み（contacts 結合）
 *            - レスポンスには表示用に contact 名/ランクを含めると web が楽（任意）
 *   POST   /              taskCreateSchema。メンテ種別は vehicle_id 必須
 *                         (isMaintenanceTaskType で判定)、source='manual'
 *   PATCH  /:id           taskUpdateSchema（status 変更=ホームのワンタップ完了）
 *   DELETE /:id           ソフトデリート
 *
 * 規約: notify は INTEGER(0/1)。mapTaskRow で boolean に変換して返す。
 */
import { Router } from 'express';
import type { DB } from '../db.js';
import { requireAuth } from '../auth.js';

export function tasksRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);
  void db;
  r.all('*', (_req, res) => res.status(501).json({ error: 'not_implemented' }));
  return r;
}
