/**
 * Express アプリ生成。テストでは in-memory DB を渡せるよう factory にする。
 */
import express, { type Express } from 'express';
import cors from 'cors';
import type { DB } from './db.js';
import { authRouter } from './routes/auth.js';
import { contactsRouter } from './routes/contacts.js';
import { vehiclesRouter } from './routes/vehicles.js';
import { notesRouter } from './routes/notes.js';
import { tasksRouter } from './routes/tasks.js';
import { templatesRouter } from './routes/templates.js';
import { settingsRouter } from './routes/settings.js';
import { syncRouter } from './sync/index.js';

export function createApp(db: DB): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // ログには顧客情報・本文を出さない（メソッドとパスのみ・仕様9章）。
  app.use((req, _res, next) => {
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${req.path}`);
    next();
  });

  app.get('/api/v1/health', (_req, res) => res.json({ ok: true }));

  // 各リソースは固有プレフィックスにマウント（ルータ間のパス衝突を避ける）。
  const v1 = express.Router();
  v1.use('/auth', authRouter(db));
  v1.use('/contacts', contactsRouter(db));
  v1.use('/vehicles', vehiclesRouter(db));
  v1.use('/notes', notesRouter(db));
  v1.use('/tasks', tasksRouter(db));
  v1.use('/templates', templatesRouter(db));
  v1.use('/settings', settingsRouter(db));
  v1.use('/sync', syncRouter(db));
  app.use('/api/v1', v1);

  return app;
}
