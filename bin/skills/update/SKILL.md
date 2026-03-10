---
name: orchestrator:update
version: 1.0.0
description: This skill should be used when the user asks to "update orchestrator", "update agents", "check for updates", or runs /orchestrator:update.
user-invocable: true
allowed-tools: Bash
---

# Update Agent Orchestrator

Update the Agent Orchestrator framework to the latest version.

## Instructions

Run the following command to update:

```bash
npx agent-orchestrator-cc@latest --update
```

This will:
1. Check the currently installed version
2. Download the latest version from npm
3. Update all skills in `~/.claude/skills/`
4. Report what changed

After the command completes, tell the user:
- What version they were on
- What version they're now on
- To restart Claude Code if skills changed
