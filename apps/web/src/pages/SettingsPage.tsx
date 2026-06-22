/**
 * 設定。  [担当: Sub D — UI / 通知は Sub E と連携 / Phase 3a で通知タイミング編集対応]
 * - 通知ON/OFF・通知タイミング編集・長期セッション・Google カレンダー連携。
 * - 文例テンプレート管理(/templates)への導線。大見出し＋mono セクション見出し＋下部タブバー。
 */
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Setting } from '@crm/shared';
import * as store from '../lib/store.js';
import * as gcal from '../lib/gcal.js';
import { useAuth } from '../lib/auth.js';
import { getPermission, isNotificationSupported, requestPermission } from '../lib/notifications.js';
import Screen from '../components/Screen.js';
import { Button, Card, SectionLabel } from '../components/ui.js';
import Modal from '../components/Modal.js';
import SyncStatusBadge from '../components/SyncStatusBadge.js';
import { useToast } from '../components/Toast.js';
import { STATIC_MODE } from '../lib/config.js';
import {
  BackupError,
  exportBackup,
  exportContactsCsv,
  parseBackupText,
  restoreBackup,
} from '../lib/backup.js';
import type { BackupEnvelopeV1 } from '@crm/shared';
import { useTheme, type ThemeMode } from '../lib/theme.js';

