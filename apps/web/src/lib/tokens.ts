/**
 * トークン保管。MVPは localStorage を使用。
 * NOTE(セキュリティ・次フェーズ): iOS/PWA ではより安全な保管(WebAuthn/パスキー＋
 * Credential 管理)へ移行する。長期セッション可否は Setting.long_session に従う。
 */
const ACCESS_KEY = 'crm.access_token';
const REFRESH_KEY = 'crm.refresh_token';

export type TokenPersistence = 'session' | 'local';

function read(key: string): string | null {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

function clearBoth(key: string): void {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

let persistence: TokenPersistence = localStorage.getItem(REFRESH_KEY) ? 'local' : 'session';

export const tokens = {
  get access(): string | null {
    return read(ACCESS_KEY);
  },
  get refresh(): string | null {
    return read(REFRESH_KEY);
  },
  get persistence(): TokenPersistence {
    return persistence;
  },
  set(access: string, refresh?: string, nextPersistence = persistence): void {
    persistence = nextPersistence;
    const storage = persistence === 'local' ? localStorage : sessionStorage;
    clearBoth(ACCESS_KEY);
    storage.setItem(ACCESS_KEY, access);
    if (refresh) {
      clearBoth(REFRESH_KEY);
      storage.setItem(REFRESH_KEY, refresh);
    }
  },
  setPersistence(next: TokenPersistence): void {
    const access = read(ACCESS_KEY);
    const refresh = read(REFRESH_KEY);
    persistence = next;
    clearBoth(ACCESS_KEY);
    clearBoth(REFRESH_KEY);
    const storage = next === 'local' ? localStorage : sessionStorage;
    if (access) storage.setItem(ACCESS_KEY, access);
    if (refresh) storage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    clearBoth(ACCESS_KEY);
    clearBoth(REFRESH_KEY);
  },
};
