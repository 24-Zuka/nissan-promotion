import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field, TextInput } from './Field.js';

describe('Field', () => {
  it('connects field errors to the input', () => {
    render(<Field label="メール" error="メール形式で入力してください"><TextInput /></Field>);
    const input = screen.getByRole('textbox', { name: 'メール' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('メール形式で入力してください');
  });
});
