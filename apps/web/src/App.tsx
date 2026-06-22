/**
 * ルーティングと認証ガード。画面の中身は [Sub D — UI] が pages/ に実装する。
 * 画面遷移（仕様4）:
 *   /login → /(ホーム) → /contacts → /contacts/:id → 設定 /settings
 */
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { useAuth } from './lib/auth.js';

const LoginPage = lazy(() => import('./pages/LoginPage.js'));
const HomePage = lazy(() => import('./pages/HomePage.js'));
const ContactsPage = lazy(() => import('./pages/ContactsPage.js'));
const ContactDetailPage = lazy(() => import('./pages/ContactDetailPage.js'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.js'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage.js'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth();
  const location = useLocation();
  if (!isAuthed) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-text2">読み込み中…</div>}>
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
    </Suspense>
  );
}
