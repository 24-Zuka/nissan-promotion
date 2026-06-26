# JARVIS をデスクアプリとして使う

ターミナルを開かずに、このシステムを**クリックだけ**で回すための層です。
既存のロジック（`~/.codex` 設定・`scripts/*.sh`・Obsidian Vault）は**作り直しません**。
その上に「窓」を3層かぶせるだけです。

| 層 | 何が端末不要になるか | 手間 |
|----|--------------------|------|
| ① Codex公式アプリ/IDE | 対話セッション（旧パターン③） | インストールのみ |
| ② Obsidian操作盤 | 朝会・ビルド・レビュー・worktree・調査 | プラグイン2個 |
| ③ .command / Raycast | Dock/ランチャからワンクリック起動 | 0〜任意 |

最短は **①＋② の併用**。③は好みで足します。

---

## ① 対話を「アプリ」にする — Codex公式 GUI

Codex は**同じ `~/.codex/` 設定を読む公式 GUI**を持っています（macデスクトップアプリ、
および VS Code / JetBrains / Cursor などの IDE 拡張）。CLIで使っていた設定が**そのまま**効きます。

1. Codex の公式デスクトップアプリ、または IDE 拡張を入れる
   （入手元は流動的なので「OpenAI Codex 公式」の最新案内を確認）。
2. **「Sign in with ChatGPT」でログイン**（`OPENAI_API_KEY` は未設定のまま＝課金ゼロ厳守）。
3. 作業フォルダ（リポジトリ）を開いて話しかける。
   - `~/.codex/AGENTS.md` の **JARVIS人格**、`agents/` の **サブエージェント**、
     `skills/`（commit / code-review / daily-brief）、**Obsidian MCP** がそのまま動きます。

> これだけで「ターミナルで `codex` と打つ」作業がアプリ内のチャットに置き換わります。
> ＝旧パターン③が完全に端末不要に。

---

## ② 操作を「アプリ」にする — Obsidian 操作盤

スクリプト操作（朝会・開発パイプライン・調査）を Obsidian の**ボタン**にします。
Obsidian は記憶の中心であり、それ自体デスクトップアプリなので、**記憶＋対話＋操作が1画面**に収まります。

導入手順 → **[`obsidian/INSTALL.md`](obsidian/INSTALL.md)**
登録コマンド一覧 → **[`obsidian/shell-commands.md`](obsidian/shell-commands.md)**
ホーム画面ノート → **[`obsidian/Control Panel.md`](obsidian/Control%20Panel.md)**（Vault直下に置く）

要点だけ:
1. コミュニティプラグイン **Shell commands** と **Buttons** を有効化。
2. `~/.jarvis.env` に `VAULT` / `REPOS` / `OBSIDIAN_API_KEY` を書く（GUI起動では `~/.zshrc` が読まれないため）。
3. `shell-commands.md` の5コマンドを登録。
4. `Control Panel.md` を Vault 直下に置き、起動時に開くノートに設定 → JARVISのホーム画面完成。

---

## ③ Dock/ランチャから — .command と Raycast（任意）

### a) ダブルクリック起動（依存ゼロ・一番簡単）
`desktop/commands/` の `.command` ファイルは、**Finder/Dock からダブルクリック**で動きます。
入力が要る操作（レビュー対象・ビルド指示など）は macOS のダイアログが出ます。出力は開いた
Terminal ウィンドウに表示されます。

初回だけ実行権限を付けます（zip展開で実行属性が落ちることがあるため）:
```bash
chmod +x ~/jarvis-codex-org/desktop/commands/*.command
```
よく使う `.command` は Finder で右クリック →「エイリアスを作成」して **Dock に登録**すると、
専用アプリのアイコンのように使えます。

> macOS が「開発元を確認できない」と出たら、初回のみ右クリック →「開く」で許可。

### b) Raycast（ランチャ/メニューバー派）
`desktop/raycast/` を Raycast の Script Commands ディレクトリに追加すると、ホットキーから
「JARVIS 朝会」「JARVIS ローカルレビュー」等を呼べます。引数欄付きです。

---

## 課金ゼロの鉄則（デスクアプリ層でも不変）
- 認証は常に **Sign in with ChatGPT**。`OPENAI_API_KEY` は未設定。
- 重い作業＝Codex/Plus、ルーチン＝ローカル（LM Studio）。Plus制限に達したらクレジットを買わず待つ。
- レビューはローカル（②の🔍 / `.command` のレビュー）で Plus を消費しない。

---

## 動作確認（実機での手順）
1. **対話**: Codexアプリを開き ChatGPTログイン → フォルダを開く → JARVISが応答、`/mcp` に `obsidian` が出る。
2. **操作盤**: Obsidian で `Control Panel.md` の 🔍ローカルレビューを実行 → 結果が出て Plus を消費しない。
3. **朝会**: 🗓️ボタン → `Daily/YYYY-MM-DD.md` が生成される。
4. **.command**: `JARVIS_調査.command` をダブルクリック → テーマ入力 → `00_Inbox/research_*.md` 生成。
