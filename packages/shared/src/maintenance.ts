/**
 * メンテナンス（点検/車検）タスク自動生成ロジック。
 * 日産の点検スケジュール（新車1/6か月無料・法定12か月・安心6か月）と
 * 自家用乗用車の車検周期（初回3年・以降2年）を初期値とする。
 *
 * 生成結果は「タスクの素」(GeneratedTaskSpec) を返し、id/タイムスタンプの付与は
 * 呼び出し側(api層)が行う。これにより本モジュールは純粋関数として単体テストしやすい。
 *
 * NOTE: 再生成時は mergeGeneratedTasks で手動修正・着手済みタスクを保護する。
 */
import { TASK_TYPE, TASK_TYPE_LABEL, type InspectionProfile, type TaskType } from './domain.js';
import { addDays, addMonths, type DateString } from './date.js';

export interface GeneratedTaskSpec {
  type: TaskType;
  title: string;
  due_date: DateString;
  /** 自動生成のまとまりを識別。再生成時に同keyの自動タスクのみ差し替える。 */
  generation_key: string;
}

type Schedule = ReadonlyArray<[months: number, type: TaskType]>;

/** 新車スケジュール（基準日からの月数, 種別）。仕様5.2準拠（standard=初回3年/以降2年）。 */
const NEW_CAR_SCHEDULE: Schedule = [
  [1, TASK_TYPE.INSPECTION_FREE_1M],
  [6, TASK_TYPE.INSPECTION_FREE_6M],
  [12, TASK_TYPE.INSPECTION_STATUTORY_12M],
  [18, TASK_TYPE.INSPECTION_ANSHIN_6M],
  [24, TASK_TYPE.INSPECTION_STATUTORY_12M],
  [30, TASK_TYPE.INSPECTION_ANSHIN_6M],
  [36, TASK_TYPE.SHAKEN],
  [42, TASK_TYPE.INSPECTION_ANSHIN_6M],
  [48, TASK_TYPE.INSPECTION_STATUTORY_12M],
  [54, TASK_TYPE.INSPECTION_ANSHIN_6M],
  [60, TASK_TYPE.SHAKEN],
];

/**
 * 毎年車検プロファイル（8ナンバー等）。新車1/6か月無料点検の後、12か月ごとに車検。
 * 中間の6か月地点には安心点検を入れる。
 */
const NEW_CAR_SCHEDULE_ANNUAL: Schedule = [
  [1, TASK_TYPE.INSPECTION_FREE_1M],
  [6, TASK_TYPE.INSPECTION_FREE_6M],
  [12, TASK_TYPE.SHAKEN],
  [18, TASK_TYPE.INSPECTION_ANSHIN_6M],
  [24, TASK_TYPE.SHAKEN],
  [30, TASK_TYPE.INSPECTION_ANSHIN_6M],
  [36, TASK_TYPE.SHAKEN],
  [42, TASK_TYPE.INSPECTION_ANSHIN_6M],
  [48, TASK_TYPE.SHAKEN],
  [54, TASK_TYPE.INSPECTION_ANSHIN_6M],
  [60, TASK_TYPE.SHAKEN],
];

function newCarSchedule(profile: InspectionProfile): Schedule {
  return profile === 'annual' ? NEW_CAR_SCHEDULE_ANNUAL : NEW_CAR_SCHEDULE;
}

function genKey(vehicleId: string, scheme: 'new' | 'used'): string {
  return `maint:${scheme}:${vehicleId}`;
}

/**
 * 新車：納車日（または登録日）を起点にメンテタスクを生成。
 * profile で車検サイクルを切替（standard=初回3年/以降2年, annual=毎年車検）。
 */
export function generateMaintenanceTasksForNewCar(
  vehicleId: string,
  startDate: DateString,
  profile: InspectionProfile = 'standard',
): GeneratedTaskSpec[] {
  const key = genKey(vehicleId, 'new');
  return newCarSchedule(profile).map(([months, type]) => ({
    type,
    title: TASK_TYPE_LABEL[type],
    due_date: addMonths(startDate, months),
    generation_key: key,
  }));
}

/**
 * 中古車：車検満了日を起点に生成。
 * 車検は満了日、直前点検（安心6か月点検）は満了30日前。
 * 既知の満了日に基づく直近サイクルのみ生成するため profile では結果は変わらない
 * （次回以降は次の満了日が判明した時点で再生成する）。
 */
export function generateMaintenanceTasksForUsedCar(
  vehicleId: string,
  shakenExpiryDate: DateString,
  _profile: InspectionProfile = 'standard',
): GeneratedTaskSpec[] {
  const key = genKey(vehicleId, 'used');
  return [
    {
      type: TASK_TYPE.INSPECTION_ANSHIN_6M,
      title: TASK_TYPE_LABEL[TASK_TYPE.INSPECTION_ANSHIN_6M],
      due_date: addDays(shakenExpiryDate, -30),
      generation_key: key,
    },
    {
      type: TASK_TYPE.SHAKEN,
      title: TASK_TYPE_LABEL[TASK_TYPE.SHAKEN],
      due_date: shakenExpiryDate,
      generation_key: key,
    },
  ];
}

/** マージ対象の既存タスク（必要最小の形）。 */
export interface ExistingTaskLike {
  id: string;
  type: TaskType;
  due_date: DateString;
  status: string; // 'open' | 'done' | 'hold'
  source: 'auto' | 'manual';
  generation_key: string | null;
}

export interface MergePlan<T extends ExistingTaskLike> {
  /** 新規に作成すべきタスク。 */
  toCreate: GeneratedTaskSpec[];
  /** 削除（ソフトデリート）すべき既存タスクのID。 */
  toDeleteIds: string[];
  /** 変更せず保持する既存タスク。 */
  kept: T[];
}

/**
 * 再生成マージ。手動タスク・着手済み(done/hold)の自動タスクは保護する。
 * 対象 generation_key の「未完(open)・自動」タスクのみ、生成結果と突き合わせて差し替える。
 * 同一(type, due_date)が既存にあれば再作成せず保持する（IDと通知設定を維持）。
 */
export function mergeGeneratedTasks<T extends ExistingTaskLike>(
  existing: T[],
  generated: GeneratedTaskSpec[],
): MergePlan<T> {
  const key = generated[0]?.generation_key ?? null;

  const kept: T[] = [];
  const replaceableByKey: T[] = [];
  for (const t of existing) {
    const isReplaceable =
      t.source === 'auto' && t.status === 'open' && key !== null && t.generation_key === key;
    if (isReplaceable) replaceableByKey.push(t);
    else kept.push(t);
  }

  const sameKey = (a: { type: TaskType; due_date: DateString }, b: ExistingTaskLike) =>
    a.type === b.type && a.due_date === b.due_date;

  const toCreate: GeneratedTaskSpec[] = [];
  const matchedExistingIds = new Set<string>();
  for (const spec of generated) {
    const match = replaceableByKey.find((e) => sameKey(spec, e) && !matchedExistingIds.has(e.id));
    if (match) {
      matchedExistingIds.add(match.id);
      kept.push(match); // 一致 → 既存を維持
    } else {
      toCreate.push(spec);
    }
  }

  const toDeleteIds = replaceableByKey
    .filter((e) => !matchedExistingIds.has(e.id))
    .map((e) => e.id);

  return { toCreate, toDeleteIds, kept };
}
