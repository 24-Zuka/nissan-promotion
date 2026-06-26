#!/usr/bin/env bash
# 研究/情報スキャン: テーマを渡すと、簡潔なブリーフをInboxに書き込む。
# 無料のweb検索MCP（要設定）またはローカル要約で運用。
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; source "$DIR/env.sh"

TOPIC="${1:?usage: research_scan.sh \"テーマ\"}"
STAMP="$(date +%Y-%m-%d_%H%M)"
NOTE="00_Inbox/research_${STAMP}.md"

PROMPT="次のテーマについて簡潔なブリーフ（要点5項目＋出典）を日本語で作成し、Obsidian MCP で ${NOTE} に書き込め。未確認の点は明記すること。テーマ: ${TOPIC}"

codex_run ci "$VAULT" "$PROMPT"
echo "brief -> ${NOTE}"
