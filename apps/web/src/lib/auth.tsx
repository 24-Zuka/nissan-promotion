/**
 * 認証コンテキスト。ログイン状態と user_profile を保持。
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';
import { tokens } from './tokens.js';
import { startSyncLoop, SYNC_EVENT } from './sync.js';
import { clearLocalData, db } from './db.js';
import { STATIC_MODE } from './config.js';
import { verifyPin } from './localAuth.js';

const SESSION_KEY = 'crm.session';

interface AuthState {
  isAuthed: boolean;
  username: string | null;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  setLongSession: (enabled: boolean) => void;
}

const AuthContext = createContext<AuthState | null>(null);

function hasStaticSession(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1' || localStorage.getItem(SESSION_KEY) === '1';
}

function persistStaticSession(longSession: boolean): void {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  (longSession ? localStorage : sessionStorage).setItem(SESSION_KEY, '1');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState<boolean>(
    STATIC_MODE ? hasStaticSession() : !!tokens.access,
  );
  const [username, setUsername] = useState<string | null>(
    STATIC_MODE && hasStaticSession() ? 'kai' : null,
  );
  const queryClient = useQueryClient();

  // 認証中は差分同期ループを回す（オンライン復帰/フォアグラウンド/一定間隔）。
  useEffect(() => {
    if (!isAuthed) return;
    const stop = startSyncLoop();
    return stop;
  }, [isAuthed]);

  // 同期完了時に TanStack Query を一括 invalidate し、Dexie の最新データで UI を更新。
  useEffect(() => {
    const handler = () => queryClient.invalidateQueries();
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, [queryClient]);

  const login = async (u: string, pin: string) => {
    if (STATIC_MODE) {
      // サーバー無し: ブラウザ内でローカル PIN 照合。
      const ok = await verifyPin(pin);
      if (!ok) throw new Error('invalid_pin');
      const settings = await db.settings.filter((row) => !row.deleted_at).first();
      persistStaticSession(Boolean(settings?.long_session));
      setUsername(u.trim() || 'kai');
      setIsAuthed(true);
      return;
    }
    const res = await api.login(u, pin);
    const settings = await api.getSettings().catch(() => null);
    tokens.setPersistence(settings?.long_session ? 'local' : 'session');
    setUsername(res.user_profile.username);
    setIsAuthed(true);
  };
  const logout = async () => {
    if (STATIC_MODE) {
      // 静的モードでは IndexedDB が唯一のデータ源。ログアウトでデータは消さない（鍵を外すだけ）。
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      setUsername(null);
      setIsAuthed(false);
      return;
    }
    await api.logout();
    await clearLocalData();
    setUsername(null);
    setIsAuthed(false);
  };

  const setLongSession = (enabled: boolean) => {
    if (STATIC_MODE) {
      if (isAuthed) persistStaticSession(enabled);
      return;
    }
    tokens.setPersistence(enabled ? 'local' : 'session');
  };

  return (
    <AuthContext.Provider value={{ isAuthed, username, login, logout, setLongSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
