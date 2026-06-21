/**
 * 顧客ランクのバッジ。モノクロの濃淡で優先度を表す（仕様書 02 カラー）。
 * A=Ink 塗り（最優先）/ B=中間グレー / C=淡色面 / D=枠線のみ（様子見）。
 * 角丸スクエア（円ではない）でアプリアイコン的に。
 */
import type { Rank } from '@crm/shared';

const RANK_STYLE: Record<Rank, string> = {
  A: 'bg-ink text-on-ink',
  B: 'bg-rank-b text-on-ink',
  C: 'bg-rank-c text-rank-c-ink',
  D: 'border-[1.5px] border-rank-d-border text-text3',
};

export default function RankBadge({
  rank,
  size = 24,
  className = '',
}: {
  rank: Rank;
  size?: number;
  className?: string;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center rounded-[7px] text-xs font-bold ${RANK_STYLE[rank]} ${className}`}
      aria-label={`ランク${rank}`}
    >
      {rank}
    </span>
  );
}
