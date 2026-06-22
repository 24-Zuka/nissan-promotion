/**
 * 文例テンプレート管理。  [Phase 1 — Templates UI]
 * - カテゴリ(maintenance/followup)別に一覧。作成/編集/削除。
 * - 本文に {{顧客名}}{{予定日}}{{車種}}{{前回要点}} を差し込みトークンとして使える。
 *   実際の差し込みは顧客詳細の「文面生成」で行う（renderTemplate）。
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_TOKENS,
  tokenTag,
  type Template,
  type TemplateCategory,
  type TemplateCreateInput,
} from '@crm/shared';
import * as store from '../lib/store.js';
import AppHeader from '../components/AppHeader.js';
import Modal from '../components/Modal.js';
import { Field, Select, TextArea, TextInput } from '../components/Field.js';
import ErrorState from '../components/ErrorState.js';
import { Button } from '../components/ui.js';
import { getFieldErrors } from '../lib/formErrors.js';

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  maintenance: '点検・車検',
  followup: '営業フォロー',
};

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Template | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['templates'],
    queryFn: () => store.listTemplates(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => store.deleteTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['templates'] });
    setEditing(null);
    setCreating(false);
  };

  const byCategory = (cat: TemplateCategory) => (data ?? []).filter((t) => t.category === cat);

  return (
    <div className="min-h-screen pb-10">
      <AppHeader
        title="文例テンプレート"
        back="/settings"
        right={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-[15px] font-semibold text-ink active:opacity-60"
          >
            ＋新規
          </button>
        }
      />

      {isLoading && <div className="p-6 text-center text-text2">読み込み中…</div>}
      {isError && <div className="mx-auto max-w-content p-4"><ErrorState onRetry={() => void refetch()} /></div>}

      {!isLoading && !isError && (
        <div className="mx-auto max-w-content space-y-5 p-4">
          {TEMPLATE_CATEGORIES.map((cat) => {
            const list = byCategory(cat);
            return (
              <section key={cat}>
                <div className="mb-1.5 px-1 font-mono text-[11px] uppercase tracking-[0.04em] text-text3">
                  {CATEGORY_LABEL[cat]}
                </div>
                {list.length === 0 ? (
                  <div className="rounded-card bg-surface p-5 text-center text-sm text-text3 shadow-card">
                    テンプレートはありません。
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-card shadow-card">
                    {list.map((t) => (
                      <div
                        key={t.id}
                        className="border-b border-separator bg-surface px-4 py-3 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-[15px] font-medium text-ink">{t.name}</div>
                          <div className="flex shrink-0 gap-3 text-sm">
                            <button
                              type="button"
                              onClick={() => setEditing(t)}
                              className="font-semibold text-ink active:opacity-60"
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(t)}
                              className="font-semibold text-overdue active:opacity-60"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-text2">
                          {t.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          <p className="px-1 text-xs text-text3">
            本文に {TEMPLATE_TOKENS.map(tokenTag).join(' ')} を入れると、顧客詳細の「文面生成」で
            実際の値に差し込めます。
          </p>
        </div>
      )}

      <TemplateModal
        open={creating || editing !== null}
        template={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={onSaved}
      />
      <Modal open={deleting != null} title="テンプレートを削除" onClose={() => setDeleting(null)}>
        <p className="mb-4 text-sm text-text2">「{deleting?.name}」を削除します。</p>
        {remove.isError && <p className="mb-2 text-sm text-overdue">削除できませんでした。</p>}
        <div className="flex gap-2">
          <Button variant="outline" full onClick={() => setDeleting(null)}>キャンセル</Button>
          <Button variant="destructive" full disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}>
            {remove.isPending ? '削除中…' : '削除する'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function TemplateModal({
  open,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // template が変わったら初期値を同期する（key で再マウントするため state 初期値で十分）。
  return open ? (
    <TemplateForm
      key={template?.id ?? 'new'}
      template={template}
      onClose={onClose}
      onSaved={onSaved}
    />
  ) : null;
}

function TemplateForm({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? '');
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? 'followup');
  const [body, setBody] = useState(template?.body ?? '');

  const save = useMutation({
    mutationFn: (input: TemplateCreateInput) =>
      template ? store.updateTemplate(template.id, input) : store.createTemplate(input),
    onSuccess: onSaved,
  });
  const errors = getFieldErrors(save.error);

  const insertToken = (tag: string) => setBody((b) => b + tag);

  const submit = () => {
    if (!name.trim() || !body.trim()) return;
    save.mutate({ name: name.trim(), category, body });
  };

  return (
    <Modal open title={template ? 'テンプレート編集' : '新規テンプレート'} onClose={onClose}>
      <Field label="名称" required error={errors.name}>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="車検案内" />
      </Field>
      <Field label="カテゴリ" required>
        <Select value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)}>
          {TEMPLATE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="本文" required error={errors.body}>
        <TextArea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
      </Field>

      <div className="mb-3 flex flex-wrap gap-1">
        {TEMPLATE_TOKENS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => insertToken(tokenTag(t))}
            className="rounded-full bg-tint px-2.5 py-1 text-xs font-medium text-ink active:bg-tint-strong"
          >
            ＋{t}
          </button>
        ))}
      </div>

      {save.isError && <div className="mb-2 text-sm text-overdue">保存に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={!name.trim() || !body.trim() || save.isPending}
        className="mt-1 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink active:opacity-80 disabled:opacity-40"
      >
        {save.isPending ? '保存中…' : '保存'}
      </button>
    </Modal>
  );
}
