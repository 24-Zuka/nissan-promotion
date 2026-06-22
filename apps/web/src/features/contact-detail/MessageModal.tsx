import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { renderTemplate, type Contact, type Note, type Template, type Vehicle } from '@crm/shared';
import type { TaskWithContact } from '../../lib/api.js';
import * as store from '../../lib/store.js';
import Modal from '../../components/Modal.js';
import { Field, Select, TextArea } from '../../components/Field.js';

export default function MessageModal({
  contact,
  vehicles,
  notes,
  tasks,
  onClose,
}: {
  contact: Contact;
  vehicles: Vehicle[];
  notes: Note[];
  tasks: TaskWithContact[];
  onClose: () => void;
}) {
  const templatesQ = useQuery({ queryKey: ['templates'], queryFn: () => store.listTemplates() });
  const [templateId, setTemplateId] = useState('');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  const vars = {
    顧客名: contact.name,
    予定日: tasks[0]?.due_date ?? '',
    車種: vehicles[0]?.name ?? '',
    前回要点: notes[0]?.summary ?? '',
  };

  const apply = (template: Template | undefined) => {
    setCopied(false);
    setText(template ? renderTemplate(template.body, vars) : '');
  };

  const onPick = (id: string) => {
    setTemplateId(id);
    apply((templatesQ.data ?? []).find((template) => template.id === id));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const templates = templatesQ.data ?? [];
  return (
    <Modal open title="文面生成" onClose={onClose}>
      {templatesQ.isError ? (
        <p className="text-sm text-overdue">テンプレートを読み込めませんでした。</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-text2">テンプレートがありません。設定 → 文例テンプレートで作成してください。</p>
      ) : (
        <>
          <Field label="テンプレート" required>
            <Select value={templateId} onChange={(event) => onPick(event.target.value)}>
              <option value="">選択してください</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </Select>
          </Field>
          <Field label="生成された文面（編集可）">
            <TextArea rows={6} value={text} onChange={(event) => setText(event.target.value)} />
          </Field>
          <button type="button" onClick={() => void copy()} disabled={!text} className="mt-1 min-h-11 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink active:opacity-80 disabled:opacity-40">
            {copied ? 'コピーしました ✓' : 'クリップボードにコピー'}
          </button>
          <p className="mt-2 text-xs text-text3">
            差し込み: 顧客名={vars.顧客名 || '—'} / 予定日={vars.予定日 || '—'} / 車種={vars.車種 || '—'} / 前回要点={vars.前回要点 ? '最新メモ' : '—'}
          </p>
        </>
      )}
    </Modal>
  );
}
