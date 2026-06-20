/**
 * タスク1行。顧客名・タイトル・期限・ランクバッジ＋大きな「完了」ボタン。
 * 期限の状況に応じて期限テキストを色分けする。
 */
import { bucketFor, type DueBucket, type Rank, todayInTokyo } from '@crm/shared';
import type { TaskWithContact } from '../lib/api.js';
import RankBadge from './RankBadge.js';

const DUE_TEXT_COLOR: Record<DueBucket, string> = {
  overdue: 'text-nissan',
  today: 'text-orange-600',
  soon: 'text-blue-600',
  later: 'text-gray-500',
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
    <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 last:border-b-0">
      <RankBadge rank={rank} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-gray-900">{task.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs">
          <span className="truncate text-gray-600">{task.contact_name ?? '—'}</span>
          <span className={`shrink-0 font-medium ${DUE_TEXT_COLOR[bucket]}`}>{task.due_date}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onComplete(task.id)}
        disabled={completing}
        className="shrink-0 rounded-full bg-nissan px-4 py-2 text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
      >
        完了
      </button>
    </div>
  );
}
