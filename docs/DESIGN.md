# My Dealer CRM 設計書（海さん専用）

営業の「フォロー漏れ」を減らし、点検・車検のフォローを自動生成する個人向け CRM。
本書は現行コードベースの実装に基づく設計の全体像をまとめたもの。仕様変更時はコードと本書を併せて更新する。

- 対象ユーザー: 1 名（日産ディーラー営業「海さん」）。iPhone をメイン、PC を補助とする単一コードベース。
- 配信形態: PWA。**GitHub Pages（静的・ブラウザ完結）** を既定とし、必要なら **Render（サーバーあり・端末間同期）** に切替可能。
- 最終更新: 2026-06-22

---

## 1. 全体像

### 1.1 ねらい
- 取りこぼし防止: 「いつ・誰に・何をするか」をホームに集約し、期限とランクで自動的に優先度付けする。
- 自動化: 車両を登録すると、日産の点検サイクル（新車）／車検満了日（中古）からフォロータスクを自動生成する。
- 個人運用に最適化: サーバーが無くても完結し、無料・カード不要・コールドスタート無しで使える。

### 1.2 2 つの動作モード
本アプリは同一コードのまま 2 モードで動く。切替はビルド時の環境変数 `VITE_STATIC`（`apps/web/src/lib/config.ts`）。

| | 静的モード（既定） | サーバーモード |
| --- | --- | --- |
| ビルド | `VITE_STATIC=1` | 既定（未設定） |
| 配信先 | GitHub Pages | Render（API+Web 同一オリジン） |
| ログイン | ブラウザ内 PIN 照合（`localAuth.ts`） | サーバー scrypt 照合（`auth.ts`） |
| データ本体 | IndexedDB（Dexie）のみ | IndexedDB ＋ サーバー SQLite |
| 端末間同期 | 無し（単一端末） | 有り（差分同期） |
| 顧客データの所在 | 各ブラウザ内に閉じる | サーバーにも保持 |

> 静的モードでは、URL を知った第三者にも「空のアプリ」しか見えない（データは各自の端末内）。
> 端末間で共有したくなったらサーバーモードに切り替える。

---

## 2. アーキテクチャ

### 2.1 モノレポ（npm workspaces）
```
/
├── packages/shared   ドメイン型・zod スキーマ・日付計算・メンテ生成・ホーム分類・同期純ロジック
├── apps/api          Express + better-sqlite3（PIN 認証 / CRUD / 差分同期）
├── apps/web          React + Vite PWA（画面・オフラインストア・カレンダー連携）
├── docs/             設計・API 契約・デプロイ・カレンダー手順
└── index.html 他     ※別目的の販促チラシ資産（本アプリとは独立）
```

| パッケージ | 役割 | 主な依存 |
| --- | --- | --- |
| `@crm/shared` | 両側で共有する型・スキーマ・**純ロジック**（副作用なし＝単体テストしやすい） | zod |
| `@crm/api` | サーバー。認証・CRUD・同期の永続化 | express, better-sqlite3, jsonwebtoken |
| `@crm/web` | クライアント。UI・オフライン同期・カレンダー連携 | react, vite, dexie, @tanstack/react-query, tailwind |

### 2.2 設計原則
- **純ロジックは shared に寄せる**: メンテ生成・日付計算・ホーム分類・同期の差分計算は副作用のない関数にし、サーバー／クライアント双方が同じ実装を使う。これにより両モードで挙動が一致する。
- **オフラインファースト**: 書き込みは即ローカル（Dexie）反映＋アウトボックスへ。オンライン時にバックグラウンドで同期。読み取りも Dexie が一次ソース。
- **ソフトデリート＋単調増加 `seq`**: 全行に `deleted_at` と `seq` を持たせ、削除も含めて差分同期できる。
- **顧客情報をログに出さない**: サーバーはメソッド／パスのみログ出力。氏名・電話・本文等は出さない。

---

## 3. データモデル

全エンティティが共通メタ（`BaseEntity`）を持つ。

```ts
interface BaseEntity {
  id: string;          // uuid
  created_at: string;  // ISO 8601 (UTC)
  updated_at: string;  // ISO 8601 (UTC)
  deleted_at: string | null; // ソフトデリート
  seq: number;         // 単調増加の同期カーソル
}
```

### 3.1 ER 概要
```
User 1───n Contact 1───n Vehicle
                 ├───n Note
                 └───n Task ───┐
Vehicle 1───n Task（メンテ系は vehicle_id 必須）

User 1───n Template
User 1───1 Setting
```

