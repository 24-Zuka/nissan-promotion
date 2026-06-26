# JARVIS型 AIエージェント組織 — 構築キット

西塚海さん専用。**メーター課金ゼロ**を厳守し、OpenAI Codex（ChatGPT Plusログイン経路）を
自動化の背骨、ローカルLM Studioを無料レビュアー、Obsidianを共有記憶として組む構成です。
クウキデザイン(Rio)の3原則 ―― 専門分化・書き物文化・意思決定権限の明文化 ―― を実装に落とし込んでいます。

---

## このキットに入っているもの

```
jarvis-codex-org/
├── README.md                     ← この文書
├── setup.sh                      ← 設置スクリプト（対話式・安全確認あり）
├── codex/
│   ├── config.toml               → ~/.codex/config.toml（基盤設定）
│   ├── AGENTS.md                 → ~/.codex/AGENTS.md（組織の憲法・JARVIS人格）
│   ├── agents/*.toml             → ~/.codex/agents/（サブエージェント4種）
│   └── skills/*/SKILL.md         → ~/.codex/skills/（再利用ワークフロー3種）
├── vault/                        → Obsidian Vault のスケルトン
│   ├── MEMORY.md                 （文脈エンジンの核：あなたの恒久文脈）
│   ├── AI_Handoff.md             （エージェント間の引き継ぎ板）
│   ├── DECISION_LOG.md           （意思決定ログ）
│   ├── Agents/*.md               （AI社員の人格・権限）
│   ├── Templates/                （Daily/Project テンプレ）
│   └── 00_Inbox, Daily, Projects
├── scripts/                      → 実行層（朝会・ローカルレビュー・worktree・調査）
├── repo-template/AGENTS.md       → 各リポジトリに置く雛形
└── launchd/                      → 朝会の定時実行（macOS）
```

---

## アーキテクチャ（役割分担）

| 層 | 担当 | 課金 | 自動化 |
|----|------|------|--------|
| ビルド（背骨） | Codex CLI（ChatGPT Plusログイン） | プラン内・無料 | ◎ `codex exec` |
| レビュー（別の目） | ローカル LM Studio | 完全無料 | ◎ |
| 共有記憶 | Obsidian（Local REST API + MCP） | 無料 | ◎ |
| 軽量大量処理 | Gemini CLI 無料枠 / Copilot 無料枠 | 無料枠内 | ○ 補助 |
| 重い調査 | Gemini Deep Research / NotebookLM | プラン内 | × 手動（ブラウザ） |

**鉄則**: ビルド = Codex/Plus、レビュー = ローカルモデル。両者をObsidian経由で引き継ぐ。

---

## 段階的セットアップ

### Stage 0 — 基盤（まず動かす）

1. **Codex CLI を入れ、ChatGPTでログイン**（API課金経路を避ける最重要ステップ）
   ```bash
   npm install -g @openai/codex      # または brew
   unset OPENAI_API_KEY              # ← API課金経路に落ちないよう必ず未設定に
   codex login                       # "Sign in with ChatGPT" を選ぶ
   ```
   設定ファイルが `forced_login_method = "chatgpt"` で認証経路を固定します。

2. **LM Studio を入れ、ローカルサーバを起動**
   - モデル: `Qwen3-Coder-30B-A3B (Q4_K_M)` ＝ 24GBでの第一候補（約16–17GB）。
     文脈に余裕が欲しければ `Qwen 3.5 9B` か `Qwen 3 14B`。
     ツール呼び出し（エージェント用途）の安定性では**密モデル(14B)**が有利な場合あり。
   - LM Studio → Developer → Local Server → port **1234**（OpenAI互換）で起動。

3. **Obsidian を入れ、"Local REST API" プラグインを有効化**
   - 設定 → Local REST API → APIキーをコピー、`Enable HTTP server`(27123)をON。
   - **Vaultは必ずバックアップ**（MCPは読み書き削除の全権を持つため）。

4. **このキットを設置**
   ```bash
   cd jarvis-codex-org
   ./setup.sh
   ```

### Stage 1 — 記憶＋統治

- `vault/` をあなたのObsidian Vault直下にコピー（setup.shが案内）。
- `~/.zshrc` に環境変数を追加:
  ```bash
  export OBSIDIAN_API_KEY="（Local REST APIのキー）"
  export VAULT="$HOME/Obsidian/Jarvis"
  # 必要なら export GITHUB_PAT_TOKEN="..."
  ```
