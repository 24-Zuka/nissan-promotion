import type { ReactNode } from 'react';
import { Card, SectionLabel } from '../../components/ui.js';

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      <Card className="p-4">{children}</Card>
    </section>
  );
}

export function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-3 py-2 text-sm">
      <dt className="text-text2">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-2 text-sm text-text3">{children}</div>;
}

export function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 rounded-xl border border-separator bg-surface px-2 text-sm font-semibold text-ink active:bg-tint">
      {label}
    </button>
  );
}

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={onEdit} className="min-h-11 px-2 text-xs font-semibold text-ink active:opacity-60">編集</button>
      <button type="button" onClick={onDelete} className="min-h-11 px-2 text-xs font-semibold text-overdue active:opacity-60">削除</button>
    </div>
  );
}

export function InlineLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm text-overdue">
      <span>読み込めませんでした。</span>
      <button type="button" onClick={onRetry} className="min-h-11 font-semibold underline underline-offset-2">再試行</button>
    </div>
  );
}
