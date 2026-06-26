#!/usr/bin/env bash
# 共通設定。各スクリプトが source する。自分の環境に合わせて編集。
set -euo pipefail

# Obsidian Vault の場所（実際のパスに変更）
export VAULT="${VAULT:-$HOME/Obsidian/Jarvis}"

# 開発リポジトリのルート（worktree作成の親）
export REPOS="${REPOS:-$HOME/dev}"

# 通知先（任意）。Discord Webhook を使う場合のみ設定。
export DISCORD_WEBHOOK="${DISCORD_WEBHOOK:-}"

# Codex 実行の安全既定（非対話・JSON）
codex_run() {  # 使い方: codex_run <profile> <cwd> <prompt>
  local profile="$1"; local cwd="$2"; local prompt="$3"
  codex exec \
    --profile "$profile" \
    --cd "$cwd" \
    --ask-for-approval never \
    --json \
    "$prompt"
}

notify() {  # Discordへ要約を通知（任意）
  [ -z "$DISCORD_WEBHOOK" ] && { echo "$1"; return; }
  curl -fsS -X POST -H 'Content-Type: application/json' \
    -d "{\"content\": $(printf '%s' "$1" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')}" \
    "$DISCORD_WEBHOOK" >/dev/null || true
}
