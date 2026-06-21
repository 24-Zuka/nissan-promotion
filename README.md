# My Dealer CRM（海さん専用）

営業の「漏れ」を減らし、点検/車検フォローを自動生成する個人向けCRM（MVP）。
仕様書「My Dealer CRM 完全版」に基づき、メインエージェント＋サブエージェントで分担開発。

## 構成（npm workspaces モノレポ）

| パッケージ | 役割 |
| --- | --- |
| `packages/shared` | ドメイン型・zodスキーマ・TZ安全な日付計算・メンテ自動生成・ホーム分類（純ロジック） |
| `apps/api` | Express + better-sqlite3。PIN認証(scrypt+JWT)・CRUD・差分同期・メンテ生成の永続化 |
| `apps/web` | React + Vite PWA。ホーム/顧客/メモ/タスク/車両/設定の画面 |

> ルート直下の `index.html` / `nissan.html` / `IMG_0386.JPG` は別目的（販促チラシ）の資産で、本アプリとは独立。

## セットアップ

```bash
npm install            # 全 workspace 一括
npm run dev            # api(:4000) と web(:5173) を同時起動（web→api は /api プロキシ）
```

初期ログイン: ユーザー名 `kai` / PIN `1206`（保存は scrypt ハッシュ。平文は保持しない）。

## スクリプト

```bash
npm test               # shared(UT) + api(IT) のテスト
npm run typecheck      # 全パッケージの型チェック
npm run build          # shared → api → web をビルド
```

## デプロイ（Web 公開・無料）

### A. GitHub Pages（推奨・ブラウザ完結・完全無料）

サーバー不要。`main` に push すると GitHub Actions（`.github/workflows/deploy-pages.yml`）が
自動でビルドして **GitHub Pages** に公開します。**カード不要・コールドスタート無し・URL 固定**。

- 初回だけ: リポジトリ **Settings → Pages → Source = 「GitHub Actions」** に設定。
- 公開 URL: `https://24-zuka.github.io/nissan-promotion/`（PIN `1206` でログイン）。
- 詳細手順は `docs/PAGES.md`、カレンダー連携は `docs/CALENDAR.md`。

> 仕組み（静的モード `VITE_STATIC=1`）: オフラインファースト設計を活かし、サーバー無しで動作。
> ログインはブラウザ内 PIN 照合、データは IndexedDB が本体。**顧客データは各ブラウザに閉じる**ため
> サーバーにも他人にも渡りません（URL を知っても他人には空のアプリが見えるだけ）。
> 代わりに**端末間同期は無し**（単一端末向け）。

### B. Render（サーバーあり・端末間同期が必要なとき）

端末間で同期したい／サーバー側保存が必要なら、Render の **無料プラン（カード不要）** に
**API + Web を1サービス（同一オリジン）** で公開できます（`Dockerfile` / `render.yaml` 同梱、
**New ▸ Blueprint** で数クリック）。手順・制約は `docs/DEPLOY.md` を参照。

## 主要設計

- **メンテ自動生成**: 新車は納車/登録日起点で日産の点検サイクル（1/6/12/18/24/30/36/48/60か月…）、
  中古は車検満了日起点（満了日に車検・30日前に安心点検）。再生成は手動/着手済みタスクを保護してマージ。
- **同期**: 全行に単調増加 `seq`。`GET /sync/pull?sync_token=` で差分取得、`POST /sync/push` で反映。
  衝突解決は Last-write-wins（優先度: 削除 > 更新 > 作成）。ソフトデリート(`deleted_at`)で削除も伝播。
- **セキュリティ**: HTTPS前提、顧客情報はログに出さない（メソッド/パスのみ）。PINはKDFハッシュ。

## 実装済み（MVP 以降の追加分）

文例テンプレート管理＋差し込み生成 / オフライン同期（Dexie アウトボックス）/ 通知タイミングの
ユーザーカスタム / 車検周期の例外（8ナンバー等の毎年車検プロファイル）/ 顧客・車両・メモ・タスクの
**編集と削除** / **Google カレンダー片方向連携**（ブラウザ完結・`docs/CALENDAR.md`）/
GitHub Pages 向け**ブラウザ完結（静的）モード**。

## 次フェーズ（未実装）

パスキー（WebAuthn）。RP 設定が必要なため、認証情報が揃い次第の別イテレーションで対応。
詳細は `docs/CONTRACT.md` と各ソースの先頭コメントを参照。
