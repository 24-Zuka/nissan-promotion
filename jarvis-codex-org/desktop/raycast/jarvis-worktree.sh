#!/bin/bash
# Raycast Script Command — JARVIS worktree作成
# @raycast.schemaVersion 1
# @raycast.title JARVIS worktree作成
# @raycast.mode compact
# @raycast.packageName JARVIS
# @raycast.icon 🌿
# @raycast.argument1 { "type": "text", "placeholder": "元リポジトリのパス" }
# @raycast.argument2 { "type": "text", "placeholder": "機能名" }

set -euo pipefail
KIT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$HOME/.jarvis.env" ] && source "$HOME/.jarvis.env"
bash "$KIT/scripts/worktree_new.sh" "$1" "$2"
