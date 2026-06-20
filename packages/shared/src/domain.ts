/**
 * ドメイン定数・列挙。サーバ/クライアント双方が参照する単一の真実。
 */

/** 顧客ランク（優先度）。Aが最優先。 */
export const RANKS = ['A', 'B', 'C', 'D'] as const;
export type Rank = (typeof RANKS)[number];

/** ランクの並び順（小さいほど優先＝上に表示）。 */
export const RANK_ORDER: Record<Rank, number> = { A: 0, B: 1, C: 2, D: 3 };

/** タスク状態。 */
export const TASK_STATUSES = ['open', 'done', 'hold'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** タスク種別。営業系とメンテ系に大別。 */
export const TASK_TYPE = {
  // --- 営業系 ---
  FOLLOW_CALL: 'follow_call',
  FOLLOW_VISIT: 'follow_visit',
  PROPOSE_TESTDRIVE: 'propose_testdrive',
  PROPOSE_ESTIMATE: 'propose_estimate',
  PROPOSE_INSURANCE: 'propose_insurance',
  // --- メンテ系（vehicle_id 必須） ---
  INSPECTION_FREE_1M: 'inspection_free_1m',
  INSPECTION_FREE_6M: 'inspection_free_6m',
  INSPECTION_STATUTORY_12M: 'inspection_statutory_12m',
  INSPECTION_ANSHIN_6M: 'inspection_anshin_6m',
  SHAKEN: 'shaken',
} as const;
export type TaskType = (typeof TASK_TYPE)[keyof typeof TASK_TYPE];

/** メンテ系タスク種別（vehicle_id を必須とする集合）。 */
export const MAINTENANCE_TASK_TYPES: ReadonlySet<TaskType> = new Set<TaskType>([
  TASK_TYPE.INSPECTION_FREE_1M,
  TASK_TYPE.INSPECTION_FREE_6M,
  TASK_TYPE.INSPECTION_STATUTORY_12M,
  TASK_TYPE.INSPECTION_ANSHIN_6M,
  TASK_TYPE.SHAKEN,
]);

export function isMaintenanceTaskType(type: TaskType): boolean {
  return MAINTENANCE_TASK_TYPES.has(type);
}

/** タスク種別ごとの既定タイトル（日本語）。 */
export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  [TASK_TYPE.FOLLOW_CALL]: '電話フォロー',
  [TASK_TYPE.FOLLOW_VISIT]: '訪問フォロー',
  [TASK_TYPE.PROPOSE_TESTDRIVE]: '試乗提案',
  [TASK_TYPE.PROPOSE_ESTIMATE]: '見積提示',
  [TASK_TYPE.PROPOSE_INSURANCE]: '保険提案',
  [TASK_TYPE.INSPECTION_FREE_1M]: '新車1か月無料点検',
  [TASK_TYPE.INSPECTION_FREE_6M]: '新車6か月無料点検',
  [TASK_TYPE.INSPECTION_STATUTORY_12M]: '法定12か月点検',
  [TASK_TYPE.INSPECTION_ANSHIN_6M]: '安心6か月点検',
  [TASK_TYPE.SHAKEN]: '車検',
};

/** 車両のコンディション（新車/中古）。生成ロジックの分岐に使う。 */
export const VEHICLE_CONDITIONS = ['new', 'used'] as const;
export type VehicleCondition = (typeof VEHICLE_CONDITIONS)[number];

/**
 * 車検周期プロファイル。メンテ自動生成の車検サイクルを切り替える。
 * - standard: 自家用乗用車。初回3年・以降2年（仕様5.2の既定）。
 * - annual:   毎年車検（8ナンバー等の特種用途・一部大型）。
 */
export const INSPECTION_PROFILES = ['standard', 'annual'] as const;
export type InspectionProfile = (typeof INSPECTION_PROFILES)[number];

export const INSPECTION_PROFILE_LABEL: Record<InspectionProfile, string> = {
  standard: '標準（初回3年・以降2年）',
  annual: '毎年車検（8ナンバー等）',
};

/** テンプレートのカテゴリ。 */
export const TEMPLATE_CATEGORIES = ['maintenance', 'followup'] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/** 通知タイミング（期限の何日前か）。MVP固定値。 */
export const NOTIFY_OFFSETS_DAYS = [30, 7, 1, 0] as const;

/** ホームでの期限分類。 */
export type DueBucket = 'overdue' | 'today' | 'soon' | 'later';
