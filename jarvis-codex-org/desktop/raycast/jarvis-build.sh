#!/bin/bash
# Raycast Script Command — JARVIS ビルド（Codex/Plus）
# @raycast.schemaVersion 1
# @raycast.title JARVIS ビルド（Codex/Plus）
# @raycast.mode fullOutput
# @raycast.packageName JARVIS
# @raycast.icon 🛠️
# @raycast.argument1 { "type": "text", "placeholder": "worktreeパス" }
# @raycast.argument2 { "type": "text", "placeholder": "Codexへの指示" }

set -euo pipefail
KIT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$HOME/.jarvis.env" ] && source "$HOME/.jarvis.env"
bash "$KIT/scripts/codex_build.sh" "$1" "$2"
