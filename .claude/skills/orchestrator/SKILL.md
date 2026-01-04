---
name: orchestrator
description: Route tasks to specialized AI agents, list available agents, check task status, view escalations, and manage the multi-agent orchestration framework. Use when routing work to agents, checking agent availability, or managing task execution.
---

# Agent Orchestrator

Use this skill to interact with the multi-agent orchestration framework. This skill provides commands for routing tasks, checking status, and managing agents.

## When This Skill Activates

This skill should be used when the user:
- Wants to route a task to an agent
- Asks "what agents are available?"
- Wants to check task status
- Asks about escalations or failed tasks
- Wants to see orchestrator statistics

## Commands

When the user asks to use the orchestrator, determine which command they want:

### Route a Task

When user says things like "route this to an agent", "have an agent do this", "assign this task":

1. Analyze the task description to identify required capabilities
2. Read `.claude/orchestrator/agents/*/manifest.json` to find available agents
3. Score agents based on capability match
4. Report which agent will handle it

**Example response:**
```
Task routed to security-scanner agent
- Capabilities matched: security, vulnerability-scan
- Match score: 85
- Status: Running
```

### List Agents

When user says "list agents", "what agents are available", "show agents":

1. Read all manifest.json files in `.claude/orchestrator/agents/`
2. Display each agent's name, capabilities, and triggers

**Example response:**
```
Available Agents (3):

1. code-analyzer
   Capabilities: code-review, static-analysis, metrics
   Triggers: analyze, review, quality

2. security-scanner
   Capabilities: security, vulnerability-scan, secrets-detection
   Triggers: security, audit, scan

3. task-validator
   Capabilities: validation, completion-check
   Triggers: validate, verify, done
```

### Check Status

When user says "check status", "task status", "what's running":

Report on any active orchestrated tasks.

### Show Escalations

When user says "show escalations", "what failed", "pending issues":

Check for any tasks that failed after retries and need user decisions.

### Show Stats

When user says "orchestrator stats", "show statistics":

Display orchestrator statistics including task counts and success rates.

## Task Routing Logic

When routing a task:

1. **Analyze the task** to extract:
   - Task type (from explicit type or inferred from description)
   - Required capabilities
   - Keywords that match agent triggers

2. **Score each agent** based on:
   - Capability matches (30 points each)
   - Trigger keyword matches (15 points each)

3. **Select the best agent**:
   - Highest score wins
   - Must meet minimum score threshold (10)

## Configuration

Settings are in `orchestrator.config.json`:
- `agents.enabled` - List of enabled agents
- `retry.maxRetries` - Max retry attempts (default: 3)
- `successThreshold` - Required success rate (default: 0.95)

## Creating New Agents

To create a new agent, ask me to "create an agent" and I'll guide you through:
1. Defining capabilities and triggers
2. Writing agent instructions
3. Proper file placement
4. Validation
