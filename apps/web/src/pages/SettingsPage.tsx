/**
 * 設定。  [担当: Sub D — UI / 通知は Sub E と連携 / Phase 3a で通知タイミング編集対応]
 * - 通知ON/OFF・通知タイミング編集・長期セッション・Google カレンダー連携。
 * - 文例テンプレート管理(/templates)への導線。大見出し＋mono セクション見出し＋下部タブバー。
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Setting } from '@crm/shared';
import * as store from '../lib/store.js';
import * as gcal from '../lib/gcal.js';
import { useAuth } from '../lib/auth.js';
import { getPermission, isNotificationSupported, requestPermission } from '../lib/notifications.js';
import Screen from '../components/Screen.js';
import { Button, Card, SectionLabel } from '../components/ui.js';

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
        checked ? 'bg-ink' : 'bg-separator'
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
    <div className="flex items-center justify-between gap-3 border-b border-separator px-4 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[15px] text-ink">{title}</div>
        {desc && <div className="mt-0.5 text-xs text-text2">{desc}</div>}
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
    queryFn: () => store.getSettings(),
  });

  const update = useMutation({
    mutationFn: (input: Partial<Setting>) => store.updateSettings(input),
    onSuccess: (next) => {
      queryClient.setQueryData(['settings'], next);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return (
    <Screen title="設定">
      {isLoading && <div className="py-10 text-center text-text2">読み込み中…</div>}
      {isError && <div className="py-10 text-center text-overdue">読み込みに失敗しました。</div>}

      {!isLoading && !isError && data && (
        <div className="space-y-5">
          <section>
            <SectionLabel>通知</SectionLabel>
            <Card>
              <Row title="通知" desc="期限が近いタスクをお知らせします">
                <Toggle
                  checked={data.notifications_enabled}
                  disabled={update.isPending}
                  onChange={(v) => update.mutate({ notifications_enabled: v })}
                />
              </Row>
              <NotifyOffsetsRow
                offsets={data.notify_offsets_days}
                disabled={update.isPending}
                onChange={(next) => update.mutate({ notify_offsets_days: next })}
              />
              <Row title="長期セッション" desc="ログイン状態を長く保持します">
                <Toggle
                  checked={data.long_session}
                  disabled={update.isPending}
                  onChange={(v) => update.mutate({ long_session: v })}
                />
              </Row>
            </Card>
            <NotificationPermissionRow enabled={data.notifications_enabled} />
          </section>

          <section>
            <SectionLabel>Google カレンダー</SectionLabel>
            <Card>
              <Row title="連携を有効にする" desc="期限のあるタスクを一方向で書き出します">
                <Toggle
                  checked={data.calendar_enabled}
                  disabled={update.isPending}
                  onChange={(v) => update.mutate({ calendar_enabled: v })}
                />
              </Row>
            </Card>
            {data.calendar_enabled && <CalendarPanel />}
          </section>

          <section>
            <SectionLabel>テンプレート</SectionLabel>
            <Card>
              <Link
                to="/templates"
                className="flex items-center justify-between px-4 py-3.5 active:bg-tint"
              >
                <div>
                  <div className="text-[15px] text-ink">文例テンプレート</div>
                  <div className="mt-0.5 text-xs text-text2">点検案内・営業フォローの定型文を管理</div>
                </div>
                <span className="text-text3">›</span>
              </Link>
            </Card>
          </section>

          <section>
            <div className="mb-2 px-1 text-xs text-text3">ログイン中: {username ?? '—'}</div>
            <Button variant="outline" full onClick={() => logout()}>
              ログアウト
            </Button>
          </section>
        </div>
      )}
    </Screen>
  );
}

/** 通知タイミング（期限の何日前）の編集行。0=当日。重複・負数は弾く。 */
function NotifyOffsetsRow({
  offsets,
  disabled,
  onChange,
}: {
  offsets: number[];
  disabled?: boolean;
  onChange: (next: number[]) => void;
}) {
  const [value, setValue] = useState('');
  const sorted = [...offsets].sort((a, b) => b - a);

  const add = () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return;
    if (offsets.includes(n)) {
      setValue('');
      return;
    }
    onChange([...offsets, n].sort((a, b) => b - a));
    setValue('');
  };

  const removeAt = (d: number) => onChange(offsets.filter((o) => o !== d));

  return (
    <div className="border-b border-separator px-4 py-3.5 last:border-b-0">
      <div className="text-[15px] text-ink">通知タイミング</div>
      <div className="mt-0.5 text-xs text-text2">期限の何日前に通知するか（0=当日）</div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {sorted.length === 0 && <span className="text-xs text-text3">未設定</span>}
        {sorted.map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => removeAt(d)}
            className="flex items-center gap-1 rounded-md bg-tint px-2.5 py-1 text-xs font-semibold text-ink active:bg-tint-strong disabled:opacity-40"
          >
            {offsetLabel(d)}
            <span className="text-text3">×</span>
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="日数"
          className="w-24 rounded-[10px] border border-transparent bg-grouped px-3 py-1.5 text-sm text-ink outline-none placeholder:text-text3 focus:border-ink"
        />
        <Button variant="secondary" onClick={add} disabled={disabled || value === ''} className="px-3 py-1.5 text-sm">
          追加
        </Button>
      </div>
    </div>
  );
}

