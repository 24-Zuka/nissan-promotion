/**
 * ローカル PIN 照合（STATIC_MODE 専用）。
 *
 * GitHub Pages のようなサーバー無しの配信では、サーバー側の scrypt 照合が使えない。
 * そこで PIN を PBKDF2-SHA256 でハッシュ化した値（平文ではない）をバンドルに埋め込み、
 * ブラウザの Web Crypto で照合する。仕様の「平文保存禁止」は満たす。
 *
 * セキュリティ注記: 静的配信ではハッシュ・ソルトは公開され得る（4桁 PIN は総当たり可能）。
 * これは本人の端末ローカルデータに対する“鍵”であり、強固な認証ではない。ただし顧客データ自体は
 * 各ブラウザの IndexedDB に閉じ、サーバーにも他人にも渡らないため、漏洩面は端末内に限定される。
 *
 * 既定 PIN 1206 に対応するハッシュ（SALT/ITERATIONS は下記固定値）。PIN を変えるときは
 * 同じパラメータで再計算して PIN_HASH_HEX を差し替える。
 */
const SALT = 'crm-static-v1';
const ITERATIONS = 100_000;
const PIN_HASH_HEX = '001efb91080b57ee3b10306051ad0473cafdc2bf2f9ac8e5432ecce04e818dcc';

async function derive(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 桁数非依存の定数時間比較（長さ違いは即 false）。 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const hash = await derive(pin);
  return timingSafeEqual(hash, PIN_HASH_HEX);
}
