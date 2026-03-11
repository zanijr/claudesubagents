# Continuation Loop

How to dispatch subtasks with context management and handle continuations.

## How the Orchestrator Implements This

The orchestrator (you) must implement this loop directly — there is no external runtime doing it for you. After each Agent tool call returns, you check the result and decide whether to re-dispatch.

## Step-by-Step Dispatch

### First Dispatch

For each subtask, build the initial prompt:

```
{originalTaskDescription}

## Context Management Protocol
You are running with context management enabled.
- Write a checkpoint every {checkpointIntervalTurns} turns to: {checkpointPath}
- Checkpoint format: YAML frontmatter (taskRunId, subtask, status, continuationNumber) + sections for Completed Work, Remaining Work, Current State, Decisions Made, Next Action
- In your FINAL response, include exactly one of:
  NEEDS_CONTINUATION: true
  NEEDS_CONTINUATION: false
- Set to true if you have remaining work. Set to false if the subtask is fully complete.
```

Dispatch via the Agent tool:
```
Agent(subagent_type=agentName, prompt=prompt, description="subtask summary")
```

### After Agent Returns — Check for Continuation

Parse the agent's result text. Look for the literal string `NEEDS_CONTINUATION: true` or `NEEDS_CONTINUATION: false`.

**If `NEEDS_CONTINUATION: false`** (or no signal and no checkpoint with `status: in_progress`):
- Subtask is done
- Delete the checkpoint file if it exists
- Proceed to the verify-and-reroute gate (Phase 5)

**If `NEEDS_CONTINUATION: true`**:
- Read the checkpoint file at `{checkpointDir}/{taskRunId}-{subtaskNumber}.md`
- Increment continuationCount
- If continuationCount >= maxContinuations (default 5): treat as partial completion, proceed
- Otherwise: re-dispatch with continuation prompt:

```
You are continuation {continuationCount + 1} of {maxContinuations} for this subtask.

## Original Task
{originalTaskDescription}

## Checkpoint From Previous Run
{paste checkpoint file contents here}

## Instructions
1. Read the checkpoint above carefully.
2. Verify that Completed Work still holds (files exist, tests pass, etc.).
3. Resume from the Next Action section.
4. Preserve all Decisions Made — do not revisit settled questions.
5. Continue writing checkpoints every {checkpointIntervalTurns} turns.
6. Write your checkpoint to: {checkpointPath}
7. Signal NEEDS_CONTINUATION: true/false in your final response.
```

**If no signal and checkpoint exists with `status: in_progress`**:
- Treat as `NEEDS_CONTINUATION: true` — the agent likely ran out of context without signaling

### Continuation Re-Dispatch

Use the Agent tool exactly as before:
```
Agent(subagent_type=agentName, prompt=continuationPrompt, description="subtask summary (cont. N)")
```

Then check the result again. This is a loop — keep going until `NEEDS_CONTINUATION: false`, max continuations reached, or the agent errors out.

## Parallel Dispatch with Continuations

For independent subtasks dispatched in parallel:
- Each subtask has its own continuation counter
- After all parallel agents return, check each result independently
- Any that need continuation get re-dispatched (can be parallel again if still independent)
- Subtasks that are done proceed to their verify-and-reroute gate immediately

## Failure Handling Within Loop

- If an agent errors out mid-loop → check for a checkpoint file
- If checkpoint exists with `status: in_progress` → try continuing with same or different agent, passing checkpoint context
- If no checkpoint → enter self-healing (Phase 4) with the error
- Include context about what the previous agent attempted
