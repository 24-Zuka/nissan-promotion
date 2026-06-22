import { z } from 'zod';
import {
  INSPECTION_PROFILES,
  RANKS,
  TASK_STATUSES,
  TASK_TYPE,
  TEMPLATE_CATEGORIES,
  VEHICLE_CONDITIONS,
} from './domain.js';

const isoString = z.string().min(1);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const taskTypes = Object.values(TASK_TYPE) as [string, ...string[]];

const baseEntitySchema = z
  .object({
    id: z.string().min(1),
    created_at: isoString,
    updated_at: isoString,
    deleted_at: isoString.nullable(),
    seq: z.number().int().nonnegative(),
  })
  .passthrough();

const contactBackupSchema = baseEntitySchema.extend({
  user_id: z.string(),
  name: z.string().min(1),
  phone: z.string().nullable(),
  // 既存データを失わないため、バックアップ復元では形式より構造を検証する。
  // 新規・編集時のメール形式は contactCreateSchema 側で保証する。
  email: z.string().nullable(),
  rank: z.enum(RANKS),
  family: z.string().nullable(),
  usage: z.string().nullable(),
  budget: z.string().nullable(),
  desired_equipment: z.string().nullable(),
  rival_car: z.string().nullable(),
  insurance_status: z.string().nullable(),
});

const vehicleBackupSchema = baseEntitySchema.extend({
  contact_id: z.string().min(1),
  name: z.string().nullable(),
  model_code: z.string().nullable(),
  condition: z.enum(VEHICLE_CONDITIONS),
  registration_date: dateString.nullable(),
  delivery_date: dateString.nullable(),
  shaken_expiry_date: dateString.nullable(),
  inspection_profile: z.enum(INSPECTION_PROFILES),
});

const noteBackupSchema = baseEntitySchema.extend({
  contact_id: z.string().min(1),
  date: dateString,
  summary: z.string().min(1),
  reaction: z.string().nullable(),
  next_action: z.string().nullable(),
});

const taskBackupSchema = baseEntitySchema.extend({
  contact_id: z.string().min(1),
  vehicle_id: z.string().nullable(),
  type: z.enum(taskTypes),
  title: z.string().min(1),
  detail: z.string().nullable(),
  due_date: dateString,
  status: z.enum(TASK_STATUSES),
  notify: z.boolean(),
  source: z.enum(['auto', 'manual']),
  generation_key: z.string().nullable(),
});

const templateBackupSchema = baseEntitySchema.extend({
  user_id: z.string(),
  category: z.enum(TEMPLATE_CATEGORIES),
  name: z.string().min(1),
  body: z.string().min(1),
});

const settingBackupSchema = baseEntitySchema.extend({
  user_id: z.string(),
  notifications_enabled: z.boolean(),
  notify_offsets_days: z.array(z.number().int().nonnegative()),
  long_session: z.boolean(),
  calendar_enabled: z.boolean(),
});

export const backupEnvelopeSchema = z.object({
  format: z.literal('my-dealer-crm-backup'),
  version: z.literal(1),
  exported_at: isoString,
  app_version: z.string().min(1),
  tables: z.object({
    contacts: z.array(contactBackupSchema),
    vehicles: z.array(vehicleBackupSchema),
    notes: z.array(noteBackupSchema),
    tasks: z.array(taskBackupSchema),
    templates: z.array(templateBackupSchema),
    settings: z.array(settingBackupSchema),
  }),
});

export type BackupEnvelopeV1 = z.infer<typeof backupEnvelopeSchema>;
export type BackupTableData = BackupEnvelopeV1['tables'];
