/**
 * conflict.resolve の単体テスト。  [担当: Sub C — SYNC]
 * 純粋関数なのでDB不要。LWW + 優先度(削除>更新>作成) を網羅する。
 */
import { describe, it, expect } from 'vitest';
import { resolve } from './conflict.js';

const T1 = '2026-06-20T10:00:00.000Z';
const T2 = '2026-06-20T11:00:00.000Z'; // T1 より新しい

describe('conflict.resolve', () => {
  it('create on missing row → apply-create', () => {
    expect(resolve({ op: 'create', updated_at: T1 }, undefined)).toBe('apply-create');
  });

  it('update on missing row → apply-create (treated as new)', () => {
    expect(resolve({ op: 'update', updated_at: T1 }, undefined)).toBe('apply-create');
  });

  it('delete on missing row → skip', () => {
    expect(resolve({ op: 'delete', updated_at: T1 }, undefined)).toBe('skip');
  });

  it('newer update wins → apply-update', () => {
    expect(resolve({ op: 'update', updated_at: T2 }, { updated_at: T1 })).toBe('apply-update');
  });

  it('older update is skipped', () => {
    expect(resolve({ op: 'update', updated_at: T1 }, { updated_at: T2 })).toBe('skip');
  });

  it('equal-timestamp update is applied (last write wins, >=)', () => {
    expect(resolve({ op: 'update', updated_at: T1 }, { updated_at: T1 })).toBe('apply-update');
  });

  it('delete beats update at equal timestamp', () => {
    // 同一タイムスタンプでも delete は常に勝つ。
    expect(resolve({ op: 'delete', updated_at: T1 }, { updated_at: T1 })).toBe('apply-delete');
  });

  it('delete on already-deleted row → skip', () => {
    expect(
      resolve({ op: 'delete', updated_at: T2 }, { updated_at: T1, deleted_at: T1 }),
    ).toBe('skip');
  });

  it('delete wins even when its timestamp is older', () => {
    // 優先度ルール: delete は LWW を上回る（未削除なら必ず適用）。
    expect(resolve({ op: 'delete', updated_at: T1 }, { updated_at: T2 })).toBe('apply-delete');
  });

  it('create on existing row folds to update under LWW', () => {
    expect(resolve({ op: 'create', updated_at: T2 }, { updated_at: T1 })).toBe('apply-update');
  });

  it('create on existing row with older ts is skipped', () => {
    expect(resolve({ op: 'create', updated_at: T1 }, { updated_at: T2 })).toBe('skip');
  });

  it('incoming without updated_at is treated as newest', () => {
    expect(resolve({ op: 'update' }, { updated_at: T2 })).toBe('apply-update');
  });
});
