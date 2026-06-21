/**
 * Google カレンダー連携（ブラウザ完結 / 一方向 CRM→カレンダー）。
 *
 * サーバーを介さず、Google Identity Services (GIS) のトークンモデルでブラウザから直接
 * 本人の Google カレンダーへ書き込む。クライアント秘密鍵は使わない（公開 Client ID のみ）。
 * 静的配信（GitHub Pages）・無料運用と相性が良く、サーバー側の改修も不要。
 *
 * 連携対象: due_date のある未完タスク（status !== 'done'）。done/削除済みのタスクは
 * 対応イベントを削除してカレンダーを掃除する（リコンサイル方式）。
 *
 * 認証情報・対応表は localStorage に保持（顧客データはログに出さない方針を維持）。
 */
import * as store from './store.js';

const CLIENT_ID_KEY = 'gcal.client_id';
const MAP_KEY = 'gcal.map'; // { [taskId]: calendarEventId }
const LAST_SYNC_KEY = 'gcal.last_sync';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// GIS の型は最小限だけ宣言（重い公式型は導入しない）。
interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  callback: (resp: TokenResponse) => void;
  requestAccessToken: (opts?: { prompt?: string }) => void;
}
interface GoogleOAuth2 {
  initTokenClient: (cfg: {
    client_id: string;
    scope: string;
    callback: (resp: TokenResponse) => void;
  }) => TokenClient;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

// ── Client ID（設定画面から貼り付け） ──────────────────
export function getClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) ?? '';
}
export function setClientId(id: string): void {
  localStorage.setItem(CLIENT_ID_KEY, id.trim());
}
export function isConfigured(): boolean {
  return getClientId().length > 0;
}
export function getLastSync(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

// ── GIS スクリプトの遅延ロード ─────────────────────────
let gisReady: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisReady) return gisReady;
  gisReady = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('gis_load_failed'));
    document.head.appendChild(s);
  });
  return gisReady;
}

// ── アクセストークン管理 ───────────────────────────────
let accessToken: string | null = null;
let tokenExpiry = 0;
let tokenClient: TokenClient | null = null;

export function isConnected(): boolean {
  return !!accessToken && Date.now() < tokenExpiry;
}

async function ensureTokenClient(): Promise<TokenClient> {
  const clientId = getClientId();
  if (!clientId) throw new Error('no_client_id');
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('gis_unavailable');
  if (!tokenClient) {
    tokenClient = oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: () => {} });
  }
  return tokenClient;
}

/** アクセストークン取得。interactive=true なら必要に応じて同意ポップアップを出す。 */
export async function connect(interactive = true): Promise<string> {
  if (isConnected()) return accessToken as string;
  const client = await ensureTokenClient();
  return new Promise<string>((resolve, reject) => {
    client.callback = (resp: TokenResponse) => {
      if (resp.error || !resp.access_token) return reject(new Error(resp.error ?? 'no_token'));
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in ?? 3600) * 1000 - 60_000;
      resolve(accessToken);
    };
    try {
      client.requestAccessToken({ prompt: interactive ? '' : 'none' });
    } catch (e) {
      reject(e as Error);
    }
  });
}

// ── タスク → カレンダーイベント変換（純関数・テスト可能） ──
interface CalEventBody {
  summary: string;
  description?: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: { private: { crmTaskId: string } };
}
export function taskToEvent(task: {
  id: string;
  title: string;
  detail?: string | null;
  due_date: string;
  contact_name?: string;
}): CalEventBody {
  const description =
    [task.contact_name ? `顧客: ${task.contact_name}` : '', task.detail ?? '']
      .filter(Boolean)
      .join('\n') || undefined;
  return {
    summary: task.title,
    description,
    start: { date: task.due_date },
    end: { date: task.due_date },
    extendedProperties: { private: { crmTaskId: task.id } },
  };
}

// ── 対応表（taskId → eventId） ─────────────────────────
type EventMap = Record<string, string>;
function loadMap(): EventMap {
  try {
    return JSON.parse(localStorage.getItem(MAP_KEY) ?? '{}') as EventMap;
  } catch {
    return {};
  }
}
function saveMap(m: EventMap): void {
  localStorage.setItem(MAP_KEY, JSON.stringify(m));
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
}

/** すべての対象タスクをカレンダーへ反映（作成/更新）し、消えたタスクのイベントを削除する。 */
export async function syncAllTasks(): Promise<SyncResult> {
  const token = await connect(true);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const all = await store.listTasks({});
  const targets = all.filter((t) => t.due_date && t.status !== 'done');
  const map = loadMap();
  const result: SyncResult = { created: 0, updated: 0, deleted: 0 };
  const seen = new Set<string>();

  for (const t of targets) {
    seen.add(t.id);
    const body = JSON.stringify(taskToEvent(t));
    const eventId = map[t.id];
    if (eventId) {
      const res = await fetch(`${CAL_BASE}/${eventId}`, { method: 'PUT', headers, body });
      if (res.ok) {
        result.updated++;
      } else if (res.status === 404 || res.status === 410) {
        const cr = await fetch(CAL_BASE, { method: 'POST', headers, body });
        if (cr.ok) {
          map[t.id] = ((await cr.json()) as { id: string }).id;
          result.created++;
        }
      }
    } else {
      const cr = await fetch(CAL_BASE, { method: 'POST', headers, body });
      if (cr.ok) {
        map[t.id] = ((await cr.json()) as { id: string }).id;
        result.created++;
      }
    }
  }

  // 対応表にあるが現存しない（done/削除済み）タスクのイベントを削除。
  for (const [taskId, eventId] of Object.entries(map)) {
    if (seen.has(taskId)) continue;
    const res = await fetch(`${CAL_BASE}/${eventId}`, { method: 'DELETE', headers });
    if (res.ok || res.status === 404 || res.status === 410) {
      delete map[taskId];
      result.deleted++;
    }
  }

  saveMap(map);
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  return result;
}
