/**
 * 顧客ランクのバッジ。A が最優先（赤系）→ D（淡色）。
 */
import type { Rank } from '@crm/shared';

const RANK_STYLE: Record<Rank, string> = {
  A: 'bg-nissan text-white',
  B: 'bg-orange-500 text-white',
  C: 'bg-blue-500 text-white',
  D: 'bg-gray-400 text-white',
};

export default function RankBadge({ rank, className = '' }: { rank: Rank; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLE[rank]} ${className}`}
      aria-label={`ランク${rank}`}
    >
      {rank}
    </span>
  );
}
