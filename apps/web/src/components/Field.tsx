/**
 * フォーム用の汎用フィールド（label + input/select 等）。
 * 入力は淡い面（grouped）に角丸、フォーカスで 2px Ink の枠（仕様書 06 コンポーネント）。
 */
import { cloneElement, isValidElement, useId, type ReactElement } from 'react';

const baseInput =
  'w-full rounded-[10px] border border-transparent bg-grouped px-3.5 py-3 text-[16px] text-ink outline-none placeholder:text-text3 focus:border-ink';

export function Field({
  label,
  required,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string; 'aria-labelledby'?: string }>;
  error?: string;
}) {
  const generatedId = useId();
  const inputId = children.props.id ?? generatedId;
  const labelId = `${inputId}-label`;
  const errorId = `${inputId}-error`;
  const input = isValidElement(children)
    ? cloneElement(children, {
        id: inputId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : children.props['aria-describedby'],
        'aria-labelledby': children.props['aria-labelledby'] ?? labelId,
      })
    : children;

  return (
    <label className="mb-3.5 block" htmlFor={inputId}>
      <span id={labelId} className="mb-1.5 block text-[13px] font-medium text-text2">
        {label}
        {required && <span className="ml-1 text-overdue">*</span>}
      </span>
      {input}
      {error && <span id={errorId} className="mt-1.5 block text-xs text-overdue">{error}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${baseInput} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${baseInput} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${baseInput} ${props.className ?? ''}`} />;
}
