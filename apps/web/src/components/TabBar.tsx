/**
 * 下部タブバー（仕様書 05・素材=Vibrancy / 04・片手で完結）。
 * 主要導線（今日 / 顧客 / 設定）を親指の届く下部に。背景はブラーで透過。
 */
import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

function IconToday({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6}>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" strokeLinecap="round" />
      <path d="M7.5 14l1.8 1.8L13 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconContacts({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7L17 17M7 7L5.3 5.3" strokeLinecap="round" />
    </svg>
  );
}

const TABS: { to: string; label: string; icon: (p: { active: boolean }) => ReactNode }[] = [
  { to: '/', label: '今日', icon: IconToday },
  { to: '/contacts', label: '顧客', icon: IconContacts },
  { to: '/settings', label: '設定', icon: IconSettings },
];

export default function TabBar() {
  const { pathname } = useLocation();
  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/');

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-separator"
      style={{
        background: 'var(--chrome)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="mx-auto flex max-w-content justify-around px-6 pb-[env(safe-area-inset-bottom)] pt-2">
        {TABS.map((t) => {
          const on = isActive(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              onClick={() => {
                if (on) window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
              }}
              className="flex flex-1 flex-col items-center gap-1 py-1 active:opacity-60"
              style={{ color: on ? 'var(--ink)' : 'var(--text-3)' }}
              aria-current={on ? 'page' : undefined}
            >
              <Icon active={on} />
              <span className={`text-[10px] ${on ? 'font-semibold' : ''}`}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
