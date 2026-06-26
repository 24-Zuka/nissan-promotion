# Shell commands 登録リスト（コピペ用）

Obsidian の **Shell commands** プラグイン設定で、下表の5コマンドを追加します。
`KIT` は本キットの絶対パス（例 `/Users/kai/jarvis-codex-org`）に置き換えてください。
各行の **Alias** は Buttons / コマンドパレットから呼ぶ名前です（`Control Panel.md` のボタンと一致させる）。

> いずれのコマンドも先頭で `~/.jarvis.env` を読み、`VAULT` / `REPOS` / `OBSIDIAN_API_KEY` を取り込みます。

| Alias | Shell command（“Command” 欄に貼る） |
|-------|-------------------------------------|
| `朝会` | `source ~/.jarvis.env 2>/dev/null; bash "KIT/scripts/morning_meeting.sh"` |
| `ローカルレビュー` | `source ~/.jarvis.env 2>/dev/null; bash "KIT/scripts/local_review.sh" "{{prompt_value:repo}}" "{{prompt_value:base}}"` |
| `worktree作成` | `source ~/.jarvis.env 2>/dev/null; bash "KIT/scripts/worktree_new.sh" "{{prompt_value:repo}}" "{{prompt_value:feature}}"` |
| `ビルド` | `source ~/.jarvis.env 2>/dev/null; bash "KIT/scripts/codex_build.sh" "{{prompt_value:worktree}}" "{{prompt_value:prompt}}"` |
| `調査スキャン` | `source ~/.jarvis.env 2>/dev/null; bash "KIT/scripts/research_scan.sh" "{{prompt_value:topic}}"` |

---

## 入力欄（Prompt）の作り方

`{{prompt_value:名前}}` を使うコマンドは、対応する **Prompt** を先に作ります。
Shell commands 設定 → **Prompts** → New prompt:

| 作る Prompt | 種別 | 使うコマンド |
|------------|------|-------------|
| `repo`（リポジトリのパス） | Single line text | ローカルレビュー / worktree作成 |
| `base`（比較ブランチ・既定 main） | Single line text | ローカルレビュー |
| `feature`（機能名） | Single line text | worktree作成 |
| `worktree`（worktreeパス） | Single line text | ビルド |
| `prompt`（Codexへの指示） | Multi line text | ビルド |
| `topic`（調査テーマ） | Single line text | 調査スキャン |

作った Prompt を、各コマンドの **Preactions** に紐付ける（実行前に入力モーダルが出ます）。

> 注: Prompt 変数の正確な記法（`{{prompt_value:...}}`）は Shell commands のバージョンで
> 微差があります。うまく展開されない場合は、プラグインの「Variables」ヘルプで現行表記を確認してください。
> 入力が面倒なら、入力付きの操作は `desktop/commands/*.command`（osascript ダイアログ）でも代用できます。

---

## 出力の見え方

- `朝会` / `調査スキャン` … Vault にノートを生成（結果は生成ファイルを開いて確認）。
- `ローカルレビュー` / `ビルド` … 標準出力に結果。Shell commands の **Output channel** を
  「Notification / Modal / Open a note」等から選べます。レビューは Modal 表示が読みやすいです。
