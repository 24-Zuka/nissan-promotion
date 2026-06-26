#!/bin/bash
# Raycast Script Command — JARVIS ローカルレビュー（無料 / Plus制限を消費しない）
# @raycast.schemaVersion 1
# @raycast.title JARVIS ローカルレビュー
# @raycast.mode fullOutput
# @raycast.packageName JARVIS
# @raycast.icon 🔍
# @raycast.argument1 { "type": "text", "placeholder": "リポジトリのパス" }
# @raycast.argument2 { "type": "text", "placeholder": "比較ブランチ(既定 main)", "optional": true }

set -euo pipefail
KIT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$HOME/.jarvis.env" ] && source "$HOME/.jarvis.env"
bash "$KIT/scripts/local_review.sh" "$1" "${2:-main}"
