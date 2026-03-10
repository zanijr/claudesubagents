# Self-Healing Protocol

When a subtask fails, the orchestrator follows a structured recovery process instead of blind retries.

## Error Analysis Framework

### Step 1: Capture

Record the failure immediately:
```markdown
## Failure Record
- **Subtask**: {subtask description}
- **Agent**: {agent name}
- **Error**: {exact error message}
- **Attempted**: {what the agent tried}
- **Environment**: {relevant state — files modified, partial output, etc.}
- **Timestamp**: {ISO-8601}
```

Append this to `.claude/memory/failure-log.md`.

### Step 2: Classify

Categorize the root cause:

| Category | Signals | Recovery Strategy |
|----------|---------|-------------------|
| **Code bug** | Syntax error, type error, logic error in generated code | Fix the code directly, retry same agent |
| **Missing dependency** | Module not found, command not found, import error | Install dependency, retry same agent |
| **Wrong approach** | Agent took fundamentally wrong direction | Try different agent or rewrite subtask |
| **Environment issue** | Permission denied, disk full, network error | Fix environment, retry same agent |
| **Insufficient context** | Agent didn't understand the task | Rewrite subtask with more detail and examples |
| **Complexity overflow** | Agent ran out of context or produced partial work | Break subtask into smaller pieces |
| **Known issue** | Matches a pattern in lessons-learned.md | Apply the documented fix directly |

### Step 3: Adapt

Based on classification, choose a recovery strategy:

#### Strategy A: Fix and Retry (same agent)
For code bugs, missing dependencies, environment issues:
1. Apply the fix (install package, change permissions, fix syntax)
2. Re-dispatch the same agent with the original prompt + fix context
3. Include: "Previous attempt failed with: {error}. The fix applied: {fix}. Continue from where the previous attempt left off."

#### Strategy B: Different Agent
For wrong approach, when a better-suited agent exists:
1. Find an agent with different capabilities that match the subtask
2. Include in prompt: "A previous agent attempted this and failed: {summary}. Take a different approach."
3. If no suitable agent exists, auto-create one tailored to the failure's root cause

#### Strategy C: Decompose
For complexity overflow or tasks too large:
1. Break the failed subtask into 2-3 smaller subtasks
2. Each smaller subtask gets its own agent assignment
3. Add dependencies between the new subtasks as needed
4. Dispatch the smaller subtasks

#### Strategy D: Apply Known Fix
When lessons-learned.md contains a matching pattern:
1. Extract the fix from lessons learned
2. Inject it into the agent prompt: "From past experience: {lesson}. Apply this approach."
3. Re-dispatch

### Step 4: Retry Bounds

- Maximum `maxRetries` attempts per subtask (default: 2, configurable)
- Each retry uses a different strategy (don't repeat the same failed approach)
- Track retry count in the failure log
- After exhausting retries, mark subtask as **failed** and continue with others

### Step 5: Record Outcome

Whether the retry succeeds or fails, record:

**On success after failure:**
```markdown
## Resolved: {subtask}
- **Original error**: {error}
- **Root cause**: {classification}
- **Fix**: {what worked}
- **Lesson**: {actionable advice for next time}
```
→ Append to `.claude/memory/lessons-learned.md`

**On permanent failure:**
```markdown
## Unresolved: {subtask}
- **Attempts**: {count}
- **Strategies tried**: {list}
- **Best partial result**: {what was accomplished}
- **Remaining work**: {what still needs doing}
- **Suggested approach**: {what to try next, manually or in future run}
```
→ Append to both `lessons-learned.md` and `failure-log.md`

## Failure Pattern Detection

When multiple subtasks fail with similar patterns, escalate:

1. **Same error across agents** → Likely an environment or project-level issue. Fix the root cause before retrying any subtasks.
2. **Same agent fails repeatedly** → Agent instructions may be flawed. Consider recreating the agent with better instructions.
3. **Cascading failures** → A dependency subtask failed, causing downstream failures. Fix the dependency first, then retry dependents.

## Integration with Verification (Phase 5)

Verification failures feed back into self-healing:

1. A subtask reports success
2. Verification runs (tests, build, linter)
3. Verification fails → treat as a new failure
4. Enter self-healing with category: "code bug" or "integration issue"
5. Re-dispatch the same agent with verification error context
6. Re-verify after fix

This creates a **build-test-fix loop** that continues until verification passes or retries are exhausted.
