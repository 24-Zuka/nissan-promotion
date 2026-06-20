/**
 * zod スキーマ。APIリクエストの検証に api 側で使用し、web 側でフォーム検証にも流用する。
 */
import { z } from 'zod';
import {
  INSPECTION_PROFILES,
  RANKS,
  TASK_STATUSES,
  TASK_TYPE,
  TEMPLATE_CATEGORIES,
  VEHICLE_CONDITIONS,
} from './domain.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で指定してください');
const taskTypeValues = Object.values(TASK_TYPE) as [string, ...string[]];

export const loginSchema = z.object({
  username: z.string().min(1),
  pin: z.string().min(4).max(12),
});

export const contactCreateSchema = z.object({
  name: z.string().min(1, '氏名は必須です'),
  rank: z.enum(RANKS),
  phone: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal('')),
  family: z.string().nullish(),
  usage: z.string().nullish(),
  budget: z.string().nullish(),
  desired_equipment: z.string().nullish(),
  rival_car: z.string().nullish(),
  insurance_status: z.string().nullish(),
});
export const contactUpdateSchema = contactCreateSchema.partial();

export const vehicleCreateSchema = z
  .object({
    contact_id: z.string().min(1),
    name: z.string().nullish(),
    model_code: z.string().nullish(),
    condition: z.enum(VEHICLE_CONDITIONS),
    registration_date: dateStr.nullish(),
    delivery_date: dateStr.nullish(),
    shaken_expiry_date: dateStr.nullish(),
    inspection_profile: z.enum(INSPECTION_PROFILES).optional(), // 車検周期（既定 standard）
    generate_maintenance: z.boolean().optional(), // 作成時にメンテ自動生成するか
  })
  .refine((v) => v.condition !== 'used' || !!v.shaken_expiry_date, {
    message: '中古車は車検満了日が必須です',
    path: ['shaken_expiry_date'],
  });
export const vehicleUpdateSchema = z.object({
  name: z.string().nullish(),
  model_code: z.string().nullish(),
  condition: z.enum(VEHICLE_CONDITIONS).optional(),
  registration_date: dateStr.nullish(),
  delivery_date: dateStr.nullish(),
  shaken_expiry_date: dateStr.nullish(),
  inspection_profile: z.enum(INSPECTION_PROFILES).optional(),
});

export const noteCreateSchema = z.object({
  contact_id: z.string().min(1),
  date: dateStr,
  summary: z.string().min(1, '要点は必須です'),
  reaction: z.string().nullish(),
  next_action: z.string().nullish(),
  // メモ追加時に同時登録するタスク（時短UI）。任意。
  task: z
    .object({
      type: z.enum(taskTypeValues),
      title: z.string().min(1),
      detail: z.string().nullish(),
      due_date: dateStr,
      notify: z.boolean().optional(),
    })
    .optional(),
});
export const noteUpdateSchema = z.object({
  date: dateStr.optional(),
  summary: z.string().min(1).optional(),
  reaction: z.string().nullish(),
  next_action: z.string().nullish(),
});

export const taskCreateSchema = z.object({
  contact_id: z.string().min(1),
  vehicle_id: z.string().nullish(),
  type: z.enum(taskTypeValues),
  title: z.string().min(1),
  detail: z.string().nullish(),
  due_date: dateStr,
  notify: z.boolean().optional(),
});
export const taskUpdateSchema = z.object({
  vehicle_id: z.string().nullish(),
  type: z.enum(taskTypeValues).optional(),
  title: z.string().min(1).optional(),
  detail: z.string().nullish(),
  due_date: dateStr.optional(),
  status: z.enum(TASK_STATUSES).optional(),
  notify: z.boolean().optional(),
});

export const templateCreateSchema = z.object({
  category: z.enum(TEMPLATE_CATEGORIES),
  name: z.string().min(1),
  body: z.string().min(1),
});
export const templateUpdateSchema = templateCreateSchema.partial();

export const settingUpdateSchema = z.object({
  notifications_enabled: z.boolean().optional(),
  notify_offsets_days: z.array(z.number().int().min(0)).optional(),
  long_session: z.boolean().optional(),
  calendar_enabled: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>;
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
