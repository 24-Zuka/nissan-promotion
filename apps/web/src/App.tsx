/**
 * ルーティングと認証ガード。画面の中身は [Sub D — UI] が pages/ に実装する。
 * 画面遷移（仕様4）:
 *   /login → /(ホーム) → /contacts → /contacts/:id → 設定 /settings
 */
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './lib/auth.js';
import LoginPage from './pages/LoginPage.js';
import HomePage from './pages/HomePage.js';
import ContactsPage from './pages/ContactsPage.js';
import ContactDetailPage from './pages/ContactDetailPage.js';
import SettingsPage from './pages/SettingsPage.js';
import TemplatesPage from './pages/TemplatesPage.js';

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth();
  const location = useLocation();
  if (!isAuthed) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/contacts"
        element={
          <RequireAuth>
            <ContactsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/contacts/:id"
        element={
          <RequireAuth>
            <ContactDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/templates"
        element={
          <RequireAuth>
            <TemplatesPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
