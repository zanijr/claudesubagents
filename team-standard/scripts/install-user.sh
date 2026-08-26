#!/usr/bin/env bash
# Oscar Wilson team standard — per-user install (Git Bash / Linux / macOS).
# Installs the global CLAUDE.md and mirrors team skills/agents from a
# claude-team-config checkout into ~/.claude. Safe to re-run any time.
#
# Usage: bash install-user.sh [path-to-claude-team-config-checkout]
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"   # team-standard/
TEAM_CFG="${1:-$HOME/source/repos/claude-team-config}"

# 1. Global CLAUDE.md (backs up any existing one first)
mkdir -p "$HOME/.claude"
if [ -f "$HOME/.claude/CLAUDE.md" ] && ! cmp -s "$HERE/global/CLAUDE.md" "$HOME/.claude/CLAUDE.md"; then
  cp "$HOME/.claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md.bak.$(date +%Y%m%d%H%M%S)"
  echo "Backed up existing ~/.claude/CLAUDE.md"
fi
cp "$HERE/global/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
echo "Installed global CLAUDE.md -> ~/.claude/CLAUDE.md"

# 2. Mirror team skills and agents from claude-team-config (if checked out)
if [ -d "$TEAM_CFG" ]; then
  (cd "$TEAM_CFG" && git pull --ff-only 2>/dev/null) || true
  if [ -d "$TEAM_CFG/skills" ]; then
    mkdir -p "$HOME/.claude/skills"
    for skill in "$TEAM_CFG/skills/"*/; do
      name="$(basename "$skill")"
      rm -rf "$HOME/.claude/skills/$name"
      cp -r "$skill" "$HOME/.claude/skills/$name"
      echo "Installed skill: $name"
    done
  fi
  if [ -d "$TEAM_CFG/agents" ]; then
    mkdir -p "$HOME/.claude/agents/project"
    # _template.md is boilerplate, NOT a live agent — never install it.
    find "$TEAM_CFG/agents" -maxdepth 1 -name '*.md' ! -name '_template.md' \
      -exec cp {} "$HOME/.claude/agents/" \;
    if [ -d "$TEAM_CFG/agents/project" ]; then
      find "$TEAM_CFG/agents/project" -maxdepth 1 -name '*.md' ! -name '_template.md' \
        -exec cp {} "$HOME/.claude/agents/project/" \;
    fi
    rm -f "$HOME/.claude/agents/_template.md" "$HOME/.claude/agents/project/_template.md"
    echo "Installed team agents (excluding _template.md)"
  fi
else
  echo "NOTE: claude-team-config not found at $TEAM_CFG — skipped skills/agents."
  echo "Clone it and re-run: git clone https://github.com/oscarwilsonengines/claude-team-config \"$TEAM_CFG\""
fi

echo "Done. Remember: never hand-edit ~/.claude mirrors — edit claude-team-config and re-run."
