/**
 * APIサーバ起動エントリ。
 */
import { openDb } from './db.js';
import { seed } from './seed.js';
import { createApp } from './server.js';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';
const DB_FILE = process.env.DB_FILE ?? 'apps/api/data/crm.sqlite';
const WEB_DIST = process.env.WEB_DIST;

// 本番では弱い既定シークレットでの稼働を禁止（顧客情報を扱うため）。
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.error('[api] JWT_SECRET is required in production. Set it as an environment variable.');
  process.exit(1);
}

const db = openDb(DB_FILE);
seed(db);
const app = createApp(db, { webDist: WEB_DIST });

app.listen(PORT, HOST, () => {
  // 顧客情報は出さない。起動メタのみ。
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://${HOST}:${PORT} (db=${DB_FILE}, web=${WEB_DIST ?? 'none'})`);
});
