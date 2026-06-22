import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleNotifications } from './notifications.js';

describe('scheduleNotifications', () => {
  const NotificationMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: Object.assign(NotificationMock, { permission: 'granted', requestPermission: vi.fn() }),
    });
    NotificationMock.mockClear();
  });

  it('does not show the same task notification twice on the same day', async () => {
    const due = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
    const task = { id: 't1', title: '電話フォロー', due_date: due };
    await scheduleNotifications([task], [0], true);
    await scheduleNotifications([task], [0], true);
    expect(NotificationMock).toHaveBeenCalledTimes(1);
  });
});
