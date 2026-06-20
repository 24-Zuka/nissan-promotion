/**
 * 型付き API クライアント。Vite の dev proxy 経由で /api/v1 を叩く。
 * アクセストークン失効時はリフレッシュを一度試みる。
 *
 * [Sub D — UI] はこのモジュールの関数のみを使い、fetch を直接呼ばないこと。
 */
import type {
  Contact,
  Note,
  Setting,
  Task,
  Template,
  Vehicle,
  ContactCreateInput,
  NoteCreateInput,
  TaskCreateInput,
  TemplateCreateInput,
  VehicleCreateInput,
} from '@crm/shared';
import { tokens } from './tokens.js';

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`);
  }
}

async function refreshAccess(): Promise<boolean> {
  const refresh_token = tokens.refresh;
  if (!refresh_token) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { access_token: string };
  tokens.set(data.access_token);
  return true;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (tokens.access) headers.set('Authorization', `Bearer ${tokens.access}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 && retry && (await refreshAccess())) {
    return request<T>(path, init, false);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const qs = (params: Record<string, string | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user_profile: { id: string; username: string };
}

/** 表示用にサーバが付与しうる結合フィールド（contact 名/ランク）。 */
export interface TaskWithContact extends Task {
  contact_name?: string;
  contact_rank?: string;
}

export const api = {
  // --- auth ---
  async login(username: string, pin: string): Promise<LoginResponse> {
    const data = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, pin }),
    });
    tokens.set(data.access_token, data.refresh_token);
    return data;
  },
  async logout(): Promise<void> {
    const refresh_token = tokens.refresh;
    await request('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token }) }).catch(
      () => undefined,
    );
    tokens.clear();
  },

  // --- contacts ---
  listContacts: () => request<Contact[]>('/contacts'),
  getContact: (id: string) => request<Contact>(`/contacts/${id}`),
  createContact: (input: ContactCreateInput) =>
    request<Contact>('/contacts', { method: 'POST', body: JSON.stringify(input) }),
  updateContact: (id: string, input: Partial<ContactCreateInput>) =>
    request<Contact>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteContact: (id: string) => request<void>(`/contacts/${id}`, { method: 'DELETE' }),

  // --- vehicles ---
  listVehicles: (contactId: string) => request<Vehicle[]>(`/vehicles${qs({ contact_id: contactId })}`),
  createVehicle: (input: VehicleCreateInput) =>
    request<Vehicle>('/vehicles', { method: 'POST', body: JSON.stringify(input) }),
  updateVehicle: (id: string, input: Partial<VehicleCreateInput>) =>
    request<Vehicle>(`/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteVehicle: (id: string) => request<void>(`/vehicles/${id}`, { method: 'DELETE' }),

  // --- notes ---
  listNotes: (contactId: string) => request<Note[]>(`/notes${qs({ contact_id: contactId })}`),
  createNote: (input: NoteCreateInput) =>
    request<Note>('/notes', { method: 'POST', body: JSON.stringify(input) }),
  updateNote: (id: string, input: Partial<NoteCreateInput>) =>
    request<Note>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteNote: (id: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }),

  // --- tasks ---
  listTasks: (params: { status?: string; due_from?: string; due_to?: string; rank?: string; contact_id?: string } = {}) =>
    request<TaskWithContact[]>(`/tasks${qs(params)}`),
  createTask: (input: TaskCreateInput) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
  updateTask: (id: string, input: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  completeTask: (id: string) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) }),
  deleteTask: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),

  // --- templates ---
  listTemplates: (category?: string) => request<Template[]>(`/templates${qs({ category })}`),
  createTemplate: (input: TemplateCreateInput) =>
    request<Template>('/templates', { method: 'POST', body: JSON.stringify(input) }),

  // --- settings ---
  getSettings: () => request<Setting>('/settings'),
  updateSettings: (input: Partial<Setting>) =>
    request<Setting>('/settings', { method: 'PATCH', body: JSON.stringify(input) }),
};
