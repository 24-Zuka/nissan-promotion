/**
 * 共通 UI 部品（仕様書 06 コンポーネント）。
 * - Button: 主（Ink 塗り）/ 副（淡色）/ 枠線 / 破壊的（赤文字）。
 * - SectionLabel: グループ見出し（mono・大文字・補助色）。
 * - Card: グループ化リストの面（surface・角丸・薄影）。
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'destructive';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-on-ink active:opacity-80',
  secondary: 'bg-tint text-ink active:bg-tint-strong',
  outline: 'border border-separator bg-surface text-ink active:bg-tint',
  destructive: 'border border-separator bg-surface text-overdue active:bg-tint',
};

export function Button({
  variant = 'primary',
  full,
  className = '',
  children,
  ...rest
}: {
  variant?: Variant;
  full?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`min-h-11 rounded-xl px-4 py-3 text-[16px] font-semibold transition-colors disabled:opacity-40 ${
        full ? 'w-full' : ''
      } ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mb-1.5 px-1 font-mono text-[11px] uppercase tracking-[0.04em] text-text3 ${className}`}
    >
      {children}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-card bg-surface shadow-card ${className}`}>{children}</div>
  );
}
