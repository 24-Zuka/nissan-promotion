/**
 * 文例テンプレートのプレースホルダ差し込み（純ロジック）。
 *
 * テンプレ本文に `{{顧客名}}` 等のトークンを書いておき、`renderTemplate` で実値へ置換する。
 * 未指定/空のトークンは空文字に落とす（差し込み漏れを画面に残さない）。
 * api/web 双方から参照する単一の真実。
 */

/** 差し込み可能なトークン（表示順）。UI のチップ挿入にも使う。 */
export const TEMPLATE_TOKENS = ['顧客名', '予定日', '車種', '前回要点'] as const;
export type TemplateToken = (typeof TEMPLATE_TOKENS)[number];

/** トークン→実値のマップ。未設定のキーは空文字として扱う。 */
export type TemplateVars = Partial<Record<TemplateToken, string | null | undefined>>;

/** `{{ 顧客名 }}` のような前後空白も許容して一致させる。 */
const TOKEN_RE = /\{\{\s*([^}\s][^}]*?)\s*\}\}/g;

/**
 * 本文中の `{{トークン}}` を vars の値で置換する。
 * - 既知トークンで値が無い/空 → 空文字
 * - 未知トークン → そのまま残さず空文字（誤送信防止）
 */
export function renderTemplate(body: string, vars: TemplateVars): string {
  const known = new Set<string>(TEMPLATE_TOKENS);
  return body.replace(TOKEN_RE, (_match, rawName: string) => {
    const name = rawName.trim();
    if (!known.has(name)) return '';
    const v = vars[name as TemplateToken];
    return v == null ? '' : String(v);
  });
}

/** 挿入用に `{{トークン}}` 文字列を作る（UI のボタンから使う）。 */
export function tokenTag(token: TemplateToken): string {
  return `{{${token}}}`;
}
