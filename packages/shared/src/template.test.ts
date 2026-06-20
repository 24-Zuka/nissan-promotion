import { describe, it, expect } from 'vitest';
import { renderTemplate, tokenTag, TEMPLATE_TOKENS } from './template.js';

describe('renderTemplate', () => {
  it('既知トークンを実値で置換する', () => {
    const body = '{{顧客名}}様、{{予定日}}に{{車種}}の件でご連絡しました。';
    const out = renderTemplate(body, {
      顧客名: '山田 太郎',
      予定日: '2026-07-01',
      車種: 'ノート',
    });
    expect(out).toBe('山田 太郎様、2026-07-01にノートの件でご連絡しました。');
  });

  it('値が無い既知トークンは空文字になる', () => {
    expect(renderTemplate('{{顧客名}}/{{前回要点}}', { 顧客名: '田中' })).toBe('田中/');
  });

  it('null/undefined は空文字に落とす', () => {
    expect(renderTemplate('{{車種}}', { 車種: null })).toBe('');
    expect(renderTemplate('{{車種}}', { 車種: undefined })).toBe('');
  });

  it('未知トークンは残さず空文字にする', () => {
    expect(renderTemplate('a{{不明}}b', {})).toBe('ab');
  });

  it('前後の空白を許容して一致させる', () => {
    expect(renderTemplate('{{ 顧客名 }}', { 顧客名: '佐藤' })).toBe('佐藤');
  });

  it('同一トークンが複数あっても全て置換する', () => {
    expect(renderTemplate('{{顧客名}}{{顧客名}}', { 顧客名: 'A' })).toBe('AA');
  });

  it('トークンが無ければ原文のまま', () => {
    expect(renderTemplate('プレーンテキスト', { 顧客名: 'X' })).toBe('プレーンテキスト');
  });

  it('tokenTag は {{トークン}} を返す', () => {
    expect(tokenTag('顧客名')).toBe('{{顧客名}}');
    for (const t of TEMPLATE_TOKENS) {
      expect(renderTemplate(tokenTag(t), { [t]: '値' } as Record<string, string>)).toBe('値');
    }
  });
});
