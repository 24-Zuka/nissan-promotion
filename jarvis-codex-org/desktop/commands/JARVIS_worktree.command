#!/bin/bash
# =============================================================================
#  JARVIS_worktree.command — 隔離作業ツリー（1タスク=1ツリー）を作る
#  ダブルクリック → リポジトリと機能名を聞き、scripts/worktree_new.sh を実行。
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

REPO="$(ask "元リポジトリのパス" "${REPOS:-$HOME/dev}/myapp")"
FEAT="$(ask "機能名（branch feature/<名前> になります）" "login-form")"

echo "==> worktree作成: $REPO -> feature/$FEAT"
bash "$KIT/scripts/worktree_new.sh" "$REPO" "$FEAT"
echo
echo "✅ 作成完了。次は JARVIS_ビルド.command でこのツリーに実装させられます。"
