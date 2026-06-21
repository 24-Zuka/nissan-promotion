/**
 * オフライン対応ストア層。  [Phase 2 — ページ結線]
 *
 * 読み取り: Dexie をプライマリソースにする。初回(sync未済)はAPIフォールバック。
 * 書き込み: enqueueWrite(Dexie+outbox) → オンライン時に即sync。
 * 同期完了後に SYNC_EVENT をディスパッチ → TanStack Query を一括 invalidate。
 */
import type {
  Contact,
  ContactCreateInput,
  InspectionProfile,
  Note,
  NoteCreateInput,
  Setting,
  Task,
  TaskCreateInput,
  Template,
  TemplateCreateInput,
  Vehicle,
  VehicleCreateInput,
} from '@crm/shared';
import {
  generateMaintenanceTasksForNewCar,
  generateMaintenanceTasksForUsedCar,
} from '@crm/shared';
import { db, getSyncToken, type StoredEntity } from './db.js';
import { enqueueWrite, isOnline } from './sync.js';
import { api, type TaskWithContact } from './api.js';
import { STATIC_MODE } from './config.js';

async function hasSynced(): Promise<boolean> {
  return (await getSyncToken()) > 0;
}

/** サーバー(API)を読みに行ってよいか。静的モードでは常に false（Dexie のみが本体）。 */
function canRemote(): boolean {
  return !STATIC_MODE && isOnline();
}

function now(): string {
  return new Date().toISOString();
}

// ── Reads ──────────────────────────────────────────────

export async function listContacts(): Promise<Contact[]> {
  if (!(await hasSynced()) && canRemote()) {
    try {
      const remote = await api.listContacts();
      if (remote.length) await db.contacts.bulkPut(remote as unknown as StoredEntity[]);
      return remote;
    } catch { /* fall through */ }
  }
  const rows = await db.contacts.filter((r) => !r.deleted_at).toArray();
  return rows as unknown as Contact[];
}

export async function getContact(id: string): Promise<Contact> {
  const local = await db.contacts.get(id);
  if (local && !local.deleted_at) return local as unknown as Contact;
  if (!canRemote()) throw new Error('not_found');
  const remote = await api.getContact(id);
  await db.contacts.put(remote as unknown as StoredEntity);
  return remote;
}

export async function listVehicles(contactId: string): Promise<Vehicle[]> {
  if (!(await hasSynced()) && canRemote()) {
    try {
      const remote = await api.listVehicles(contactId);
      if (remote.length) await db.vehicles.bulkPut(remote as unknown as StoredEntity[]);
      return remote;
    } catch { /* fall through */ }
  }
  const rows = await db.vehicles
    .where('contact_id')
    .equals(contactId)
    .filter((r) => !r.deleted_at)
    .toArray();
  return rows as unknown as Vehicle[];
}

export async function listNotes(contactId: string): Promise<Note[]> {
  if (!(await hasSynced()) && canRemote()) {
    try {
      const remote = await api.listNotes(contactId);
      if (remote.length) await db.notes.bulkPut(remote as unknown as StoredEntity[]);
      return remote;
    } catch { /* fall through */ }
  }
  const rows = await db.notes
    .where('contact_id')
    .equals(contactId)
    .filter((r) => !r.deleted_at)
    .toArray();
  return rows as unknown as Note[];
}

export async function listTasks(
  params: {
    status?: string;
    contact_id?: string;
    due_from?: string;
    due_to?: string;
    rank?: string;
  } = {},
): Promise<TaskWithContact[]> {
  if (!(await hasSynced()) && canRemote()) {
    try {
      const remote = await api.listTasks(params);
      if (remote.length) {
        const entities = remote.map(
          ({ contact_name: _cn, contact_rank: _cr, ...rest }) => rest,
        );
        await db.tasks.bulkPut(entities as unknown as StoredEntity[]);
      }
      return remote;
    } catch { /* fall through */ }
  }

  let tasks = await db.tasks.filter((t) => !t.deleted_at).toArray();
  if (params.status) tasks = tasks.filter((t) => t.status === params.status);
  if (params.contact_id)
    tasks = tasks.filter((t) => t.contact_id === params.contact_id);

  const contacts = await db.contacts.toArray();
  const cMap = new Map(contacts.map((c) => [c.id, c]));
  return tasks.map((t) => {
    const c = cMap.get(t.contact_id as string);
    return { ...t, contact_name: c?.name, contact_rank: c?.rank };
  }) as unknown as TaskWithContact[];
}

