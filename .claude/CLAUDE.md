# Agent Orchestrator Framework

Routes tasks to specialized AI agents via Claude Code's **Task tool**. Agents are defined as `.md` files with YAML frontmatter.

## How It Works

1. User describes a task (e.g., "check my Docker containers")
2. The orchestrator skill reads agent `.md` files from `.claude/agents/project/`
3. It matches the task against each agent's `capabilities` and `triggers`
4. It dispatches to the best match using the **Task tool** with the agent's `name` as `subagent_type`
5. On failure, it retries with the next best agent (up to 2 retries)

## Skills

### orchestrator
Routes tasks to agents, lists available agents, finds agents by capability.

**Trigger phrases:** "list agents", "route this to an agent", "what agents can handle X?"

### create-agent
Creates new agent `.md` files with proper frontmatter and instructions.

**Trigger phrases:** "create an agent for X", "make a new agent", "I need an agent to handle X"

## Agent Format

Agents are `.md` files in `.claude/agents/project/` with this structure:

```yaml
---
id: my-agent
name: My Agent Name
description: |
  When to use this agent and what it does.
capabilities:
  - capability-one
  - capability-two
triggers:
  - keyword1
  - keyword2
model: sonnet
---
```

The body contains instructions that the agent follows when dispatched.

## Configuration

`orchestrator.config.json`:
- `agentPaths` - Directories containing agent `.md` files
- `maxRetries` - How many different agents to try on failure (default: 2)
- `defaultModel` - Model when agent doesn't specify one (default: sonnet)

## Key Files

| File | Purpose |
|------|---------|
| `.claude/skills/orchestrator/SKILL.md` | Task routing skill |
| `.claude/skills/create-agent/SKILL.md` | Agent creation skill |
| `templates/new-agent.md` | Agent template |
| `templates/orchestrator.config.json` | Config template |
