/**
 * 車両(Vehicle) CRUD ルート。  [担当: Sub A — CRM_CORE]
 *
 * このルータは /api/v1/vehicles にマウント済み（パスはこのプレフィックス相対）。
 * 実装する契約:
 *   GET    /?contact_id=<id>     顧客配下の未削除一覧
 *   POST   /                     vehicleCreateSchema で検証 → 作成（contact_id は body）。
 *                                generate_maintenance=true なら
 *                                ../maint.ts の generateAndStoreMaintenance を併せて実行
 *   PATCH  /:id                  vehicleUpdateSchema で部分更新
 *   DELETE /:id                  ソフトデリート
 *
 * 規約: contact の所有者(user_id===req.userId)のみ操作可。中古は shaken_expiry_date 必須。
 */
import { Router } from 'express';
import type { DB } from '../db.js';
import { requireAuth } from '../auth.js';

export function vehiclesRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);
  void db;
  r.all('*', (_req, res) => res.status(501).json({ error: 'not_implemented' }));
  return r;
}
