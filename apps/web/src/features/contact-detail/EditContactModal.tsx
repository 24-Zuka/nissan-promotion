import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RANKS, type Contact, type ContactCreateInput, type Rank } from '@crm/shared';
import * as store from '../../lib/store.js';
import { getFieldErrors } from '../../lib/formErrors.js';
import Modal from '../../components/Modal.js';
import { Field, Select, TextInput } from '../../components/Field.js';
import { Button } from '../../components/ui.js';
import { OPTIONAL_CONTACT_FIELDS } from './contactFields.js';

export default function EditContactModal({ contact, onClose, onDone }: { contact: Contact; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(contact.name);
  const [rank, setRank] = useState<Rank>(contact.rank);
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [email, setEmail] = useState(contact.email ?? '');
  const [optional, setOptional] = useState<Record<string, string>>(() =>
    Object.fromEntries(OPTIONAL_CONTACT_FIELDS.map((field) => [field.key as string, (contact[field.key] as string | null) ?? ''])),
  );

  const update = useMutation({
    mutationFn: (input: Partial<ContactCreateInput>) => store.updateContact(contact.id, input),
    onSuccess: onDone,
  });
  const errors = getFieldErrors(update.error);

  const submit = () => {
    if (!name.trim()) return;
    const input: Partial<ContactCreateInput> = {
      name: name.trim(), rank, phone: phone.trim() || undefined, email: email.trim() || undefined,
    };
    for (const field of OPTIONAL_CONTACT_FIELDS) {
      (input as Record<string, unknown>)[field.key as string] = optional[field.key as string]?.trim() || undefined;
    }
    update.mutate(input);
  };

  return (
    <Modal open title="顧客を編集" onClose={onClose}>
      <Field label="氏名" required error={errors.name}>
        <TextInput value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="ランク" required>
        <Select value={rank} onChange={(event) => setRank(event.target.value as Rank)}>
          {RANKS.map((value) => <option key={value} value={value}>{value}</option>)}
        </Select>
      </Field>
      <Field label="電話番号"><TextInput value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></Field>
      <Field label="メール" error={errors.email}><TextInput value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" /></Field>
      {OPTIONAL_CONTACT_FIELDS.map((field) => (
        <Field key={field.key as string} label={field.label}>
          <TextInput value={optional[field.key as string] ?? ''} onChange={(event) => setOptional((previous) => ({ ...previous, [field.key as string]: event.target.value }))} />
        </Field>
      ))}
      {update.isError && Object.keys(errors).length === 0 && <div className="mb-2 text-sm text-overdue">保存に失敗しました。</div>}
      <Button full onClick={submit} disabled={!name.trim() || update.isPending} className="mt-1">
        {update.isPending ? '保存中…' : '保存'}
      </Button>
    </Modal>
  );
}
