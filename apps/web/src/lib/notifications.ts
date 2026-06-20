/**
 * ローカル通知スケジュール。  [担当: Sub E — NOTIFICATION]
 *
 * 仕様 7.1: 期限 30/7/1/当日 に Notification API でリマインド。
 * - requestPermission(): ブラウザ許可を取得。
 * - scheduleNotifications(): オープンタスク一覧と設定を受け取り、
 *   今日が offset に該当するタスクについてブラウザ通知を発行。
 *
 * MVP では Service Worker の showNotification ではなく
 * new Notification() を使用（アプリがフォアグラウンド時のみ）。
 * バックグラウンド通知は次フェーズで SW push に移行予定。
 */
import { diffDays, todayInTokyo, type DateString } from '@crm/shared';

export type NotificationPermission = 'granted' | 'denied' | 'default';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  return Notification.requestPermission();
}

export function getPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

interface NotifiableTask {
  id: string;
  title: string;
  due_date: DateString;
  contact_name?: string;
}

export function scheduleNotifications(
  tasks: NotifiableTask[],
  offsets: number[],
  enabled: boolean,
): void {
  if (!enabled) return;
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  const today = todayInTokyo();
  const offsetSet = new Set(offsets);

  for (const task of tasks) {
    const daysUntilDue = diffDays(task.due_date, today);
    if (!offsetSet.has(daysUntilDue)) continue;

    const label =
      daysUntilDue === 0
        ? '本日期限'
        : `${daysUntilDue}日後に期限`;
    const who = task.contact_name ? `（${task.contact_name}）` : '';

    new Notification(`${label}: ${task.title}${who}`, {
      body: `期限: ${task.due_date}`,
      tag: `task-${task.id}-${daysUntilDue}`,
      icon: '/favicon.ico',
    });
  }
}
