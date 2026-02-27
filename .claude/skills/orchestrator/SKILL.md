---
name: orchestrator
description: Route tasks to specialized AI agents, list available agents, and manage the multi-agent orchestration framework. Use when routing work to agents, checking agent availability, or managing task execution.
---

# Agent Orchestrator

Route tasks to specialized agents via the **Task tool**. Agents are defined as `.md` files in `.claude/agents/project/` with YAML frontmatter.

## When This Skill Activates

- User wants to route a task to an agent
- User asks "what agents are available?"
- User asks "what agents can handle X?"
- User says "route this to an agent" or "have an agent do this"

## Commands

### List Agents

When user says "list agents", "what agents are available", "show agents":

1. Read all `.md` files in `.claude/agents/project/` (skip `_template.md`)
2. Parse the YAML frontmatter from each file to extract: `name`, `capabilities`, `triggers`, `description`, `model`
3. Display each agent in a table:

```
Available Agents:

| Agent | Capabilities | Triggers | Model |
|-------|-------------|----------|-------|
| Infrastructure Monitor Agent | docker-monitoring, systemd-monitoring, ... | monitor, docker, containers, ... | sonnet |
| Android Development Agent | android-ui, kotlin, ... | android, kotlin, ... | sonnet |
```

### Route a Task

When user says "route this to an agent", "have an agent do this", "assign this task", or describes a task that matches an agent's capabilities:

**Step 1: Discover agents**

Read all `.md` files from `.claude/agents/project/` (skip `_template.md`). Parse the YAML frontmatter between the `---` delimiters to extract:
- `name` - The agent's display name (also its `subagent_type` for the Task tool)
- `capabilities` - List of things the agent can do
- `triggers` - Keywords that indicate this agent should handle a task
- `description` - What the agent does
- `model` - Which model to use (sonnet, opus, haiku)

**Step 2: Match task to agents**

Score each agent against the task:
- Check if any trigger words appear in the task description (strong signal)
- Check if the task requirements overlap with agent capabilities (strong signal)
- Consider the agent's description for semantic relevance (weaker signal)
- Rank all agents by match quality

Selection rules:
- Prefer agents with more specific trigger/capability matches over general ones
- If no agent scores well, tell the user no suitable agent exists and suggest creating one with the `create-agent` skill
- If multiple agents score similarly, tell the user which ones matched and let them choose

**Step 3: Dispatch via Task tool**

Call the **Task tool** with these parameters:
- `subagent_type`: Set to the agent's `name` field from frontmatter (e.g., "Infrastructure Monitor Agent")
- `prompt`: A clear description of the task including all relevant context from the user's request
- `description`: A short 3-5 word summary of the task
- `model`: Use the agent's `model` field from frontmatter, or fall back to the `defaultModel` from `orchestrator.config.json`

Tell the user which agent was selected and why before dispatching.

**Step 4: Handle failure**

If the Task tool agent fails or returns an unsatisfactory result:
1. Try the next best matching agent (if one exists) - up to 2 retries with different agents
2. Each retry should include context about what the previous agent attempted

**Step 5: Escalate**

If all matching agents fail (or no agents match at all):
1. Report what was tried and what failed
2. Ask the user for direction: retry, modify the task, or cancel
3. Suggest creating a specialized agent if the gap is clear

### Find Agents by Capability

When user says "what agents can handle X?" or "do I have an agent for X?":

1. Read all agent `.md` files from `.claude/agents/project/`
2. Check each agent's capabilities and triggers against the query
3. Report matching agents, or suggest creating one if none match

## Configuration

Read `orchestrator.config.json` for:
- `agentPaths` - Where to find agent `.md` files
- `maxRetries` - How many different agents to try on failure (default: 2)
- `defaultModel` - Model to use when agent doesn't specify one (default: sonnet)

## Important Notes

- Always use the **Task tool** for actual dispatch - this is what makes agents execute real work
- The `subagent_type` parameter in the Task tool must match the agent's `name` field exactly
- Agent `.md` files are the source of truth - the frontmatter defines routing, the body defines behavior
- Do NOT read JS files, manifest.json, or any other legacy format - only `.md` agent files
