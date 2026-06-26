#!/bin/bash
# Raycast Script Command — JARVIS 朝会
# 設定: Raycast → Extensions → Script Commands → Add Directory に desktop/raycast を追加。
# @raycast.schemaVersion 1
# @raycast.title JARVIS 朝会（Daily生成）
# @raycast.mode fullOutput
# @raycast.packageName JARVIS
# @raycast.icon 🗓️
# Documentation:
# @raycast.author nishizuka kai

set -euo pipefail
KIT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$HOME/.jarvis.env" ] && source "$HOME/.jarvis.env"
bash "$KIT/scripts/morning_meeting.sh"
