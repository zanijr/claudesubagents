# Agent Orchestrator

A lightweight framework for routing tasks to specialized AI agents in [Claude Code](https://claude.ai/claude-code). Agents are simple `.md` files with YAML frontmatter - no runtime, no server, no dependencies.

## How It Works

Claude Code has a built-in **Task tool** that can dispatch work to specialized subagents. This framework provides:

1. **A routing skill** that reads your agent definitions and dispatches to the best match
2. **An agent creation skill** that walks you through building new agents
3. **A standard format** for defining agent capabilities, triggers, and instructions
4. **Automatic context management** that checkpoints agent progress and re-dispatches when context runs low

```
User: "Check if my Docker containers are healthy"
                    |
        Orchestrator skill activates
                    |
    Reads .claude/agents/project/*.md
    Matches triggers: "docker", "containers"
                    |
    Dispatches via Task tool to
    "Infrastructure Monitor Agent"
                    |
    Agent runs, returns real results
```

## Installation

One command — works on Linux, macOS, WSL, and Windows (with Node.js):

```bash
npx agent-orchestrator-cc@latest
```

The installer will ask you:
1. **Runtime** — pick Claude Code
2. **Scope** — Global (all projects) or Local (current project only)

### Project Setup

After installing globally, set up each project:

```bash
cd my-project
npx agent-orchestrator-cc@latest    # choose "Local"
```

This creates the agent directory, checkpoint directory, copies templates, and updates `.gitignore`.

### Updating

From inside Claude Code:

```
/orchestrator:update
```

Or from the terminal:

```bash
npx agent-orchestrator-cc@latest --update
```

### Alternative Install Methods

<details>
<summary>curl one-liner (Linux / macOS / WSL)</summary>

```bash
curl -fsSL https://raw.githubusercontent.com/zanijr/claudesubagents/main/scripts/get.sh | bash
```
</details>

<details>
<summary>Manual install</summary>

```bash
git clone https://github.com/zanijr/claudesubagents.git ~/.claude/orchestrator
bash ~/.claude/orchestrator/scripts/marketplace.sh install
```
</details>

## Usage

Skills activate automatically based on what you say:

| Say this... | What happens |
|------------|--------------|
| "List available agents" | Shows all agents from `.claude/agents/project/` |
| "Route this task to an agent" | Matches and dispatches via Task tool |
| "Create a new agent for X" | Walks through agent creation |
| "What agents can handle security?" | Finds matching agents |

## Defining Agents

Create a `.md` file in `.claude/agents/project/`:

```markdown
---
id: database-manager
name: Database Management Agent
version: 1.0.0
description: |
  Manages database migrations, queries, and schema design.
  Use for any SQL, PostgreSQL, or database optimization tasks.
capabilities:
  - sql-queries
  - schema-design
  - migrations
  - query-optimization
triggers:
  - database
  - sql
  - migration
  - schema
  - query
model: sonnet
---

# Database Management Agent

You are an expert database administrator...

## Task Execution

1. Analyze the database requirement
2. Write and validate SQL
3. Test the migration path
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Lowercase hyphenated identifier |
| `name` | Yes | Display name - must match Task tool `subagent_type` |
| `description` | Yes | When to use this agent (used for routing) |
| `capabilities` | Yes | What the agent can do (used for routing) |
| `triggers` | No | Keywords that route to this agent |
| `model` | No | `sonnet` (default), `opus`, or `haiku` |
| `version` | No | Version tracking |

## Configuration

`orchestrator.config.json`:

```json
{
    "version": "3.0.0",
    "agentPaths": [".claude/agents/project"],
    "maxRetries": 2,
    "defaultModel": "sonnet",
    "contextManagement": {
        "enabled": true,
        "checkpointDir": ".claude/context/checkpoints",
        "maxContinuations": 5,
        "checkpointIntervalTurns": 20,
        "maxTurns": 80
    }
}
```

## Context Management

Large tasks can exhaust an agent's context window, causing it to lose all progress. The orchestrator solves this automatically:

1. **Checkpoint Protocol** — The orchestrator injects instructions into each agent's prompt telling it to write structured checkpoint files at regular intervals
2. **Continuation Loop** — When an agent signals `NEEDS_CONTINUATION: true` or runs out of turns, the orchestrator reads the checkpoint and dispatches a fresh agent that picks up where the last one left off
3. **Bounded** — Each subtask gets up to `maxContinuations` re-dispatches (default: 5), so a single subtask can use up to 5 × 80 = 400 turns total
4. **Clean** — Checkpoint files are ephemeral runtime state, cleaned up after successful completion

### Config Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Set `false` to disable context management entirely |
| `checkpointDir` | `.claude/context/checkpoints` | Where checkpoint files are written |
| `maxContinuations` | `5` | Max re-dispatches per subtask |
| `checkpointIntervalTurns` | `20` | How often agents write checkpoints (in turns) |
| `maxTurns` | `80` | Turn limit per dispatch (~60% context proxy) |

### Disabling Context Management

To restore the original stateless behavior, set `enabled` to `false`:

```json
{
    "contextManagement": {
        "enabled": false
    }
}
```

Or remove the `contextManagement` section entirely — the orchestrator will skip context management if the section is missing.

### How It Works Under the Hood

1. At dispatch time, the orchestrator generates a unique `taskRunId` and prepares a `Checkpoint Protocol` block
2. The protocol block is appended to each agent's prompt, telling it to track turns, write checkpoints, and signal completion status
3. Agents write checkpoints to `{checkpointDir}/{taskRunId}-{subtaskNumber}.md` using a structured format (completed work, remaining work, current state, decisions made, next action)
4. After each dispatch, the orchestrator checks the agent's return for `NEEDS_CONTINUATION: true/false`
5. If continuation is needed, the orchestrator reads the checkpoint, builds a continuation prompt with the original task + checkpoint context, and re-dispatches
6. This loops until the agent signals completion or `maxContinuations` is exhausted

### Checkpoint Format

See `templates/checkpoint.md` for the full format. Key sections:

- **Completed Work** — Cumulative snapshot, overwritten each checkpoint
- **Remaining Work** — What's left, overwritten each checkpoint
- **Current State** — Environment snapshot (files modified, test status, etc.)
- **Decisions Made** — Append-only across continuations with rationale
- **Next Action** — Single concrete step for the continuation agent

## Task Routing

When a task is submitted:

1. All agent `.md` files are read and their frontmatter parsed
2. Each agent is scored against the task by matching triggers and capabilities
3. The best match is dispatched via the **Task tool**
4. If context management is enabled, the dispatch is wrapped in a continuation loop
5. If the agent fails, the next best match is tried (up to `maxRetries`)
6. If all agents fail, the user is asked for direction

## License

MIT
