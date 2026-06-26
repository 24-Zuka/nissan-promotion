#!/bin/bash
# =============================================================================
#  JARVIS_朝会.command — ダブルクリックで「朝会」を実行（端末不要）
#  Finder/Dock からダブルクリックすると Terminal が開き、本日のDailyノートを生成する。
#  依存プラグインなし。kit の scripts/morning_meeting.sh を呼ぶだけの薄いラッパ。
# =============================================================================
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
KIT="$(cd "$DIR/../.." && pwd)"

# GUI起動では ~/.zshrc の環境変数が載らないため、任意の鍵ファイルを読む。
[ -f "$HOME/.jarvis.env" ] && source "$HOME/.jarvis.env"

echo "==> JARVIS 朝会を実行します ($(date '+%Y-%m-%d %H:%M'))"
bash "$KIT/scripts/morning_meeting.sh"
echo
echo "✅ 完了。Obsidian の Daily/$(date +%Y-%m-%d).md を確認してください。"
echo "（このウィンドウは閉じて構いません）"
