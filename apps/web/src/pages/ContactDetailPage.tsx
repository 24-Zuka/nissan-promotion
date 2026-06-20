/**
 * 顧客詳細。  [担当: Sub D — UI / 仕様3.2・3.3]
 * - 顧客情報(必須/任意項目)・車両リスト・直近メモ・未完タスクを表示。
 * - 「メモ追加」: api.createNote（body.task で次アクションも同時登録＝時短UI）。
 * - 「タスク追加」: api.createTask（メンテ系は vehicle_id 必須）。
 * - 「車両追加」: api.createVehicle（generate_maintenance チェックでメンテ自動生成）。
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INSPECTION_PROFILES,
  INSPECTION_PROFILE_LABEL,
  isMaintenanceTaskType,
  renderTemplate,
  TASK_TYPE,
  TASK_TYPE_LABEL,
  todayInTokyo,
  VEHICLE_CONDITIONS,
  type Contact,
  type InspectionProfile,
  type Note,
  type NoteCreateInput,
  type TaskCreateInput,
  type TaskType,
  type Template,
  type Vehicle,
  type VehicleCondition,
  type VehicleCreateInput,
} from '@crm/shared';
import type { TaskWithContact } from '../lib/api.js';
import { api } from '../lib/api.js';
import AppHeader from '../components/AppHeader.js';
import RankBadge from '../components/RankBadge.js';
import Modal from '../components/Modal.js';
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
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<null | 'note' | 'task' | 'vehicle' | 'message'>(null);

  const contactQ = useQuery({ queryKey: ['contact', id], queryFn: () => api.getContact(id) });
  const vehiclesQ = useQuery({ queryKey: ['vehicles', id], queryFn: () => api.listVehicles(id) });
  const notesQ = useQuery({ queryKey: ['notes', id], queryFn: () => api.listNotes(id) });
  const tasksQ = useQuery({
    queryKey: ['tasks', { contact_id: id, status: 'open' }],
    queryFn: () => api.listTasks({ contact_id: id, status: 'open' }),
  });

  const close = () => setModal(null);
  const invalidate = (keys: unknown[][]) => {
    for (const k of keys) queryClient.invalidateQueries({ queryKey: k });
    close();
  };

  const c = contactQ.data;

  return (
    <div className="min-h-screen pb-10">
      <AppHeader title={c?.name ?? '顧客詳細'} back="/contacts" right={c && <RankBadge rank={c.rank} />} />

      {contactQ.isLoading && <div className="p-6 text-center text-gray-500">読み込み中…</div>}
      {contactQ.isError && <div className="p-6 text-center text-nissan">読み込みに失敗しました。</div>}

      {c && (
        <div className="space-y-4 p-4">
          {/* 顧客情報 */}
          <Section title="顧客情報">
            <dl className="divide-y divide-gray-100">
              <InfoRow label="電話" value={c.phone} />
              <InfoRow label="メール" value={c.email} />
              {OPTIONAL_FIELDS.map(
                (f) => c[f.key] != null && c[f.key] !== '' && (
                  <InfoRow key={f.key as string} label={f.label} value={String(c[f.key])} />
                ),
              )}
            </dl>
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
            className="w-full rounded-xl bg-nissan py-2.5 text-sm font-bold text-white active:opacity-80"
          >
            ✉ テンプレートから文面生成
          </button>

          {/* 未完タスク */}
          <Section title="未完タスク">
            {tasksQ.data && tasksQ.data.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {tasksQ.data.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-gray-900">{t.title}</span>
                    <span className="text-xs text-gray-500">{t.due_date}</span>
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
              <ul className="divide-y divide-gray-100">
                {vehiclesQ.data.map((v: Vehicle) => (
                  <li key={v.id} className="py-2 text-sm">
                    <div className="font-medium text-gray-900">
                      {v.name ?? '（車名未設定）'}
                      <span className="ml-2 text-xs text-gray-500">
                        {v.condition === 'used' ? '中古' : '新車'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {v.model_code && `型式 ${v.model_code}`}
                      {v.shaken_expiry_date && ` / 車検満了 ${v.shaken_expiry_date}`}
                    </div>
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
                  <li key={n.id} className="text-sm">
                    <div className="text-xs text-gray-400">{n.date}</div>
                    <div className="text-gray-900">{n.summary}</div>
                    {n.reaction && <div className="text-xs text-gray-500">反応: {n.reaction}</div>}
                    {n.next_action && (
                      <div className="text-xs text-gray-500">次アクション: {n.next_action}</div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>メモはまだありません。</Empty>
            )}
          </Section>
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
    </div>
  );
}

/* ---------- 表示用の小コンポーネント ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-bold text-gray-700">{title}</h2>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-3 py-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right text-gray-900">{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-2 text-sm text-gray-400">{children}</div>;
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-nissan bg-white py-2 text-sm font-bold text-nissan active:bg-red-50"
    >
      {label}
    </button>
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
    mutationFn: (input: NoteCreateInput) => api.createNote(input),
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

      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
        <input type="checkbox" checked={withTask} onChange={(e) => setWithTask(e.target.checked)} />
        次アクションもタスク登録する
      </label>

      {withTask && (
        <div className="mb-3 rounded-lg bg-gray-50 p-3">
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
            <p className="text-xs text-nissan">
              メンテ系タスクは車両との紐付けが必要です。車両を指定する場合は「タスク追加」をご利用ください。
            </p>
          )}
        </div>
      )}

      {create.isError && <div className="mb-2 text-sm text-nissan">登録に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={!summary.trim() || create.isPending}
        className="mt-1 w-full rounded-xl bg-nissan py-3 font-bold text-white active:opacity-80 disabled:opacity-40"
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
    mutationFn: (input: TaskCreateInput) => api.createTask(input),
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
        <div className="mb-2 text-xs text-nissan">
          メンテ系タスクには車両が必要です。先に車両を追加してください。
        </div>
      )}
      {create.isError && <div className="mb-2 text-sm text-nissan">登録に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={blocked || create.isPending}
        className="mt-1 w-full rounded-xl bg-nissan py-3 font-bold text-white active:opacity-80 disabled:opacity-40"
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
  const templatesQ = useQuery({ queryKey: ['templates'], queryFn: () => api.listTemplates() });
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
        <p className="text-sm text-gray-500">
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
            className="mt-1 w-full rounded-xl bg-nissan py-3 font-bold text-white active:opacity-80 disabled:opacity-40"
          >
            {copied ? 'コピーしました ✓' : 'クリップボードにコピー'}
          </button>
          <p className="mt-2 text-xs text-gray-400">
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
    mutationFn: (input: VehicleCreateInput) => api.createVehicle(input),
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
        <div className="mb-2 text-xs text-nissan">中古車は車検満了日が必須です。</div>
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

      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
        <input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)} />
        点検・車検スケジュールを自動生成する
      </label>

      {create.isError && <div className="mb-2 text-sm text-nissan">登録に失敗しました。</div>}

      <button
        type="button"
        onClick={submit}
        disabled={blocked || create.isPending}
        className="mt-1 w-full rounded-xl bg-nissan py-3 font-bold text-white active:opacity-80 disabled:opacity-40"
      >
        {create.isPending ? '登録中…' : '登録'}
      </button>
    </Modal>
  );
}
