import { describe, it, expect } from 'vitest';
import {
  addMonths,
  addDays,
  diffDays,
  parseDate,
  formatDate,
  isDateString,
  todayInTokyo,
} from './date.js';

describe('parseDate / formatDate', () => {
  it('round-trips a date via UTC noon', () => {
    expect(formatDate(parseDate('2025-03-15'))).toBe('2025-03-15');
  });

  it('parses to UTC noon (TZ-safe)', () => {
    const d = parseDate('2025-03-15');
    expect(d.getUTCHours()).toBe(12);
    expect(d.getUTCFullYear()).toBe(2025);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(15);
  });
});

describe('isDateString', () => {
  it('accepts valid dates', () => {
    expect(isDateString('2025-01-01')).toBe(true);
    expect(isDateString('2024-02-29')).toBe(true); // leap day
  });

  it('rejects malformed strings', () => {
    expect(isDateString('2025-1-1')).toBe(false);
    expect(isDateString('25-01-01')).toBe(false);
    expect(isDateString('not-a-date')).toBe(false);
    expect(isDateString('')).toBe(false);
  });

  it('rejects impossible calendar dates', () => {
    expect(isDateString('2025-02-30')).toBe(false);
    expect(isDateString('2025-13-01')).toBe(false);
    expect(isDateString('2025-00-10')).toBe(false);
    expect(isDateString('2023-02-29')).toBe(false); // non-leap year
  });
});

describe('addMonths', () => {
  it('adds simple months', () => {
    expect(addMonths('2025-01-15', 1)).toBe('2025-02-15');
    expect(addMonths('2025-01-15', 6)).toBe('2025-07-15');
  });

  it('clamps month-end overflow (Jan 31 + 1m => Feb 28)', () => {
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
  });

  it('clamps to Feb 29 in a leap year', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29'); // 2024 is leap
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28'); // 2025 is not
  });

  it('handles month 30/31 clamping (Mar 31 + 1m => Apr 30)', () => {
    expect(addMonths('2025-03-31', 1)).toBe('2025-04-30');
  });

  it('crosses year boundaries forward', () => {
    expect(addMonths('2025-12-10', 1)).toBe('2026-01-10');
    expect(addMonths('2025-11-15', 14)).toBe('2027-01-15');
  });

  it('supports negative months (subtraction)', () => {
    expect(addMonths('2025-01-15', -1)).toBe('2024-12-15');
    expect(addMonths('2025-03-31', -1)).toBe('2025-02-28');
  });

  it('covers the full new-car cadence offsets without drift', () => {
    // 36 months from a mid-month date stays on the same day.
    expect(addMonths('2025-04-10', 36)).toBe('2028-04-10');
    expect(addMonths('2025-04-10', 60)).toBe('2030-04-10');
  });
});

describe('addDays', () => {
  it('adds and subtracts days', () => {
    expect(addDays('2025-06-10', 5)).toBe('2025-06-15');
    expect(addDays('2025-06-10', -30)).toBe('2025-05-11');
  });

  it('crosses month boundaries', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
  });

  it('crosses year boundaries', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles leap-day arithmetic', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });
});

describe('diffDays', () => {
  it('returns positive when a is after b', () => {
    expect(diffDays('2025-06-15', '2025-06-10')).toBe(5);
  });

  it('returns negative when a is before b', () => {
    expect(diffDays('2025-06-10', '2025-06-15')).toBe(-5);
  });

  it('returns zero for equal dates', () => {
    expect(diffDays('2025-06-10', '2025-06-10')).toBe(0);
  });

  it('counts across month and year boundaries', () => {
    expect(diffDays('2026-01-01', '2025-12-31')).toBe(1);
    expect(diffDays('2025-03-01', '2025-02-01')).toBe(28); // non-leap Feb
    expect(diffDays('2024-03-01', '2024-02-01')).toBe(29); // leap Feb
  });

  it('is the inverse of addDays', () => {
    expect(diffDays(addDays('2025-06-10', 30), '2025-06-10')).toBe(30);
  });
});

describe('todayInTokyo', () => {
  it('returns the JST calendar date for a UTC instant just before midnight JST', () => {
    // 2026-06-19T15:30Z is 2026-06-20T00:30 JST.
    expect(todayInTokyo(new Date('2026-06-19T15:30:00Z'))).toBe('2026-06-20');
  });

  it('does not roll over before 15:00Z', () => {
    // 2026-06-19T14:59Z is 2026-06-19T23:59 JST.
    expect(todayInTokyo(new Date('2026-06-19T14:59:00Z'))).toBe('2026-06-19');
  });

  it('handles exactly 15:00Z (= 00:00 JST next day)', () => {
    expect(todayInTokyo(new Date('2026-06-19T15:00:00Z'))).toBe('2026-06-20');
  });

  it('handles a UTC instant well within the same JST day', () => {
    expect(todayInTokyo(new Date('2026-06-20T03:00:00Z'))).toBe('2026-06-20');
  });

  it('rolls the year/month at the JST boundary', () => {
    // 2025-12-31T15:00Z = 2026-01-01T00:00 JST.
    expect(todayInTokyo(new Date('2025-12-31T15:00:00Z'))).toBe('2026-01-01');
  });
});
