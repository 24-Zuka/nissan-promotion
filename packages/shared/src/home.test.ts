import { describe, it, expect } from 'vitest';
import { bucketFor, compareHomeTasks, SOON_WITHIN_DAYS, type HomeTaskLike } from './home.js';
import type { Rank } from './domain.js';

const TODAY = '2026-06-20';

describe('bucketFor', () => {
  it('classifies past due dates as overdue', () => {
    expect(bucketFor('2026-06-19', TODAY)).toBe('overdue');
    expect(bucketFor('2020-01-01', TODAY)).toBe('overdue');
  });

  it('classifies the same date as today', () => {
    expect(bucketFor(TODAY, TODAY)).toBe('today');
  });

  it('classifies within the soon window as soon', () => {
    expect(bucketFor('2026-06-21', TODAY)).toBe('soon');
    expect(bucketFor('2026-06-27', TODAY)).toBe('soon'); // exactly +7
  });

  it('classifies beyond the soon window as later', () => {
    expect(bucketFor('2026-06-28', TODAY)).toBe('later'); // +8
    expect(bucketFor('2027-01-01', TODAY)).toBe('later');
  });

  it('honors a custom soon window', () => {
    expect(bucketFor('2026-06-23', TODAY, 2)).toBe('later'); // +3 > 2
    expect(bucketFor('2026-06-22', TODAY, 2)).toBe('soon'); // +2 == 2
  });

  it('uses SOON_WITHIN_DAYS as the default boundary', () => {
    const edge = '2026-06-27'; // +7
    expect(bucketFor(edge, TODAY)).toBe(bucketFor(edge, TODAY, SOON_WITHIN_DAYS));
  });
});

function task(due_date: string, rank: Rank): HomeTaskLike {
  return { due_date, rank };
}

describe('compareHomeTasks', () => {
  const cmp = compareHomeTasks<HomeTaskLike>(TODAY);

  it('orders by bucket first (overdue -> today -> soon -> later)', () => {
    const overdue = task('2026-06-10', 'D');
    const today = task(TODAY, 'D');
    const soon = task('2026-06-22', 'A');
    const later = task('2026-07-30', 'A');
    const sorted = [later, soon, today, overdue].sort(cmp);
    expect(sorted).toEqual([overdue, today, soon, later]);
  });

  it('orders rank A before D within the same bucket', () => {
    const a = task('2026-06-25', 'A');
    const b = task('2026-06-25', 'B');
    const c = task('2026-06-25', 'C');
    const d = task('2026-06-25', 'D');
    expect([d, c, b, a].sort(cmp)).toEqual([a, b, c, d]);
  });

  it('orders by due date ascending when bucket and rank tie', () => {
    const early = task('2026-06-22', 'A');
    const late = task('2026-06-25', 'A');
    expect([late, early].sort(cmp)).toEqual([early, late]);
  });

  it('applies the full precedence: bucket > rank > due', () => {
    const overdueB = task('2026-06-01', 'B');
    const overdueA = task('2026-06-15', 'A');
    const todayA = task(TODAY, 'A');
    const soonAEarly = task('2026-06-21', 'A');
    const soonALate = task('2026-06-25', 'A');
    const soonD = task('2026-06-21', 'D');

    const sorted = [soonD, soonALate, soonAEarly, todayA, overdueB, overdueA].sort(cmp);
    expect(sorted).toEqual([
      overdueA, // overdue, rank A
      overdueB, // overdue, rank B
      todayA, // today
      soonAEarly, // soon, rank A, earlier
      soonALate, // soon, rank A, later
      soonD, // soon, rank D
    ]);
  });
});
