---
name: orchestrator
version: 2.0.0
description: This skill should be used when the user asks to "orchestrate a task", "plan and execute this", "have agents do this", "break this into subtasks", "list agents", or needs autonomous multi-agent task decomposition and dispatch.
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, TodoWrite
argument-hint: [goal or "list agents"]
---

# Agent Orchestrator

Autonomous planner and executor. Take the user's goal, decompose it into subtasks, ensure agents exist for each, and dispatch all work via the **Task tool** — without stopping for permission at each step.

## Live Context

Available agents: !`ls .claude/agents/project/*.md 2>/dev/null | xargs -I{} basename {} .md || echo "No agents found"`
Configuration: !`cat orchestrator.config.json 2>/dev/null || echo "No config found — using defaults"`

## Core Workflow

### Phase 1: Plan

Decompose the goal into concrete subtasks. For each subtask, identify:
- What needs to be done (clear, actionable description)
- Required capabilities and keywords

Output the plan as a numbered list. Do NOT ask for approval — show the plan and proceed.

### Phase 2: Match Agents

1. Read all `.md` files from `.claude/agents/project/` (skip `_template.md`)
2. Parse YAML frontmatter: `name`, `capabilities`, `triggers`, `description`, `model`
3. Score every agent per subtask:
   - Trigger keyword matches (strong signal)
   - Capability overlap (strong signal)
   - Description semantic relevance (weaker signal)
4. Assign the best-matching agent to each subtask

### Phase 3: Create Missing Agents

For any subtask with no good match, auto-create the agent immediately. Write a new `.md` file to `.claude/agents/project/` with proper frontmatter (`id`, `name`, `version`, `description`, `capabilities`, `triggers`, `model`) and actionable body instructions. Include relevant project context (file paths, tech stack). Tell the user and move on.

### Phase 3.5: Prepare Dispatch Context

Read `orchestrator.config.json` and check `contextManagement`.

If `contextManagement.enabled` is `true` (default):
1. Generate a `taskRunId` (e.g., `run-20260310-143022`)
2. Read config values with defaults: `checkpointDir` (`.claude/context/checkpoints`), `maxContinuations` (`5`), `checkpointIntervalTurns` (`20`), `maxTurns` (`80`)
3. Create checkpoint directory: `mkdir -p {checkpointDir}`
4. Clean up stale checkpoints from previous runs
5. Prepare the Checkpoint Protocol block for agent prompt injection

If disabled, skip this phase entirely.

See [references/checkpoint-protocol.md](references/checkpoint-protocol.md) for the full Checkpoint Protocol block and continuation loop pseudocode.

### Phase 4: Dispatch

Dispatch each subtask via the **Task tool**.

- `subagent_type`: Agent's `name` field from frontmatter
- `prompt`: Detailed task description with all relevant context
- `description`: Short 3-5 word summary
- `model`: From agent frontmatter or `defaultModel` from config

**With context management enabled**, wrap each dispatch in a continuation loop. On first dispatch, append the Checkpoint Protocol block to the prompt. On continuations, read the checkpoint file and build a continuation prompt with the checkpoint context.

See [references/continuation-loop.md](references/continuation-loop.md) for full dispatch pseudocode.

**Dispatch independent subtasks in parallel** using multiple Task tool calls in a single message. Only sequence subtasks with dependencies.

### Phase 5: Handle Failures

1. Retry with the next best matching agent (up to `maxRetries`)
2. Include context about what the previous agent tried
3. Report partially complete subtasks from last checkpoint's `Completed Work`
4. Continue with remaining subtasks — do NOT stop everything for one failure

### Phase 6: Report

Summarize after all subtasks complete or fail:
- What was planned
- What succeeded
- What partially completed (with continuation stats)
- What failed and why
- Agents created
- Context management stats (if enabled)
- Suggested next steps

## List Agents Command

When user says "list agents", "what agents are available", or "show agents":

1. Read all `.md` files in `.claude/agents/project/` (skip `_template.md`)
2. Parse frontmatter for: `name`, `capabilities`, `triggers`, `model`
3. Display as a table

## Key Rules

- **Be autonomous.** Plan, create agents, dispatch, and report without asking permission.
- **Be parallel.** Dispatch independent subtasks simultaneously.
- **Be resilient.** One failure doesn't stop everything.
- **Be transparent.** Show the plan upfront and report at the end.
- **Be persistent.** Context management ensures large tasks complete without losing progress.
- Always use the **Task tool** for dispatch.
- The `subagent_type` must match the agent's `name` field exactly.
- Clean up checkpoint files after successful completion.

## Additional Resources

- [references/checkpoint-protocol.md](references/checkpoint-protocol.md) — Full checkpoint protocol block injected into agent prompts
- [references/continuation-loop.md](references/continuation-loop.md) — Continuation loop dispatch pseudocode
- [references/agent-creation-template.md](references/agent-creation-template.md) — Template for auto-created agents
