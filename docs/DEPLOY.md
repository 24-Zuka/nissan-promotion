# デプロイ手順 — Render でフルスタック公開

My Dealer CRM を **iPhone / PC のブラウザから実際に使える**状態にする手順です。
API（Express + SQLite）と Web（React PWA）を **1 つのサービス・同一オリジン**で公開します。

> なぜ Render か: このアプリのバックエンドは SQLite のファイル DB に書き込むため、
> **永続ストレージ（Disk）** が必要です。静的ホスト（Netlify 等）単独では動きません。
> Render は永続ディスク・自動 HTTPS・GitHub からの自動デプロイに対応しています。

---

## 前提
- GitHub にこのリポジトリが push 済みであること。
- Render アカウント（https://render.com）。GitHub でサインアップ可。

## 手順（Blueprint で数クリック）

1. **PR をマージ** して、デプロイ用ファイル（`Dockerfile` / `render.yaml`）を `main` に入れる。
2. Render ダッシュボード → **New ▸ Blueprint**。
3. GitHub アカウントを接続し、リポジトリ `24-Zuka/nissan-promotion` を選択。
4. Render が `render.yaml` を自動検出 → 内容（web サービス + 1GB ディスク + JWT_SECRET 自動生成）
   を確認して **Apply**。
5. 初回ビルド（Docker）が走る。完了すると `https://my-dealer-crm-xxxx.onrender.com` が発行される。
6. その URL を開き、**ユーザー名 `kai` / PIN `1206`** でログイン。

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
| `DB_FILE` | `/data/crm.sqlite` | SQLite の保存先（永続ディスク内） |
| `JWT_SECRET` | 自動生成 | アクセストークン署名鍵。Render が強い値を生成 |
| `PORT` | Render が注入 | 監視ポート（コードは `process.env.PORT`） |

永続ディスク `crm-data` を `/data` にマウント。`DB_FILE` と同じ場所を指すこと。

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
データ（`/data` のディスク）はデプロイをまたいで保持されます。
