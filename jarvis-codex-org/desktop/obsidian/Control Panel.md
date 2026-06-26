---
type: dashboard
note: JARVIS 操作盤。Vault直下に置く。Buttons + Shell commands で全機能をクリック操作。
---

# 🎛️ JARVIS 操作盤

> このノートが「ホーム画面」。ボタンは **Buttons** プラグイン、実体は **Shell commands**（`shell-commands.md` で登録した Alias）を呼びます。
> ボタンが効かない時は Alias 名の一致を確認してください。

## 日次

```button
name 🗓️ 朝会（Daily生成）
type command
action Shell commands: Execute: 朝会
```

## 開発パイプライン

```button
name 🌿 worktree作成
type command
action Shell commands: Execute: worktree作成
```
```button
name 🛠️ ビルド（Codex/Plus）
type command
action Shell commands: Execute: ビルド
```
```button
name 🔍 ローカルレビュー（無料）
type command
action Shell commands: Execute: ローカルレビュー
```

> 流れ: **worktree作成 → ビルド → ローカルレビュー**。`main` へのマージは人間（海）が判断。

## 調査

```button
name 📚 調査スキャン → Inbox
type command
action Shell commands: Execute: 調査スキャン
```

---

## 記憶へのリンク

- [[MEMORY]] — 文脈エンジン（恒久文脈）
- [[AI_Handoff]] — 引き継ぎ板
- [[DECISION_LOG]] — 意思決定ログ
- 今日の Daily: `Daily/` を開く

## メモ
- Plus制限に達したら **クレジットを買わず**、レビュー等はローカル（上の🔍）へ。5時間でリセット。
- 重い調査（Deep Research / NotebookLM）はブラウザで実施 → 結果を `00_Inbox/` へ。

> ⚠️ ボタンの `action` は Buttons プラグインのバージョンで `Shell commands: Execute: <Alias>` の
> 表記が異なる場合があります。ボタン作成時に表示されるコマンド候補から、登録済み Alias を選び直してください。