### 3.2 主なエンティティ
| テーブル | 主フィールド | 備考 |
| --- | --- | --- |
| `users` | `username`, `pin_hash` | PIN は scrypt ハッシュ。平文保存しない |
| `contacts` | `name`(必須), `rank`(A–D 必須), `phone`, `email` ＋ 任意（`family`/`usage`/`budget`/`desired_equipment`/`rival_car`/`insurance_status`） | 営業に効く任意項目を保持 |
| `vehicles` | `name`, `model_code`, `condition`(new/used), `registration_date`, `delivery_date`, `shaken_expiry_date`, `inspection_profile` | 中古は車検満了日が必須 |
| `notes` | `date`(必須), `summary`(必須), `reaction`, `next_action` | 商談メモ。次の一手をタスク化できる |
| `tasks` | `type`, `title`, `due_date`, `status`(open/done/hold), `notify`, `source`(auto/manual), `generation_key`, `vehicle_id` | メンテ系は `vehicle_id` 必須 |
| `templates` | `category`(maintenance/followup), `name`, `body` | 差し込みトークン対応 |
| `settings` | `notifications_enabled`, `notify_offsets_days`, `long_session`, `calendar_enabled` | ユーザーごと 1 行 |
| `auth_tokens` | `refresh_token_hash`, `expires_at`, `revoked_at` | リフレッシュトークン（ハッシュ保存） |
| `calendar_sync_state` | `task_id`, `calendar_event_id` | サーバー側カレンダー連携の将来用（現行のブラウザ完結連携では未使用） |

### 3.3 列挙（`domain.ts`）
- ランク: `A > B > C > D`（`RANK_ORDER` で並び順）。
- タスク種別: 営業系（電話/訪問フォロー・試乗/見積/保険提案）＋メンテ系（新車1か月・6か月無料点検／法定12か月／安心6か月／車検）。
- 車検周期プロファイル: `standard`（初回3年・以降2年）/ `annual`（毎年車検＝8ナンバー等）。

---

## 4. 認証

### 4.1 サーバーモード（`apps/api/src/auth.ts`）
- PIN を **scrypt(KDF)** でハッシュ化（`scrypt$<salt>$<hash>` 形式）。照合は `timingSafeEqual`。
- **アクセストークン**: JWT・短命（30 分）。`Authorization: Bearer` で検証し `req.userId` を確定。
- **リフレッシュトークン**: ランダム 32 byte。ハッシュを `auth_tokens` に保存、有効期限 30 日。失効・期限切れを検証。
- 本番ガード: `NODE_ENV=production` で `JWT_SECRET` 未設定なら起動を中止（`index.ts`）。

### 4.2 静的モード（`apps/web/src/lib/localAuth.ts`）
- サーバーが無いため、PIN を **PBKDF2-SHA256（10万回）** でハッシュ化した値をバンドルに埋め込み、Web Crypto で照合。
- 平文保存禁止は満たすが、4 桁 PIN のハッシュ／ソルトは公開され得るため**強固な認証ではない**。これは端末内ローカルデータへの“鍵”であり、顧客データ自体は IndexedDB に閉じる（漏洩面は端末内に限定）。
- PIN 変更時は同じパラメータで再計算し `PIN_HASH_HEX` を差し替える。初期 PIN は `1206`。

---

## 5. API 契約（サーバーモード）

ベース `/api/v1`。すべて user スコープ（自分の所有データのみ）。詳細は各ルータ参照。

| リソース | エンドポイント |
| --- | --- |
| ヘルス | `GET /health` |
| 認証 | `POST /auth/login` `POST /auth/refresh` `POST /auth/logout` |
| 顧客 | `GET/POST /contacts` `GET/PATCH/DELETE /contacts/:id` |
| 車両 | `GET/POST /contacts/:id/vehicles` `PATCH/DELETE /vehicles/:id` |
| メモ | `GET/POST /contacts/:id/notes` `PATCH/DELETE /notes/:id` |
| タスク | `GET /tasks?status=&due_from=&due_to=&rank=` `POST /tasks` `PATCH/DELETE /tasks/:id` |
| テンプレート | `GET/POST /templates?category=` `PATCH/DELETE /templates/:id` |
| 設定 | `GET/PATCH /settings` |
| 同期 | `GET /sync/pull?sync_token=` `POST /sync/push` |

