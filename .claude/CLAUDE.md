# Agent Orchestrator Framework

This is the multi-agent orchestration framework for coordinating AI agents.

## Skills Available

### /create-agent [name]
Creates a new agent with proper configuration. Guides you through:
- Setting capabilities and triggers
- Choosing agent type (markdown or JavaScript)
- Writing instructions
- Validating the configuration

### /orchestrator:route [task]
Routes a task to the best available agent based on capabilities.

### /orchestrator:list
Lists all registered agents and their status.

### /orchestrator:status
Shows active tasks and their progress.

### /orchestrator:escalations
Shows pending escalations requiring user decisions.

## Architecture

```
Orchestrator (central coordinator)
     │
     ├── AgentRegistry (discovers and tracks agents)
     ├── TaskDispatcher (routes tasks to agents)
     └── RetryManager (handles failures and escalation)
           │
           └── Dashboard (web UI for monitoring)
```

## Adding This to a Project

```bash
# As submodule
git submodule add git@github.com:zanijr/claudesubagents.git .claude/orchestrator

# Initialize
node .claude/orchestrator/scripts/init-project.js
```

## Creating Agents

Use `/create-agent` to ensure proper configuration, or manually create:

**Markdown agent** (`.claude/agents/project/my-agent.md`):
```markdown
---
id: my-agent
capabilities: [cap1, cap2]
triggers: [keyword1]
---
Instructions here...
```

**JavaScript agent** (`agents/my-agent/`):
- `manifest.json` - capabilities and metadata
- `agent.js` - extends BaseAgent

## Key Files

| File | Purpose |
|------|---------|
| `core/Orchestrator.js` | Main coordinator |
| `core/BaseAgent.js` | Agent contract |
| `core/RetryManager.js` | Retry + escalation logic |
| `templates/new-agent.md` | Agent template |
