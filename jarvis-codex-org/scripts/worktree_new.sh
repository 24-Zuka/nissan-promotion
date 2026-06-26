#!/usr/bin/env bash
# 隔離作業ツリーを作る。1タスク=1ツリー。複数ワーカーが同じツリーを触らない鉄則。
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; source "$DIR/env.sh"

REPO="${1:?usage: worktree_new.sh <repo-path> <feature-name>}"
FEAT="${2:?feature name required}"

cd "$REPO"
git worktree add -b "feature/${FEAT}" "../$(basename "$REPO")-${FEAT}" main
echo "created worktree: ../$(basename "$REPO")-${FEAT}  (branch feature/${FEAT})"
