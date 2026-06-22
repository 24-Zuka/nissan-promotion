/**
 * 顧客一覧。  [担当: Sub D — UI]
 * - store.listContacts()。ランク順 → 氏名。新規作成モーダル。検索（氏名/電話/メール）。
 * - ランク（A〜D）ごとにグループ化（mono 見出し）。行タップで /contacts/:id へ。
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RANKS, type Contact, type ContactCreateInput, type Rank } from '@crm/shared';
import * as store from '../lib/store.js';
import Screen from '../components/Screen.js';
import { Button, Card, SectionLabel } from '../components/ui.js';
import RankBadge from '../components/RankBadge.js';
import Modal from '../components/Modal.js';
import { Field, Select, TextInput } from '../components/Field.js';
import ErrorState from '../components/ErrorState.js';
import { getFieldErrors } from '../lib/formErrors.js';

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => store.listContacts(),
  });

  const needle = q.trim().toLowerCase();
  const filtered = (data ?? []).filter((c) => {
    if (!needle) return true;
    return [c.name, c.phone, c.email].some((v) => v?.toLowerCase().includes(needle));
  });

  const byRank = (r: Rank) =>
    filtered.filter((c) => c.rank === r).sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const addButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="新規顧客"
      className="grid h-9 w-9 place-items-center rounded-full bg-tint text-2xl font-light leading-none text-ink active:bg-tint-strong"
    >
      +
    </button>
  );

  return (
    <Screen title="顧客" action={addButton}>
      {/* 検索 */}
      <div className="mb-4 flex items-center gap-2 rounded-[10px] bg-surface px-3 py-2.5 shadow-card">
        <span className="text-text3">⌕</span>
        <input
          aria-label="顧客を検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="検索"
          className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-text3"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text2 active:bg-tint" aria-label="検索をクリア">×</button>
        )}
      </div>

      {!isLoading && !isError && data && (
        <div className="mb-3 px-1 text-xs text-text2">{filtered.length}件 / 全{data.length}件</div>
      )}

      {isLoading && <div className="py-10 text-center text-text2">読み込み中…</div>}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && (
        <div className="space-y-5">
          {filtered.length === 0 ? (
            <Card className="px-6 py-12">
              <div className="text-center text-text2">
                {needle ? '該当する顧客がいません。' : '顧客が登録されていません。'}
              </div>
            </Card>
          ) : (
            RANKS.map((r) => {
              const list = byRank(r);
              if (list.length === 0) return null;
              return (
                <section key={r}>
                  <SectionLabel>RANK {r}</SectionLabel>
                  <Card>
                    {list.map((c: Contact) => (
                      <Link
                        key={c.id}
                        to={`/contacts/${c.id}`}
                        className="flex items-center gap-3 border-b border-separator px-4 py-3 last:border-b-0 active:bg-tint"
                      >
                        <RankBadge rank={c.rank} size={26} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-medium text-ink">{c.name}</div>
                          {(c.phone || c.email) && (
                            <div className="truncate text-xs text-text2">{c.phone ?? c.email}</div>
                          )}
                        </div>
                        <span className="text-text3">›</span>
                      </Link>
                    ))}
                  </Card>
                </section>
              );
            })
          )}
        </div>
      )}

      <NewContactModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
          setOpen(false);
        }}
      />
    </Screen>
  );
}

function NewContactModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [rank, setRank] = useState<Rank>('B');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const create = useMutation({
    mutationFn: (input: ContactCreateInput) => store.createContact(input),
    onSuccess: () => {
      setName('');
      setRank('B');
      setPhone('');
      setEmail('');
      onCreated();
    },
  });
  const errors = getFieldErrors(create.error);

  const submit = () => {
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(),
      rank,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    });
  };

  return (
    <Modal open={open} title="新規顧客" onClose={onClose}>
      <Field label="氏名" required error={errors.name}>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" />
      </Field>
      <Field label="ランク" required>
        <Select value={rank} onChange={(e) => setRank(e.target.value as Rank)}>
          {RANKS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="電話番号">
        <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      </Field>
      <Field label="メール" error={errors.email}>
        <TextInput value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
      </Field>

      {create.isError && <div className="mb-2 text-sm text-overdue">登録に失敗しました。</div>}

      <Button full onClick={submit} disabled={!name.trim() || create.isPending} className="mt-2">
        {create.isPending ? '登録中…' : '登録'}
      </Button>
    </Modal>
  );
}
