---
name: orchestrator:update
version: 1.1.0
description: This skill should be used when the user asks to "update orchestrator", "update agents", "check for updates", or runs /orchestrator:update.
user-invocable: true
allowed-tools: Bash
---

# Update Agent Orchestrator

Update the Agent Orchestrator framework to the latest version from GitHub.

## Instructions

Determine which update method is available and use the first one that works:

### Method 1: claude-market CLI (preferred)
If `claude-market` is in PATH:
```bash
claude-market update
```

### Method 2: update.sh script
If installed at `~/.claude/orchestrator`:
```bash
bash ~/.claude/orchestrator/scripts/update.sh
```

### Method 3: git pull directly
If the orchestrator directory has a `.git` folder:
```bash
cd ~/.claude/orchestrator && git pull --ff-only origin main
```

## Detection Logic

Run this to find the right method:
```bash
if command -v claude-market >/dev/null 2>&1; then
  claude-market update
elif [ -f "$HOME/.claude/orchestrator/scripts/update.sh" ]; then
  bash "$HOME/.claude/orchestrator/scripts/update.sh"
elif [ -d "$HOME/.claude/orchestrator/.git" ]; then
  cd "$HOME/.claude/orchestrator" && git pull --ff-only origin main
else
  echo "Agent Orchestrator not found. Install with:"
  echo "  curl -fsSL https://raw.githubusercontent.com/zanijr/claudesubagents/main/scripts/get.sh | bash"
fi
```

After the command completes, tell the user:
- What version they were on
- What version they're now on (check `~/.claude/.orchestrator-version`)
- To restart Claude Code if skills changed