- バリデーションは `@crm/shared` の zod スキーマを共有（`contactCreateSchema` 等）。Web 側もフォーム検証に流用。
- DELETE は **ソフトデリート**（`deleted_at` を立てて同期で伝播）。
- 本番は `createApp(db, { webDist })` で **Web ビルドを同一オリジン配信**（`/api` 以外は SPA フォールバック）。

---

## 6. 差分同期（`apps/api/src/sync/index.ts` ＋ `@crm/shared/syncing`）

### 6.1 カーソル
全行が単調増加 `seq` を持つ（`seq_counter` を `nextSeq` で採番）。`sync_token` = クライアントが受信済みの最大 `seq`。

### 6.2 pull
`GET /sync/pull?sync_token=<n>`。全同期テーブルから `seq > sync_token` の行（削除済み含む）を user スコープで返す。`0` で全件。

### 6.3 push
`POST /sync/push { sync_token, events:[{table, op, entity}] }`。
- 単一トランザクションで反映。1 件の不正イベントで全体を落とさず `rejected` に収集。
- 各イベントで**所有権を検証**（他人のデータには触れない／contact 付け替えも拒否）。
- 反映後、`sync_token` 以降の差分（pull 相当）も併せて返すので往復が 1 回で済む。

### 6.4 衝突解決（`sync/conflict.ts`）
**Last-write-wins**、優先度 **削除 > 更新 > 作成**。`updated_at` を比較し、古い書き込みは `skip`。

### 6.5 同期テーブルと列
同期対象は `contacts/vehicles/notes/tasks/templates/settings`。各テーブルの同期列は `COLUMNS` で明示。
boolean（`notify` 等）は 0/1、`notify_offsets_days` は JSON 文字列に正規化して保存。

---

## 7. メンテナンス自動生成（`@crm/shared/maintenance.ts`）

副作用のない純関数で「タスクの素」(`GeneratedTaskSpec`) を返す。id・タイムスタンプ付与は呼び出し側（store / api）。

### 7.1 新車（納車日 or 登録日を起点）
`standard` プロファイル: 1か月無料 → 6か月無料 → 12か月法定 → 18 安心 → 24 法定 → 30 安心 → 36 車検 → 42 安心 → 48 法定 → 54 安心 → 60 車検。
`annual` プロファイル（8ナンバー等）: 1/6か月無料点検の後、12 か月ごとに車検、中間 6 か月に安心点検。

### 7.2 中古車（車検満了日を起点）
満了日に車検、満了 30 日前に安心点検。次サイクルは次回満了日が判明した時点で再生成。

### 7.3 再生成マージ（`mergeGeneratedTasks`）
再生成しても**手動タスク・着手済み（done/hold）の自動タスクは保護**する。対象 `generation_key` の「未完(open)・自動」タスクのみ生成結果と突き合わせ、同一 `(type, due_date)` は既存を維持（ID・通知設定を保つ）、不要分のみ削除候補にする。

---

## 8. ホーム分類（`@crm/shared/home.ts`）

タスクを期限で **overdue → today → soon(7日以内) → later** に分類。表示順は次の優先度:
1. バケット（期限切れ → 今日 → 近日 → later）
2. ランク（A → D）
3. 期限（昇順）

これにより「期限が迫っていて、かつ重要顧客」が常に最上位に来る。

---

## 9. クライアント アーキテクチャ（`apps/web`）

### 9.1 レイヤ構成
```
pages/ ──▶ lib/store.ts ──▶ lib/sync.ts ──▶ lib/db.ts（Dexie/IndexedDB）
                │                  │
                │                  └──▶ lib/api.ts（REST・サーバーモードのみ）
                └──▶ @crm/shared（メンテ生成・型・スキーマ）
```
- 状態管理は **TanStack Query**（サーバー/ローカル状態のキャッシュと無効化）。
- 同期完了時に `SYNC_EVENT` を dispatch → Query を一括 invalidate。

### 9.2 オフラインストア（`store.ts`）
- **読み取り**: Dexie を一次ソース。未同期かつオンラインなら API フォールバックして Dexie に取り込む。静的モードでは常に Dexie のみ。
- **書き込み**: `enqueueWrite(table, op, entity)` で「Dexie 反映＋アウトボックス追加」。オンラインなら即 `sync()`。
- 顧客／車両／メモ／タスク／テンプレートとも **作成・編集・削除**に対応（すべて同じ `enqueueWrite` パターン）。

### 9.3 同期エンジン（`sync.ts`）
- `sync()` = push → pull を直列化（多重起動防止）。
- アウトボックスは `coalesceOutbox` で同一エンティティの連続操作をまとめてから送信。
- トリガ: 起動時 / `online` 復帰 / `visibilitychange`（フォア復帰）/ 30 秒間隔。
- 静的モードでは同期を完全に無効化（アウトボックスにも積まない）。

