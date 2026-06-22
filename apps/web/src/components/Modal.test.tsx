import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal.js';

describe('Modal', () => {
  it('has an accessible title and closes with Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal open title="顧客を編集" onClose={onClose}><input aria-label="氏名" /></Modal>);
    expect(screen.getByRole('dialog', { name: '顧客を編集' })).toBeInTheDocument();
    expect(screen.getByLabelText('氏名')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps Tab focus inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Modal open title="確認" onClose={() => undefined}><button>実行</button></Modal>);
    const close = screen.getByRole('button', { name: '閉じる' });
    const action = screen.getByRole('button', { name: '実行' });
    action.focus();
    await user.tab();
    expect(close).toHaveFocus();
  });
});
