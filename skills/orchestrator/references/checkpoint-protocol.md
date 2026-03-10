# Checkpoint Protocol

This block is injected into each agent's prompt when context management is enabled.

## Protocol Block

```
## Checkpoint Protocol

You are operating under context management. Follow these rules:

1. Track your turn count (each response = 1 turn).
2. Every {checkpointIntervalTurns} turns, write a checkpoint file to:
   `{checkpointDir}/{taskRunId}-{subtaskNumber}.md`
3. Use this format for the checkpoint file:
   - YAML frontmatter: task_run_id, subtask, agent, continuation, turn_count, status (in_progress/complete), timestamp
   - Sections: ## Completed Work, ## Remaining Work, ## Current State, ## Decisions Made, ## Next Action
4. Completed Work and Remaining Work: overwrite each checkpoint (cumulative snapshot).
5. Decisions Made: append-only (preserve across checkpoints).
6. Next Action: single concrete step a continuation agent can pick up immediately.
7. In your FINAL response, include exactly one of these signals on its own line:
   NEEDS_CONTINUATION: true
   NEEDS_CONTINUATION: false
```

## Checkpoint File Format

```markdown
---
task_run_id: "{taskRunId}"
subtask: "{subtaskNumber}"
agent: "{agentName}"
continuation: 1
turn_count: 0
status: "in_progress"
timestamp: "{ISO-8601}"
---

# Checkpoint: {subtask description}

## Completed Work
{Cumulative list — overwrite each checkpoint.}

## Remaining Work
{What still needs to be done — overwrite each checkpoint.}

## Current State
{Environment snapshot: files modified, test results, build status.}

## Decisions Made
{Append-only across continuations. Include rationale.}

1. **Decision**: {what} — **Rationale**: {why}

## Next Action
{Single concrete step for continuation agent to pick up immediately.}
```

## Config Defaults

| Setting | Default | Description |
|---------|---------|-------------|
| `checkpointDir` | `.claude/context/checkpoints` | Where checkpoint files are written |
| `maxContinuations` | `5` | Max re-dispatches per subtask |
| `checkpointIntervalTurns` | `20` | How often agents checkpoint |
| `maxTurns` | `80` | Turn limit per dispatch (~60% context proxy) |
