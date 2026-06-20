/**
 * 認証コンテキスト。ログイン状態と user_profile を保持。
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from './api.js';
import { tokens } from './tokens.js';

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

  const login = async (u: string, pin: string) => {
    const res = await api.login(u, pin);
    setUsername(res.user_profile.username);
    setIsAuthed(true);
  };
  const logout = async () => {
    await api.logout();
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
