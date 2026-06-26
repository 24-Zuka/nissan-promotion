#!/bin/bash
# =============================================================================
#  JARVIS_調査.command — テーマを渡すと簡潔ブリーフを Inbox に書き込む
#  ダブルクリック → テーマを聞き、scripts/research_scan.sh を実行。
# =============================================================================
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
KIT="$(cd "$DIR/../.." && pwd)"
[ -f "$HOME/.jarvis.env" ] && source "$HOME/.jarvis.env"

ask() {
  osascript <<OSA 2>/dev/null || exit 0
text returned of (display dialog "$1" default answer "$2" buttons {"キャンセル","OK"} default button "OK")
OSA
}

TOPIC="$(ask "調査テーマ" "")"
[ -z "$TOPIC" ] && { echo "テーマが空です。中止しました。"; exit 0; }

echo "==> 調査スキャン: $TOPIC"
bash "$KIT/scripts/research_scan.sh" "$TOPIC"
echo
echo "✅ 完了。Obsidian の 00_Inbox/ に research_*.md が生成されました。"
