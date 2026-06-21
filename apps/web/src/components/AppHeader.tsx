/**
 * 画面上部の共通ヘッダー（詳細・サブ画面用）。Vibrancy（半透明＋ブラー）で内容を主役に。
 * 戻る/タイトル/右アクションを最小限のクロムで。
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AppHeader({
  title,
  back,
  right,
}: {
  title: string;
  back?: boolean | string;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header
      className="sticky top-0 z-10 flex items-center gap-1 border-b border-separator px-2 py-2.5 pt-[calc(env(safe-area-inset-top)+10px)]"
      style={{
        background: 'var(--chrome)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {back != null && back !== false && (
        <button
          type="button"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          className="flex items-center px-2 text-[15px] text-text2 active:opacity-60"
          aria-label="戻る"
        >
          <span className="mr-0.5 text-lg leading-none">‹</span>
          戻る
        </button>
      )}
      <h1 className="flex-1 truncate px-1 text-center text-[16px] font-semibold text-ink">{title}</h1>
      <div className="flex min-w-[64px] shrink-0 items-center justify-end gap-3 px-1">{right}</div>
    </header>
  );
}
