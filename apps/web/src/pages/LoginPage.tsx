/**
 * ログイン画面。  [担当: Sub D — UI]
 * - username(初期 "kai") + PIN(初期ヒント 1206) を入力 → useAuth().login → 成功で "/" へ遷移。
 * - 失敗時はメッセージ表示（理由は区別しない）。テンキー風UI（iPhone向け）。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('kai');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const press = (k: string) => {
    setError('');
    if (k === 'del') setPin((p) => p.slice(0, -1));
    else if (k && pin.length < 12) setPin((p) => p + k);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), pin);
      navigate('/');
    } catch {
      setError('ログインできませんでした。入力をご確認ください。');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="text-2xl font-bold text-nissan">NISSAN CRM</div>
        <div className="mt-1 text-sm text-gray-500">営業フォロー支援</div>
      </div>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium text-gray-700">ユーザー名</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-nissan focus:ring-1 focus:ring-nissan"
        />
      </label>

      <div className="mb-2 text-sm font-medium text-gray-700">PIN（初期 1206）</div>
      <div className="mb-4 flex items-center justify-center gap-3" aria-label="PIN桁数">
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${i < pin.length ? 'bg-nissan' : 'bg-gray-300'}`}
          />
        ))}
      </div>

      {error && <div className="mb-3 text-center text-sm text-nissan">{error}</div>}

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k, i) =>
          k === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              className="rounded-xl bg-white py-4 text-xl font-semibold text-gray-800 shadow active:bg-gray-100"
            >
              {k === 'del' ? '⌫' : k}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy || pin.length < 4 || !username.trim()}
        className="mt-6 w-full rounded-xl bg-nissan py-3 text-base font-bold text-white active:opacity-80 disabled:opacity-40"
      >
        {busy ? '確認中…' : 'ログイン'}
      </button>
    </div>
  );
}
