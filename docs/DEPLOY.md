# デプロイ手順 — Render 無料プランでフルスタック公開

My Dealer CRM を **iPhone / PC のブラウザから実際に使える**状態にする手順です。
API（Express + SQLite）と Web（React PWA）を **1 つのサービス・同一オリジン**で、
**Render の無料プラン（カード登録不要）** で公開します。

> なぜ Render か: API と Web を 1 オリジンにまとめて配信でき、自動 HTTPS・GitHub からの
> 自動デプロイに対応しているため。Docker でそのまま動かせます。

### ⚠️ 無料プランの制約（先に理解しておく）
- **15 分無操作でスリープ** → 次アクセスで **~30 秒の起動待ち**（コールドスタート）が入ります。
- **永続ディスクは使えません**。サーバ側の SQLite はコンテナの一時領域に作られ、
  **再デプロイ／スリープ復帰でリセットされる可能性**があります。
- ただし本アプリは **オフラインファースト**設計で、データは**ブラウザ内（IndexedDB）にも保存**
  されます。**同じ端末で使う限り**、サーバDBがリセットされても閲覧・入力は継続できます
  （サーバは認証・初回読込・端末間同期のために使います）。
- **データを恒久保存したい／複数端末で確実に同期したい**場合は、`render.yaml` の `plan` を
  `starter`（有料）に変更し、コメントアウトされた `disk:` ブロックを有効化、`DB_FILE` を
  `/data/crm.sqlite` に戻してください（手順は同ファイル内のコメント参照）。

---

## 前提
- GitHub にこのリポジトリが push 済みであること（`render.yaml` が `main` にあること）。
- Render アカウント（https://render.com）。**GitHub でサインアップ可・無料・カード不要**。

## 手順（Blueprint で数クリック）

1. デプロイ用ファイル（`Dockerfile` / `render.yaml`）を `main` に入れる（PR をマージ）。
2. Render ダッシュボード → **New ▸ Blueprint**。
3. GitHub アカウントを接続し、リポジトリ `24-Zuka/nissan-promotion` を選択。
4. Render が `render.yaml` を自動検出 → 内容（web サービス〔無料プラン〕 + JWT_SECRET 自動生成）
   を確認して **Apply**。
5. 初回ビルド（Docker）が走る。完了すると `https://my-dealer-crm-xxxx.onrender.com` が発行される。
6. その URL を開き、**ユーザー名 `kai` / PIN `1206`** でログイン
   （しばらくアクセスが無いと、最初の表示まで ~30 秒かかることがあります）。

## iPhone でアプリのように使う（PWA）
1. Safari で発行された URL を開く。
2. 共有ボタン → **「ホーム画面に追加」**。
3. ホーム画面のアイコンから起動すると、全画面（standalone）で動作。
   オフラインでも閲覧・入力でき、オンライン復帰時に自動同期します。

---

## 環境変数（render.yaml で設定済み）
| 変数 | 値 | 用途 |
|------|----|------|
| `NODE_ENV` | `production` | 本番モード。弱い既定シークレットでの起動を禁止 |
| `DB_FILE` | `/app/data/crm.sqlite` | SQLite の保存先（無料プランは一時領域。`openDb` が親dirを自動作成） |
| `JWT_SECRET` | 自動生成 | アクセストークン署名鍵。Render が強い値を生成 |
| `PORT` | Render が注入 | 監視ポート（コードは `process.env.PORT`） |

> 無料プランでは永続ディスクを付けないため、`DB_FILE` は一時領域を指します。
> 永続化する場合は `starter` プラン＋ Disk を `/data` にマウントし、`DB_FILE` を
> `/data/crm.sqlite` に合わせます（`render.yaml` のコメント参照）。

## ローカルでの本番相当の確認（任意）
```bash
npm run build
NODE_ENV=production JWT_SECRET=dev-only PORT=4000 \
  DB_FILE=$PWD/data/crm.sqlite WEB_DIST=$PWD/apps/web/dist \
  node apps/api/dist/index.js
# → http://localhost:4000 を開く（API と Web が同一オリジン）
```

## セキュリティ上の注意
- 公開 URL では誰でもログイン画面に到達できます。PIN は仕様により `1206` 固定ですが、
  運用上は**推測されにくい PIN への変更**を検討してください（`apps/api/src/seed.ts` の既定値、
  または将来的にログイン後の PIN 変更 UI で対応）。
- 顧客情報はログに出しません（メソッドとパスのみ）。HTTPS は Render が自動付与します。

## 更新の反映
`autoDeploy: true` のため、`main` に push すると Render が自動で再ビルド・再デプロイします。
**無料プランではサーバ側 DB が再デプロイでリセットされ得ます**（ブラウザ内 IndexedDB の
データは残ります）。サーバ側もデプロイをまたいで保持したい場合は `starter` + Disk に切替を。
