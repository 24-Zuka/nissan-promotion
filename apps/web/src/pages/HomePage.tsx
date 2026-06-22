/**
 * ホーム（今日のフォロー）。  [担当: Sub D — UI / 仕様3.1]
 * - api.listTasks({status:'open'}) を取得し、shared の compareHomeTasks / bucketFor で
 *   期限切れ→今日→近日 に分類。各バケット内はランクA優先・期限昇順。
 * - ワンタップ完了: store.completeTask（楽観更新 → invalidate）。
 * - 大見出し＋日付、バケットは色付きドット＋ラベル＋件数。導線は下部タブバー。
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bucketFor,
  compareHomeTasks,
  type DueBucket,
  type Rank,
  todayInTokyo,
} from '@crm/shared';
import type { TaskWithContact } from '../lib/api.js';
import * as store from '../lib/store.js';
import { scheduleNotifications } from '../lib/notifications.js';
import Screen from '../components/Screen.js';
import { Card } from '../components/ui.js';
import TaskRow from '../components/TaskRow.js';
import ErrorState from '../components/ErrorState.js';
import SyncStatusBadge from '../components/SyncStatusBadge.js';
import { useToast } from '../components/Toast.js';

const tasksKey = ['tasks', { status: 'open' }] as const;

const SECTIONS: { bucket: DueBucket; label: string; dot: string; text: string }[] = [
  { bucket: 'overdue', label: '期限切れ', dot: 'bg-overdue', text: 'text-overdue' },
  { bucket: 'today', label: '今日', dot: 'bg-today', text: 'text-today' },
  { bucket: 'soon', label: '近日', dot: 'bg-text3', text: 'text-text2' },
];

function todayLabel(): string {
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(new Date());
  } catch {
    return todayInTokyo();
  }
}

export default function HomePage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const today = todayInTokyo();
  const [showLater, setShowLater] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: tasksKey,
    queryFn: () => store.listTasks({ status: 'open' }),
  });

  const complete = useMutation({
    mutationFn: (id: string) => store.completeTask(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: tasksKey });
      const prev = queryClient.getQueryData<TaskWithContact[]>(tasksKey);
      queryClient.setQueryData<TaskWithContact[]>(tasksKey, (old) =>
        (old ?? []).filter((t) => t.id !== id),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(tasksKey, ctx.prev);
      showToast({ message: 'タスクを完了できませんでした。もう一度お試しください。' });
    },
    onSuccess: (_result, id) => {
      showToast({
        message: 'タスクを完了しました。',
        duration: 8000,
        actionLabel: '元に戻す',
        onAction: async () => {
          await store.updateTask(id, { status: 'open' });
          await queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => store.getSettings(),
    staleTime: 5 * 60_000,
  });

  const notifiedRef = useRef(false);
  useEffect(() => {
    if (notifiedRef.current || !data || !settingsQuery.data) return;
    notifiedRef.current = true;
    const s = settingsQuery.data;
    void scheduleNotifications(
      data.map((t) => ({
        id: t.id,
        title: t.title,
        due_date: t.due_date,
        contact_name: t.contact_name,
      })),
      s.notify_offsets_days,
      s.notifications_enabled,
    );
  }, [data, settingsQuery.data]);

  const onComplete = (id: string) => complete.mutate(id);

  const withRank = (data ?? []).map((t) => ({
    ...t,
    rank: (t.contact_rank as Rank) ?? 'D',
  }));
  const sorted = [...withRank].sort(compareHomeTasks(today));
  const byBucket = (b: DueBucket) => sorted.filter((t) => bucketFor(t.due_date, today) === b);
  const laterTasks = byBucket('later');
  const overdueCount = byBucket('overdue').length;
  const todayCount = byBucket('today').length;
  const soonCount = byBucket('soon').length;

  return (
    <Screen
      title="今日のフォロー"
      subtitle={<div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>{todayLabel()}</span><SyncStatusBadge /></div>}
      contentClassName="max-w-[1120px]"
    >
      {isLoading && <div className="py-10 text-center text-text2">読み込み中…</div>}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
          <div className="space-y-5">
            {SECTIONS.map((s) => {
              const list = byBucket(s.bucket);
              if (list.length === 0) return null;
              return (
                <section key={s.bucket}>
                  <div className="mb-2 flex items-center gap-1.5 px-1">
                    <span className={`h-[7px] w-[7px] rounded-full ${s.dot}`} />
                    <span className={`text-[13px] font-semibold ${s.text}`}>{s.label}</span>
                    <span className="text-[13px] text-text3">{list.length}</span>
                  </div>
                  <Card>
                    {list.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        onComplete={onComplete}
                        completing={complete.isPending && complete.variables === t.id}
                      />
                    ))}
                  </Card>
                </section>
              );
            })}

            {sorted.length === 0 && (
              <Card className="px-6 py-12">
                <div className="text-center text-text2">対応が必要なタスクはありません。</div>
              </Card>
            )}

            {laterTasks.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowLater((v) => !v)}
                  className="mb-2 px-1 text-[13px] font-medium text-text2 active:opacity-60"
                >
                  {showLater ? '▾' : '▸'} それ以降（{laterTasks.length}）
                </button>
                {showLater && (
                  <Card>
                    {laterTasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        onComplete={onComplete}
                        completing={complete.isPending && complete.variables === t.id}
                      />
                    ))}
                  </Card>
                )}
              </section>
            )}
          </div>

          <aside className="mt-0 hidden lg:block" aria-label="今日のサマリー">
            <Card className="sticky top-6 overflow-hidden">
              <div className="border-b border-separator px-5 py-4">
                <h2 className="text-[16px] font-semibold">今日のサマリー</h2>
              </div>
              <dl className="divide-y divide-separator px-5">
                <div className="flex items-center justify-between py-3.5">
                  <dt className="text-[14px] text-text2">今日のタスク</dt>
                  <dd className="text-[18px] font-semibold tabular-nums">{todayCount}件</dd>
                </div>
                <div className="flex items-center justify-between py-3.5">
                  <dt className="text-[14px] text-text2">期限切れ</dt>
                  <dd className="text-[18px] font-semibold tabular-nums text-overdue">{overdueCount}件</dd>
                </div>
                <div className="flex items-center justify-between py-3.5">
                  <dt className="text-[14px] text-text2">近日</dt>
                  <dd className="text-[18px] font-semibold tabular-nums">{soonCount}件</dd>
                </div>
              </dl>
              <div className="p-4">
                <Link
                  to="/contacts"
                  className="flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 text-[14px] font-semibold text-on-ink transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  ＋ 顧客を追加
                </Link>
              </div>
            </Card>
          </aside>
        </div>
      )}
    </Screen>
  );
}
