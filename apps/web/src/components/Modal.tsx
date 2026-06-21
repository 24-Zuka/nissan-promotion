/**
 * モバイル前提のボトムシート風モーダル（仕様書 07・素材=Sheet）。
 * グラブハンドル＋タイトル＋閉じる。背景は dim、面は surface、最前面の影。
 */
import type { ReactNode } from 'react';

export default function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-sheet bg-grouped px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3 shadow-sheet sm:max-w-md sm:rounded-sheet">
        <div className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-rank-d-border sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full bg-tint text-lg leading-none text-text2 active:bg-tint-strong"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
