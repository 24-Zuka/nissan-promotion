/**
 * ホーム画面のタスク分類・並び替えロジック。
 * 期限切れ→今日→近日 の順、各バケット内はランクA優先、同ランクは期限昇順。
 */
import { diffDays, type DateString } from './date.js';
import { RANK_ORDER, type DueBucket, type Rank } from './domain.js';

export interface HomeTaskLike {
  due_date: DateString;
  rank: Rank; // 紐付く顧客のランク
}

/** 近日とみなす日数（今日より後〜この日数以内）。 */
export const SOON_WITHIN_DAYS = 7;

export function bucketFor(due: DateString, today: DateString, soonWithin = SOON_WITHIN_DAYS): DueBucket {
  const d = diffDays(due, today);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d <= soonWithin) return 'soon';
  return 'later';
}

const BUCKET_ORDER: Record<DueBucket, number> = { overdue: 0, today: 1, soon: 2, later: 3 };

/**
 * ホーム表示順の比較関数。
 * 1) バケット（期限切れ→今日→近日→later）
 * 2) ランク（A→D）
 * 3) 期限（昇順）
 */
export function compareHomeTasks<T extends HomeTaskLike>(today: DateString) {
  return (a: T, b: T): number => {
    const ba = BUCKET_ORDER[bucketFor(a.due_date, today)];
    const bb = BUCKET_ORDER[bucketFor(b.due_date, today)];
    if (ba !== bb) return ba - bb;
    const ra = RANK_ORDER[a.rank];
    const rb = RANK_ORDER[b.rank];
    if (ra !== rb) return ra - rb;
    return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
  };
}
