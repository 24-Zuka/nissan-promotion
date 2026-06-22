/**
 * タスク1行。ランクバッジ＋タイトル＋顧客名/期限、右端にワンタップ完了の丸チェック。
 * 期限の状況に応じて期限テキストを色分け（期限切れ=赤 / 今日=黄土 / 近日=副 / 以降=補助）。
 */
import { bucketFor, type DueBucket, type Rank, todayInTokyo } from '@crm/shared';
import type { TaskWithContact } from '../lib/api.js';
import RankBadge from './RankBadge.js';

const DUE_TEXT_COLOR: Record<DueBucket, string> = {
  overdue: 'text-overdue',
  today: 'text-today',
  soon: 'text-text2',
  later: 'text-text3',
};

export default function TaskRow({
  task,
  onComplete,
  completing,
}: {
  task: TaskWithContact;
  onComplete: (id: string) => void;
  completing?: boolean;
}) {
  const today = todayInTokyo();
  const bucket = bucketFor(task.due_date, today);
  const rank = (task.contact_rank as Rank) ?? 'D';

  return (
    <div className="flex items-center gap-3 border-b border-separator px-4 py-3 last:border-b-0">
      <RankBadge rank={rank} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-ink">{task.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs">
          <span className="truncate text-text2">{task.contact_name ?? '—'}</span>
          <span className={`shrink-0 font-mono ${DUE_TEXT_COLOR[bucket]}`}>{task.due_date}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onComplete(task.id)}
        disabled={completing}
        aria-label="完了にする"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-transparent transition-colors active:text-on-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full border-[1.5px] border-rank-d-border">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
    </div>
  );
}
