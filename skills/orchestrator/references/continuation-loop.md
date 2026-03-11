# Continuation Loop

Full dispatch pseudocode for context-managed subtask execution.

## Pseudocode

```
For each subtask (subtaskNumber):
  continuationCount = 0
  checkpointPath = "{checkpointDir}/{taskRunId}-{subtaskNumber}.md"

  LOOP:
    # Build the prompt
    if continuationCount == 0:
      prompt = originalTaskDescription + "\n\n" + checkpointProtocolBlock
    else:
      # Read the checkpoint file
      checkpointContent = read(checkpointPath)
      prompt = """
You are continuation {continuationCount + 1} of {maxContinuations} for this subtask.

## Original Task
{originalTaskDescription}

## Checkpoint From Previous Run
{checkpointContent}

## Instructions
1. Read the checkpoint above carefully.
2. Verify that Completed Work still holds (files exist, tests pass, etc.).
3. Resume from the Next Action section.
4. Preserve all Decisions Made — do not revisit settled questions.
5. Continue writing checkpoints every {checkpointIntervalTurns} turns.
6. Write your checkpoint to: {checkpointPath}
7. Signal NEEDS_CONTINUATION: true/false in your final response.
"""

    # Dispatch via Agent tool
    result = Agent(
      subagent_type = agentName,
      prompt = prompt,
      description = shortSummary + (continuationCount > 0 ? " (cont. {continuationCount+1})" : "")
    )

    # Check result for continuation signal
    if result contains "NEEDS_CONTINUATION: false":
      # Done — clean up checkpoint
      delete(checkpointPath) if exists
      BREAK

    elif result contains "NEEDS_CONTINUATION: true":
      continuationCount += 1
      if continuationCount >= maxContinuations:
        # Exhausted — treat as partial completion
        BREAK
      else:
        CONTINUE LOOP

    else:
      # No signal — fallback: check if checkpoint exists with status: in_progress
      if checkpointPath exists AND frontmatter has status: "in_progress":
        continuationCount += 1
        if continuationCount >= maxContinuations:
          BREAK
        else:
          CONTINUE LOOP
      else:
        # Assume complete
        delete(checkpointPath) if exists
        BREAK
```

## Parallel Dispatch

Dispatch independent subtasks in parallel using multiple Agent tool calls in a single message. Each parallel subtask gets its own continuation loop. Only sequence subtasks that have explicit dependencies.

## Failure Handling Within Loop

- If an agent errors out mid-loop, check for a checkpoint file
- If checkpoint exists with `status: in_progress`, try continuing with same or different agent
- If no checkpoint, retry with next best matching agent (up to `maxRetries`)
- Include context about what the previous agent attempted
