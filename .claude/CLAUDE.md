# Agent Orchestrator Framework

Autonomous planner and executor that breaks goals into subtasks, creates any missing agents, and dispatches everything via the **Task tool** without user intervention.

## How It Works

1. User describes a goal (e.g., `/orchestrator set up monitoring for my Docker stack`)
2. Orchestrator plans: decomposes goal into subtasks with required capabilities
3. Matches subtasks to existing agents from `.claude/agents/project/*.md`
4. Auto-creates new agents for any unmatched subtasks
5. Dispatches all subtasks via the **Task tool** (parallel when independent)
6. Reports results: what succeeded, what failed, what agents were created

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

## Key Files

| File | Purpose |
|------|---------|
| `.claude/skills/orchestrator/SKILL.md` | Autonomous planner/executor |
| `.claude/skills/create-agent/SKILL.md` | Manual agent creation |
| `templates/new-agent.md` | Agent template |
| `templates/orchestrator.config.json` | Config template |
