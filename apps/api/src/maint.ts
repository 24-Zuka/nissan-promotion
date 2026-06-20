/**
 * メンテ生成のDB橋渡し。shared の純ロジック(Sub B)を使い、生成タスクを永続化する。
 * 再生成は mergeGeneratedTasks で手動・着手済みを保護（仕様5・「手動修正を消さない」）。
 */
import {
  generateMaintenanceTasksForNewCar,
  generateMaintenanceTasksForUsedCar,
  mergeGeneratedTasks,
  type ExistingTaskLike,
  type GeneratedTaskSpec,
} from '@crm/shared';
import { nextSeq, type DB } from './db.js';
import { newId, nowIso } from './repo.js';

interface VehicleForGen {
  id: string;
  contact_id: string;
  condition: string;
  registration_date: string | null;
  delivery_date: string | null;
  shaken_expiry_date: string | null;
}

function specsFor(vehicle: VehicleForGen): GeneratedTaskSpec[] {
  if (vehicle.condition === 'used') {
    if (!vehicle.shaken_expiry_date) return [];
    return generateMaintenanceTasksForUsedCar(vehicle.id, vehicle.shaken_expiry_date);
  }
  const start = vehicle.delivery_date ?? vehicle.registration_date;
  if (!start) return [];
  return generateMaintenanceTasksForNewCar(vehicle.id, start);
}

/**
 * 車両のメンテタスクを生成し、既存と差分マージして永続化する。
 * @returns 新規作成したタスク数
 */
export function generateAndStoreMaintenance(db: DB, vehicle: VehicleForGen): number {
  const specs = specsFor(vehicle);
  if (specs.length === 0) return 0;

  const existing = db
    .prepare(
      `SELECT id, type, due_date, status, source, generation_key
       FROM tasks WHERE vehicle_id = ? AND deleted_at IS NULL`,
    )
    .all(vehicle.id) as ExistingTaskLike[];

  const plan = mergeGeneratedTasks(existing, specs);

  const insert = db.prepare(
    `INSERT INTO tasks
       (id, contact_id, vehicle_id, type, title, detail, due_date, status, notify, source, generation_key, created_at, updated_at, deleted_at, seq)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 1, 'auto', ?, ?, ?, NULL, ?)`,
  );
  const del = db.prepare(
    `UPDATE tasks SET deleted_at = ?, updated_at = ?, seq = ? WHERE id = ?`,
  );

  const tx = db.transaction(() => {
    for (const id of plan.toDeleteIds) {
      del.run(nowIso(), nowIso(), nextSeq(db), id);
    }
    for (const spec of plan.toCreate) {
      insert.run(
        newId(),
        vehicle.contact_id,
        vehicle.id,
        spec.type,
        spec.title,
        null,
        spec.due_date,
        spec.generation_key,
        nowIso(),
        nowIso(),
        nextSeq(db),
      );
    }
  });
  tx();
  return plan.toCreate.length;
}
