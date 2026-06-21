# My Dealer CRM — 単一サービス（API が Web ビルドを同一オリジンで配信）
# better-sqlite3 はネイティブモジュールのため、build ステージにビルドツールを入れる。

# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 のネイティブビルドに必要。
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# 依存解決を先に（レイヤキャッシュを効かせる）。
# package-lock.json があれば npm ci、無ければ npm install にフォールバック。
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ソースを入れて全ワークスペースをビルド（shared → api → web）。
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# 無料プランは永続ディスク不可のため、DB は一時FS上に置く（openDb が親dirを自動作成）。
# 永続ディスクを使う場合は /data/crm.sqlite に変更し、render.yaml の disk を有効化する。
ENV DB_FILE=/app/data/crm.sqlite
ENV WEB_DIST=/app/apps/web/dist

# ワークスペースの symlink とコンパイル済み better-sqlite3(.node) を含む node_modules、
# 各パッケージのビルド成果物のみをコピー（src/devツールは不要）。
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist

# PORT は Render が注入する（コードは process.env.PORT ?? 4000）。
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
