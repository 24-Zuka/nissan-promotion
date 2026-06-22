import { beforeEach, describe, expect, it } from 'vitest';
import { db, type StoredEntity } from './db.js';
import { BackupError, createBackupEnvelope, parseBackupText, restoreBackup } from './backup.js';

const contact: StoredEntity = {
  id: 'contact-1', user_id: '', name: '佐藤 健一', rank: 'A', phone: null, email: null,
  family: null, usage: null, budget: null, desired_equipment: null, rival_car: null,
  insurance_status: null, created_at: '2026-06-22T00:00:00.000Z',
  updated_at: '2026-06-22T00:00:00.000Z', deleted_at: null, seq: 0,
};

describe('backup', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('round-trips a validated backup envelope', async () => {
    await db.contacts.put(contact);
    const envelope = await createBackupEnvelope();
    expect(parseBackupText(JSON.stringify(envelope))).toEqual(envelope);
    expect(envelope.tables.contacts).toHaveLength(1);
  });

  it('rejects invalid JSON and unknown versions', () => {
    expect(() => parseBackupText('{')).toThrow(BackupError);
    expect(() => parseBackupText(JSON.stringify({ format: 'my-dealer-crm-backup', version: 2 }))).toThrow(BackupError);
  });

  it('replaces data atomically after creating a safety snapshot', async () => {
    await db.contacts.put(contact);
    const envelope = await createBackupEnvelope();
    envelope.tables.contacts[0].name = '復元後';
    let safetyCopyCreated = false;
    const result = await restoreBackup(envelope, () => { safetyCopyCreated = true; }, true);
    expect(safetyCopyCreated).toBe(true);
    expect((await db.contacts.get('contact-1'))?.name).toBe('復元後');
    expect(result.restored.contacts).toBe(1);
  });

  it('does not alter data when safety backup creation fails', async () => {
    await db.contacts.put(contact);
    const envelope = await createBackupEnvelope();
    envelope.tables.contacts[0].name = '変更されない';
    await expect(restoreBackup(envelope, () => { throw new Error('download blocked'); }, true)).rejects.toThrow();
    expect((await db.contacts.get('contact-1'))?.name).toBe('佐藤 健一');
  });
});
