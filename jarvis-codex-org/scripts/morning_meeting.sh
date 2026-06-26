#!/usr/bin/env bash
# 朝会（morning meeting）: その日のDailyノートをCodexに生成させる。
# launchd から毎朝実行する想定。Obsidian MCP 経由でVaultに書き込む。
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/env.sh"

TODAY="$(date +%Y-%m-%d)"
DAILY="Daily/${TODAY}.md"

PROMPT=$(cat <<PROMPT
daily-brief スキルに従い、本日 ${TODAY} のDailyノートをVaultに作成せよ。
手順:
1) Obsidian MCP で MEMORY.md と AI_Handoff.md の「アクティブ」を読み、文脈を把握する。
2) 取得可能な情報（GitHubのCI、Inboxの未整理メモ等）を集約する。取れない情報は「未取得」と記す。
3) Templates/daily.md の構成で日本語のDailyノートを生成する。
4) Obsidian MCP で ${DAILY} に書き込む（既存があれば追記、上書きしない）。
5) 最後に最優先3件を1行ずつ標準出力に出して終了する。
PROMPT
)

# CIプロファイル（gpt-5.4-mini, 非対話）で実行。Plus制限に優しい。
OUT="$(codex_run ci "$VAULT" "$PROMPT" 2>&1 | tee /tmp/morning_meeting.log | tail -n 20)"
notify "🗓️ ${TODAY} 朝会完了。最優先:\n${OUT}"
echo "done: ${DAILY}"