- `MEMORY.md` を自分の情報で更新（既に初期値は記入済み）。
- 接続確認: `codex` を起動し `/mcp` で obsidian が出るか確認。

### Stage 2 — 開発パイプライン

```bash
# 1) 隔離ツリーを作る（1タスク=1ツリー）
scripts/worktree_new.sh ~/dev/myapp login-form

# 2) ビルド（Codex/Plus）
scripts/codex_build.sh ~/dev/myapp-login-form "SPEC.md の §2 を実装し、テストを通せ"

# 3) レビュー（ローカル・無料）
scripts/local_review.sh ~/dev/myapp-login-form main
```
同時並列は **3〜5本**まで。それ以上はレビューが追いつかず逆効果。

### Stage 3 — 定時運用（朝会）

```bash
cp launchd/com.jarvis.morningmeeting.plist ~/Library/LaunchAgents/
# plist内のパス・VAULT・OBSIDIAN_API_KEY を実値に編集してから:
launchctl load ~/Library/LaunchAgents/com.jarvis.morningmeeting.plist
```
毎朝7:30に `morning_meeting.sh` が走り、DailyノートをVaultに生成します。

### Stage 4 — 調査ループ（一部手動）

- 重い調査（Gemini Deep Research / NotebookLM）はブラウザで実施 → 結果をMarkdownでObsidianへ。
- 軽量・定時の調査は `scripts/research_scan.sh "テーマ"` で自動化（web検索MCPの設定が前提）。

---

## 🖥️ デスクアプリとして使う（ターミナル不要）

「`codex` と打つ／`scripts/*.sh` を叩く」をすべて**クリック操作**に置き換えられます。
既存ロジックは作り直さず、上に窓を3層かぶせるだけ:

1. **対話** → Codex公式デスクトップ/IDEアプリ（同じ `~/.codex` 設定をそのまま読む）。
2. **操作** → Obsidian「操作盤」ノート（Buttons＋Shell commands で朝会/ビルド/レビュー/worktree/調査）。
3. **ランチャ**（任意）→ ダブルクリックの `desktop/commands/*.command`、または Raycast。

最短は ①＋②。詳しい手順は **[`desktop/DESKTOP.md`](desktop/DESKTOP.md)** を参照。
（課金ゼロ・ChatGPTログイン固定・ローカルレビュー退避の鉄則はデスクアプリ層でも不変。）

---

## ⚠️ 重要な落とし穴（検証済み）

1. **認証経路 = 唯一の課金事故ポイント。** 「Sign in with ChatGPT」を使い、`OPENAI_API_KEY`
   は未設定に。API キー経路はメーター課金です。本設定は `forced_login_method="chatgpt"` で固定済み。

2. **ローカルモデルは Responses API が必要。** Codexは2026年2月以降 `wire_api="responses"` のみ対応で、
   Chat Completions は廃止されました。LM Studio がそれを直接話せない版だと404になります。
   その場合は **LiteLLM** で変換:
   ```bash
   pip install 'litellm[proxy]'
   litellm --model lm_studio/qwen3-coder-30b --port 4000
   ```
   そして config.toml の `base_url` を `http://localhost:4000/v1` に変更。

3. **`codex exec`（非対話）ではカスタムエージェントを名前で呼べない場合がある。**
   サブエージェントの名前指定は対話CLI/TUI（`/agent`、明示的な委譲プロンプト）で有効です。
   スクリプト自動化では「1ツリー=1ワーカー」を基本にし、エージェントの指示は
   プロンプトに直接埋め込む設計にしています（本キットのスクリプトはその方針）。

4. **自己署名証明書。** HTTPS(27124)で繋ぐ場合は証明書を信頼させるか、平文HTTP(27123)を使う
   （本設定は簡単のため27123を既定）。

5. **MCPはPlus制限を食う。** 使わないMCPは `enabled=false` に。本設定でGitHub/Context7は既定OFF。

6. **Plusの5時間ウィンドウ制限**（フラッグシップで概ね 15–80メッセージ/5h）。
   使い切ったら**クレジットを買わずリセットを待つ**のが「課金ゼロ」の原則。ルーチンはローカルへ。

7. **価格・上限・無料枠は流動的。** 適宜 `chatgpt.com/codex/pricing` とセッション内 `/status` で確認を。

---

## トラブル時

- `/mcp` にobsidianが出ない → APIキー(env)とHTTP(27123)有効化を確認。Codexを再起動。
- ローカルレビューが404 → 上記2のLiteLLMプロキシを挟む。
- 制限到達 → `--profile local_review` でローカルに退避。クレジットは有効化しない。
