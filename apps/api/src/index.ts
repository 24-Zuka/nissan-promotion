/**
 * APIサーバ起動エントリ。
 */
import { openDb } from './db.js';
import { seed } from './seed.js';
import { createApp } from './server.js';

const PORT = Number(process.env.PORT ?? 4000);
const DB_FILE = process.env.DB_FILE ?? 'apps/api/data/crm.sqlite';

const db = openDb(DB_FILE);
seed(db);
const app = createApp(db);

app.listen(PORT, () => {
  // 顧客情報は出さない。起動メタのみ。
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${PORT} (db=${DB_FILE})`);
});
