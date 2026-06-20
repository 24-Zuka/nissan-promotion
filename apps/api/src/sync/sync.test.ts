/**
 * 差分同期 統合テスト。  [担当: Sub C — SYNC]
 *
 * in-memory DB + seed + createApp + login(kai/1206) で実APIを叩く。
 * 並行実装中の contacts ルートに依存しないよう、顧客は SQL で直接投入する。
 * 流れ: pull(0) で顧客が出る → 同トークンで再pull は空 → 新しい update を push して反映
 *       → 古い(stale) update を push して skip → delete を push して soft-delete を確認。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { openDb, nextSeq, type DB } from '../db.js';
import { seed } from '../seed.js';
import { createApp } from '../server.js';
import { newId, nowIso } from '../repo.js';

const BASE = '/api/v1';

describe('Sync integration', () => {
  let db: DB;
  let app: Express;
  let token: string;
  let userId: string;
  let contactId: string;
  let contactUpdatedAt: string;

  beforeAll(async () => {
    db = openDb(':memory:');
    userId = seed(db);
    app = createApp(db);

    // 並行実装中の contacts ルートに依存しないよう SQL で直接投入。
    contactId = newId();
    contactUpdatedAt = nowIso();
    db.prepare(
      `INSERT INTO contacts
         (id, user_id, name, phone, email, rank, family, usage, budget,
          desired_equipment, rival_car, insurance_status,
          created_at, updated_at, deleted_at, seq)
       VALUES (?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, NULL, ?)`,
    ).run(contactId, userId, '山田太郎', 'A', contactUpdatedAt, contactUpdatedAt, nextSeq(db));

    const login = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ username: 'kai', pin: '1206' });
    expect(login.status).toBe(200);
    token = login.body.access_token as string;
    expect(token).toBeTruthy();
  });

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  let syncToken = 0;

  it('pull(0) returns the contact and a sync_token', async () => {
    const res = await auth(request(app).get(`${BASE}/sync/pull`).query({ sync_token: 0 }));
    expect(res.status).toBe(200);
    const ids = (res.body.changes.contacts as Array<{ id: string }>).map((c) => c.id);
    expect(ids).toContain(contactId);
    expect(typeof res.body.sync_token).toBe('number');
    expect(res.body.sync_token).toBeGreaterThan(0);
    syncToken = res.body.sync_token;
  });

  it('pull with latest token returns no changes', async () => {
    const res = await auth(
      request(app).get(`${BASE}/sync/pull`).query({ sync_token: syncToken }),
    );
    expect(res.status).toBe(200);
    expect(res.body.changes.contacts).toHaveLength(0);
    expect(res.body.sync_token).toBe(syncToken);
  });

  it('applies a newer update event', async () => {
    const newer = new Date(Date.now() + 60_000).toISOString();
    const res = await auth(
      request(app)
        .post(`${BASE}/sync/push`)
        .send({
          sync_token: syncToken,
          events: [
            {
              table: 'contacts',
              op: 'update',
              entity: { id: contactId, name: '山田改', updated_at: newer },
            },
          ],
        }),
    );
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(1);
    expect(res.body.rejected).toHaveLength(0);

    const changed = (res.body.changes.contacts as Array<{ id: string; name: string }>).find(
      (c) => c.id === contactId,
    );
    expect(changed?.name).toBe('山田改');
    expect(res.body.sync_token).toBeGreaterThan(syncToken);
    syncToken = res.body.sync_token;
    contactUpdatedAt = newer;
  });

  it('skips a stale update event', async () => {
    const stale = '2000-01-01T00:00:00.000Z';
    const res = await auth(
      request(app)
        .post(`${BASE}/sync/push`)
        .send({
          sync_token: syncToken,
          events: [
            {
              table: 'contacts',
              op: 'update',
              entity: { id: contactId, name: 'STALE', updated_at: stale },
            },
          ],
        }),
    );
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(0);
    expect(res.body.rejected).toHaveLength(1);
    expect(res.body.rejected[0].reason).toBe('conflict_skipped');

    // 名前は変わっていない（新トークン以降の変更も無い）。
    const verify = await auth(
      request(app).get(`${BASE}/sync/pull`).query({ sync_token: syncToken }),
    );
    expect(verify.body.changes.contacts).toHaveLength(0);
  });

  it('propagates a soft-delete on next pull', async () => {
    const pushed = await auth(
      request(app)
        .post(`${BASE}/sync/push`)
        .send({
          sync_token: syncToken,
          events: [
            {
              table: 'contacts',
              op: 'delete',
              entity: { id: contactId, updated_at: new Date(Date.now() + 120_000).toISOString() },
            },
          ],
        }),
    );
    expect(pushed.status).toBe(200);
    expect(pushed.body.applied).toBe(1);

    const res = await auth(
      request(app).get(`${BASE}/sync/pull`).query({ sync_token: syncToken }),
    );
    const row = (res.body.changes.contacts as Array<{ id: string; deleted_at: string | null }>).find(
      (c) => c.id === contactId,
    );
    expect(row).toBeTruthy();
    expect(row?.deleted_at).toBeTruthy();
  });

  it('requires auth', async () => {
    const res = await request(app).get(`${BASE}/sync/pull`).query({ sync_token: 0 });
    expect(res.status).toBe(401);
  });
});
