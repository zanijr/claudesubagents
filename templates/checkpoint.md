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

{Cumulative list of everything completed so far. Overwrite this section each checkpoint — it should always reflect the full picture, not just incremental progress.}

- [ ] Step that was completed
- [ ] Another completed step

## Remaining Work

{What still needs to be done. Overwrite each checkpoint to reflect current remaining scope.}

- [ ] Next step to do
- [ ] Another remaining step

## Current State

{Snapshot of the environment/codebase relevant to resuming work. Include file paths modified, services running, test results, etc.}

- Files modified: `path/to/file.ts`
- Tests passing: yes/no
- Build status: clean/broken
- Key variables or state: ...

## Decisions Made

{Append-only across continuations. Each decision should include rationale so future continuations don't revisit settled questions.}

1. **Decision**: {what was decided} — **Rationale**: {why}

## Next Action

{Single, concrete next step for a continuation agent to pick up. Be specific enough that the agent can start immediately without re-analyzing.}

Do X in file Y because Z.
