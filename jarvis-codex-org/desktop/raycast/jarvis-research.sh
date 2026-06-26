#!/bin/bash
# Raycast Script Command — JARVIS 調査スキャン
# @raycast.schemaVersion 1
# @raycast.title JARVIS 調査スキャン
# @raycast.mode fullOutput
# @raycast.packageName JARVIS
# @raycast.icon 📚
# @raycast.argument1 { "type": "text", "placeholder": "調査テーマ" }

set -euo pipefail
KIT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$HOME/.jarvis.env" ] && source "$HOME/.jarvis.env"
bash "$KIT/scripts/research_scan.sh" "$1"
