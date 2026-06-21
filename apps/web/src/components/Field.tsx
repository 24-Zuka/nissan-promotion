/**
 * フォーム用の汎用フィールド（label + input/select 等）。
 * 入力は淡い面（grouped）に角丸、フォーカスで 2px Ink の枠（仕様書 06 コンポーネント）。
 */
import type { ReactNode } from 'react';

const baseInput =
  'w-full rounded-[10px] border border-transparent bg-grouped px-3.5 py-3 text-[16px] text-ink outline-none placeholder:text-text3 focus:border-ink';

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="mb-3.5 block">
      <span className="mb-1.5 block text-[13px] font-medium text-text2">
        {label}
        {required && <span className="ml-1 text-overdue">*</span>}
      </span>
      {children}
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
