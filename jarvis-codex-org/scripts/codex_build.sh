#!/usr/bin/env bash
# 指定worktreeで仕様の一節を実装させる（ビルド担当 = Codex/Plus）。
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; source "$DIR/env.sh"

WT="${1:?usage: codex_build.sh <worktree-path> <prompt>}"
PROMPT="${2:?prompt required}"

# 既定プロファイル（gpt-5.5）でビルド。高難度なら 'deep' に変更。
codex exec \
  --cd "$WT" \
  --sandbox workspace-write \
  --ask-for-approval never \
  --json \
  -o "$WT/.codex_build_out.md" \
  "$PROMPT
作業後、必ずテストを実行し結果を報告せよ。完了した決定は Obsidian の DECISION_LOG.md に1行追記し、引き継ぎを AI_Handoff.md に記録せよ。"
echo "build finished. output -> $WT/.codex_build_out.md"
