/**
 * 設定。  [担当: Sub D — UI / 通知は Sub E と連携]
 * - 通知ON/OFF・通知タイミング表示(30/7/1/当日)・長期セッション・カレンダー連携(次フェーズ表示)。
 * - api.getSettings / api.updateSettings。
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Setting } from '@crm/shared';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import {
  getPermission,
  isNotificationSupported,
  requestPermission,
} from '../lib/notifications.js';
import AppHeader from '../components/AppHeader.js';

function offsetLabel(d: number): string {
  return d === 0 ? '当日' : `${d}日前`;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-nissan' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function Row({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0">
      <div className="min-w-0">
        <div className="font-medium text-gray-900">{title}</div>
        {desc && <div className="mt-0.5 text-xs text-gray-500">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { username, logout } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
  });

  const update = useMutation({
    mutationFn: (input: Partial<Setting>) => api.updateSettings(input),
    onSuccess: (next) => {
      queryClient.setQueryData(['settings'], next);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return (
    <div className="min-h-screen pb-10">
      <AppHeader title="設定" back="/" />

      {isLoading && <div className="p-6 text-center text-gray-500">読み込み中…</div>}
      {isError && <div className="p-6 text-center text-nissan">読み込みに失敗しました。</div>}

      {!isLoading && !isError && data && (
        <div className="p-4">
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <Row title="通知" desc="期限が近いタスクをお知らせします">
              <Toggle
                checked={data.notifications_enabled}
                disabled={update.isPending}
                onChange={(v) => update.mutate({ notifications_enabled: v })}
              />
            </Row>

            <Row title="通知タイミング" desc="MVPでは固定（変更不可）">
              <div className="flex flex-wrap justify-end gap-1">
                {data.notify_offsets_days.map((d) => (
                  <span
                    key={d}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                  >
                    {offsetLabel(d)}
                  </span>
                ))}
              </div>
            </Row>

            <Row title="長期セッション" desc="ログイン状態を長く保持します">
              <Toggle
                checked={data.long_session}
                disabled={update.isPending}
                onChange={(v) => update.mutate({ long_session: v })}
              />
            </Row>

            <Row title="カレンダー連携" desc="次フェーズで対応予定">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                次フェーズ
              </span>
            </Row>
          </div>

          <NotificationPermissionRow enabled={data.notifications_enabled} />

          <div className="mt-6 px-1 text-xs text-gray-500">ログイン中: {username ?? '—'}</div>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white py-3 font-medium text-gray-700 active:bg-gray-50"
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}

function NotificationPermissionRow({ enabled }: { enabled: boolean }) {
  const [perm, setPerm] = useState(getPermission);

  if (!isNotificationSupported()) return null;
  if (!enabled) return null;
  if (perm === 'granted') return null;

  const ask = async () => {
    const result = await requestPermission();
    setPerm(result);
  };

  return (
    <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3">
      <div className="text-sm font-medium text-amber-800">
        通知の許可が必要です
      </div>
      <p className="mt-1 text-xs text-amber-700">
        {perm === 'denied'
          ? 'ブラウザの設定から通知を許可してください。'
          : 'タスクの期限通知を受け取るには、ブラウザの通知を許可してください。'}
      </p>
      {perm !== 'denied' && (
        <button
          type="button"
          onClick={ask}
          className="mt-2 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-medium text-white active:opacity-80"
        >
          通知を許可する
        </button>
      )}
    </div>
  );
}
