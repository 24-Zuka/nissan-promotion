/**
 * 顧客一覧。  [担当: Sub D — UI]
 * - api.listContacts()。ランク順 → 氏名。新規作成(api.createContact)モーダル。
 * - 行タップで /contacts/:id へ。
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RANKS, RANK_ORDER, type Contact, type ContactCreateInput, type Rank } from '@crm/shared';
import { api } from '../lib/api.js';
import AppHeader from '../components/AppHeader.js';
import RankBadge from '../components/RankBadge.js';
import Modal from '../components/Modal.js';
import { Field, Select, TextInput } from '../components/Field.js';

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => api.listContacts(),
  });

  const sorted = [...(data ?? [])].sort((a, b) => {
    const r = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    return r !== 0 ? r : a.name.localeCompare(b.name, 'ja');
  });

  return (
    <div className="min-h-screen pb-10">
      <AppHeader
        title="顧客一覧"
        back="/"
        right={
          <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-nissan">
            ＋新規顧客
          </button>
        }
      />

      {isLoading && <div className="p-6 text-center text-gray-500">読み込み中…</div>}
      {isError && <div className="p-6 text-center text-nissan">読み込みに失敗しました。</div>}

      {!isLoading && !isError && (
        <div className="p-4">
          {sorted.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm">
              顧客が登録されていません。
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl shadow-sm">
              {sorted.map((c: Contact) => (
                <Link
                  key={c.id}
                  to={`/contacts/${c.id}`}
                  className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 last:border-b-0 active:bg-gray-50"
                >
                  <RankBadge rank={c.rank} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-gray-900">{c.name}</div>
                    {(c.phone || c.email) && (
                      <div className="truncate text-xs text-gray-500">{c.phone ?? c.email}</div>
                    )}
                  </div>
                  <span className="text-gray-300">›</span>
                </Link>
              ))}
            </div>
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
    </div>
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
    mutationFn: (input: ContactCreateInput) => api.createContact(input),
    onSuccess: () => {
      setName('');
      setRank('B');
      setPhone('');
      setEmail('');
      onCreated();
    },
  });

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
      <Field label="氏名" required>
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
      <Field label="メール">
        <TextInput value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
      </Field>

      {create.isError && <div className="mb-2 text-sm text-nissan">登録に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={!name.trim() || create.isPending}
        className="mt-2 w-full rounded-xl bg-nissan py-3 font-bold text-white active:opacity-80 disabled:opacity-40"
      >
        {create.isPending ? '登録中…' : '登録'}
      </button>
    </Modal>
  );
}
