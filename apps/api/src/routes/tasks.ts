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
import {
  isMaintenanceTaskType,
  taskCreateSchema,
  taskUpdateSchema,
  type TaskType,
} from '@crm/shared';
import { nextSeq, type DB } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { getActiveRow, mapTaskRow, newId, nowIso, softDelete } from '../repo.js';

interface TaskRow {
  id: string;
  contact_id: string;
  vehicle_id: string | null;
  type: string;
  [key: string]: unknown;
}

function ownsContact(db: DB, contactId: string, userId: string): boolean {
  const c = getActiveRow<{ user_id: string }>(db, 'contacts', contactId);
  return !!c && c.user_id === userId;
}

function getOwnedTask(db: DB, id: string, userId: string): TaskRow | undefined {
  const t = getActiveRow<TaskRow>(db, 'tasks', id);
  if (!t || !ownsContact(db, t.contact_id, userId)) return undefined;
  return t;
}

export function tasksRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);

  // GET / — フィルタ付き一覧。contacts と JOIN して所有スコープ・rank 絞り込み・表示名を付与。
  r.get('/', (req: AuthedRequest, res) => {
    const where: string[] = ['t.deleted_at IS NULL', 'c.deleted_at IS NULL', 'c.user_id = ?'];
    const params: unknown[] = [req.userId];

    const status = req.query.status ? String(req.query.status) : null;
    if (status) {
      where.push('t.status = ?');
      params.push(status);
    }
    const dueFrom = req.query.due_from ? String(req.query.due_from) : null;
    if (dueFrom) {
      where.push('t.due_date >= ?');
      params.push(dueFrom);
    }
    const dueTo = req.query.due_to ? String(req.query.due_to) : null;
    if (dueTo) {
      where.push('t.due_date <= ?');
      params.push(dueTo);
    }
    const rank = req.query.rank ? String(req.query.rank) : null;
    if (rank) {
      where.push('c.rank = ?');
      params.push(rank);
    }
    const contactId = req.query.contact_id ? String(req.query.contact_id) : null;
    if (contactId) {
      where.push('t.contact_id = ?');
      params.push(contactId);
    }

    const rows = db
      .prepare(
        `SELECT t.*, c.name AS contact_name, c.rank AS contact_rank
         FROM tasks t
         JOIN contacts c ON c.id = t.contact_id
         WHERE ${where.join(' AND ')}
         ORDER BY t.due_date ASC, t.seq ASC`,
      )
      .all(...(params as never[])) as Record<string, unknown>[];
    res.json(rows.map(mapTaskRow));
  });

  // POST / — タスク作成。メンテ種別は vehicle_id 必須。
  r.post('/', (req: AuthedRequest, res) => {
    const parsed = taskCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    if (!ownsContact(db, d.contact_id, req.userId!)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (isMaintenanceTaskType(d.type as TaskType) && !d.vehicle_id) {
      res
        .status(400)
        .json({ error: 'validation', issues: [{ path: ['vehicle_id'], message: 'メンテ種別は車両が必須です' }] });
      return;
    }
    // vehicle_id があれば、その車両も同じ顧客所有であることを確認。
    if (d.vehicle_id) {
      const v = getActiveRow<{ contact_id: string }>(db, 'vehicles', d.vehicle_id);
      if (!v || v.contact_id !== d.contact_id) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
    }

    const id = newId();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO tasks
         (id, contact_id, vehicle_id, type, title, detail, due_date, status,
          notify, source, generation_key, created_at, updated_at, deleted_at, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, 'manual', NULL, ?, ?, NULL, ?)`,
    ).run(
      id,
      d.contact_id,
      d.vehicle_id ?? null,
      d.type,
      d.title,
      d.detail ?? null,
      d.due_date,
      d.notify === false ? 0 : 1,
      ts,
      ts,
      nextSeq(db),
    );
    res.status(201).json(mapTaskRow(getActiveRow(db, 'tasks', id) as Record<string, unknown>));
  });

  // PATCH /:id — 部分更新（status 変更でワンタップ完了）。
  r.patch('/:id', (req: AuthedRequest, res) => {
    const existing = getOwnedTask(db, req.params.id, req.userId!);
    if (!existing) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const parsed = taskUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;

    // 更新後の種別/車両で、メンテ種別なら vehicle_id 必須を担保。
    const nextType = (d.type ?? existing.type) as TaskType;
    const nextVehicleId =
      d.vehicle_id !== undefined ? d.vehicle_id : (existing.vehicle_id as string | null);
    if (isMaintenanceTaskType(nextType) && !nextVehicleId) {
      res
        .status(400)
        .json({ error: 'validation', issues: [{ path: ['vehicle_id'], message: 'メンテ種別は車両が必須です' }] });
      return;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (d.vehicle_id !== undefined) {
      fields.push('vehicle_id = ?');
      values.push(d.vehicle_id);
    }
    if (d.type !== undefined) {
      fields.push('type = ?');
      values.push(d.type);
    }
    if (d.title !== undefined) {
      fields.push('title = ?');
      values.push(d.title);
    }
    if (d.detail !== undefined) {
      fields.push('detail = ?');
      values.push(d.detail);
    }
    if (d.due_date !== undefined) {
      fields.push('due_date = ?');
      values.push(d.due_date);
    }
    if (d.status !== undefined) {
      fields.push('status = ?');
      values.push(d.status);
    }
    if (d.notify !== undefined) {
      fields.push('notify = ?');
      values.push(d.notify ? 1 : 0);
    }
    fields.push('updated_at = ?', 'seq = ?');
    values.push(nowIso(), nextSeq(db), req.params.id);
    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...(values as never[]));
    res.json(mapTaskRow(getActiveRow(db, 'tasks', req.params.id) as Record<string, unknown>));
  });

  // DELETE /:id — ソフトデリート。
  r.delete('/:id', (req: AuthedRequest, res) => {
    const existing = getOwnedTask(db, req.params.id, req.userId!);
    if (!existing) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    softDelete(db, 'tasks', req.params.id);
    res.json({ ok: true });
  });

  return r;
}
