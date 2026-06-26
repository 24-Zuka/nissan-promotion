# Obsidian を「操作盤（デスクアプリ）」にする — 導入手順

Obsidian は既に共有記憶（Vault）の中心であり、それ自体がデスクトップアプリです。
ここに数個のコミュニティプラグインを足すと、**記憶・対話・操作が1つのウィンドウで完結**します
（クウキデザインの方法論「Obsidianがハブ」に最も忠実な形）。

> 前提: 先に本キットの `setup.sh` を実行し、Vault スケルトンと `~/.codex` 設定を設置済みであること。
> また、`scripts/` の置き場所（例: `~/jarvis-codex-org/`）の**絶対パス**を控えておくこと。以下この絶対パスを `KIT` と呼ぶ。

---

## 1. プラグインを入れる（Obsidian → 設定 → コミュニティプラグイン）

| プラグイン | 役割 | 必須/任意 |
|-----------|------|----------|
| **Shell commands** | Vault から `scripts/*.sh` を実行する心臓部 | 必須 |
| **Buttons**（代替: Meta Bind） | ノート内にクリックボタンを置く | 必須 |
| **Obsidian Agent Client**（ACP） | Codex 対話を Obsidian 内に埋め込む（対話もObsidianで完結したい人向け） | 任意 |

コミュニティプラグインは「制限モード」をOFFにしてから検索・インストール・有効化します。

---

## 2. 環境変数の受け渡し（重要）

Obsidian を Finder/Dock から起動すると `~/.zshrc` の `export` が読まれません。
そこで GUI 用の鍵ファイルを1つ作ります:

`~/.jarvis.env`
```bash
export VAULT="$HOME/Obsidian/Jarvis"
export REPOS="$HOME/dev"
export OBSIDIAN_API_KEY="（Local REST API のキー）"
# 任意: export DISCORD_WEBHOOK="..."  /  export GITHUB_PAT_TOKEN="..."
```

本キットの `.command` / Raycast ラッパと Shell commands 設定は、いずれもこの
`~/.jarvis.env` を読み込む前提にしてあります。

> Shell commands プラグインの「Environments」設定で、PATH に `/opt/homebrew/bin:/usr/local/bin` を
> 追加しておくと、`codex` / `git` が見つからない問題を防げます。

---

## 3. Shell commands にコマンドを登録

`shell-commands.md` の表にある5つのコマンドを、Shell commands 設定で1つずつ追加します。
各コマンドに **Alias（別名）** を付けると、Buttons や コマンドパレットから名前で呼べます。
入力が必要なもの（レビュー対象・ビルド指示・worktree名・調査テーマ）は、Shell commands の
**Prompt 機能**で入力欄を出します（手順は `shell-commands.md` 参照）。

---

## 4. 操作盤ノートを置く

`Control Panel.md` を **Vault の直下**にコピーします（setup.sh で展開した Vault の中）。
Buttons プラグインが有効なら、開くだけで [朝会][レビュー][worktree][ビルド][調査] のボタンが表示されます。
このノートを Obsidian のスター/ピン留め、または起動時に開くノートに設定すると、
**「JARVISのホーム画面」**になります。

---

## 5. （任意）対話も Obsidian 内で

「Obsidian Agent Client」を入れ、エージェントとして **Codex（ACP）** を選び、コマンドに
`codex`（必要なら `codex acp` 等、プラグインの指示に従う）を指定します。
これで JARVIS との対話（旧パターン③）も Obsidian の中で行え、ターミナルを完全に開かずに済みます。
対話は既存の `~/.codex/AGENTS.md`（JARVIS人格）・skills・subagents・Obsidian MCP をそのまま使います。

---

## トラブル時
- ボタンを押しても何も起きない → Shell commands の Alias 名と Buttons の `action` 名が一致しているか確認。
- `codex: command not found` → 手順2の PATH 設定、または `~/.jarvis.env` を見直す。
- レビューが 404 → LM Studio が :1234 で起動しているか、READMEの LiteLLM プロキシ手順を確認。
