# Agent Orchestrator Framework

Autonomous planner, builder, and learner. Takes a goal, breaks it into subtasks, creates agents, dispatches work, self-heals on failure, and remembers what it learned — all via the **Agent tool** without user intervention.

## How It Works

1. User describes an idea (e.g., `/orchestrator set up monitoring for my Docker stack`)
2. Orchestrator checks **lessons learned** from past runs for relevant knowledge
3. Plans: decomposes goal into subtasks with **success criteria**
4. Matches subtasks to agents from `.claude/agents/project/*.md`, auto-creates missing ones
5. Dispatches all subtasks via **Agent tool** (parallel when independent)
6. **Self-heals**: when subtasks fail, analyzes the error, adapts strategy, retries
7. **Verifies**: runs success criteria checks after subtasks complete
8. **Learns**: writes lessons to `.claude/memory/lessons-learned.md` for future runs
9. Reports: what succeeded, what failed, what was learned

## Skills (2.0)

Both skills use Skills 2.0 format with YAML frontmatter, dynamic context injection (`!`command``), progressive disclosure via `references/`, lifecycle hooks, and argument support.

### orchestrator
Autonomous planner/executor with self-healing and learning.

**Trigger:** `/orchestrator`, "orchestrate a task", "plan and execute this", "build this for me", "list agents"

**Features:**
- Dynamic context injection: live agent list, config, lessons learned, recent failures
- Self-healing: error analysis → adapt strategy → retry (not blind retries)
- Persistent memory: lessons learned survive across sessions
- Lifecycle hooks: `PostToolUseFailure` captures failures, `Stop` prunes memory
- Progressive disclosure: heavy content in `references/`
- Argument support: `/orchestrator [goal]`

### create-agent
Interactive agent creation with guided questions.

**Trigger:** `/create-agent`, "create an agent for X", "make a new agent"

**Features:**
- Dynamic context injection for existing agent list
- Argument support: `/create-agent [agent purpose]`
- Agent template in `references/agent-template.md`

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

The `name` field must match the Agent tool's `subagent_type`. The body contains agent instructions.

## Memory System

The orchestrator maintains persistent knowledge in `.claude/memory/`:

| File | Purpose | Injected At |
|------|---------|-------------|
| `lessons-learned.md` | What worked, what failed, actionable advice | Start of every run |
| `failure-log.md` | Raw failure records for pattern detection | Start of every run |

Memory is injected via `!`cat .claude/memory/lessons-learned.md`` — the orchestrator sees past knowledge before it starts planning.

## Self-Healing

When a subtask fails, the orchestrator:
1. **Captures** the error and environment state
2. **Classifies** root cause (code bug, wrong approach, missing dep, etc.)
3. **Adapts** strategy (fix and retry, try different agent, decompose, apply known fix)
4. **Retries** with the adapted approach
5. **Records** what worked for future reference

Never stops at first failure. Analyzes, adapts, learns.

## Context Management

When `contextManagement.enabled` is `true` in config:

- **Checkpoints**: Agents write structured progress at regular intervals
- **Continuation loop**: Agents get re-dispatched with checkpoint context when they run out of turns
- **Bounded**: Up to `maxContinuations` re-dispatches per subtask (default 5)
- **Opt-out**: Set `contextManagement.enabled: false` in config

## Key Files

| File | Purpose |
|------|---------|
| `.claude/skills/orchestrator/SKILL.md` | Autonomous planner/executor (Skills 2.0) |
| `.claude/skills/orchestrator/references/` | Self-healing, memory, checkpoint, continuation protocols |
| `.claude/skills/orchestrator/scripts/` | Lifecycle hooks (capture-failure, save-lessons) |
| `.claude/skills/create-agent/SKILL.md` | Interactive agent creation (Skills 2.0) |
| `.claude/skills/create-agent/references/` | Agent file template |
| `.claude/memory/` | Persistent lessons learned and failure log |
| `templates/orchestrator.config.json` | Config template |
| `templates/new-agent.md` | Agent template |
