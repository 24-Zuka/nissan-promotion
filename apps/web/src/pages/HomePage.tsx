/**
 * ホーム（今日のフォロー）。  [担当: Sub D — UI / 仕様3.1]
 * - api.listTasks({status:'open'}) を取得し、shared の compareHomeTasks / bucketFor で
 *   期限切れ→今日→近日 に分類。各バケット内はランクA優先・期限昇順。
 * - ワンタップ完了: store.completeTask（楽観更新 → invalidate）。
 * - 大見出し＋日付、バケットは色付きドット＋ラベル＋件数。導線は下部タブバー。
 */
import { useEffect, useRef, useState } from 'react';
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
  const today = todayInTokyo();
  const [showLater, setShowLater] = useState(false);

  const { data, isLoading, isError } = useQuery({
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
    <Screen title="今日のフォロー" subtitle={todayLabel()}>
      {isLoading && <div className="py-10 text-center text-text2">読み込み中…</div>}
      {isError && <div className="py-10 text-center text-overdue">読み込みに失敗しました。</div>}

      {!isLoading && !isError && (
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
                      completing={complete.isPending}
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
                      completing={complete.isPending}
                    />
                  ))}
                </Card>
              )}
            </section>
          )}
        </div>
      )}
    </Screen>
  );
}
