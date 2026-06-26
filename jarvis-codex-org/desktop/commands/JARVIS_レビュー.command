#!/bin/bash
# =============================================================================
#  JARVIS_レビュー.command — ローカルモデルで無料コードレビュー（Plus制限を消費しない）
#  ダブルクリック → 対象リポジトリと比較ブランチを聞き、scripts/local_review.sh を実行。
#  LM Studio を :1234 で起動しておくこと。
# =============================================================================
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
KIT="$(cd "$DIR/../.." && pwd)"
[ -f "$HOME/.jarvis.env" ] && source "$HOME/.jarvis.env"

ask() {  # ask "メッセージ" "既定値" -> 入力（キャンセルで終了）
  osascript <<OSA 2>/dev/null || exit 0
text returned of (display dialog "$1" default answer "$2" buttons {"キャンセル","OK"} default button "OK")
OSA
}

REPO="$(ask "レビュー対象リポジトリのパス" "${REPOS:-$HOME/dev}/myapp")"
BASE="$(ask "比較先ブランチ" "main")"

echo "==> ローカルレビュー: $REPO （$BASE...HEAD）"
bash "$KIT/scripts/local_review.sh" "$REPO" "$BASE"
echo
echo "✅ レビュー完了。"
