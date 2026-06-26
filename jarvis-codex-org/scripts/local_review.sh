#!/usr/bin/env bash
# ローカルモデル（LM Studio）で現在ブランチの差分を読み取り専用レビュー。
# Plus制限を一切消費しない無料レビュー。LM Studioが:1234で起動している前提。
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/env.sh"

TARGET="${1:-$PWD}"      # レビュー対象リポジトリ（既定: カレント）
BASE="${2:-main}"        # 比較先ブランチ

PROMPT="code-review スキルに従い、git diff ${BASE}...HEAD の差分をレビューせよ。深刻度順に、ファイル参照付きで指摘し、所感を3行以内で述べよ。コードは編集しないこと。"

codex exec \
  --profile local_review \
  --cd "$TARGET" \
  --ask-for-approval never \
  "$PROMPT"
