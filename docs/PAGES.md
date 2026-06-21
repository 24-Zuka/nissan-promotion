# デプロイ手順 — GitHub Pages（ブラウザ完結・完全無料）

このアプリを **GitHub Pages から直接公開**し、iPhone / PC のブラウザでアプリとして使う手順です。
サーバー（Render 等）は不要・**カード不要・コールドスタート無し・完全無料**。`main` に push すると
GitHub Actions が自動でビルドして公開します（URL は変わらず内容だけ更新）。

> 仕組み（静的モード）: このアプリは**オフラインファースト**で、データはブラウザの IndexedDB が本体。
> GitHub Pages 配信時はサーバーを使わず、ログインはブラウザ内の PIN 照合、データは端末内に保存。
> **顧客データはあなたのブラウザに閉じる**ため、URL を知った他人には空のアプリしか見えません。

## 制約（理解しておく）
- **端末間同期は無し**（データは各ブラウザ内。複数端末で共有はされない）。
- ログインの PIN 照合はブラウザ内で行うため、強固な認証ではない（本人端末のローカルデータの鍵）。
  ただし顧客データはサーバーにも他人にも渡らないため、漏洩面は端末内に限定される。
- 端末間で同期したい／サーバー側保存が必要なら、`docs/DEPLOY.md`（Render）を参照。

---

## 手順（初回だけ・1回）

1. リポジトリの **Settings → Pages** を開く。
2. **Build and deployment → Source** を **「GitHub Actions」** に設定する
   （クラシックの「Deploy from a branch」ではない）。
3. `main` に push する（同梱の `.github/workflows/deploy-pages.yml` が自動で走る）。
4. **Actions** タブでワークフローの完了を待つ（初回は数分）。
5. 完了後、`https://24-zuka.github.io/nissan-promotion/` が公開 URL。
   開いて **PIN `1206`** でログイン（ユーザー名は任意）。

> 以降は **`main` に push するだけで自動再デプロイ**。URL は変わりません。

## iPhone でアプリのように使う（PWA）
1. Safari で公開 URL を開く。
2. 共有ボタン → **「ホーム画面に追加」**。
3. ホーム画面のアイコンから全画面で起動。オフラインでも閲覧・入力できます。

## Google カレンダー連携
別途 `docs/CALENDAR.md` を参照（OAuth クライアント ID を設定画面に貼るだけ）。
GitHub Pages は HTTPS なので連携可能。OAuth の「承認済み JavaScript 生成元」には
`https://24-zuka.github.io` を登録してください。

---

## ローカルで静的ビルドを確認（任意）
```bash
npm run build -w @crm/shared
VITE_STATIC=1 npm run build -w @crm/web      # base='/' でビルド
cd apps/web/dist && python3 -m http.server 4100
# → http://localhost:4100 を開き、PIN 1206 でログイン
```

## 設定のしくみ（コード）
- `VITE_STATIC=1` で**静的モード**（`apps/web/src/lib/config.ts`）。サーバー API を使わず、
  ログインはローカル PIN 照合（`lib/localAuth.ts`）、同期は無効、データは Dexie のみ。
- `BASE_PATH=/nissan-promotion/` でサブパス配信に対応（`vite.config.ts` / `main.tsx` の basename）。
- PIN を変えるときは `lib/localAuth.ts` の `PIN_HASH_HEX` を同じパラメータ（PBKDF2-SHA256 /
  salt `crm-static-v1` / 100000回）で再計算して差し替える。
