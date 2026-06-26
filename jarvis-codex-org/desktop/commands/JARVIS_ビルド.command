#!/bin/bash
# =============================================================================
#  JARVIS_ビルド.command — Codex(Plus)で指定worktreeに実装させる
#  ダブルクリック → worktreeパスと指示文を聞き、scripts/codex_build.sh を実行。
#  ※ Plus の5時間ウィンドウ制限を消費する作業。隔離ツリーは先に worktree で作る。
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

WT="$(ask "ビルド対象 worktree のパス" "${REPOS:-$HOME/dev}/myapp-login-form")"
PROMPT="$(ask "Codexへの指示（例: SPEC.mdの§2を実装しテストを通せ）" "")"

[ -z "$PROMPT" ] && { echo "指示が空です。中止しました。"; exit 0; }

echo "==> Codexビルド: $WT"
bash "$KIT/scripts/codex_build.sh" "$WT" "$PROMPT"
echo
echo "✅ ビルド完了。出力: $WT/.codex_build_out.md / 次はローカルレビューへ。"
