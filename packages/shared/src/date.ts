/**
 * 日付ユーティリティ。タスク期限は「日付のみ」(YYYY-MM-DD) で扱い、
 * タイムゾーン由来のズレを避ける。内部計算はUTCの正午を基準にする。
 */

export type DateString = string; // 'YYYY-MM-DD'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(s: string): s is DateString {
  if (!DATE_RE.test(s)) return false;
  const d = parseDate(s);
  return formatDate(d) === s; // 2025-02-30 等の不正値を弾く
}

/** 'YYYY-MM-DD' を UTC正午の Date に変換（DST/TZ非依存）。 */
export function parseDate(s: DateString): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

/** Date を 'YYYY-MM-DD' に整形（UTC基準）。 */
export function formatDate(date: Date): DateString {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0, 12)).getUTCDate();
}

/**
 * 月加算。月末日のオーバーフローは対象月の末日にクランプする。
 * 例: 2025-01-31 + 1month => 2025-02-28
 */
export function addMonths(s: DateString, months: number): DateString {
  const base = parseDate(s);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();
  const total = m + months;
  const targetYear = y + Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12;
  const clampedDay = Math.min(d, lastDayOfMonth(targetYear, targetMonth));
  return formatDate(new Date(Date.UTC(targetYear, targetMonth, clampedDay, 12)));
}

/** 日加算（負値で減算）。 */
export function addDays(s: DateString, days: number): DateString {
  const base = parseDate(s);
  base.setUTCDate(base.getUTCDate() + days);
  return formatDate(base);
}

/** a - b を日数で返す（a が後なら正）。 */
export function diffDays(a: DateString, b: DateString): number {
  const ms = parseDate(a).getTime() - parseDate(b).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Asia/Tokyo の「今日」を 'YYYY-MM-DD' で返す。
 * サーバ/クライアントの実行TZに依存させない。
 */
export function todayInTokyo(now: Date = new Date()): DateString {
  // UTC+9。Intl を使わず固定オフセットで算出（日本は夏時間なし）。
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
