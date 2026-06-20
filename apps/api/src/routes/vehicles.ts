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
import { vehicleCreateSchema, vehicleUpdateSchema } from '@crm/shared';
import { nextSeq, type DB } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { getActiveRow, newId, nowIso, softDelete } from '../repo.js';
import { generateAndStoreMaintenance } from '../maint.js';

interface VehicleRow {
  id: string;
  contact_id: string;
  condition: string;
  registration_date: string | null;
  delivery_date: string | null;
  shaken_expiry_date: string | null;
  inspection_profile: string | null;
  [key: string]: unknown;
}

/** contact が req.userId の所有か。所有していれば true。 */
function ownsContact(db: DB, contactId: string, userId: string): boolean {
  const c = getActiveRow<{ user_id: string }>(db, 'contacts', contactId);
  return !!c && c.user_id === userId;
}

/** 車両を取得し、親 contact の所有者でなければ undefined。 */
function getOwnedVehicle(db: DB, id: string, userId: string): VehicleRow | undefined {
  const v = getActiveRow<VehicleRow>(db, 'vehicles', id);
  if (!v || !ownsContact(db, v.contact_id, userId)) return undefined;
  return v;
}

export function vehiclesRouter(db: DB): Router {
  const r = Router();
  r.use(requireAuth);

  // GET /?contact_id= — 顧客配下の車両一覧。
  r.get('/', (req: AuthedRequest, res) => {
    const contactId = String(req.query.contact_id ?? '');
    if (!contactId || !ownsContact(db, contactId, req.userId!)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const rows = db
      .prepare(
        `SELECT * FROM vehicles
         WHERE contact_id = ? AND deleted_at IS NULL
         ORDER BY updated_at DESC, seq DESC`,
      )
      .all(contactId);
    res.json(rows);
  });

  // POST / — 新規作成。任意でメンテ自動生成。
  r.post('/', (req: AuthedRequest, res) => {
    const parsed = vehicleCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    if (!ownsContact(db, d.contact_id, req.userId!)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const id = newId();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO vehicles
         (id, contact_id, name, model_code, condition, registration_date,
          delivery_date, shaken_expiry_date, inspection_profile, created_at, updated_at, deleted_at, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).run(
      id,
      d.contact_id,
      d.name ?? null,
      d.model_code ?? null,
      d.condition,
      d.registration_date ?? null,
      d.delivery_date ?? null,
      d.shaken_expiry_date ?? null,
      d.inspection_profile ?? 'standard',
      ts,
      ts,
      nextSeq(db),
    );

    if (d.generate_maintenance) {
      const v = getActiveRow<VehicleRow>(db, 'vehicles', id)!;
      generateAndStoreMaintenance(db, {
        id: v.id,
        contact_id: v.contact_id,
        condition: v.condition,
        registration_date: v.registration_date,
        delivery_date: v.delivery_date,
        shaken_expiry_date: v.shaken_expiry_date,
        inspection_profile: v.inspection_profile as string | null,
      });
    }

    res.status(201).json(getActiveRow(db, 'vehicles', id));
  });

  // PATCH /:id — 部分更新。
  r.patch('/:id', (req: AuthedRequest, res) => {
    const existing = getOwnedVehicle(db, req.params.id, req.userId!);
    if (!existing) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const parsed = vehicleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];
    const cols: Array<keyof typeof d> = [
      'name',
      'model_code',
      'condition',
      'registration_date',
      'delivery_date',
      'shaken_expiry_date',
      'inspection_profile',
    ];
    for (const col of cols) {
      if (d[col] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(d[col]);
      }
    }
    fields.push('updated_at = ?', 'seq = ?');
    values.push(nowIso(), nextSeq(db), req.params.id);
    db.prepare(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`).run(...(values as never[]));
    res.json(getActiveRow(db, 'vehicles', req.params.id));
  });

  // DELETE /:id — ソフトデリート。
  r.delete('/:id', (req: AuthedRequest, res) => {
    const existing = getOwnedVehicle(db, req.params.id, req.userId!);
    if (!existing) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    softDelete(db, 'vehicles', req.params.id);
    res.json({ ok: true });
  });

  return r;
}