export async function listTemplates(category?: string): Promise<Template[]> {
  if (!(await hasSynced()) && canRemote()) {
    try {
      const remote = await api.listTemplates(category);
      if (remote.length)
        await db.templates.bulkPut(remote as unknown as StoredEntity[]);
      return remote;
    } catch { /* fall through */ }
  }
  let rows = await db.templates.filter((r) => !r.deleted_at).toArray();
  if (category) rows = rows.filter((r) => r.category === category);
  return rows as unknown as Template[];
}

const SETTINGS_DEFAULTS: Setting = {
  id: '',
  user_id: '',
  notifications_enabled: false,
  notify_offsets_days: [30, 7, 1, 0],
  long_session: false,
  calendar_enabled: false,
  created_at: '',
  updated_at: '',
  deleted_at: null,
  seq: 0,
};

export async function getSettings(): Promise<Setting> {
  const rows = await db.settings.filter((r) => !r.deleted_at).toArray();
  if (rows.length > 0) return rows[0] as unknown as Setting;
  if (!canRemote()) return SETTINGS_DEFAULTS;
  try {
    const remote = await api.getSettings();
    await db.settings.put(remote as unknown as StoredEntity);
    return remote;
  } catch {
    return SETTINGS_DEFAULTS;
  }
}

// ── Writes ─────────────────────────────────────────────

export async function createContact(
  input: ContactCreateInput,
): Promise<Contact> {
  const ts = now();
  const entity: Record<string, unknown> = {
    id: crypto.randomUUID(),
    user_id: '',
    name: input.name,
    rank: input.rank,
    phone: input.phone ?? null,
    email: input.email ?? null,
    family: input.family ?? null,
    usage: input.usage ?? null,
    budget: input.budget ?? null,
    desired_equipment: input.desired_equipment ?? null,
    rival_car: input.rival_car ?? null,
    insurance_status: input.insurance_status ?? null,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    seq: 0,
  };
  await enqueueWrite('contacts', 'create', entity as StoredEntity);
  return entity as unknown as Contact;
}

export async function updateContact(
  id: string,
  input: Partial<ContactCreateInput>,
): Promise<void> {
  await enqueueWrite('contacts', 'update', {
    id,
    ...input,
    updated_at: now(),
  } as StoredEntity);
}

export async function deleteContact(id: string): Promise<void> {
  const ts = now();
  await enqueueWrite('contacts', 'delete', {
    id,
    deleted_at: ts,
    updated_at: ts,
  } as StoredEntity);
}

// 車両・メモ・タスクの編集／削除（顧客と同じ enqueueWrite パターン。sync COLUMNS が
// 編集対象カラムを網羅済みなので、オンライン時はそのままサーバーへ伝播する）。

export async function updateVehicle(
  id: string,
  input: Partial<VehicleCreateInput>,
): Promise<void> {
  await enqueueWrite('vehicles', 'update', {
    id,
    ...input,
    updated_at: now(),
  } as StoredEntity);
}

export async function deleteVehicle(id: string): Promise<void> {
  const ts = now();
  await enqueueWrite('vehicles', 'delete', {
    id,
    deleted_at: ts,
    updated_at: ts,
  } as StoredEntity);
}

type NoteEditInput = Partial<Pick<NoteCreateInput, 'date' | 'summary' | 'reaction' | 'next_action'>>;

export async function updateNote(id: string, input: NoteEditInput): Promise<void> {
  await enqueueWrite('notes', 'update', {
    id,
    ...input,
    updated_at: now(),
  } as StoredEntity);
}

export async function deleteNote(id: string): Promise<void> {
  const ts = now();
  await enqueueWrite('notes', 'delete', {
    id,
    deleted_at: ts,
    updated_at: ts,
  } as StoredEntity);
}

export type TaskEditInput = Partial<
  Pick<Task, 'type' | 'title' | 'detail' | 'due_date' | 'status' | 'notify' | 'vehicle_id'>
>;

export async function updateTask(id: string, input: TaskEditInput): Promise<void> {
  await enqueueWrite('tasks', 'update', {
    id,
    ...input,
    updated_at: now(),
  } as StoredEntity);
}

export async function deleteTask(id: string): Promise<void> {
  const ts = now();
  await enqueueWrite('tasks', 'delete', {
    id,
    deleted_at: ts,
    updated_at: ts,
  } as StoredEntity);
}

