/**
 * CRM CRUD 統合テスト。  [担当: Sub A — CRM_CORE]
 *
 * in-memory DB を立て、seed → createApp → login（Bearer）で実APIを叩く一連の流れを検証する。
 * 顧客作成 → 車両作成（メンテ自動生成）→ タスク一覧でメンテ確認 → メモ＋埋め込みタスク作成
 * → status/rank フィルタ → タスク完了(PATCH) → 顧客ソフトデリート。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { openDb, type DB } from '../db.js';
import { seed } from '../seed.js';
import { createApp } from '../server.js';

const BASE = '/api/v1';

describe('CRM CRUD integration', () => {
  let db: DB;
  let app: Express;
  let token: string;

  beforeAll(async () => {
    db = openDb(':memory:');
    seed(db);
    app = createApp(db);

    const login = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ username: 'kai', pin: '1206' });
    expect(login.status).toBe(200);
    expect(login.body.access_token).toBeTruthy();
    token = login.body.access_token;
  });

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  it('runs the full CRM flow', async () => {
    // --- 顧客作成 ---
    const contactRes = await auth(
      request(app).post(`${BASE}/contacts`).send({ name: '山田太郎', rank: 'A', phone: '090-0000-0000' }),
    );
    expect(contactRes.status).toBe(201);
    const contactId = contactRes.body.id as string;
    expect(contactId).toBeTruthy();

    // --- 車両作成（新車・メンテ自動生成） ---
    const vehicleRes = await auth(
      request(app).post(`${BASE}/vehicles`).send({
        contact_id: contactId,
        name: 'ノート',
        condition: 'new',
        delivery_date: '2026-01-15',
        generate_maintenance: true,
      }),
    );
    expect(vehicleRes.status).toBe(201);
    const vehicleId = vehicleRes.body.id as string;
    expect(vehicleId).toBeTruthy();

    // --- メンテタスクが生成されたことを GET /tasks で確認 ---
    const afterGen = await auth(request(app).get(`${BASE}/tasks`).query({ contact_id: contactId }));
    expect(afterGen.status).toBe(200);
    const autoTasks = (afterGen.body as Array<{ source: string; vehicle_id: string }>).filter(
      (t) => t.source === 'auto',
    );
    expect(autoTasks.length).toBeGreaterThan(0);
    expect(autoTasks.every((t) => t.vehicle_id === vehicleId)).toBe(true);
    // notify は boolean に変換されている。
    expect(typeof (afterGen.body[0] as { notify: unknown }).notify).toBe('boolean');
    // contact 名/ランクが付与されている。
    expect((afterGen.body[0] as { contact_name: string }).contact_name).toBe('山田太郎');
    expect((afterGen.body[0] as { contact_rank: string }).contact_rank).toBe('A');

    // --- メモ＋埋め込みタスク作成 ---
    const noteRes = await auth(
      request(app).post(`${BASE}/notes`).send({
        contact_id: contactId,
        date: '2026-06-20',
        summary: '来店、試乗を希望',
        task: {
          type: 'propose_testdrive',
          title: '試乗の日程調整',
          due_date: '2026-06-25',
        },
      }),
    );
    expect(noteRes.status).toBe(201);
    expect(noteRes.body.task).toBeTruthy();
    const embeddedTaskId = noteRes.body.task.id as string;
    expect(noteRes.body.task.contact_id).toBe(contactId);
    expect(noteRes.body.task.source).toBe('manual');

    // --- status=open & rank=A フィルタ ---
    const filtered = await auth(
      request(app).get(`${BASE}/tasks`).query({ status: 'open', rank: 'A' }),
    );
    expect(filtered.status).toBe(200);
    const ids = (filtered.body as Array<{ id: string; status: string; contact_rank: string }>).map(
      (t) => t.id,
    );
    expect(ids).toContain(embeddedTaskId);
    expect(
      (filtered.body as Array<{ status: string }>).every((t) => t.status === 'open'),
    ).toBe(true);
    expect(
      (filtered.body as Array<{ contact_rank: string }>).every((t) => t.contact_rank === 'A'),
    ).toBe(true);

    // rank=B では出てこない。
    const otherRank = await auth(request(app).get(`${BASE}/tasks`).query({ rank: 'B' }));
    expect(otherRank.status).toBe(200);
    expect((otherRank.body as Array<{ id: string }>).map((t) => t.id)).not.toContain(
      embeddedTaskId,
    );

    // --- タスク完了（ワンタップ完了） ---
    const patched = await auth(
      request(app).patch(`${BASE}/tasks/${embeddedTaskId}`).send({ status: 'done' }),
    );
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe('done');

    const doneList = await auth(request(app).get(`${BASE}/tasks`).query({ status: 'done' }));
    expect((doneList.body as Array<{ id: string }>).map((t) => t.id)).toContain(embeddedTaskId);

    // --- 顧客ソフトデリート ---
    const del = await auth(request(app).delete(`${BASE}/contacts/${contactId}`));
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    // 削除後は 404。
    const afterDel = await auth(request(app).get(`${BASE}/contacts/${contactId}`));
    expect(afterDel.status).toBe(404);

    // 一覧にも出てこない。
    const list = await auth(request(app).get(`${BASE}/contacts`));
    expect((list.body as Array<{ id: string }>).map((c) => c.id)).not.toContain(contactId);
  });

  it('rejects maintenance task type without vehicle_id', async () => {
    const c = await auth(
      request(app).post(`${BASE}/contacts`).send({ name: '佐藤花子', rank: 'C' }),
    );
    const res = await auth(
      request(app).post(`${BASE}/tasks`).send({
        contact_id: c.body.id,
        type: 'shaken',
        title: '車検',
        due_date: '2026-12-01',
      }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
  });

  it('returns and updates settings', async () => {
    const get = await auth(request(app).get(`${BASE}/settings`));
    expect(get.status).toBe(200);
    expect(Array.isArray(get.body.notify_offsets_days)).toBe(true);
    expect(typeof get.body.notifications_enabled).toBe('boolean');

    const patch = await auth(
      request(app)
        .patch(`${BASE}/settings`)
        .send({ notifications_enabled: false, notify_offsets_days: [14, 1] }),
    );
    expect(patch.status).toBe(200);
    expect(patch.body.notifications_enabled).toBe(false);
    expect(patch.body.notify_offsets_days).toEqual([14, 1]);
  });

  it('requires auth', async () => {
    const res = await request(app).get(`${BASE}/contacts`);
    expect(res.status).toBe(401);
  });
});
