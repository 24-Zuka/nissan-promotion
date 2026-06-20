/**
 * 認証ルート。PINログイン → アクセス/リフレッシュトークン発行。
 */
import { Router } from 'express';
import { loginSchema } from '@crm/shared';
import type { DB } from '../db.js';
import {
  consumeRefreshToken,
  issueRefreshToken,
  revokeRefreshToken,
  signAccessToken,
  verifyPin,
} from '../auth.js';

export function authRouter(db: DB): Router {
  const r = Router();

  // POST /api/v1/auth/login
  r.post('/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const { username, pin } = parsed.data;
    const user = db
      .prepare(`SELECT id, username, pin_hash FROM users WHERE username = ? AND deleted_at IS NULL`)
      .get(username) as { id: string; username: string; pin_hash: string } | undefined;

    // ログには顧客/認証情報を残さない（仕様9章）。失敗理由も区別しない。
    if (!user || !verifyPin(pin, user.pin_hash)) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    const access_token = signAccessToken({ sub: user.id, username: user.username });
    const refresh_token = issueRefreshToken(db, user.id);
    res.json({
      access_token,
      refresh_token,
      user_profile: { id: user.id, username: user.username },
    });
  });

  // POST /api/v1/auth/refresh
  r.post('/refresh', (req, res) => {
    const token = String(req.body?.refresh_token ?? '');
    const userId = token ? consumeRefreshToken(db, token) : null;
    if (!userId) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    const user = db.prepare(`SELECT id, username FROM users WHERE id = ?`).get(userId) as
      | { id: string; username: string }
      | undefined;
    if (!user) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    res.json({ access_token: signAccessToken({ sub: user.id, username: user.username }) });
  });

  // POST /api/v1/auth/logout
  r.post('/logout', (req, res) => {
    const token = String(req.body?.refresh_token ?? '');
    if (token) revokeRefreshToken(db, token);
    res.json({ ok: true });
  });

  return r;
}
