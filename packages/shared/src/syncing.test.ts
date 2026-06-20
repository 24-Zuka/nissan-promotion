import { describe, it, expect } from 'vitest';
import {
  applyChanges,
  applyEntity,
  coalesceOutbox,
  maxSyncToken,
  type OutboxEntry,
} from './syncing.js';

describe('coalesceOutbox', () => {
  const e = (seq: number, op: OutboxEntry['op'], entity: Record<string, unknown>): OutboxEntry => ({
    seq,
    table: 'contacts',
    op,
    entity: entity as { id: string },
  });

  it('create→update を1件にマージし create を維持する', () => {
    const out = coalesceOutbox([
      e(1, 'create', { id: 'a', name: 'X' }),
      e(2, 'update', { id: 'a', name: 'Y', phone: '090' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].op).toBe('create');
    expect(out[0].entity).toEqual({ id: 'a', name: 'Y', phone: '090' });
  });

  it('途中で delete が来たら最終は delete（中間編集は無視）', () => {
    const out = coalesceOutbox([
      e(1, 'create', { id: 'a', name: 'X' }),
      e(2, 'update', { id: 'a', name: 'Y' }),
      e(3, 'delete', { id: 'a' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].op).toBe('delete');
    expect(out[0].entity).toEqual({ id: 'a' });
  });

  it('別 id は別イベントとして出現順を保つ', () => {
    const out = coalesceOutbox([
      e(2, 'update', { id: 'b', name: 'B' }),
      e(1, 'create', { id: 'a', name: 'A' }),
    ]);
    expect(out.map((o) => o.entity.id)).toEqual(['a', 'b']); // seq 昇順で a が先
  });

  it('既存への update のみなら update のまま', () => {
    const out = coalesceOutbox([e(5, 'update', { id: 'a', rank: 'A' })]);
    expect(out[0].op).toBe('update');
  });
});

describe('applyEntity', () => {
  it('deleted_at 付きはローカルから除去する', () => {
    const m = new Map([['a', { id: 'a', deleted_at: null }]]);
    applyEntity(m, { id: 'a', deleted_at: '2026-01-01T00:00:00Z' });
    expect(m.has('a')).toBe(false);
  });
  it('通常はupsert', () => {
    const m = new Map<string, { id: string; deleted_at?: string | null; v?: number }>();
    applyEntity(m, { id: 'a', v: 1 });
    applyEntity(m, { id: 'a', v: 2 });
    expect(m.get('a')?.v).toBe(2);
  });
});

describe('applyChanges', () => {
  it('テーブルごとに upsert / delete を反映する', () => {
    const current = {
      contacts: [{ id: 'c1', deleted_at: null, name: '旧' }],
      tasks: [{ id: 't1', deleted_at: null }],
    } as Record<string, Array<{ id: string; deleted_at?: string | null; name?: string }>>;

    const next = applyChanges(current, {
      contacts: [
        { id: 'c1', deleted_at: null, name: '新' }, // 更新
        { id: 'c2', deleted_at: null, name: '追加' }, // 追加
      ],
      tasks: [{ id: 't1', deleted_at: '2026-01-01T00:00:00Z' }], // 削除
    });

    expect(next.contacts.find((c) => c.id === 'c1')?.name).toBe('新');
    expect(next.contacts.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
    expect(next.tasks).toHaveLength(0);
  });

  it('全テーブルのキーを必ず返す（空配列含む）', () => {
    const next = applyChanges({}, {});
    expect(Object.keys(next).sort()).toEqual(
      ['contacts', 'notes', 'settings', 'tasks', 'templates', 'vehicles'].sort(),
    );
  });
});

describe('maxSyncToken', () => {
  it('大きい方を返す', () => {
    expect(maxSyncToken(3, 10)).toBe(10);
    expect(maxSyncToken(10, 3)).toBe(10);
  });
});
