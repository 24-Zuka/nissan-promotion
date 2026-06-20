/**
 * 認証。PINは scrypt(KDF) でハッシュ化して保存（平文禁止・仕様9章）。
 * アクセストークン(JWT, 短命) ＋ リフレッシュトークン(DBにハッシュ保存)。
 */
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { DB } from './db.js';

const ACCESS_TTL = '30m';
const REFRESH_TTL_DAYS = 30;
const SCRYPT_KEYLEN = 64;

function jwtSecret(): string {
  return process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me';
}

/** PIN を scrypt でハッシュ化。形式: scrypt$<saltHex>$<hashHex> */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = scryptSync(pin, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export interface AccessClaims {
  sub: string; // user_id
  username: string;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, jwtSecret(), { expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, jwtSecret()) as AccessClaims;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** リフレッシュトークンを発行し、ハッシュをDBに保存。 */
export function issueRefreshToken(db: DB, userId: string): string {
  const token = randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + REFRESH_TTL_DAYS * 86_400_000);
  db.prepare(
    `INSERT INTO auth_tokens (id, user_id, refresh_token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(randomUUID(), userId, hashToken(token), expires.toISOString(), now.toISOString());
  return token;
}

/** リフレッシュトークンを検証（未失効・未期限切れ）。userId を返す。 */
export function consumeRefreshToken(db: DB, token: string): string | null {
  const row = db
    .prepare(
      `SELECT id, user_id, expires_at, revoked_at FROM auth_tokens WHERE refresh_token_hash = ?`,
    )
    .get(hashToken(token)) as
    | { id: string; user_id: string; expires_at: string; revoked_at: string | null }
    | undefined;
  if (!row || row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.user_id;
}

export function revokeRefreshToken(db: DB, token: string): void {
  db.prepare(`UPDATE auth_tokens SET revoked_at = ? WHERE refresh_token_hash = ?`).run(
    new Date().toISOString(),
    hashToken(token),
  );
}

/** Express ミドルウェア：Authorization: Bearer を検証し req.userId を設定。 */
export interface AuthedRequest extends Request {
  userId?: string;
  username?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    const claims = verifyAccessToken(token);
    req.userId = claims.sub;
    req.username = claims.username;
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}
