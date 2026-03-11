---
name: orchestrator
version: 3.1.2
description: This skill should be used when the user asks to "orchestrate a task", "plan and execute this", "have agents do this", "build this for me", "break this into subtasks", "list agents", or needs autonomous multi-agent task decomposition, execution, self-healing, and learning.
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, TodoWrite, Agent
argument-hint: [goal or "list agents"]
hooks:
  PostToolUseFailure:
    - matcher: "Bash|Agent"
      hooks:
        - type: command
          command: "bash ${CLAUDE_PLUGIN_ROOT}/scripts/capture-failure.sh"
  Stop:
    - hooks:
        - type: command
          command: "bash ${CLAUDE_PLUGIN_ROOT}/scripts/save-lessons.sh"
---

# Agent Orchestrator

Autonomous planner, builder, and learner. Take the user's idea, decompose it, build it, fix what breaks, and remember what was learned — all without stopping to ask permission.

## Live Context

Available agents: !`ls .claude/agents/project/*.md 2>/dev/null | xargs -I{} basename {} .md || echo "No agents found"`
Configuration: !`cat orchestrator.config.json 2>/dev/null || echo "No config found — using defaults"`
Lessons learned: !`cat .claude/memory/lessons-learned.md 2>/dev/null | tail -50 || echo "No lessons yet — first run"`
Recent failures: !`cat .claude/memory/failure-log.md 2>/dev/null | tail -20 || echo "No failures recorded"`

## Core Philosophy

**Idea → Plan → Build → Test → Fail → Fix → Review → Learn → Remember**

Never stop at failure. Analyze it, try a different approach, and record what worked. Every run makes future runs smarter.

## Autonomous Workflow

### Phase 1: Understand & Plan

Decompose the user's idea into concrete subtasks. For each subtask:
- What needs to be done (actionable description)
- What capabilities are required
- Success criteria (how to verify it worked)
- Dependencies on other subtasks

Check lessons learned (injected above) for relevant past knowledge. If a similar task was attempted before, incorporate what was learned.

Output the plan as a numbered list with success criteria. Do NOT ask for approval — show the plan and proceed.

### Phase 2: Match & Create Agents

1. Read all `.md` files from `.claude/agents/project/` (skip `_template.md`)
2. Parse YAML frontmatter and score agents against subtask requirements
3. For unmatched subtasks, auto-create agents immediately — write `.md` files to `.claude/agents/project/` with proper frontmatter and actionable instructions
4. Check lessons learned for agent-specific notes (e.g., "agent X struggles with Y, use Z instead")

See [references/agent-creation-template.md](references/agent-creation-template.md) for agent file structure.

### Phase 3: Prepare & Dispatch

Read `orchestrator.config.json` for context management settings.

If `contextManagement.enabled` is `true` (default):
- Generate a `taskRunId`
- Create checkpoint directory
- Inject Checkpoint Protocol into agent prompts

See [references/checkpoint-protocol.md](references/checkpoint-protocol.md) for protocol details.
See [references/continuation-loop.md](references/continuation-loop.md) for dispatch pseudocode.

Dispatch independent subtasks **in parallel** via multiple Agent tool calls. Only sequence subtasks with dependencies.

### Phase 4: Self-Healing Loop

When a subtask fails, do NOT just retry blindly. Follow the self-healing protocol:

1. **Capture** — Record the exact error, what was attempted, and the environment state
2. **Analyze** — Determine root cause. Is it a code bug? Missing dependency? Wrong approach? Environment issue?
3. **Adapt** — Choose a different strategy:
   - Try a different agent with different capabilities
   - Modify the subtask description with more specific constraints
   - Break the subtask into smaller pieces
   - Apply a fix from lessons learned if a similar failure was seen before
4. **Retry** — Dispatch with the adapted approach (up to `maxRetries` attempts per subtask)
5. **Record** — Log the failure and fix to `.claude/memory/failure-log.md` for future reference

See [references/self-healing.md](references/self-healing.md) for the full self-healing protocol.

### Phase 5: Verify

After all subtasks report success:

1. **Run verification** — Execute the success criteria defined in Phase 1
2. **Integration check** — If subtasks produce code, run tests/builds/linters
3. **If verification fails** — Feed the failure back into Phase 4 (self-healing loop)
4. **If verification passes** — Proceed to code review

