import { describe, it, expect } from 'vitest';
import {
  generateMaintenanceTasksForNewCar,
  generateMaintenanceTasksForUsedCar,
  mergeGeneratedTasks,
  type ExistingTaskLike,
  type GeneratedTaskSpec,
} from './maintenance.js';
import { TASK_TYPE, TASK_TYPE_LABEL } from './domain.js';
import { addMonths, addDays } from './date.js';

const VEHICLE = 'veh-1';

/** Per spec 5.2: months 1,6,12,18,24,30,36,42,48,54,60 with these types. */
const EXPECTED_NEW: ReadonlyArray<[number, string]> = [
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

describe('generateMaintenanceTasksForNewCar', () => {
  const START = '2025-04-10';
  const tasks = generateMaintenanceTasksForNewCar(VEHICLE, START);

  it('generates exactly 11 tasks', () => {
    expect(tasks).toHaveLength(11);
    expect(tasks).toHaveLength(EXPECTED_NEW.length);
  });

  it('produces each (type, monthsOffset -> due_date) entry in order', () => {
    const actual = tasks.map((t) => ({ type: t.type, due_date: t.due_date }));
    const expected = EXPECTED_NEW.map(([months, type]) => ({
      type,
      due_date: addMonths(START, months),
    }));
    expect(actual).toEqual(expected);
  });

  it('uses the spec-defined Nissan cadence (3y shaken then statutory/anshin then 5y shaken)', () => {
    // Sanity: shaken at 36 and 60 months only.
    const shakenOffsets = EXPECTED_NEW.filter(([, type]) => type === TASK_TYPE.SHAKEN).map(
      ([m]) => m,
    );
    expect(shakenOffsets).toEqual([36, 60]);
  });

  it('sets default Japanese titles from TASK_TYPE_LABEL', () => {
    for (const t of tasks) {
      expect(t.title).toBe(TASK_TYPE_LABEL[t.type]);
    }
  });

  it('tags all tasks with the new-car generation_key', () => {
    expect(new Set(tasks.map((t) => t.generation_key))).toEqual(
      new Set([`maint:new:${VEHICLE}`]),
    );
  });

  it('clamps month-end overflow in due dates (start on the 31st)', () => {
    const t = generateMaintenanceTasksForNewCar(VEHICLE, '2025-01-31');
    // +1 month from Jan 31 clamps to Feb 28 (2025 is not leap).
    expect(t[0].due_date).toBe('2025-02-28');
  });
});

describe('generateMaintenanceTasksForUsedCar', () => {
  const EXPIRY = '2026-09-30';
  const tasks = generateMaintenanceTasksForUsedCar(VEHICLE, EXPIRY);

  it('generates exactly 2 tasks', () => {
    expect(tasks).toHaveLength(2);
  });

  it('schedules ANSHIN_6M at expiry-30days and SHAKEN at expiry', () => {
    const anshin = tasks.find((t) => t.type === TASK_TYPE.INSPECTION_ANSHIN_6M)!;
    const shaken = tasks.find((t) => t.type === TASK_TYPE.SHAKEN)!;
    expect(anshin.due_date).toBe(addDays(EXPIRY, -30));
    expect(anshin.due_date).toBe('2026-08-31');
    expect(shaken.due_date).toBe(EXPIRY);
  });

  it('tags all tasks with the used-car generation_key', () => {
    expect(new Set(tasks.map((t) => t.generation_key))).toEqual(
      new Set([`maint:used:${VEHICLE}`]),
    );
  });

  it('uses a different generation_key namespace than the new-car path', () => {
    const used = generateMaintenanceTasksForUsedCar(VEHICLE, EXPIRY);
    const fresh = generateMaintenanceTasksForNewCar(VEHICLE, '2025-04-10');
    expect(used[0].generation_key).not.toBe(fresh[0].generation_key);
  });
});

// ---- mergeGeneratedTasks ----

let idSeq = 0;
function existing(
  spec: GeneratedTaskSpec,
  over: Partial<ExistingTaskLike> = {},
): ExistingTaskLike {
  return {
    id: `id-${++idSeq}`,
    type: spec.type,
    due_date: spec.due_date,
    status: 'open',
    source: 'auto',
    generation_key: spec.generation_key,
    ...over,
  };
}

describe('mergeGeneratedTasks', () => {
  const START = '2025-04-10';
  const generated = generateMaintenanceTasksForNewCar(VEHICLE, START);

  it('(a) fresh: with no existing, everything is toCreate', () => {
    const plan = mergeGeneratedTasks<ExistingTaskLike>([], generated);
    expect(plan.toCreate).toHaveLength(generated.length);
    expect(plan.toCreate).toEqual(generated);
    expect(plan.toDeleteIds).toEqual([]);
    expect(plan.kept).toEqual([]);
  });

  it('(b) re-run: identical open auto tasks -> nothing recreated, nothing deleted', () => {
    const existingTasks = generated.map((g) => existing(g));
    const plan = mergeGeneratedTasks(existingTasks, generated);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toDeleteIds).toEqual([]);
    expect(plan.kept).toHaveLength(generated.length);
    // The original ids (and thus notification settings) are preserved.
    expect(new Set(plan.kept.map((t) => t.id))).toEqual(
      new Set(existingTasks.map((t) => t.id)),
    );
  });

  it('(c) keeps manual tasks and non-open auto tasks regardless of generation', () => {
    const manual = existing(generated[0], {
      id: 'manual-1',
      source: 'manual',
      generation_key: null,
    });
    const doneAuto = existing(generated[1], { id: 'done-1', status: 'done' });
    const holdAuto = existing(generated[2], { id: 'hold-1', status: 'hold' });
    // Remaining specs (3..10) are fresh open auto tasks.
    const openMatches = generated.slice(3).map((g) => existing(g));

    const plan = mergeGeneratedTasks(
      [manual, doneAuto, holdAuto, ...openMatches],
      generated,
    );

    const keptIds = new Set(plan.kept.map((t) => t.id));
    expect(keptIds.has('manual-1')).toBe(true);
    expect(keptIds.has('done-1')).toBe(true);
    expect(keptIds.has('hold-1')).toBe(true);
    expect(plan.toDeleteIds).toEqual([]);
    // generated[0..2] still get (re)created because the protected tasks block
    // their slots rather than being treated as the auto match.
    const createdTypes = plan.toCreate.map((t) => ({ type: t.type, due_date: t.due_date }));
    expect(createdTypes).toEqual(
      generated.slice(0, 3).map((g) => ({ type: g.type, due_date: g.due_date })),
    );
  });

  it('(d) deletes open auto tasks of the same key that no longer match the new generation', () => {
    const stale = existing(
      {
        type: TASK_TYPE.INSPECTION_ANSHIN_6M,
        title: TASK_TYPE_LABEL[TASK_TYPE.INSPECTION_ANSHIN_6M],
        due_date: '2099-01-01',
        generation_key: `maint:new:${VEHICLE}`,
      },
      { id: 'stale-1' },
    );
    const matches = generated.map((g) => existing(g));

    const plan = mergeGeneratedTasks([stale, ...matches], generated);
    expect(plan.toDeleteIds).toEqual(['stale-1']);
    expect(plan.toCreate).toEqual([]);
    expect(plan.kept.map((t) => t.id)).toEqual(matches.map((t) => t.id));
  });

  it('does not touch tasks belonging to a different generation_key', () => {
    const otherKey = existing(
      {
        type: TASK_TYPE.SHAKEN,
        title: TASK_TYPE_LABEL[TASK_TYPE.SHAKEN],
        due_date: '2030-01-01',
        generation_key: 'maint:used:other-vehicle',
      },
      { id: 'other-1' },
    );
    const plan = mergeGeneratedTasks([otherKey], generated);
    expect(plan.toDeleteIds).toEqual([]);
    expect(plan.kept.map((t) => t.id)).toEqual(['other-1']);
    expect(plan.toCreate).toHaveLength(generated.length);
  });

  it('matches by (type, due_date) so a re-run with a shifted start replaces dates', () => {
    const oldTasks = generateMaintenanceTasksForNewCar(VEHICLE, '2025-04-10').map((g) =>
      existing(g),
    );
    const shifted = generateMaintenanceTasksForNewCar(VEHICLE, '2025-05-10');
    const plan = mergeGeneratedTasks(oldTasks, shifted);
    // No due_date overlaps, so all old open auto tasks are deleted and all new created.
    expect(plan.toCreate).toHaveLength(shifted.length);
    expect(plan.toDeleteIds).toHaveLength(oldTasks.length);
    expect(plan.kept).toEqual([]);
  });

  it('handles empty generated input without deleting anything', () => {
    const open = existing(generated[0]);
    const plan = mergeGeneratedTasks([open], []);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toDeleteIds).toEqual([]);
    expect(plan.kept.map((t) => t.id)).toEqual([open.id]);
  });

  it('does not double-match two identical existing tasks to one spec', () => {
    // Two existing open auto tasks with the same (type, due_date) as one spec.
    const dupA = existing(generated[0], { id: 'dup-a' });
    const dupB = existing(generated[0], { id: 'dup-b' });
    const plan = mergeGeneratedTasks([dupA, dupB], [generated[0]]);
    // One is kept (matched), the other is a leftover open auto task -> deleted.
    expect(plan.toCreate).toEqual([]);
    expect(plan.kept).toHaveLength(1);
    expect(plan.toDeleteIds).toHaveLength(1);
    expect(new Set([...plan.kept.map((t) => t.id), ...plan.toDeleteIds])).toEqual(
      new Set(['dup-a', 'dup-b']),
    );
  });
});
