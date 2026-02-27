# Agent Orchestrator

A lightweight framework for routing tasks to specialized AI agents in [Claude Code](https://claude.ai/claude-code). Agents are simple `.md` files with YAML frontmatter - no runtime, no server, no dependencies.

## How It Works

Claude Code has a built-in **Task tool** that can dispatch work to specialized subagents. This framework provides:

1. **A routing skill** that reads your agent definitions and dispatches to the best match
2. **An agent creation skill** that walks you through building new agents
3. **A standard format** for defining agent capabilities, triggers, and instructions

```
User: "Check if my Docker containers are healthy"
                    ↓
        Orchestrator skill activates
                    ↓
    Reads .claude/agents/project/*.md
    Matches triggers: "docker", "containers"
                    ↓
    Dispatches via Task tool to
    "Infrastructure Monitor Agent"
                    ↓
    Agent runs, returns real results
```

## Installation

```bash
# Clone into your Claude Code config
git clone https://github.com/zanijr/claudesubagents.git ~/.claude/orchestrator

# Create skill symlinks
ln -s ~/.claude/orchestrator/.claude/skills/orchestrator ~/.claude/skills/orchestrator
ln -s ~/.claude/orchestrator/.claude/skills/create-agent ~/.claude/skills/create-agent

# Create the agent directory in your project
mkdir -p .claude/agents/project

# Copy the config template (optional)
cp ~/.claude/orchestrator/templates/orchestrator.config.json ./orchestrator.config.json

# Copy the agent template (optional)
cp ~/.claude/orchestrator/templates/new-agent.md .claude/agents/project/_template.md
```

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

`orchestrator.config.json` (optional):

```json
{
    "version": "2.0.0",
    "agentPaths": [".claude/agents/project"],
    "maxRetries": 2,
    "defaultModel": "sonnet"
}
```

## Task Routing

When a task is submitted:

1. All agent `.md` files are read and their frontmatter parsed
2. Each agent is scored against the task by matching triggers and capabilities
3. The best match is dispatched via the **Task tool**
4. If the agent fails, the next best match is tried (up to `maxRetries`)
5. If all agents fail, the user is asked for direction

## License

MIT
