/**
 * 差分同期(Sync) ルート。  [担当: Sub C — SYNC]
 *
 * このルータは /api/v1/sync にマウント済み（パスはこのプレフィックス相対）。
 * 実装する契約:
 *   GET  /pull?sync_token=<n>
 *        - sync_token は「クライアントが受信済みの最大 seq」。0 で全件。
 *        - 全同期テーブル(contacts/vehicles/notes/tasks/templates/settings)から
 *          seq > sync_token の行（削除済み含む）を返す。
 *        - レスポンス: { changes: { [table]: Row[] }, sync_token: <最新の最大seq> }
 *   POST /push
 *        - body: { sync_token, events: [{ table, op:'create'|'update'|'delete', entity }] }
 *        - Last-write-wins（updated_at 比較）。優先度 削除 > 更新 > 作成。
 *        - 反映後の最新 sync_token を返し、サーバ側変更も併せて返してよい。
 *
 * 規約:
 *   - すべて user スコープ（req.userId 経由で所有データのみ）。
 *   - 反映時は nextSeq(db) を採番し、サーバの seq を単調増加に保つ。
 *   - 衝突解決ロジックは純粋関数に切り出し、vitest で単体テスト可能にする。
 */
import { Router } from 'express';
import type { DB } from '../db.js';
import { requireAuth } from '../auth.js';

export function syncRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);
  void db;
  r.all('*', (_req, res) => res.status(501).json({ error: 'not_implemented' }));
  return r;
}
