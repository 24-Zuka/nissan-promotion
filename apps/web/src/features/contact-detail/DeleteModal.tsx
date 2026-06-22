import { useMutation } from '@tanstack/react-query';
import Modal from '../../components/Modal.js';
import { Button } from '../../components/ui.js';

export default function DeleteModal({
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
  const remove = useMutation({ mutationFn: deleteFn, onSuccess: onDeleted });

  return (
    <Modal open title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-text2">{message}</p>
      {remove.isError && <div className="mb-2 text-sm text-overdue">削除に失敗しました。</div>}
      <div className="flex gap-2">
        <Button variant="outline" full onClick={onClose}>キャンセル</Button>
        <Button variant="destructive" full onClick={() => remove.mutate()} disabled={remove.isPending}>
          {remove.isPending ? '削除中…' : '削除する'}
        </Button>
      </div>
    </Modal>
  );
}
