#!/usr/bin/env bash
# =============================================================================
#  setup.sh — JARVIS型エージェント組織 設置スクリプト
#  方針: 既存ファイルを壊さない。上書き前に必ず確認。鍵は書き込まない。
# =============================================================================
set -euo pipefail

KIT="$(cd "$(dirname "$0")" && pwd)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"

say()  { printf '\033[1;36m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m%s\033[0m\n' "$*"; }

backup_if_exists() {  # 既存があればタイムスタンプ付きで退避
  local f="$1"
  if [ -e "$f" ]; then
    local b="${f}.bak.$(date +%Y%m%d%H%M%S)"
    cp -a "$f" "$b"
    warn "既存を退避: $b"
  fi
}

say "==> Codex 設定の設置先: $CODEX_HOME"
mkdir -p "$CODEX_HOME/agents" "$CODEX_HOME/skills"

# --- 1. config.toml ----------------------------------------------------------
say "--- config.toml"
if [ -e "$CODEX_HOME/config.toml" ]; then
  warn "$CODEX_HOME/config.toml は既に存在します。"
  read -r -p "上書きしますか？（既存はバックアップ） [y/N] " ans
  if [[ "${ans:-N}" =~ ^[Yy]$ ]]; then
    backup_if_exists "$CODEX_HOME/config.toml"
    cp "$KIT/codex/config.toml" "$CODEX_HOME/config.toml"
    ok "config.toml を設置しました。"
  else
    warn "config.toml はスキップ。手動マージ用に kit 内を参照してください。"
  fi
else
  cp "$KIT/codex/config.toml" "$CODEX_HOME/config.toml"
  ok "config.toml を設置しました。"
fi

# --- 2. AGENTS.md ------------------------------------------------------------
say "--- AGENTS.md（グローバル）"
backup_if_exists "$CODEX_HOME/AGENTS.md"
cp "$KIT/codex/AGENTS.md" "$CODEX_HOME/AGENTS.md"
ok "AGENTS.md を設置しました。"

# --- 3. subagents ------------------------------------------------------------
say "--- サブエージェント (~/.codex/agents/)"
cp "$KIT"/codex/agents/*.toml "$CODEX_HOME/agents/"
ok "$(ls "$CODEX_HOME"/agents/*.toml | wc -l | tr -d ' ') 個のエージェントを設置。"

# --- 4. skills ---------------------------------------------------------------
say "--- スキル (~/.codex/skills/)"
cp -R "$KIT"/codex/skills/* "$CODEX_HOME/skills/"
ok "スキルを設置しました（code-review / commit / daily-brief）。"

# --- 5. Vault ----------------------------------------------------------------
say "--- Obsidian Vault スケルトン"
DEFAULT_VAULT="$HOME/Obsidian/Jarvis"
read -r -p "Vaultの設置先 [$DEFAULT_VAULT]: " VPATH
VPATH="${VPATH:-$DEFAULT_VAULT}"
if [ -e "$VPATH" ] && [ "$(ls -A "$VPATH" 2>/dev/null || true)" ]; then
  warn "$VPATH は空ではありません。既存ファイルは上書きしません（不足分のみ補完）。"
  cp -Rn "$KIT"/vault/* "$VPATH"/ 2>/dev/null || true
  cp -Rn "$KIT"/vault/.gitkeep "$VPATH"/ 2>/dev/null || true
else
  mkdir -p "$VPATH"
  cp -R "$KIT"/vault/* "$VPATH"/
fi
ok "Vault を $VPATH に展開しました。"

# --- 6. 仕上げ案内 -----------------------------------------------------------
echo
say "==== 残りの手動ステップ ===="
cat <<NEXT
1) ~/.zshrc に環境変数を追加（鍵はこのスクリプトでは書きません）:
     export OBSIDIAN_API_KEY="（Obsidian Local REST APIのキー）"
     export VAULT="$VPATH"
   その後:  source ~/.zshrc

2) LM Studio を起動し、モデルをロードして Local Server を :1234 で起動。
   config.toml の profiles.local_review の model を、ロード中のモデルIDに合わせる。

3) ChatGPTでログイン（API課金経路を避ける）:
     unset OPENAI_API_KEY
     codex login        # "Sign in with ChatGPT"

4) 接続確認:
     codex            # 起動後  /mcp  で obsidian が見えるか確認
     $KIT/scripts/local_review.sh ~/dev/yourrepo main   # ローカルレビュー試運転

5) 朝会の定時実行（任意）:
     cp $KIT/launchd/com.jarvis.morningmeeting.plist ~/Library/LaunchAgents/
     # plist 内のパス/VAULT/鍵を編集後:
     launchctl load ~/Library/LaunchAgents/com.jarvis.morningmeeting.plist
NEXT
ok "セットアップ完了。詳細は README.md を参照してください。"
