/**
 * ビルド時の動作モード。
 *
 * STATIC_MODE: サーバー(API)を一切使わず、ブラウザ完結で動かすモード（GitHub Pages 配信用）。
 *   - ログインはローカル PIN 照合（lib/localAuth.ts）。
 *   - データは IndexedDB（Dexie）のみが本体。サーバー差分同期は無効化。
 *   - 顧客データは各ブラウザ内に閉じるため、URL を知った他人には空のアプリしか見えない。
 *
 * `npm run dev` や通常ビルド（サーバー併用）では false。
 * GitHub Pages 用ビルド時に `VITE_STATIC=1` で有効化する。
 */
export const STATIC_MODE = import.meta.env.VITE_STATIC === '1';
