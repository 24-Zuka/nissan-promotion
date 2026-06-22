import { describe, expect, it } from 'vitest';
import { TASK_TYPE } from './domain.js';
import { contactCreateSchema, noteCreateSchema, taskCreateSchema, vehicleCreateSchema } from './schemas.js';

describe('shared form validation', () => {
  it('rejects an invalid email address', () => {
    expect(contactCreateSchema.safeParse({ name: '顧客', rank: 'A', email: 'invalid' }).success).toBe(false);
  });

  it('requires a shaken expiry for used vehicles', () => {
    expect(vehicleCreateSchema.safeParse({ contact_id: 'c1', condition: 'used' }).success).toBe(false);
  });

  it('requires a base date when generating new-car maintenance', () => {
    const result = vehicleCreateSchema.safeParse({
      contact_id: 'c1', condition: 'new', generate_maintenance: true,
    });
    expect(result.success).toBe(false);
  });

  it('requires a vehicle for maintenance tasks', () => {
    const result = taskCreateSchema.safeParse({
      contact_id: 'c1', type: TASK_TYPE.SHAKEN, title: '車検', due_date: '2026-07-01',
    });
    expect(result.success).toBe(false);
  });

  it('prevents maintenance tasks from the note shortcut', () => {
    const result = noteCreateSchema.safeParse({
      contact_id: 'c1', date: '2026-06-22', summary: '商談',
      task: { type: TASK_TYPE.SHAKEN, title: '車検', due_date: '2026-07-01' },
    });
    expect(result.success).toBe(false);
  });
});