### 9.4 ローカル DB（`db.ts` / Dexie）
- テーブル: `contacts/vehicles/notes/tasks/templates/settings` ＋ `outbox`（順序付き）＋ `meta`（`sync_token`）。
- ログアウト時は `clearLocalData()` で全消去。

---

## 10. Google カレンダー連携（`apps/web/src/lib/gcal.ts`）

**ブラウザ完結・一方向（CRM → カレンダー）**。サーバー無改修。

- **方式**: Google Identity Services (GIS) のトークンモデル。公開 **Client ID のみ**（秘密鍵なし）をユーザーが設定画面に貼る運用。GIS スクリプトは遅延ロード、アクセストークンはメモリ保持＋失効管理。
- **対象**: `due_date` のある**未完タスク**（`status !== 'done'`）。
- **イベント**: 終日イベント（`start.date`/`end.date` = `due_date`）。`summary` = タスク名、`description` = 顧客名＋詳細。`extendedProperties.private.crmTaskId` でタスクと対応付け。
- **リコンサイル同期** (`syncAllTasks`): 対象タスクを upsert（`taskId → eventId` 対応表は localStorage）。対応表にあるが現存しない（完了/削除）タスクのイベントは削除してカレンダーを掃除。
- セットアップ手順は `docs/CALENDAR.md`（Google Cloud で OAuth クライアント ID 作成 → 承認済み JavaScript 生成元に公開 URL 登録 → 設定画面に貼付）。

---

## 11. 通知（`apps/web/src/lib/notifications.ts`）

- Notification API ＋ Service Worker。`notify_offsets_days`（既定 `[30,7,1,0]`＝期限の何日前か、0=当日）でタイミングをユーザーがカスタム可能（設定画面でチップ追加/削除）。
- iOS PWA の通知制約があるため、許可状態に応じて設定画面で許可導線を出す。
- 同一の `(task_id, offset, 東京日付)` は1回だけ通知する。Service Worker 登録が利用できる場合は `showNotification` を使う。
- Web Push は未実装のため、通知判定はアプリを開いた時に行う。この制約は設定画面にも明示する。

### 11.1 ローカルバックアップ

- `BackupEnvelopeV1` は `contacts / vehicles / notes / tasks / templates / settings` のみを含む。PIN、認証トークン、Google認証情報、outbox、sync token は含めない。
- JSON出力は両モード、復元は静的モードのみ。復元前に現在データをJSON保存し、zod検証後に単一Dexieトランザクションで全置換する。
- 顧客一覧はExcel互換のUTF-8 BOM付きCSVとして出力できる。

---

## 12. UI / デザインシステム

「Apple 純正風・無彩色」デザイン（仕様書 v1.0）。CSS カスタムプロパティで Light/Dark を切り替える。初期値はOS設定に追従し、設定画面で「端末設定・ライト・ダーク」を明示選択できる（`theme.tsx`、`index.css`）。Tailwind は変数を参照（`tailwind.config.js`）。

### 12.1 カラートークン
| 役割 | トークン | 用途 |
| --- | --- | --- |
| アクセント | `ink` / `on-ink` | ボタン・強調（唯一のアクセント色） |
| テキスト階層 | `ink` / `text2` / `text3` | 1次/2次/3次（無彩グレー） |
| 面 | `surface` / `surface-2` / `grouped` | カード面・背景 |
| 区切り | `separator` | 罫線 |
| 選択 | `tint` / `tint-strong` | 選択・チップ |
| 意味色 | `overdue`(赤) / `today`(琥珀) / `done`(緑) | 期限の意味づけ |
| ランク | `rank-b/c/...` | 単色＋アウトラインで A–D を表現 |

### 12.2 主要コンポーネント
- `Screen`: 大見出し＋下部タブバーを持つトップ画面の枠。
- `TabBar`: ホーム/顧客/設定の 3 タブ（vibrancy ＝ blur 半透明）。
- `AppHeader` / `Modal`: vibrancy 背景（`backdrop-filter: blur`）。
- `RankBadge`: A=Ink ベタ / B=中間グレー / C=薄面 / D=アウトラインのみ（色相に頼らない単色表現）。
- `TaskRow`: 円形チェックボックス＋期限色（overdue/today/…）。
- `ui.tsx`: `Button`(primary/secondary/outline/destructive)・`Card`・`SectionLabel`（mono 大文字）。
- `Modal`: Esc終了、フォーカストラップ、初期フォーカス、終了後のフォーカス復帰、背景スクロール抑止に対応。
- PWAアイコンは192px / 512px / maskable / Apple Touch Iconを同梱する。

