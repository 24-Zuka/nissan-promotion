import { STATIC_MODE } from '../lib/config.js';
import { sync } from '../lib/sync.js';
import { useSyncStatus } from '../lib/useSyncStatus.js';

const label = {
  local: 'この端末に保存',
  idle: '同期済み',
  pending: '同期待ち',
  syncing: '同期中…',
  offline: 'オフライン',
  error: '同期できません',
} as const;

export default function SyncStatusBadge({ detailed = false }: { detailed?: boolean }) {
  const status = useSyncStatus();
  const tone = status.state === 'error' ? 'text-overdue' : status.state === 'offline' ? 'text-today' : 'text-text2';

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${tone}`} role="status" aria-live="polite">
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${status.state === 'error' ? 'bg-overdue' : status.state === 'offline' ? 'bg-today' : 'bg-done'}`} />
        {label[status.state]}
        {status.pending_count > 0 ? `（${status.pending_count}件）` : ''}
      </span>
      {detailed && status.last_synced_at && (
        <span className="text-text3">
          最終同期 {new Date(status.last_synced_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {!STATIC_MODE && status.state === 'error' && (
        <button type="button" onClick={() => void sync()} className="min-h-8 font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          再試行
        </button>
      )}
    </div>
  );
}
