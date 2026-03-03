# Agent Orchestrator Framework

Autonomous planner and executor that breaks goals into subtasks, creates any missing agents, and dispatches everything via the **Task tool** without user intervention.

## How It Works

1. User describes a goal (e.g., `/orchestrator set up monitoring for my Docker stack`)
2. Orchestrator plans: decomposes goal into subtasks with required capabilities
3. Matches subtasks to existing agents from `.claude/agents/project/*.md`
4. Auto-creates new agents for any unmatched subtasks
5. Dispatches all subtasks via the **Task tool** (parallel when independent)
6. **Context management**: agents checkpoint progress and get re-dispatched automatically if they run out of context
7. Reports results: what succeeded, what failed, what agents were created

## Skills

### orchestrator
Autonomous planner/executor. Plans, matches/creates agents, dispatches, reports.

**Trigger:** `/orchestrator`, "orchestrate this", "plan and execute", "list agents"

### create-agent
Manual agent creation with guided questions. Use when you want to create a single agent interactively.

**Trigger:** "create an agent for X", "make a new agent"

## Agent Format

Agents are `.md` files in `.claude/agents/project/` with YAML frontmatter:

```yaml
---
id: my-agent
name: My Agent Name
description: |
  When to use this agent and what it does.
capabilities:
  - capability-one
triggers:
  - keyword1
model: sonnet
---
```

The `name` field must match the Task tool's `subagent_type`. The body contains agent instructions.

## Context Management

When `contextManagement.enabled` is `true` in config, the orchestrator automatically manages agent context windows:

- **Checkpoints**: Agents write structured checkpoint files at regular intervals, capturing completed work, remaining work, decisions made, and the next action to take
- **Continuation loop**: When an agent signals `NEEDS_CONTINUATION: true` (or runs out of turns), the orchestrator reads the checkpoint and re-dispatches a fresh agent with that context
- **Transparent**: Agents receive a `Checkpoint Protocol` block in their prompt that tells them how to participate
- **Bounded**: Each subtask gets up to `maxContinuations` re-dispatches (default 5), preventing infinite loops
- **Opt-out**: Set `contextManagement.enabled: false` in config to restore stateless behavior

### How Agents Participate

Agents don't need special code. When context management is active, the orchestrator injects a `Checkpoint Protocol` section into the agent's prompt at dispatch time. This tells the agent to:

1. Track turn count
2. Write checkpoints every N turns to a specific file path
3. Use the structured checkpoint format (completed work, remaining work, decisions, next action)
4. Signal `NEEDS_CONTINUATION: true/false` in their final response

The agent template (`templates/new-agent.md`) includes a `Context Management` section so agents understand this pattern.

## Key Files

| File | Purpose |
|------|---------|
| `.claude/skills/orchestrator/SKILL.md` | Autonomous planner/executor with continuation loop |
| `.claude/skills/create-agent/SKILL.md` | Manual agent creation |
| `templates/new-agent.md` | Agent template (includes context management section) |
| `templates/orchestrator.config.json` | Config template (includes contextManagement settings) |
| `templates/checkpoint.md` | Checkpoint file format reference |
