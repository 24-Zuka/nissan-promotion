/**
 * 顧客詳細。  [担当: Sub D — UI / 仕様3.2・3.3]
 * - 顧客情報(必須/任意項目)・車両リスト・直近メモ・未完タスクを表示。
 * - 「メモ追加」: api.createNote（body.task で次アクションも同時登録＝時短UI）。
 * - 「タスク追加」: api.createTask（メンテ系は vehicle_id 必須）。
 * - 「車両追加」: api.createVehicle（generate_maintenance チェックでメンテ自動生成）。
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INSPECTION_PROFILES,
  INSPECTION_PROFILE_LABEL,
  isMaintenanceTaskType,
  RANKS,
  renderTemplate,
  TASK_TYPE,
  TASK_TYPE_LABEL,
  todayInTokyo,
  VEHICLE_CONDITIONS,
  type Contact,
  type ContactCreateInput,
  type InspectionProfile,
  type Note,
  type NoteCreateInput,
  type Rank,
  type TaskCreateInput,
  type TaskStatus,
  type TaskType,
  type Template,
  type Vehicle,
  type VehicleCondition,
  type VehicleCreateInput,
} from '@crm/shared';
import type { TaskWithContact } from '../lib/api.js';
import * as store from '../lib/store.js';
import AppHeader from '../components/AppHeader.js';
import RankBadge from '../components/RankBadge.js';
import Modal from '../components/Modal.js';
import { Card, SectionLabel } from '../components/ui.js';
import { Field, Select, TextArea, TextInput } from '../components/Field.js';

const OPTIONAL_FIELDS: { key: keyof Contact; label: string }[] = [
  { key: 'family', label: '家族構成' },
  { key: 'usage', label: '用途' },
  { key: 'budget', label: '予算' },
  { key: 'desired_equipment', label: '希望装備' },
  { key: 'rival_car', label: '競合車' },
  { key: 'insurance_status', label: '保険状況' },
];

export default function ContactDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<
    null | 'note' | 'task' | 'vehicle' | 'message' | 'edit'
  >(null);
  // 個別アイテムの編集モーダル（対象を保持）。
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [editTask, setEditTask] = useState<TaskWithContact | null>(null);
  // 削除確認（タイトル/文言/実行/後処理を保持し、1つの DeleteModal で使い回す）。
  const [del, setDel] = useState<{
    title: string;
    message: string;
    run: () => Promise<void>;
    after: () => void;
  } | null>(null);

  const contactQ = useQuery({ queryKey: ['contact', id], queryFn: () => store.getContact(id) });
  const vehiclesQ = useQuery({ queryKey: ['vehicles', id], queryFn: () => store.listVehicles(id) });
  const notesQ = useQuery({ queryKey: ['notes', id], queryFn: () => store.listNotes(id) });
  const tasksQ = useQuery({
    queryKey: ['tasks', { contact_id: id, status: 'open' }],
    queryFn: () => store.listTasks({ contact_id: id, status: 'open' }),
  });

  const close = () => setModal(null);
  const invalidateKeys = (keys: unknown[][]) => {
    for (const k of keys) queryClient.invalidateQueries({ queryKey: k });
  };
  const invalidate = (keys: unknown[][]) => {
    invalidateKeys(keys);
    close();
  };
  const closeEdits = () => {
    setEditVehicle(null);
    setEditNote(null);
    setEditTask(null);
  };

  // キー定義（編集/削除後の invalidate に使い回す）。
  const TASK_KEYS: unknown[][] = [['tasks', { contact_id: id, status: 'open' }], ['tasks']];
  const c = contactQ.data;

  return (
    <div className="min-h-screen bg-grouped pb-10">
      <AppHeader
        title="顧客"
        back="/contacts"
        right={
          c && (
            <button
              type="button"
              onClick={() => setModal('edit')}
              className="text-[15px] text-ink active:opacity-60"
            >
              編集
            </button>
          )
        }
      />

      {contactQ.isLoading && <div className="p-6 text-center text-text2">読み込み中…</div>}
      {contactQ.isError && <div className="p-6 text-center text-overdue">読み込みに失敗しました。</div>}

      {c && (
        <div className="mx-auto max-w-content space-y-4 p-4">
          {/* 顧客ヘッダー（アバター＋氏名） */}
          <div className="flex items-center gap-3 px-1 pt-1">
            <RankBadge rank={c.rank} size={44} className="text-[17px]" />
            <div className="min-w-0">
              <div className="truncate text-[24px] font-semibold tracking-tight text-ink">{c.name}</div>
              {c.phone && <div className="text-[13px] text-text2">{c.phone}</div>}
            </div>
          </div>

          {/* 顧客情報 */}
          <Section title="顧客情報">
            {c.phone || c.email || OPTIONAL_FIELDS.some((f) => c[f.key] != null && c[f.key] !== '') ? (
              <dl className="divide-y divide-separator">
                <InfoRow label="電話" value={c.phone} />
                <InfoRow label="メール" value={c.email} />
                {OPTIONAL_FIELDS.map(
                  (f) => c[f.key] != null && c[f.key] !== '' && (
                    <InfoRow key={f.key as string} label={f.label} value={String(c[f.key])} />
                  ),
                )}
              </dl>
            ) : (
              <Empty>連絡先は未登録です。「編集」から追加できます。</Empty>
            )}
          </Section>

          {/* アクション */}
          <div className="grid grid-cols-3 gap-2">
            <ActionBtn label="メモ追加" onClick={() => setModal('note')} />
            <ActionBtn label="タスク追加" onClick={() => setModal('task')} />
            <ActionBtn label="車両追加" onClick={() => setModal('vehicle')} />
          </div>
          <button
            type="button"
            onClick={() => setModal('message')}
            className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-on-ink active:opacity-80"
          >
            ✉ テンプレートから文面生成
          </button>

          {/* 未完タスク */}
          <Section title="未完タスク">
            {tasksQ.data && tasksQ.data.length > 0 ? (
              <ul className="divide-y divide-separator">
                {tasksQ.data.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="text-ink">{t.title}</span>
                      <span className="ml-2 text-xs text-text2">{t.due_date}</span>
                    </div>
                    <RowActions
                      onEdit={() => setEditTask(t)}
                      onDelete={() =>
                        setDel({
                          title: 'タスクを削除',
                          message: `「${t.title}」を削除します。`,
                          run: () => store.deleteTask(t.id),
                          after: () => invalidateKeys(TASK_KEYS),
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>未完タスクはありません。</Empty>
            )}
          </Section>

          {/* 車両リスト */}
          <Section title="車両リスト">
            {vehiclesQ.data && vehiclesQ.data.length > 0 ? (
              <ul className="divide-y divide-separator">
                {vehiclesQ.data.map((v: Vehicle) => (
                  <li key={v.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-ink">
                        {v.name ?? '（車名未設定）'}
                        <span className="ml-2 text-xs text-text2">
                          {v.condition === 'used' ? '中古' : '新車'}
                        </span>
                      </div>
                      <div className="text-xs text-text2">
                        {v.model_code && `型式 ${v.model_code}`}
                        {v.shaken_expiry_date && ` / 車検満了 ${v.shaken_expiry_date}`}
                      </div>
                    </div>
                    <RowActions
                      onEdit={() => setEditVehicle(v)}
                      onDelete={() =>
                        setDel({
                          title: '車両を削除',
                          message: `「${v.name ?? '（車名未設定）'}」を削除します。`,
                          run: () => store.deleteVehicle(v.id),
                          after: () => invalidateKeys([['vehicles', id], ...TASK_KEYS]),
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>車両は登録されていません。</Empty>
            )}
          </Section>

          {/* 直近メモ */}
          <Section title="直近メモ">
            {notesQ.data && notesQ.data.length > 0 ? (
              <ul className="space-y-3">
                {notesQ.data.slice(0, 5).map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="text-xs text-text3">{n.date}</div>
                      <div className="text-ink">{n.summary}</div>
                      {n.reaction && <div className="text-xs text-text2">反応: {n.reaction}</div>}
                      {n.next_action && (
                        <div className="text-xs text-text2">次アクション: {n.next_action}</div>
                      )}
                    </div>
                    <RowActions
                      onEdit={() => setEditNote(n)}
                      onDelete={() =>
                        setDel({
                          title: 'メモを削除',
                          message: 'このメモを削除します。',
                          run: () => store.deleteNote(n.id),
                          after: () => invalidateKeys([['notes', id]]),
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>メモはまだありません。</Empty>
            )}
          </Section>

          {/* 削除 */}
          <button
            type="button"
            onClick={() =>
              setDel({
                title: '顧客を削除',
                message: `「${c.name}」を削除します。一覧から消え、関連情報も表示されなくなります。`,
                run: () => store.deleteContact(id),
                after: () => {
                  queryClient.invalidateQueries({ queryKey: ['contacts'] });
                  navigate('/contacts');
                },
              })
            }
            className="w-full rounded-xl border border-separator bg-surface py-3 text-sm font-semibold text-overdue active:bg-tint"
          >
            この顧客を削除
          </button>
        </div>
      )}

      {modal === 'note' && (
        <NoteModal
          contactId={id}
          onClose={close}
          onDone={() => invalidate([['notes', id], ['tasks', { contact_id: id, status: 'open' }], ['tasks']])}
        />
      )}
      {modal === 'task' && (
        <TaskModal
          contactId={id}
          vehicles={vehiclesQ.data ?? []}
          onClose={close}
          onDone={() => invalidate([['tasks', { contact_id: id, status: 'open' }], ['tasks']])}
        />
      )}
      {modal === 'vehicle' && (
        <VehicleModal
          contactId={id}
          onClose={close}
          onDone={() => invalidate([['vehicles', id], ['tasks', { contact_id: id, status: 'open' }], ['tasks']])}
        />
      )}
      {modal === 'message' && c && (
        <MessageModal
          contact={c}
          vehicles={vehiclesQ.data ?? []}
          notes={notesQ.data ?? []}
          tasks={tasksQ.data ?? []}
          onClose={close}
        />
      )}
      {modal === 'edit' && c && (
        <EditModal
          contact={c}
          onClose={close}
          onDone={() => invalidate([['contact', id], ['contacts'], ['tasks']])}
        />
      )}
      {editVehicle && (
        <EditVehicleModal
          vehicle={editVehicle}
          onClose={closeEdits}
          onDone={() => {
            invalidateKeys([['vehicles', id]]);
            closeEdits();
          }}
        />
      )}
      {editNote && (
        <EditNoteModal
          note={editNote}
          onClose={closeEdits}
          onDone={() => {
            invalidateKeys([['notes', id]]);
            closeEdits();
          }}
        />
      )}
      {editTask && (
        <EditTaskModal
          task={editTask}
          vehicles={vehiclesQ.data ?? []}
          onClose={closeEdits}
          onDone={() => {
            invalidateKeys(TASK_KEYS);
            closeEdits();
          }}
        />
      )}
      {del && (
        <DeleteModal
          title={del.title}
          message={del.message}
          deleteFn={del.run}
          onClose={() => setDel(null)}
          onDeleted={() => {
            del.after();
            setDel(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- 顧客編集（ランク・氏名・連絡先・任意項目） ---------- */

function EditModal({
  contact,
  onClose,
  onDone,
}: {
  contact: Contact;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(contact.name);
  const [rank, setRank] = useState<Rank>(contact.rank);
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [email, setEmail] = useState(contact.email ?? '');
  const [optional, setOptional] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      OPTIONAL_FIELDS.map((f) => [f.key as string, (contact[f.key] as string | null) ?? '']),
    ),
  );

  const update = useMutation({
    mutationFn: (input: Partial<ContactCreateInput>) => store.updateContact(contact.id, input),
    onSuccess: onDone,
  });

  const submit = () => {
    if (!name.trim()) return;
    const input: Partial<ContactCreateInput> = {
      name: name.trim(),
      rank,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    };
    for (const f of OPTIONAL_FIELDS) {
      (input as Record<string, unknown>)[f.key as string] = optional[f.key as string]?.trim() || undefined;
    }
    update.mutate(input);
  };

  return (
    <Modal open title="顧客を編集" onClose={onClose}>
      <Field label="氏名" required>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
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
      {OPTIONAL_FIELDS.map((f) => (
        <Field key={f.key as string} label={f.label}>
          <TextInput
            value={optional[f.key as string] ?? ''}
            onChange={(e) =>
              setOptional((prev) => ({ ...prev, [f.key as string]: e.target.value }))
            }
          />
        </Field>
      ))}

      {update.isError && <div className="mb-2 text-sm text-overdue">保存に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={!name.trim() || update.isPending}
        className="mt-1 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink active:opacity-80 disabled:opacity-40"
      >
        {update.isPending ? '保存中…' : '保存'}
      </button>
    </Modal>
  );
}

/* ---------- 汎用削除（確認）。顧客/車両/メモ/タスクで共用 ---------- */

function DeleteModal({
  title,
  message,
  onClose,
  onDeleted,
  deleteFn,
}: {
  title: string;
  message: string;
  onClose: () => void;
  onDeleted: () => void;
  deleteFn: () => Promise<void>;
}) {
  const del = useMutation({ mutationFn: deleteFn, onSuccess: onDeleted });

  return (
    <Modal open title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-text2">{message}</p>
      {del.isError && <div className="mb-2 text-sm text-overdue">削除に失敗しました。</div>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-separator bg-surface py-3 font-semibold text-ink active:bg-tint"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={() => del.mutate()}
          disabled={del.isPending}
          className="flex-1 rounded-xl bg-overdue py-3 font-semibold text-white active:opacity-80 disabled:opacity-40"
        >
          {del.isPending ? '削除中…' : '削除する'}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- 表示用の小コンポーネント ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      <Card className="p-4">{children}</Card>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-3 py-2 text-sm">
      <dt className="text-text2">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-2 text-sm text-text3">{children}</div>;
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-separator bg-surface py-2.5 text-sm font-semibold text-ink active:bg-tint"
    >
      {label}
    </button>
  );
}

/** リスト行の「編集 / 削除」操作。 */
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <button type="button" onClick={onEdit} className="text-xs font-semibold text-ink active:opacity-60">
        編集
      </button>
      <button type="button" onClick={onDelete} className="text-xs font-semibold text-overdue active:opacity-60">
        削除
      </button>
    </div>
  );
}

/* ---------- メモ追加（次アクション同時登録あり） ---------- */

function NoteModal({
  contactId,
  onClose,
  onDone,
}: {
  contactId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = todayInTokyo();
  const [date, setDate] = useState(today);
  const [summary, setSummary] = useState('');
  const [reaction, setReaction] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [withTask, setWithTask] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>(TASK_TYPE.FOLLOW_CALL);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState(today);

  const create = useMutation({
    mutationFn: (input: NoteCreateInput) => store.createNote(input),
    onSuccess: onDone,
  });

  const submit = () => {
    if (!summary.trim()) return;
    const input: NoteCreateInput = {
      contact_id: contactId,
      date,
      summary: summary.trim(),
      reaction: reaction.trim() || undefined,
      next_action: nextAction.trim() || undefined,
    };
    if (withTask && taskTitle.trim()) {
      input.task = { type: taskType, title: taskTitle.trim(), due_date: taskDue };
    }
    create.mutate(input);
  };

  return (
    <Modal open title="メモ追加" onClose={onClose}>
      <Field label="日付" required>
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="要点" required>
        <TextArea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>
      <Field label="相手の反応">
        <TextInput value={reaction} onChange={(e) => setReaction(e.target.value)} />
      </Field>
      <Field label="次の一手">
        <TextInput value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
      </Field>

      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-text2">
        <input type="checkbox" checked={withTask} onChange={(e) => setWithTask(e.target.checked)} />
        次アクションもタスク登録する
      </label>

      {withTask && (
        <div className="mb-3 rounded-[10px] bg-grouped p-3">
          <Field label="種別" required>
            <Select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)}>
              {Object.values(TASK_TYPE).map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="タイトル" required>
            <TextInput value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          </Field>
          <Field label="期限" required>
            <TextInput type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
          </Field>
          {isMaintenanceTaskType(taskType) && (
            <p className="text-xs text-overdue">
              メンテ系タスクは車両との紐付けが必要です。車両を指定する場合は「タスク追加」をご利用ください。
            </p>
          )}
        </div>
      )}

      {create.isError && <div className="mb-2 text-sm text-overdue">登録に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={!summary.trim() || create.isPending}
        className="mt-1 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink active:opacity-80 disabled:opacity-40"
      >
        {create.isPending ? '登録中…' : '登録'}
      </button>
    </Modal>
  );
}

/* ---------- タスク追加 ---------- */

function TaskModal({
  contactId,
  vehicles,
  onClose,
  onDone,
}: {
  contactId: string;
  vehicles: Vehicle[];
  onClose: () => void;
  onDone: () => void;
}) {
  const today = todayInTokyo();
  const [type, setType] = useState<TaskType>(TASK_TYPE.FOLLOW_CALL);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(today);
  const [vehicleId, setVehicleId] = useState('');

  const create = useMutation({
    mutationFn: (input: TaskCreateInput) => store.createTask(input),
    onSuccess: onDone,
  });

  const needsVehicle = isMaintenanceTaskType(type);
  const blocked = !title.trim() || (needsVehicle && !vehicleId);

  const submit = () => {
    if (blocked) return;
    create.mutate({
      contact_id: contactId,
      type,
      title: title.trim(),
      due_date: due,
      vehicle_id: vehicleId || undefined,
    });
  };

  return (
    <Modal open title="タスク追加" onClose={onClose}>
      <Field label="種別" required>
        <Select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
          {Object.values(TASK_TYPE).map((t) => (
            <option key={t} value={t}>
              {TASK_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="タイトル" required>
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={TASK_TYPE_LABEL[type]}
        />
      </Field>
      <Field label="期限" required>
        <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field label="車両" required={needsVehicle}>
        <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="">{needsVehicle ? '車両を選択' : '（任意）'}</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name ?? '（車名未設定）'}
            </option>
          ))}
        </Select>
      </Field>

      {needsVehicle && vehicles.length === 0 && (
        <div className="mb-2 text-xs text-overdue">
          メンテ系タスクには車両が必要です。先に車両を追加してください。
        </div>
      )}
      {create.isError && <div className="mb-2 text-sm text-overdue">登録に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={blocked || create.isPending}
        className="mt-1 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink active:opacity-80 disabled:opacity-40"
      >
        {create.isPending ? '登録中…' : '登録'}
      </button>
    </Modal>
  );
}

/* ---------- テンプレートから文面生成 ---------- */

function MessageModal({
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

  // 差し込み元: 顧客名 / 直近の未完タスク期限 / 先頭車両の車名 / 最新メモ要点。
  const vars = {
    顧客名: contact.name,
    予定日: tasks[0]?.due_date ?? '',
    車種: vehicles[0]?.name ?? '',
    前回要点: notes[0]?.summary ?? '',
  };

  const apply = (tpl: Template | undefined) => {
    setCopied(false);
    setText(tpl ? renderTemplate(tpl.body, vars) : '');
  };

  const onPick = (id: string) => {
    setTemplateId(id);
    apply((templatesQ.data ?? []).find((t) => t.id === id));
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
      {templates.length === 0 ? (
        <p className="text-sm text-text2">
          テンプレートがありません。設定 → 文例テンプレートで作成してください。
        </p>
      ) : (
        <>
          <Field label="テンプレート" required>
            <Select value={templateId} onChange={(e) => onPick(e.target.value)}>
              <option value="">選択してください</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="生成された文面（編集可）">
            <TextArea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>

          <button
            type="button"
            onClick={copy}
            disabled={!text}
            className="mt-1 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink active:opacity-80 disabled:opacity-40"
          >
            {copied ? 'コピーしました ✓' : 'クリップボードにコピー'}
          </button>
          <p className="mt-2 text-xs text-text3">
            差し込み: 顧客名={vars.顧客名 || '—'} / 予定日={vars.予定日 || '—'} / 車種=
            {vars.車種 || '—'} / 前回要点={vars.前回要点 ? '最新メモ' : '—'}
          </p>
        </>
      )}
    </Modal>
  );
}

/* ---------- 車両追加 ---------- */

function VehicleModal({
  contactId,
  onClose,
  onDone,
}: {
  contactId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [condition, setCondition] = useState<VehicleCondition>('new');
  const [registration, setRegistration] = useState('');
  const [delivery, setDelivery] = useState('');
  const [shaken, setShaken] = useState('');
  const [profile, setProfile] = useState<InspectionProfile>('standard');
  const [generate, setGenerate] = useState(true);

  const create = useMutation({
    mutationFn: (input: VehicleCreateInput) => store.createVehicle(input),
    onSuccess: onDone,
  });

  const usedNeedsShaken = condition === 'used' && !shaken;
  const blocked = !name.trim() || usedNeedsShaken;

  const submit = () => {
    if (blocked) return;
    create.mutate({
      contact_id: contactId,
      name: name.trim(),
      model_code: modelCode.trim() || undefined,
      condition,
      registration_date: registration || undefined,
      delivery_date: delivery || undefined,
      shaken_expiry_date: shaken || undefined,
      inspection_profile: profile,
      generate_maintenance: generate,
    });
  };

  return (
    <Modal open title="車両追加" onClose={onClose}>
      <Field label="車名" required>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="ノート e-POWER" />
      </Field>
      <Field label="型式">
        <TextInput value={modelCode} onChange={(e) => setModelCode(e.target.value)} />
      </Field>
      <Field label="状態" required>
        <Select value={condition} onChange={(e) => setCondition(e.target.value as VehicleCondition)}>
          {VEHICLE_CONDITIONS.map((co) => (
            <option key={co} value={co}>
              {co === 'used' ? '中古' : '新車'}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="登録日">
        <TextInput type="date" value={registration} onChange={(e) => setRegistration(e.target.value)} />
      </Field>
      <Field label="納車日">
        <TextInput type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
      </Field>
      <Field label="車検満了日" required={condition === 'used'}>
        <TextInput type="date" value={shaken} onChange={(e) => setShaken(e.target.value)} />
      </Field>
      {usedNeedsShaken && (
        <div className="mb-2 text-xs text-overdue">中古車は車検満了日が必須です。</div>
      )}
      <Field label="車検周期">
        <Select value={profile} onChange={(e) => setProfile(e.target.value as InspectionProfile)}>
          {INSPECTION_PROFILES.map((p) => (
            <option key={p} value={p}>
              {INSPECTION_PROFILE_LABEL[p]}
            </option>
          ))}
        </Select>
      </Field>

      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-text2">
        <input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)} />
        点検・車検スケジュールを自動生成する
      </label>

      {create.isError && <div className="mb-2 text-sm text-overdue">登録に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={blocked || create.isPending}
        className="mt-1 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink active:opacity-80 disabled:opacity-40"
      >
        {create.isPending ? '登録中…' : '登録'}
      </button>
    </Modal>
  );
}

/* ---------- 車両編集 ---------- */

function EditVehicleModal({
  vehicle,
  onClose,
  onDone,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(vehicle.name ?? '');
  const [modelCode, setModelCode] = useState(vehicle.model_code ?? '');
  const [condition, setCondition] = useState<VehicleCondition>(vehicle.condition);
  const [registration, setRegistration] = useState(vehicle.registration_date ?? '');
  const [delivery, setDelivery] = useState(vehicle.delivery_date ?? '');
  const [shaken, setShaken] = useState(vehicle.shaken_expiry_date ?? '');
  const [profile, setProfile] = useState<InspectionProfile>(vehicle.inspection_profile);

  const update = useMutation({
    mutationFn: (input: Partial<VehicleCreateInput>) => store.updateVehicle(vehicle.id, input),
    onSuccess: onDone,
  });

  const usedNeedsShaken = condition === 'used' && !shaken;
  const blocked = !name.trim() || usedNeedsShaken;

  const submit = () => {
    if (blocked) return;
    update.mutate({
      name: name.trim(),
      model_code: modelCode.trim() || null,
      condition,
      registration_date: registration || null,
      delivery_date: delivery || null,
      shaken_expiry_date: shaken || null,
      inspection_profile: profile,
    });
  };

  return (
    <Modal open title="車両を編集" onClose={onClose}>
      <Field label="車名" required>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="型式">
        <TextInput value={modelCode} onChange={(e) => setModelCode(e.target.value)} />
      </Field>
      <Field label="状態" required>
        <Select value={condition} onChange={(e) => setCondition(e.target.value as VehicleCondition)}>
          {VEHICLE_CONDITIONS.map((co) => (
            <option key={co} value={co}>
              {co === 'used' ? '中古' : '新車'}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="登録日">
        <TextInput type="date" value={registration} onChange={(e) => setRegistration(e.target.value)} />
      </Field>
      <Field label="納車日">
        <TextInput type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
      </Field>
      <Field label="車検満了日" required={condition === 'used'}>
        <TextInput type="date" value={shaken} onChange={(e) => setShaken(e.target.value)} />
      </Field>
      {usedNeedsShaken && (
        <div className="mb-2 text-xs text-overdue">中古車は車検満了日が必須です。</div>
      )}
      <Field label="車検周期">
        <Select value={profile} onChange={(e) => setProfile(e.target.value as InspectionProfile)}>
          {INSPECTION_PROFILES.map((p) => (
            <option key={p} value={p}>
              {INSPECTION_PROFILE_LABEL[p]}
            </option>
          ))}
        </Select>
      </Field>

      <p className="mb-2 text-xs text-text3">
        ※ 既存の点検・車検タスクは自動で再生成されません（必要に応じてタスクを編集してください）。
      </p>
      {update.isError && <div className="mb-2 text-sm text-overdue">保存に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={blocked || update.isPending}
        className="mt-1 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink active:opacity-80 disabled:opacity-40"
      >
        {update.isPending ? '保存中…' : '保存'}
      </button>
    </Modal>
  );
}

/* ---------- メモ編集 ---------- */

function EditNoteModal({
  note,
  onClose,
  onDone,
}: {
  note: Note;
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(note.date);
  const [summary, setSummary] = useState(note.summary);
  const [reaction, setReaction] = useState(note.reaction ?? '');
  const [nextAction, setNextAction] = useState(note.next_action ?? '');

  const update = useMutation({
    mutationFn: () =>
      store.updateNote(note.id, {
        date,
        summary: summary.trim(),
        reaction: reaction.trim() || null,
        next_action: nextAction.trim() || null,
      }),
    onSuccess: onDone,
  });

  const submit = () => {
    if (!summary.trim()) return;
    update.mutate();
  };

  return (
    <Modal open title="メモを編集" onClose={onClose}>
      <Field label="日付" required>
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="要点" required>
        <TextArea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>
      <Field label="相手の反応">
        <TextInput value={reaction} onChange={(e) => setReaction(e.target.value)} />
      </Field>
      <Field label="次の一手">
        <TextInput value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
      </Field>

      {update.isError && <div className="mb-2 text-sm text-overdue">保存に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={!summary.trim() || update.isPending}
        className="mt-1 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink active:opacity-80 disabled:opacity-40"
      >
        {update.isPending ? '保存中…' : '保存'}
      </button>
    </Modal>
  );
}

/* ---------- タスク編集 ---------- */

const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'open', label: '未完' },
  { value: 'hold', label: '保留' },
  { value: 'done', label: '完了' },
];

function EditTaskModal({
  task,
  vehicles,
  onClose,
  onDone,
}: {
  task: TaskWithContact;
  vehicles: Vehicle[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState<TaskType>(task.type);
  const [title, setTitle] = useState(task.title);
  const [detail, setDetail] = useState(task.detail ?? '');
  const [due, setDue] = useState(task.due_date);
  const [vehicleId, setVehicleId] = useState(task.vehicle_id ?? '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [notify, setNotify] = useState(task.notify);

  const update = useMutation({
    mutationFn: (input: store.TaskEditInput) => store.updateTask(task.id, input),
    onSuccess: onDone,
  });

  const needsVehicle = isMaintenanceTaskType(type);
  const blocked = !title.trim() || (needsVehicle && !vehicleId);

  const submit = () => {
    if (blocked) return;
    update.mutate({
      type,
      title: title.trim(),
      detail: detail.trim() || null,
      due_date: due,
      status,
      notify,
      vehicle_id: vehicleId || null,
    });
  };

  return (
    <Modal open title="タスクを編集" onClose={onClose}>
      <Field label="種別" required>
        <Select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
          {Object.values(TASK_TYPE).map((t) => (
            <option key={t} value={t}>
              {TASK_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="タイトル" required>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="詳細">
        <TextInput value={detail} onChange={(e) => setDetail(e.target.value)} />
      </Field>
      <Field label="期限" required>
        <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field label="状態" required>
        <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
          {TASK_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="車両" required={needsVehicle}>
        <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="">{needsVehicle ? '車両を選択' : '（任意）'}</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name ?? '（車名未設定）'}
            </option>
          ))}
        </Select>
      </Field>

      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-text2">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        期限が近づいたら通知する
      </label>

      {needsVehicle && vehicles.length === 0 && (
        <div className="mb-2 text-xs text-overdue">
          メンテ系タスクには車両が必要です。先に車両を追加してください。
        </div>
      )}
      {update.isError && <div className="mb-2 text-sm text-overdue">保存に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={blocked || update.isPending}
        className="mt-1 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink active:opacity-80 disabled:opacity-40"
      >
        {update.isPending ? '保存中…' : '保存'}
      </button>
    </Modal>
  );
}
