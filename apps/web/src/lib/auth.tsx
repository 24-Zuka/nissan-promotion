/**
 * 認証コンテキスト。ログイン状態と user_profile を保持。
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';
import { tokens } from './tokens.js';
import { startSyncLoop, SYNC_EVENT } from './sync.js';
import { clearLocalData } from './db.js';

interface AuthState {
  isAuthed: boolean;
  username: string | null;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState<boolean>(!!tokens.access);
  const [username, setUsername] = useState<string | null>(null);
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
    const res = await api.login(u, pin);
    setUsername(res.user_profile.username);
    setIsAuthed(true);
  };
  const logout = async () => {
    await api.logout();
    await clearLocalData();
    setUsername(null);
    setIsAuthed(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthed, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