function offsetLabel(d: number): string {
  return d === 0 ? '当日' : `${d}日前`;
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-11 w-[52px] shrink-0 disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-2 h-7 w-12 rounded-full transition-colors ${
          checked ? 'bg-text2' : 'bg-separator'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
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
  const { username, logout, setLongSession } = useAuth();
  const { showToast } = useToast();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => store.getSettings(),
  });

  const update = useMutation({
    mutationFn: (input: Partial<Setting>) => store.updateSettings(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['settings'] });
      const previous = queryClient.getQueryData<Setting>(['settings']);
      if (previous) queryClient.setQueryData(['settings'], { ...previous, ...input });
      return { previous };
    },
    onSuccess: (next, input) => {
      if (input.long_session != null) setLongSession(next.long_session);
      queryClient.setQueryData(['settings'], next);
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(['settings'], context.previous);
      showToast({ message: '設定を保存できませんでした。通信状態を確認して、もう一度お試しください。' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <Screen title="設定">
      {isLoading && <div className="py-10 text-center text-text2">読み込み中…</div>}
      {isError && (
        <div className="py-10 text-center">
          <div className="text-sm text-overdue">設定を読み込めませんでした。</div>
          <Button variant="outline" onClick={() => void refetch()} className="mt-3 px-4 py-2 text-sm">再試行</Button>
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-5">
          <section>
            <SectionLabel>保存状態</SectionLabel>
            <Card className="px-4 py-3.5">
              <SyncStatusBadge detailed />
            </Card>
          </section>

          <section>
            <SectionLabel>画面表示</SectionLabel>
            <Card className="p-1.5">
              <div className="grid grid-cols-3 gap-1" role="group" aria-label="画面テーマ">
                {([
                  ['system', '端末設定'],
                  ['light', 'ライト'],
                  ['dark', 'ダーク'],
                ] as const satisfies ReadonlyArray<readonly [ThemeMode, string]>).map(([value, label]) => {
                  const selected = themeMode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setThemeMode(value)}
                      className={`min-h-11 rounded-[10px] px-2 text-sm font-semibold transition-colors ${
                        selected ? 'bg-ink text-on-ink shadow-sm' : 'text-text2 active:bg-tint'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Card>
          </section>

          <section>
            <SectionLabel>通知</SectionLabel>
            <Card>
              <Row title="通知" desc="期限が近いタスクをお知らせします">
                <Toggle
                  label="通知"
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
                  label="長期セッション"
                  checked={data.long_session}
                  disabled={update.isPending}
                  onChange={(v) => update.mutate({ long_session: v })}
                />
              </Row>
            </Card>
            <NotificationPermissionRow enabled={data.notifications_enabled} />
            <p className="mt-2 px-1 text-xs text-text3">通知はアプリを開いた時に確認されます。バックグラウンドでの自動通知には対応していません。</p>
          </section>

          <section>
            <SectionLabel>データ管理</SectionLabel>
            <DataManagementPanel onMessage={(message) => showToast({ message })} />
          </section>

          <section>
            <SectionLabel>アプリとして使う</SectionLabel>
            <Card className="px-4 py-3.5">
              <div className="text-[15px] text-ink">ホーム画面に追加</div>
              <p className="mt-1 text-xs leading-relaxed text-text2">
                iPhoneではSafariの共有ボタンから「ホーム画面に追加」を選択してください。PCではブラウザのインストール項目から追加できます。
              </p>
            </Card>
          </section>

          <section>
            <SectionLabel>Google カレンダー</SectionLabel>
            <Card>
              <Row title="連携を有効にする" desc="期限のあるタスクを一方向で書き出します">
                <Toggle
                  label="Googleカレンダー連携"
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

function DataManagementPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<BackupEnvelopeV1 | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<string>, success: string) => {
    setBusy(true);
    setStatus('');
    try {
      const filename = await action();
      setStatus(`${success}: ${filename}`);
    } catch {
      setStatus('ファイルを作成できませんでした。ブラウザのダウンロード設定をご確認ください。');
    } finally {
      setBusy(false);
    }
  };

  const chooseBackup = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setStatus('バックアップファイルが大きすぎます（上限20MB）。');
      return;
    }
    try {
      setCandidate(parseBackupText(await file.text()));
      setCandidateName(file.name);
      setStatus('');
    } catch (error) {
      setStatus(
        error instanceof BackupError && error.code === 'invalid_json'
          ? 'JSONファイルを読み取れませんでした。'
          : 'My Dealer CRMの有効なバックアップではありません。',
      );
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmRestore = async () => {
    if (!candidate) return;
    setBusy(true);
    try {
      const result = await restoreBackup(candidate);
      setCandidate(null);
      await queryClient.invalidateQueries();
      const count = Object.values(result.restored).reduce((sum, value) => sum + value, 0);
      onMessage(`${count}件のデータを復元しました。`);
    } catch {
      setStatus('復元できませんでした。現在のデータは変更されていません。');
      setCandidate(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="divide-y divide-separator">
        <div className="p-4">
          <div className="text-[15px] text-ink">バックアップ</div>
          <p className="mt-0.5 text-xs text-text2">顧客・車両・メモ・タスク・テンプレート・設定をJSONで保存します。</p>
          <Button variant="outline" disabled={busy} onClick={() => void run(exportBackup, '保存しました')} className="mt-3 px-3 py-2 text-sm">JSONを保存</Button>
        </div>
        <div className="p-4">
          <div className="text-[15px] text-ink">顧客一覧CSV</div>
          <p className="mt-0.5 text-xs text-text2">Excelで開ける形式で顧客情報を出力します。</p>
          <Button variant="outline" disabled={busy} onClick={() => void run(exportContactsCsv, '出力しました')} className="mt-3 px-3 py-2 text-sm">CSVを保存</Button>
        </div>
        <div className="p-4">
          <div className="text-[15px] text-ink">バックアップから復元</div>
          <p className="mt-0.5 text-xs text-text2">
            {STATIC_MODE ? '復元前に現在のデータも自動保存し、端末内データを置き換えます。' : 'サーバー同期モードでは競合防止のため復元できません。'}
          </p>
          {STATIC_MODE && (
            <>
              <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void chooseBackup(event.target.files?.[0])} />
              <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()} className="mt-3 px-3 py-2 text-sm">JSONを選択</Button>
            </>
          )}
        </div>
      </Card>
      {status && <p className="mt-2 px-1 text-xs text-text2" role="status">{status}</p>}
      <Modal open={candidate != null} title="バックアップを復元" onClose={() => setCandidate(null)}>
        <p className="text-sm leading-relaxed text-text2">「{candidateName}」で現在の端末データを置き換えます。置き換え前のデータは自動でダウンロードします。</p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" full onClick={() => setCandidate(null)} disabled={busy}>キャンセル</Button>
          <Button full onClick={() => void confirmRestore()} disabled={busy}>{busy ? '復元中…' : '復元する'}</Button>
        </div>
      </Modal>
    </>
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
            className="flex min-h-11 items-center gap-1 rounded-md bg-tint px-2.5 py-1 text-xs font-semibold text-ink active:bg-tint-strong disabled:opacity-40"
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
          className="min-h-11 w-24 rounded-[10px] border border-transparent bg-grouped px-3 py-1.5 text-sm text-ink outline-none placeholder:text-text3 focus:border-ink"
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
