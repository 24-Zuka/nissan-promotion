/**
 * トークン保管。MVPは localStorage を使用。
 * NOTE(セキュリティ・次フェーズ): iOS/PWA ではより安全な保管(WebAuthn/パスキー＋
 * Credential 管理)へ移行する。長期セッション可否は Setting.long_session に従う。
 */
const ACCESS_KEY = 'crm.access_token';
const REFRESH_KEY = 'crm.refresh_token';

export const tokens = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
