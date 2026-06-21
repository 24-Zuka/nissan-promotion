/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 意味づけは index.css の CSS 変数（Light/Dark 自動切替）に委譲。
        ink: 'var(--ink)',
        'on-ink': 'var(--on-ink)',
        text2: 'var(--text-2)',
        text3: 'var(--text-3)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        grouped: 'var(--bg)',
        separator: 'var(--separator)',
        tint: 'var(--tint)',
        'tint-strong': 'var(--tint-strong)',
        overdue: 'var(--overdue)',
        today: 'var(--today)',
        done: 'var(--done)',
        'rank-b': 'var(--rank-b)',
        'rank-c': 'var(--rank-c)',
        'rank-c-ink': 'var(--rank-c-ink)',
        'rank-d-border': 'var(--rank-d-border)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04)',
        pop: '0 6px 16px rgba(0,0,0,0.10)',
        sheet: '0 20px 48px rgba(0,0,0,0.20)',
      },
      borderRadius: {
        card: '14px',
        sheet: '20px',
      },
      maxWidth: {
        content: '680px',
      },
    },
  },
  plugins: [],
};
