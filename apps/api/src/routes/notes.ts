/**
 * メモ(Note) CRUD ルート。  [担当: Sub A — CRM_CORE]
 *
 * このルータは /api/v1/notes にマウント済み（パスはこのプレフィックス相対）。
 * 実装する契約:
 *   GET    /?contact_id=<id>    顧客配下の未削除一覧（date 降順）
 *   POST   /                    noteCreateSchema で検証 → 作成（contact_id は body）。
 *                               body.task があれば同時にタスクも作成
 *                               （時短UI・仕様3.3）。両方をトランザクションで。
 *   PATCH  /:id                 noteUpdateSchema で部分更新
 *   DELETE /:id                 ソフトデリート
 */
import { Router } from 'express';
import { noteCreateSchema, noteUpdateSchema } from '@crm/shared';
import { nextSeq, type DB } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { getActiveRow, newId, nowIso, softDelete } from '../repo.js';

interface NoteRow {
  id: string;
  contact_id: string;
  [key: string]: unknown;
}

function ownsContact(db: DB, contactId: string, userId: string): boolean {
  const c = getActiveRow<{ user_id: string }>(db, 'contacts', contactId);
  return !!c && c.user_id === userId;
}

function getOwnedNote(db: DB, id: string, userId: string): NoteRow | undefined {
  const n = getActiveRow<NoteRow>(db, 'notes', id);
  if (!n || !ownsContact(db, n.contact_id, userId)) return undefined;
  return n;
}

export function notesRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);

  // GET /?contact_id= — 顧客配下のメモ一覧（日付降順）。
  r.get('/', (req: AuthedRequest, res) => {
    const contactId = String(req.query.contact_id ?? '');
    if (!contactId || !ownsContact(db, contactId, req.userId!)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const rows = db
      .prepare(
        `SELECT * FROM notes
         WHERE contact_id = ? AND deleted_at IS NULL
         ORDER BY date DESC, seq DESC`,
      )
      .all(contactId);
    res.json(rows);
  });

  // POST / — メモ作成。task があれば同一トランザクションでタスクも作成。
  r.post('/', (req: AuthedRequest, res) => {
    const parsed = noteCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    if (!ownsContact(db, d.contact_id, req.userId!)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const noteId = newId();
    let taskId: string | null = null;

    const tx = db.transaction(() => {
      const ts = nowIso();
      db.prepare(
        `INSERT INTO notes
           (id, contact_id, date, summary, reaction, next_action,
            created_at, updated_at, deleted_at, seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      ).run(
        noteId,
        d.contact_id,
        d.date,
        d.summary,
        d.reaction ?? null,
        d.next_action ?? null,
        ts,
        ts,
        nextSeq(db),
      );

      if (d.task) {
        taskId = newId();
        const tts = nowIso();
        db.prepare(
          `INSERT INTO tasks
             (id, contact_id, vehicle_id, type, title, detail, due_date, status,
              notify, source, generation_key, created_at, updated_at, deleted_at, seq)
           VALUES (?, ?, NULL, ?, ?, ?, ?, 'open', ?, 'manual', NULL, ?, ?, NULL, ?)`,
        ).run(
          taskId,
          d.contact_id,
          d.task.type,
          d.task.title,
          d.task.detail ?? null,
          d.task.due_date,
          d.task.notify === false ? 0 : 1,
          tts,
          tts,
          nextSeq(db),
        );
      }
    });
    tx();

    const note = getActiveRow(db, 'notes', noteId);
    const task = taskId ? getActiveRow(db, 'tasks', taskId) : null;
    res.status(201).json(task ? { ...(note as object), task } : note);
  });

  // PATCH /:id — 部分更新。
  r.patch('/:id', (req: AuthedRequest, res) => {
    const existing = getOwnedNote(db, req.params.id, req.userId!);
    if (!existing) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const parsed = noteUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];
    const cols: Array<keyof typeof d> = ['date', 'summary', 'reaction', 'next_action'];
    for (const col of cols) {
      if (d[col] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(d[col]);
      }
    }
    fields.push('updated_at = ?', 'seq = ?');
    values.push(nowIso(), nextSeq(db), req.params.id);
    db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...(values as never[]));
    res.json(getActiveRow(db, 'notes', req.params.id));
  });

  // DELETE /:id — ソフトデリート。
  r.delete('/:id', (req: AuthedRequest, res) => {
    const existing = getOwnedNote(db, req.params.id, req.userId!);
    if (!existing) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    softDelete(db, 'notes', req.params.id);
    res.json({ ok: true });
  });

  return r;
}
