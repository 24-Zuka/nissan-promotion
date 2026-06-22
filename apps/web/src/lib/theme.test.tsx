import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './theme.js';

function ThemeControls() {
  const { mode, setMode } = useTheme();
  return (
    <>
      <output>{mode}</output>
      <button onClick={() => setMode('light')}>ライト</button>
      <button onClick={() => setMode('dark')}>ダーク</button>
      <button onClick={() => setMode('system')}>端末設定</button>
    </>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('switches themes immediately and remembers the explicit selection', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeControls /></ThemeProvider>);

    expect(screen.getByText('system')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ダーク' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('crm.theme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'ライト' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('crm.theme')).toBe('light');
  });

  it('removes the override when returning to the device setting', async () => {
    localStorage.setItem('crm.theme', 'dark');
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeControls /></ThemeProvider>);

    await user.click(screen.getByRole('button', { name: '端末設定' }));
    expect(localStorage.getItem('crm.theme')).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
