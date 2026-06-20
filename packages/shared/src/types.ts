/**
 * エンティティ型。DB行とAPIレスポンスの基準形。
 */
import type { Rank, TaskStatus, TaskType, TemplateCategory, VehicleCondition } from './domain.js';
import type { DateString } from './date.js';

/** 同期・ソフトデリート用の共通メタ。全エンティティが持つ。 */
export interface BaseEntity {
  id: string; // uuid
  created_at: string; // ISO 8601 (UTC)
  updated_at: string; // ISO 8601 (UTC)
  deleted_at: string | null; // ソフトデリート
  seq: number; // 単調増加の同期カーソル
}

export interface User extends BaseEntity {
  username: string;
  // PINハッシュ等の認証情報は別テーブル/別レスポンスで扱い、ここには含めない。
}

export interface Contact extends BaseEntity {
  user_id: string;
  name: string; // 必須
  phone: string | null;
  email: string | null;
  rank: Rank; // 必須
  // 任意（営業に効く項目）
  family: string | null;
  usage: string | null;
  budget: string | null;
  desired_equipment: string | null;
  rival_car: string | null;
  insurance_status: string | null;
}

export interface Vehicle extends BaseEntity {
  contact_id: string;
  name: string | null; // 車名
  model_code: string | null; // 型式
  condition: VehicleCondition;
  registration_date: DateString | null; // 登録日
  delivery_date: DateString | null; // 納車日
  shaken_expiry_date: DateString | null; // 車検満了日（中古は必須）
}

export interface Note extends BaseEntity {
  contact_id: string;
  date: DateString; // 必須
  summary: string; // 要点（必須）
  reaction: string | null; // 相手の反応/懸念
  next_action: string | null; // 次の一手
}

export interface Task extends BaseEntity {
  contact_id: string; // 必須
  vehicle_id: string | null; // メンテ系は必須
  type: TaskType;
  title: string;
  detail: string | null;
  due_date: DateString;
  status: TaskStatus;
  notify: boolean;
  source: 'auto' | 'manual'; // 自動生成 or 手動
  generation_key: string | null; // 自動生成のまとまりを識別（再生成マージ用）
}

export interface Template extends BaseEntity {
  user_id: string;
  category: TemplateCategory;
  name: string;
  body: string; // 差し込み: {{顧客名}},{{予定日}},{{車種}},{{前回要点}}
}

export interface Setting extends BaseEntity {
  user_id: string;
  notifications_enabled: boolean;
  notify_offsets_days: number[]; // 通知タイミング
  long_session: boolean; // 長期セッション可否
  calendar_enabled: boolean;
}
