# Agent Orchestrator Framework

This is the multi-agent orchestration framework for coordinating AI agents.

## How Skills Work

**Skills are automatically triggered** based on what you say - you don't need to type slash commands. Just describe what you want:

| Say this... | Skill activates |
|------------|-----------------|
| "List available agents" | orchestrator |
| "Route this task to an agent" | orchestrator |
| "Create a new agent for X" | create-agent |
| "What agents can handle security?" | orchestrator |

## Available Skills

### orchestrator
Routes tasks to agents, lists available agents, checks status, shows escalations.

**Trigger phrases:**
- "What agents are available?"
- "Route this to an agent"
- "Check task status"
- "Show orchestrator stats"

### create-agent
Creates new agents with proper configuration.

**Trigger phrases:**
- "Create an agent for X"
- "Make a new agent"
- "I need an agent to handle X"

## Available Agents

The orchestrator routes tasks to these agents based on capabilities:

| Agent | Capabilities | Triggers |
|-------|-------------|----------|
| code-analyzer | code-review, static-analysis | analyze, review, quality |
| task-validator | validation, completion-check | validate, verify, done |
| security-scanner | security, vulnerability-scan | security, audit, scan |

## Project-Specific Agents

Add custom agents in `.claude/agents/project/`:

1. Create a new `.md` file using the template from `.claude/orchestrator/templates/new-agent.md`
2. Define capabilities and triggers in the frontmatter
3. Agent auto-registers on next orchestrator run

## Configuration

See `orchestrator.config.json` for:
- Enabled/disabled agents
- Retry settings (default: 3 retries, then escalate)
- Success threshold (default: 95%)

## Key Files

| File | Purpose |
|------|---------|
| `core/Orchestrator.js` | Main coordinator |
| `core/BaseAgent.js` | Agent contract |
| `core/RetryManager.js` | Retry + escalation logic |
| `templates/new-agent.md` | Agent template |
