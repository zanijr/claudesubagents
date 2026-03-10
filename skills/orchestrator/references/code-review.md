# Code Review Protocol

After verification passes (Phase 5), the orchestrator dispatches a code review before declaring success.

## When to Review

- **Always review** when subtasks produced or modified code files
- **Skip review** for documentation-only, configuration-only, or research tasks
- **Always review** if the task involves security, authentication, or data handling

## Dispatch

Dispatch the **Code Reviewer** agent via Task tool with this prompt structure:

```
Review the code produced by the following subtasks:

## What was built
{summary of the goal and what each subtask accomplished}

## Files created or modified
{list of files — use git diff --name-only or track from subtask results}

## Success criteria that passed
{list from Phase 1 that were verified in Phase 5}

## Project context
- Language/framework: {detected from files}
- Has tests: {yes/no}
- Has linter: {yes/no}
- Has type checker: {yes/no}

Review for: correctness, security, code quality, error handling, performance.
```

## Handling Review Results

### If review returns PASS
- Proceed to Phase 7 (Learn & Remember)
- Include "Code review: PASS" in the report

### If review returns PASS WITH NOTES
- Proceed to Phase 7 (Learn & Remember)
- Include notes in the report as "suggested improvements"
- Record any recurring patterns in lessons learned

### If review returns FAIL (critical issues found)
The orchestrator feeds critical issues back into the **self-healing loop** (Phase 4):

1. For each critical issue, create a fix subtask:
   - Description: "Fix {issue type} in {file}:{line} — {description}"
   - Agent: The original agent that wrote the code (they have context)
   - Include the reviewer's suggested fix in the prompt
2. Dispatch fix subtasks
3. Re-run verification (Phase 5)
4. Re-run code review (Phase 6) on the fixed files only
5. If still failing after `maxRetries`, report the unresolved issues

This creates a **build → test → review → fix** cycle that continues until the code is clean or retries are exhausted.

## What Gets Recorded in Lessons Learned

After code review, record:
- Common issues found (e.g., "agents tend to forget input validation on API endpoints")
- Agent-specific patterns (e.g., "Infrastructure Agent leaves debug logging in production code")
- Security patterns (e.g., "always check for path traversal when handling file uploads")

These lessons get injected into future agent prompts, reducing repeat issues over time.
