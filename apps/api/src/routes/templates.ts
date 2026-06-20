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
import { templateCreateSchema, templateUpdateSchema } from '@crm/shared';
import { nextSeq, type DB } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { getActiveRow, newId, nowIso, softDelete } from '../repo.js';

interface TemplateRow {
  id: string;
  user_id: string;
  [key: string]: unknown;
}

function getOwnedTemplate(db: DB, id: string, userId: string): TemplateRow | undefined {
  const row = getActiveRow<TemplateRow>(db, 'templates', id);
  if (!row || row.user_id !== userId) return undefined;
  return row;
}

export function templatesRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);

  // GET /?category= — 自分のテンプレート一覧（任意でカテゴリ絞り込み）。
  r.get('/', (req: AuthedRequest, res) => {
    const category = req.query.category ? String(req.query.category) : null;
    const rows = category
      ? db
          .prepare(
            `SELECT * FROM templates
             WHERE user_id = ? AND category = ? AND deleted_at IS NULL
             ORDER BY updated_at DESC, seq DESC`,
          )
          .all(req.userId, category)
      : db
          .prepare(
            `SELECT * FROM templates
             WHERE user_id = ? AND deleted_at IS NULL
             ORDER BY updated_at DESC, seq DESC`,
          )
          .all(req.userId);
    res.json(rows);
  });

  // POST / — 新規作成。
  r.post('/', (req: AuthedRequest, res) => {
    const parsed = templateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    const id = newId();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO templates
         (id, user_id, category, name, body, created_at, updated_at, deleted_at, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).run(id, req.userId, d.category, d.name, d.body, ts, ts, nextSeq(db));
    res.status(201).json(getActiveRow(db, 'templates', id));
  });

  // PATCH /:id — 部分更新。
  r.patch('/:id', (req: AuthedRequest, res) => {
    const existing = getOwnedTemplate(db, req.params.id, req.userId!);
    if (!existing) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const parsed = templateUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];
    const cols: Array<keyof typeof d> = ['category', 'name', 'body'];
    for (const col of cols) {
      if (d[col] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(d[col]);
      }
    }
    fields.push('updated_at = ?', 'seq = ?');
    values.push(nowIso(), nextSeq(db), req.params.id);
    db.prepare(`UPDATE templates SET ${fields.join(', ')} WHERE id = ?`).run(
      ...(values as never[]),
    );
    res.json(getActiveRow(db, 'templates', req.params.id));
  });

  // DELETE /:id — ソフトデリート。
  r.delete('/:id', (req: AuthedRequest, res) => {
    const existing = getOwnedTemplate(db, req.params.id, req.userId!);
    if (!existing) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    softDelete(db, 'templates', req.params.id);
    res.json({ ok: true });
  });

  return r;
}
