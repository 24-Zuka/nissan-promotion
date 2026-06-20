# 開発契約（メイン＋サブエージェント）

メイン（土台確定済み）: モノレポ / `@crm/shared`(型・zod・日付・メンテ生成・ホーム分類) /
DBスキーマ / 認証(PIN scrypt + JWT) / Express factory / 各ルータのマウントとスタブ。

サブの担当ディレクトリ（**他は触らない**）:
- Sub A (CRM_CORE): `apps/api/src/routes/{contacts,vehicles,notes,tasks,templates,settings}.ts`
- Sub B (MAINT_SCHEDULER): `packages/shared/src/maintenance.ts` の検証 + `*.test.ts`
- Sub C (SYNC): `apps/api/src/sync/`
- Sub D (UI): `apps/web/src/pages/`, `apps/web/src/components/`
- Sub E (NOTIFICATION): `apps/web/src/lib/notifications.ts` ＋ Settings への結線

共通規約: 書き込み時は created_at/updated_at と nextSeq(db) をスタンプ / ソフトデリート /
ログに顧客情報を出さない / user スコープ徹底 / 各自のパッケージで typecheck を通す。
