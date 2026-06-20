/**
 * ホーム（今日やること）。  [担当: Sub D — UI / 仕様3.1]
 * - api.listTasks({status:'open'}) を取得し、shared の compareHomeTasks / bucketFor で
 *   期限切れ(赤)→今日(橙)→近日(青) に分類。各バケット内はランクA優先・期限昇順。
 * - ワンタップ完了: api.completeTask(id)（楽観更新 → invalidate）。
 * - ヘッダに 顧客一覧/設定 への導線。
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
import { api, type TaskWithContact } from '../lib/api.js';
import { scheduleNotifications } from '../lib/notifications.js';
import AppHeader from '../components/AppHeader.js';
import TaskRow from '../components/TaskRow.js';

const tasksKey = ['tasks', { status: 'open' }] as const;

const SECTIONS: { bucket: DueBucket; label: string; color: string }[] = [
  { bucket: 'overdue', label: '期限切れ', color: 'text-nissan' },
  { bucket: 'today', label: '今日', color: 'text-orange-600' },
  { bucket: 'soon', label: '近日', color: 'text-blue-600' },
];

export default function HomePage() {
  const queryClient = useQueryClient();
  const today = todayInTokyo();
  const [showLater, setShowLater] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: tasksKey,
    queryFn: () => api.listTasks({ status: 'open' }),
  });

  const complete = useMutation({
    mutationFn: (id: string) => api.completeTask(id),
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
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
    staleTime: 5 * 60_000,
  });

  const notifiedRef = useRef(false);
  useEffect(() => {
    if (notifiedRef.current || !data || !settingsQuery.data) return;
    notifiedRef.current = true;
    const s = settingsQuery.data;
    scheduleNotifications(
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

  return (
    <div className="min-h-screen pb-10">
      <AppHeader
        title="今日のタスク"
        right={
          <>
            <Link to="/contacts" className="text-sm font-medium text-nissan">
              顧客一覧
            </Link>
            <Link to="/settings" className="text-sm font-medium text-gray-500">
              設定
            </Link>
          </>
        }
      />

      {isLoading && <div className="p-6 text-center text-gray-500">読み込み中…</div>}
      {isError && <div className="p-6 text-center text-nissan">読み込みに失敗しました。</div>}

      {!isLoading && !isError && (
        <div className="space-y-5 p-4">
          {SECTIONS.map((s) => {
            const list = byBucket(s.bucket);
            if (list.length === 0) return null;
            return (
              <section key={s.bucket}>
                <h2 className={`mb-2 px-1 text-sm font-bold ${s.color}`}>
                  {s.label}
                  <span className="ml-2 font-normal text-gray-400">{list.length}件</span>
                </h2>
                <div className="overflow-hidden rounded-xl shadow-sm">
                  {list.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onComplete={onComplete}
                      completing={complete.isPending}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {sorted.length === 0 && (
            <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm">
              対応が必要なタスクはありません。
            </div>
          )}

          {laterTasks.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowLater((v) => !v)}
                className="mb-2 px-1 text-sm font-medium text-gray-500"
              >
                {showLater ? '▾' : '▸'} それ以降（{laterTasks.length}件）
              </button>
              {showLater && (
                <div className="overflow-hidden rounded-xl shadow-sm">
                  {laterTasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onComplete={onComplete}
                      completing={complete.isPending}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
