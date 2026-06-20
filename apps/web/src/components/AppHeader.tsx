/**
 * 画面上部の共通ヘッダー。タイトル＋任意の戻る/右側アクション。
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
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
      {back != null && back !== false && (
        <button
          type="button"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          className="-ml-1 mr-1 text-lg text-nissan"
          aria-label="戻る"
        >
          ‹
        </button>
      )}
      <h1 className="flex-1 truncate text-lg font-bold text-gray-900">{title}</h1>
      {right && <div className="flex shrink-0 items-center gap-3">{right}</div>}
    </header>
  );
}