/**
 * Google カレンダー連携パネル（ブラウザ完結）。
 * Client ID を貼り付け → Google と接続 → 今すぐ同期。詳細手順は docs/CALENDAR.md。
 */
function CalendarPanel() {
  const [clientId, setClientId] = useState(gcal.getClientId());
  const [connected, setConnected] = useState(gcal.isConnected());
  const [lastSync, setLastSync] = useState(gcal.getLastSync());
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const saved = gcal.getClientId().length > 0 && gcal.getClientId() === clientId.trim();

  const save = () => {
    gcal.setClientId(clientId);
    setStatus('Client ID を保存しました。');
  };

  const connect = async () => {
    setBusy(true);
    setStatus('');
    try {
      await gcal.connect(true);
      setConnected(true);
      setStatus('Google と接続しました。');
    } catch {
      setStatus('接続に失敗しました。Client ID と「承認済み JavaScript 生成元」をご確認ください。');
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    setStatus('');
    try {
      const r = await gcal.syncAllTasks();
      setConnected(true);
      setLastSync(gcal.getLastSync());
      setStatus(`同期しました（追加 ${r.created} / 更新 ${r.updated} / 削除 ${r.deleted}）。`);
    } catch {
      setStatus('同期に失敗しました。接続状態をご確認ください。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2.5 rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-done' : 'bg-text3'}`} />
        <div className="text-[13px] font-semibold text-text2">
          {connected ? '接続済み' : '未接続'}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-text2">
        Google Cloud で作成した OAuth クライアント ID を貼り付けてください（作成手順は
        docs/CALENDAR.md）。期限のあるタスクが終日予定として書き出されます。
      </p>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-text2">OAuth クライアント ID</span>
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="xxxxxxxx.apps.googleusercontent.com"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-[10px] border border-transparent bg-grouped px-3 py-2 text-sm text-ink outline-none placeholder:text-text3 focus:border-ink"
        />
      </label>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button variant="outline" onClick={save} disabled={!clientId.trim() || saved} className="px-3 py-1.5 text-sm">
          {saved ? '保存済み' : 'Client ID を保存'}
        </Button>
        <Button variant="outline" onClick={connect} disabled={!saved || busy} className="px-3 py-1.5 text-sm">
          {connected ? '接続済み ✓' : 'Google と接続'}
        </Button>
        <Button onClick={sync} disabled={!saved || busy} className="px-3 py-1.5 text-sm">
          {busy ? '同期中…' : '今すぐ同期'}
        </Button>
      </div>

      {status && <div className="mt-2 text-xs text-text2">{status}</div>}
      {lastSync && (
        <div className="mt-1 font-mono text-xs text-text3">
          最終同期: {new Date(lastSync).toLocaleString('ja-JP')}
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
    <div className="mt-2.5 rounded-card border border-separator bg-surface px-4 py-3 shadow-card">
      <div className="text-sm font-semibold text-today">通知の許可が必要です</div>
      <p className="mt-1 text-xs text-text2">
        {perm === 'denied'
          ? 'ブラウザの設定から通知を許可してください。'
          : 'タスクの期限通知を受け取るには、ブラウザの通知を許可してください。'}
      </p>
      {perm !== 'denied' && (
        <Button onClick={ask} className="mt-2 px-3 py-1.5 text-xs">
          通知を許可する
        </Button>
      )}
    </div>
  );
}
