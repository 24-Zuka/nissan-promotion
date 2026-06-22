/**
 * トップレベル画面（今日 / 顧客 / 設定）の共通レイアウト。
 * 大見出し（Large Title）＋本文＋下部タブバー。画面ごとに最大幅を指定できる。
 */
import type { ReactNode } from 'react';
import TabBar from './TabBar.js';

export default function Screen({
  title,
  subtitle,
  action,
  children,
  contentClassName = 'max-w-content',
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="min-h-screen bg-grouped pb-[calc(72px+env(safe-area-inset-bottom))]">
      <div className={`mx-auto px-4 pt-[calc(env(safe-area-inset-top)+12px)] ${contentClassName}`}>
        <header className="mb-4 mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {subtitle && <div className="mb-0.5 text-[13px] text-text2">{subtitle}</div>}
            <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink">
              {title}
            </h1>
          </div>
          {action && <div className="shrink-0 pb-1">{action}</div>}
        </header>
        {children}
      </div>
      <TabBar />
    </div>
  );
}