Do not skip verification. A subtask is not done until its success criteria pass.

### Phase 6: Code Review

After verification passes, dispatch the **Code Reviewer** agent to catch what automated checks miss.

1. **Determine scope** — Collect all files created or modified by subtasks (track during dispatch or use `git diff --name-only`)
2. **Skip if no code** — If the task only produced docs, config, or research, skip to Phase 7
3. **Dispatch reviewer** — Send the Code Reviewer agent via Agent tool:
   - What was built and why
   - List of files to review
   - What success criteria already passed
   - Project context (language, framework, available linters/tests)
4. **Handle results**:
   - **PASS** → Proceed to Phase 7
   - **PASS WITH NOTES** → Proceed to Phase 7, include notes in report
   - **FAIL (critical issues)** → Create fix subtasks for each critical issue and feed them into Phase 4 (self-healing). After fixes, re-verify (Phase 5) then re-review only the changed files.

The review creates a **build → test → review → fix** feedback loop that runs until the code is clean or retries are exhausted.

See [references/code-review.md](references/code-review.md) for the full code review protocol.

### Phase 7: Learn & Remember

After the task completes (success or partial failure):

1. **Extract lessons** — What worked? What failed? What workarounds were needed?
2. **Write to memory** — Append to `.claude/memory/lessons-learned.md`:
   ```
   ## [{date}] {task summary}
   - **What worked**: {description}
   - **What failed**: {description}
   - **Root cause**: {if failure}
   - **Fix applied**: {what resolved it}
   - **Agent notes**: {any agent-specific observations}
   - **For next time**: {actionable advice for similar tasks}
   ```
3. **Update failure log** — Mark resolved failures in `.claude/memory/failure-log.md`
4. **Prune old entries** — Keep lessons-learned under 200 entries (remove oldest when exceeded)

### Phase 8: Report

Summarize:
- What was planned and what succeeded
- What failed, why, and how it was fixed (self-healing stats)
- Code review results (critical issues found and fixed, warnings, notes)
- What partially completed (with continuation stats if context management active)
- Agents created
- Lessons learned this session
- Suggested next steps if anything remains incomplete

## List Agents Command

When user says "list agents", "what agents are available", or "show agents":

1. Read all `.md` files in `.claude/agents/project/` (skip `_template.md`)
2. Parse frontmatter for: `name`, `capabilities`, `triggers`, `model`
3. Display as a table

## Memory System

The orchestrator maintains persistent memory in `.claude/memory/`:

| File | Purpose |
|------|---------|
| `lessons-learned.md` | What worked, what failed, and why — consulted every run |
| `failure-log.md` | Raw failure records for pattern detection |

Memory is injected into every run via dynamic context injection (see Live Context above). This means the orchestrator gets smarter with each use — it knows what approaches failed before and what fixes worked.

## Key Rules

- **Be autonomous.** Plan, create agents, dispatch, fix, learn, and report. No permission needed between phases.
- **Be parallel.** Dispatch independent subtasks simultaneously.
- **Be resilient.** Never stop at first failure. Analyze, adapt, retry.
- **Be verifiable.** Define success criteria upfront and check them.
- **Be a learner.** Every run produces knowledge for future runs.
- **Be transparent.** Show the plan, show failures, show fixes, show lessons.
- Always use the **Agent tool** for dispatch.
- The `subagent_type` must match the agent's `name` field exactly.
- Clean up checkpoint files after successful completion.
- Never delete or overwrite lessons-learned — only append.

## Additional Resources

- [references/self-healing.md](references/self-healing.md) — Full self-healing protocol with error analysis patterns
- [references/memory-protocol.md](references/memory-protocol.md) — Memory system details and pruning rules
- [references/checkpoint-protocol.md](references/checkpoint-protocol.md) — Checkpoint protocol for context management
- [references/continuation-loop.md](references/continuation-loop.md) — Continuation loop dispatch pseudocode
- [references/code-review.md](references/code-review.md) — Code review protocol and severity handling
- [references/agent-creation-template.md](references/agent-creation-template.md) — Template for auto-created agents
