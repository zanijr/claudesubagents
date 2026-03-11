# Verify-and-Reroute Protocol

Every subtask that produces code goes through an automatic quality gate before being marked complete. This creates a closed loop: **agent delivers → reviewer checks → agent fixes → reviewer re-checks** until the work passes or retries are exhausted.

## When It Fires

The verify-and-reroute gate fires **per subtask**, immediately after the agent reports completion — not at the end of all subtasks. This catches issues early, before downstream subtasks build on broken work.

```
Agent completes subtask
  → Run success criteria (tests, build, linter)
  → Dispatch Code Reviewer on that subtask's files
  → PASS? → Mark subtask complete, proceed
  → FAIL? → Route back to original agent with review feedback
         → Agent fixes
         → Re-verify (success criteria + re-review)
         → Loop until PASS or maxRetries exhausted
```

## Skip Conditions

Skip the review gate for subtasks that:
- Produce only documentation (`.md`, `.txt`, `.rst`)
- Produce only configuration (`.json`, `.yaml`, `.toml`, `.env`)
- Are research/exploration tasks with no file output

## Gate Steps

### Step 1: Run Success Criteria

Execute the success criteria defined in Phase 1 for this specific subtask:
- Run tests if tests were written or modified
- Run build if source code was modified
- Run linter if available
- Check that expected files exist and are non-empty

If success criteria fail, skip the review — go directly to reroute (Step 4).

### Step 2: Dispatch Code Reviewer

Send the **Code Reviewer** agent via Agent tool:

```
Review the code produced by subtask: {subtask description}

## What was built
{summary from agent's result}

## Files created or modified
{file list — from agent result or git diff --name-only}

## Success criteria that passed
{which checks passed in Step 1}

## Project context
- Language/framework: {detected}
- Tests passing: {yes/no}
- Linter clean: {yes/no}

Review for: correctness, security, code quality, error handling, performance.
Return PASS, PASS WITH NOTES, or FAIL with specific issues.
```

### Step 3: Handle Review Result

| Result | Action |
|--------|--------|
| **PASS** | Mark subtask complete. Proceed to next subtask or Phase 7. |
| **PASS WITH NOTES** | Mark subtask complete. Record notes for the final report. |
| **FAIL (critical issues)** | Proceed to Step 4 (reroute). |

### Step 4: Reroute to Original Agent

Re-dispatch the **same agent** that built the subtask, with the review feedback injected:

```
Your previous work on subtask "{subtask description}" was reviewed and needs fixes.

## Review Feedback
{paste the Code Reviewer's full output — critical issues and suggested fixes}

## Files to Fix
{list of files with issues}

## Instructions
1. Fix ALL critical issues identified by the reviewer.
2. Do NOT introduce new features or refactor unrelated code.
3. Run tests after fixing to ensure nothing broke.
4. If a suggested fix is wrong, explain why and apply a better fix.
```

### Step 5: Re-Verify

After the agent delivers fixes:
1. Re-run success criteria (Step 1)
2. Re-dispatch Code Reviewer on **only the changed files** (Step 2)
3. If still failing, loop back to Step 4

### Step 6: Exhaustion

If `maxRetries` is exhausted (default: 2 reroute attempts per subtask):
1. Mark the subtask as **partially complete**
2. Record unresolved issues in the failure log
3. Include unresolved issues in the final report
4. Continue with other subtasks — do NOT block the entire run

## Retry Counting

The verify-and-reroute loop has its own retry counter, separate from the self-healing retry counter:
- `maxRetries` from config applies (default: 2)
- Each reroute counts as one retry
- Self-healing retries (Phase 4) are separate — those handle agent crashes and errors
- Verify-and-reroute handles quality issues in otherwise "successful" output

## Post-Fix Regression Test

After a critical issue is found and fixed via reroute, the orchestrator dispatches the **Test Engineer** agent to write a regression test covering the specific bug that was caught. This ensures the same issue never passes review again.

```
Write a regression test for the following bug that was caught in code review:

## Bug Description
{critical issue from review — what was wrong and where}

## Fix Applied
{what the agent changed to fix it}

## Files Involved
{file paths}

## Test Requirements
- Test the specific edge case that triggered the bug
- Test should FAIL if the fix is reverted
- Add to the existing test suite (don't create a new test file unless necessary)
```

## Integration with Other Phases

- **Phase 3 (Dispatch)**: After each agent completes, enter verify-and-reroute before dispatching dependent subtasks
- **Phase 4 (Self-Healing)**: If an agent crashes during a reroute fix, self-healing takes over
- **Phase 6 (Code Review)**: The final Phase 6 review is a lightweight pass over the full codebase — most issues should already be caught per-subtask
- **Phase 7 (Learn)**: Record verify-and-reroute stats (how many reroutes, what issues were found) in lessons learned
