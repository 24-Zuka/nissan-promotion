import {
  CLIENT_SYNC_TABLES,
  backupEnvelopeSchema,
  type BackupEnvelopeV1,
  type BackupTableData,
  type Contact,
} from '@crm/shared';
import { db, type StoredEntity } from './db.js';
import { STATIC_MODE } from './config.js';

const APP_VERSION = '0.1.0';

export interface RestoreResult {
  restored: Record<keyof BackupTableData, number>;
  pre_restore_filename: string;
}

export class BackupError extends Error {
  constructor(public code: 'invalid_json' | 'invalid_format' | 'restore_not_allowed' | 'download_failed') {
    super(code);
  }
}

const tableNames = [
  'contacts',
  'vehicles',
  'notes',
  'tasks',
  'templates',
  'settings',
] as const satisfies ReadonlyArray<keyof BackupTableData>;

function timestampForFilename(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export async function createBackupEnvelope(): Promise<BackupEnvelopeV1> {
  const tables = {} as BackupTableData;
  await db.transaction('r', [...CLIENT_SYNC_TABLES], async () => {
    for (const table of tableNames) {
      const rows = await db.entityTable(table).toArray();
      tables[table] = rows as never;
    }
  });
  return {
    format: 'my-dealer-crm-backup',
    version: 1,
    exported_at: new Date().toISOString(),
    app_version: APP_VERSION,
    tables,
  };
}

export function parseBackupText(text: string): BackupEnvelopeV1 {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BackupError('invalid_json');
  }
  const parsed = backupEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw new BackupError('invalid_format');
  return parsed.data;
}

export function downloadText(content: string, filename: string, type: string): void {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch {
    throw new BackupError('download_failed');
  }
}

export async function exportBackup(prefix = 'my-dealer-crm-backup'): Promise<string> {
  const envelope = await createBackupEnvelope();
  const filename = `${prefix}-${timestampForFilename()}.json`;
  downloadText(JSON.stringify(envelope, null, 2), filename, 'application/json;charset=utf-8');
  return filename;
}

export async function restoreBackup(
  envelope: BackupEnvelopeV1,
  beforeReplace: (snapshot: BackupEnvelopeV1, filename: string) => void = (snapshot, filename) =>
    downloadText(JSON.stringify(snapshot, null, 2), filename, 'application/json;charset=utf-8'),
  allowRestore = STATIC_MODE,
): Promise<RestoreResult> {
  if (!allowRestore) throw new BackupError('restore_not_allowed');

  const validated = backupEnvelopeSchema.parse(envelope);
  const current = await createBackupEnvelope();
  const preRestoreFilename = `my-dealer-crm-before-restore-${timestampForFilename()}.json`;
  beforeReplace(current, preRestoreFilename);

  await db.transaction('rw', [...CLIENT_SYNC_TABLES, 'outbox', 'meta'], async () => {
    for (const table of tableNames) await db.entityTable(table).clear();
    for (const table of tableNames) {
      const rows = validated.tables[table] as StoredEntity[];
      if (rows.length > 0) await db.entityTable(table).bulkPut(rows);
    }
    await db.outbox.clear();
    await db.meta.clear();
  });

  return {
    restored: Object.fromEntries(tableNames.map((table) => [table, validated.tables[table].length])) as RestoreResult['restored'],
    pre_restore_filename: preRestoreFilename,
  };
}

function csvCell(value: string | null): string {
  const text = value ?? '';
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportContactsCsv(): Promise<string> {
  const rows = (await db.contacts.filter((row) => !row.deleted_at).toArray()) as unknown as Contact[];
  const header = [
    '氏名', 'ランク', '電話番号', 'メール', '家族構成', '用途', '予算', '希望装備', '比較車種', '保険状況',
  ];
  const lines = rows
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    .map((contact) => [
      contact.name,
      contact.rank,
      contact.phone,
      contact.email,
      contact.family,
      contact.usage,
      contact.budget,
      contact.desired_equipment,
      contact.rival_car,
      contact.insurance_status,
    ].map(csvCell).join(','));
  const filename = `my-dealer-crm-contacts-${timestampForFilename()}.csv`;
  downloadText(`\uFEFF${[header.join(','), ...lines].join('\r\n')}`, filename, 'text/csv;charset=utf-8');
  return filename;
}
