#!/usr/bin/env bash
# Oscar Wilson team guardrails — PreToolUse hook for the Bash tool.
#
# Hard-blocks the small set of commands the team has agreed Claude must
# never run, regardless of which repo or machine the session is in.
# Blocking contract: exit 2 blocks the tool call; stderr is shown to
# Claude so it can take a safer path. Exit 0 lets the normal permission
# flow decide.
#
# Hook input arrives as JSON on stdin: {"tool_name":..., "tool_input":{"command":...}}

INPUT="$(cat 2>/dev/null)"
CMD=""
if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // .command // empty' 2>/dev/null)"
fi
# Fallback when jq is unavailable or input shape differs
[ -z "$CMD" ] && CMD="${CLAUDE_TOOL_INPUT:-}"
[ -z "$CMD" ] && exit 0

block() {
  echo "BLOCKED by OW team guardrails: $1" >&2
  exit 2
}

# --- Git safety -------------------------------------------------------------
# Force pushes rewrite shared history. --force-with-lease on a personal
# feature branch is a human decision, not Claude's.
if printf '%s' "$CMD" | grep -qE 'git +push[^|;&]*( --force| -f )'; then
  block "force push. Ask a human to do this deliberately if it is truly needed."
fi
if printf '%s' "$CMD" | grep -qE 'git +push[^|;&]*(--force|-f)$'; then
  block "force push. Ask a human to do this deliberately if it is truly needed."
fi

# Direct pushes to main/master — all changes go through a PR.
if printf '%s' "$CMD" | grep -qE 'git +push[^|;&]* (origin|upstream) +(main|master)( |$|:)'; then
  block "direct push to main/master. Push a feature branch and open a PR."
fi

# Hooks exist for a reason.
if printf '%s' "$CMD" | grep -qE 'git +commit[^|;&]*( --no-verify| -n )|git +commit[^|;&]*(--no-verify)$'; then
  block "commit with --no-verify. Fix what the hook is complaining about instead."
fi

# Whole-history rewrites. (Rebasing a feature branch onto main is fine and
# not matched here.)
if printf '%s' "$CMD" | grep -qE 'git +(filter-branch|filter-repo)( |$)'; then
  block "whole-history rewrite (filter-branch/filter-repo)."
fi

# --- Filesystem safety ------------------------------------------------------
# Catastrophic rm targets: root, home, cwd, everything.
if printf '%s' "$CMD" | grep -qE 'rm +(-[a-zA-Z]* +)*-[a-zA-Z]*[rR][a-zA-Z]* +("?\$HOME"?|~|/|\*|\.|\.\.)([/ ]\*?)? *($|[;&|])'; then
  block "recursive delete of a broad target (/, ~, ., *). Delete specific paths only."
fi

# --- Supply-chain safety ----------------------------------------------------
# Piping a downloaded script straight into a shell.
if printf '%s' "$CMD" | grep -qE '(curl|wget)[^|;&]*\| *(sudo +)?(ba|z|da)?sh( |$)'; then
  block "curl|bash style install. Download the script to a file, review it, then run it."
fi

# --- Secrets safety ---------------------------------------------------------
# Reading env/secret files through the shell (the Read tool is already
# denied these paths in settings.json; this closes the Bash side).
# .env.example / .env.sample / .env.template are documentation, not secrets.
STRIPPED="$(printf '%s' "$CMD" | sed -E 's/\.env\.(example|sample|template)//g')"
if printf '%s' "$STRIPPED" | grep -qE '(cat|less|more|head|tail|grep|awk|sed|strings|xxd|base64|cut|sort|uniq)[^|;&]* ("|'"'"')?([^ "'"'"']*/)?\.env([." '"'"']|$)'; then
  block "shell read of a .env file. Ask the human for the specific value you need."
fi
if printf '%s' "$CMD" | grep -qE '(cat|less|more|head|tail|grep|strings|base64) +[^|;&]*(id_rsa|id_ed25519|\.pem|\.pfx|\.p12)([" ]|$)'; then
  block "shell read of a private key file."
fi

exit 0
