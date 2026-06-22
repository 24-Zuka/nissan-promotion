export type FieldErrors = Record<string, string>;

export function getFieldErrors(error: unknown): FieldErrors {
  if (!error || typeof error !== 'object' || !('issues' in error)) return {};
  const issues = (error as { issues?: Array<{ path?: Array<string | number>; message?: string }> }).issues;
  if (!Array.isArray(issues)) return {};
  const result: FieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path?.[0] ?? '_form');
    if (!result[key]) result[key] = issue.message || '入力内容をご確認ください。';
  }
  return result;
}

export function getSafeErrorMessage(error: unknown, fallback = '処理に失敗しました。もう一度お試しください。'): string {
  const fields = getFieldErrors(error);
  return fields._form ?? Object.values(fields)[0] ?? fallback;
}
