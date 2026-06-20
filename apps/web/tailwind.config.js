/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nissan: '#c3002f', // 日産レッド（アクセント）
      },
    },
  },
  plugins: [],
};
