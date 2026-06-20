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

## 主要設計

- **メンテ自動生成**: 新車は納車/登録日起点で日産の点検サイクル（1/6/12/18/24/30/36/48/60か月…）、
  中古は車検満了日起点（満了日に車検・30日前に安心点検）。再生成は手動/着手済みタスクを保護してマージ。
- **同期**: 全行に単調増加 `seq`。`GET /sync/pull?sync_token=` で差分取得、`POST /sync/push` で反映。
  衝突解決は Last-write-wins（優先度: 削除 > 更新 > 作成）。ソフトデリート(`deleted_at`)で削除も伝播。
- **セキュリティ**: HTTPS前提、顧客情報はログに出さない（メソッド/パスのみ）。PINはKDFハッシュ。

## 次フェーズ（未実装）

Googleカレンダー片方向連携 / パスキー / 通知タイミングのユーザーカスタム / 車検周期の例外(8ナンバー等)。
詳細は `docs/CONTRACT.md` と各ソースの先頭コメントを参照。
