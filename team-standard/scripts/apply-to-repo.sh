#!/usr/bin/env bash
# Oscar Wilson team standard — stamp the guardrails into one repo.
# Adds .claude/settings.json (guardrails), the bash-guard hook, AGENTS.md /
# CLAUDE.md from templates (only if the repo has neither), and .gitignore
# entries. Never overwrites an existing settings.json, AGENTS.md or CLAUDE.md —
# it reports instead, so repos with real config stay untouched.
#
# Usage: bash apply-to-repo.sh /path/to/repo
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"   # team-standard/
REPO="${1:?usage: apply-to-repo.sh /path/to/repo}"
[ -d "$REPO/.git" ] || { echo "Not a git repo: $REPO" >&2; exit 1; }

mkdir -p "$REPO/.claude/hooks"

# Guardrail hook — always safe to refresh (it is the standard's file)
cp "$HERE/guardrails/hooks/bash-guard.sh" "$REPO/.claude/hooks/bash-guard.sh"
chmod +x "$REPO/.claude/hooks/bash-guard.sh"
echo "Installed .claude/hooks/bash-guard.sh"

# Shared settings — never clobber an existing one
if [ -f "$REPO/.claude/settings.json" ]; then
  echo "SKIPPED .claude/settings.json (exists) — merge $HERE/global/settings.json manually"
else
  cp "$HERE/global/settings.json" "$REPO/.claude/settings.json"
  echo "Installed .claude/settings.json"
fi

# Two-file instruction layout — only when the repo has neither file
if [ -f "$REPO/CLAUDE.md" ] || [ -f "$REPO/AGENTS.md" ]; then
  echo "SKIPPED CLAUDE.md/AGENTS.md (repo already has instructions)"
else
  cp "$HERE/templates/AGENTS.md.template" "$REPO/AGENTS.md"
  cp "$HERE/templates/CLAUDE.md.template" "$REPO/CLAUDE.md"
  echo "Installed AGENTS.md + CLAUDE.md templates — fill in the {placeholders}"
fi

# .gitignore entries
touch "$REPO/.gitignore"
for entry in ".claude/settings.local.json" "CLAUDE.local.md" ".env" ".env.*" "!.env.example" "exports/"; do
  grep -qxF "$entry" "$REPO/.gitignore" || echo "$entry" >> "$REPO/.gitignore"
done
echo "Ensured .gitignore entries"

# Memory scaffold (committed on purpose — see the global standard)
mkdir -p "$REPO/.claude/memory"
[ -f "$REPO/.claude/memory/lessons-learned.md" ] || cat > "$REPO/.claude/memory/lessons-learned.md" <<'EOF'
# Lessons Learned

Concise, actionable, dated. Newest at the bottom.
Format: - [YYYY-MM-DD] fact — why it matters — what to do instead.
EOF
echo "Ensured .claude/memory/lessons-learned.md"

echo "Done. Review 'git status' in $REPO, fill any {placeholders}, then commit on a feature branch."