export async function createNote(input: NoteCreateInput): Promise<void> {
  const ts = now();
  await enqueueWrite('notes', 'create', {
    id: crypto.randomUUID(),
    contact_id: input.contact_id,
    date: input.date,
    summary: input.summary,
    reaction: input.reaction ?? null,
    next_action: input.next_action ?? null,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    seq: 0,
  } as StoredEntity);

  if (input.task) {
    await enqueueWrite('tasks', 'create', {
      id: crypto.randomUUID(),
      contact_id: input.contact_id,
      vehicle_id: null,
      type: input.task.type,
      title: input.task.title,
      detail: input.task.detail ?? null,
      due_date: input.task.due_date,
      status: 'open',
      notify: input.task.notify ?? true,
      source: 'manual',
      generation_key: null,
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
      seq: 0,
    } as StoredEntity);
  }
}

export async function createTask(input: TaskCreateInput): Promise<void> {
  const ts = now();
  await enqueueWrite('tasks', 'create', {
    id: crypto.randomUUID(),
    contact_id: input.contact_id,
    vehicle_id: input.vehicle_id ?? null,
    type: input.type,
    title: input.title,
    detail: input.detail ?? null,
    due_date: input.due_date,
    status: 'open',
    notify: input.notify ?? true,
    source: 'manual',
    generation_key: null,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    seq: 0,
  } as StoredEntity);
}

export async function completeTask(id: string): Promise<void> {
  await enqueueWrite('tasks', 'update', {
    id,
    status: 'done',
    updated_at: now(),
  } as StoredEntity);
}

export async function createVehicle(input: VehicleCreateInput): Promise<void> {
  const ts = now();
  const vehicleId = crypto.randomUUID();
  const profile = (input.inspection_profile ?? 'standard') as InspectionProfile;

  await enqueueWrite('vehicles', 'create', {
    id: vehicleId,
    contact_id: input.contact_id,
    name: input.name ?? null,
    model_code: input.model_code ?? null,
    condition: input.condition,
    registration_date: input.registration_date ?? null,
    delivery_date: input.delivery_date ?? null,
    shaken_expiry_date: input.shaken_expiry_date ?? null,
    inspection_profile: profile,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    seq: 0,
  } as StoredEntity);

  if (input.generate_maintenance) {
    let specs: ReturnType<typeof generateMaintenanceTasksForNewCar> = [];
    if (input.condition === 'new') {
      const start = input.delivery_date ?? input.registration_date;
      if (start) specs = generateMaintenanceTasksForNewCar(vehicleId, start, profile);
    } else if (input.condition === 'used' && input.shaken_expiry_date) {
      specs = generateMaintenanceTasksForUsedCar(
        vehicleId,
        input.shaken_expiry_date,
        profile,
      );
    }
    for (const spec of specs) {
      await enqueueWrite('tasks', 'create', {
        id: crypto.randomUUID(),
        contact_id: input.contact_id,
        vehicle_id: vehicleId,
        type: spec.type,
        title: spec.title,
        due_date: spec.due_date,
        detail: null,
        status: 'open',
        notify: true,
        source: 'auto',
        generation_key: spec.generation_key,
        created_at: ts,
        updated_at: ts,
        deleted_at: null,
        seq: 0,
      } as StoredEntity);
    }
  }
}

export async function createTemplate(
  input: TemplateCreateInput,
): Promise<void> {
  const ts = now();
  await enqueueWrite('templates', 'create', {
    id: crypto.randomUUID(),
    user_id: '',
    category: input.category,
    name: input.name,
    body: input.body,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    seq: 0,
  } as StoredEntity);
}

export async function updateTemplate(
  id: string,
  input: Partial<TemplateCreateInput>,
): Promise<void> {
  await enqueueWrite('templates', 'update', {
    id,
    ...input,
    updated_at: now(),
  } as StoredEntity);
}

export async function deleteTemplate(id: string): Promise<void> {
  const ts = now();
  await enqueueWrite('templates', 'delete', {
    id,
    deleted_at: ts,
    updated_at: ts,
  } as StoredEntity);
}

export async function updateSettings(
  input: Partial<Setting>,
): Promise<Setting> {
  const ts = now();
  const current = await getSettings();
  if (current.id) {
    await enqueueWrite('settings', 'update', {
      id: current.id,
      ...input,
      updated_at: ts,
    } as StoredEntity);
    return { ...current, ...input, updated_at: ts };
  }
  // 静的モードはサーバー seed が無いため、初回更新時にローカルへ設定行を作る。
  if (STATIC_MODE) {
    const id = crypto.randomUUID();
    const created: Setting = { ...current, ...input, id, created_at: ts, updated_at: ts };
    await enqueueWrite('settings', 'create', created as unknown as StoredEntity);
    return created;
  }
  return { ...current, ...input, updated_at: ts };
}