### 12.3 画面遷移
`/login → /（ホーム）→ /contacts → /contacts/:id → /settings`、`/templates`（設定から）。未認証は `/login` へ（`RequireAuth`）。

---

## 13. セキュリティ

- HTTPS 前提。顧客情報（氏名/電話/メール/本文/車検満了日 等）は**ログに出さない**（メソッドとパスのみ）。
- PIN は KDF ハッシュ保存（平文禁止）。サーバーは scrypt、静的は PBKDF2。
- サーバー同期は全イベントで所有権検証（user スコープ厳守）。
- 静的モードの注意: PIN ハッシュは公開され得るため認証強度は限定的。顧客データは端末内に閉じる設計で漏洩面を局所化。

---

## 14. デプロイ

### 14.1 GitHub Pages（既定・無料・カード不要）
- `main` への push で `.github/workflows/deploy-pages.yml` が `VITE_STATIC=1` ＋ `BASE_PATH=/nissan-promotion/` でビルドし Pages へ公開。
- 初回のみ Settings → Pages → Source = 「GitHub Actions」。
- 公開 URL: `https://24-zuka.github.io/nissan-promotion/`（PIN `1206`）。SPA フォールバックは `404.html` を `index.html` のコピーで実現。
- 手順詳細は `docs/PAGES.md`。

### 14.2 Render（サーバーあり・端末間同期）
- `Dockerfile` ＋ `render.yaml`（無料プラン・ディスク無し・`JWT_SECRET` 自動生成）。**New ▸ Blueprint** で数クリック。
- 制約: コールドスタート（~30 秒）、サーバー DB は一時的（ブラウザ IndexedDB が本体なので単一端末では継続）。
- 手順詳細は `docs/DEPLOY.md`。

---

## 15. テスト

| 種別 | 対象 | ツール |
| --- | --- | --- |
| UT | shared（日付・メンテ生成・ホーム分類・同期差分・テンプレ差し込み） | vitest |
| IT | api（認証・CRUD・sync push/pull・衝突解決） | supertest ＋ 一時 SQLite |
| E2E（手動/Playwright） | ログイン → 顧客/車両/メモ/タスクの作成・編集・削除 → リロード保持 → ホーム分類・ワンタップ完了 | Playwright |
| Web UT | バックアップ、通知重複防止、フォーム関連付け、モーダル操作 | Vitest + Testing Library + fake-indexeddb |

検証コマンド: `npm run lint` / `npm run typecheck`（3 パッケージ）/ `npm test`（shared UT + api IT + Web UT）/ `npm run e2e` / `npm run build`。

---

## 16. 今後（未実装）

- **パスキー（WebAuthn）**: RP 設定が必要。認証情報が揃い次第、別イテレーションで対応。
- **カレンダー双方向／サーバー集中同期**: 現行はブラウザ完結の一方向。`calendar_sync_state` テーブルは将来のサーバー側集中同期用に温存。

---

## 付録 A: 主要ファイル早見表

| 関心事 | ファイル |
| --- | --- |
| ドメイン定数・列挙 | `packages/shared/src/domain.ts` |
| エンティティ型 | `packages/shared/src/types.ts` |
| zod スキーマ | `packages/shared/src/schemas.ts` |
| メンテ生成 | `packages/shared/src/maintenance.ts` |
| ホーム分類 | `packages/shared/src/home.ts` |
| 同期純ロジック | `packages/shared/src/syncing.ts` |
| DB スキーマ | `apps/api/src/db.ts` |
| 認証（サーバー） | `apps/api/src/auth.ts` |
| Express factory | `apps/api/src/server.ts` |
| 同期ルート | `apps/api/src/sync/index.ts` |
| オフラインストア | `apps/web/src/lib/store.ts` |
| 同期エンジン | `apps/web/src/lib/sync.ts` |
| ローカル DB | `apps/web/src/lib/db.ts` |
| カレンダー連携 | `apps/web/src/lib/gcal.ts` |
| 認証（静的） | `apps/web/src/lib/localAuth.ts` |
| 動作モード | `apps/web/src/lib/config.ts` |
| ルーティング | `apps/web/src/App.tsx` |
| デザイントークン | `apps/web/src/index.css` / `apps/web/tailwind.config.js` |
