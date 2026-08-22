---
name: orchestrator
version: 3.4.0
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

**Idea → Plan → Build → Verify → Review → Reroute (if needed) → Fix → Re-verify → Learn → Remember**

Never stop at failure. Analyze it, try a different approach, and record what worked. Every run makes future runs smarter.

## Autonomous Workflow

### Phase 1: Understand & Plan

Decompose the user's idea into concrete subtasks. For each subtask:
- What needs to be done (actionable description)
- What capabilities are required
- Success criteria (how to verify it worked) — **executable wherever possible**: an exact
  command with checkable output (`pytest tests/test_x.py`, `npm run build`), not prose.
  Correctness gates everything: work that fails its criteria counts as zero progress no
  matter how good it looks.
- Dependencies on other subtasks

**Goal is a measurable improvement of something that already works** (performance, size,
latency, a benchmark score)? Don't decompose — use the evolution loop instead:
[references/evolution-loop.md](references/evolution-loop.md).

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
- Generate a `taskRunId` (e.g., `run-{timestamp}`)
- Create checkpoint directory: `.claude/context/checkpoints/`
- Inject Checkpoint Protocol into every agent prompt (see [references/checkpoint-protocol.md](references/checkpoint-protocol.md))

**Dispatch** independent subtasks **in parallel** via multiple Agent tool calls. Only sequence subtasks with dependencies.

**Dispatch contract** — every implementation dispatch prompt MUST include:
1. **The verification command(s)** — the subtask's executable success criteria, verbatim.
2. **The inner loop instruction** — "Run the verification yourself. Iterate
   edit→evaluate→diagnose until it passes BEFORE returning. Do not return work that fails
   its own success criteria."
3. **Relevant knowledge** — pointers to reference material (`.claude/knowledge/` if present,
   applicable lessons from `.claude/memory/lessons-learned.md`) and, on re-dispatch, the
   scored history of prior attempts.

Agents that self-verify return working code; the verify-and-reroute gate (Phase 5) then acts
as a commit gate for what self-verification can't catch, instead of being the first place
errors surface.

**Continuation handling** — after each agent returns, check the result:
1. If result contains `NEEDS_CONTINUATION: true` → read the checkpoint file at `.claude/context/checkpoints/{taskRunId}-{subtaskNumber}.md`, then re-dispatch the same agent with the checkpoint context injected (see [references/continuation-loop.md](references/continuation-loop.md) for the full loop)
2. If result contains `NEEDS_CONTINUATION: false` or no signal → agent is done, clean up checkpoint file, proceed to verify-and-reroute gate
3. Repeat up to `maxContinuations` (default 5) re-dispatches per subtask

**After each agent completes** (including after continuations), immediately run the **verify-and-reroute gate** (Phase 5) on that subtask before dispatching any dependent subtasks. Do NOT wait for all subtasks to finish before verifying.

### Phase 4: Self-Healing Loop

When a subtask fails, do NOT just retry blindly. Follow the self-healing protocol:

1. **Capture** — Record the exact error, what was attempted, and the environment state
2. **Analyze** — Determine root cause. Is it a code bug? Missing dependency? Wrong approach? Environment issue? Or a **plateau** — attempts succeeding without improving (see Plateau Detection in [references/self-healing.md](references/self-healing.md)); plateaus get a trajectory review and a changed direction, never another same-direction retry
3. **Adapt** — Choose a different strategy:
   - Try a different agent with different capabilities
   - Modify the subtask description with more specific constraints
   - Break the subtask into smaller pieces
   - Apply a fix from lessons learned if a similar failure was seen before
4. **Retry** — Dispatch with the adapted approach (up to `maxRetries` attempts per subtask)
5. **Record** — Log the failure and fix to `.claude/memory/failure-log.md` for future reference

See [references/self-healing.md](references/self-healing.md) for the full self-healing protocol.

### Phase 5: Verify-and-Reroute Gate (Per Subtask)

This gate fires **per subtask**, immediately after each agent completes — not at the end. This catches issues early before downstream subtasks build on broken work.

**Skip** for subtasks that only produce docs, config, or research (no code output).

For each completed code subtask:

1. **Run success criteria** — Execute the subtask's success criteria from Phase 1 (tests, build, linter)
2. **Dispatch Code Reviewer** — Send the Code Reviewer agent to review that subtask's files:
   - What was built and why
   - Files created/modified (from agent result or `git diff --name-only`)
   - Which success criteria passed
   - Project context (language, framework, tests, linter)
3. **Handle result**:
   - **PASS** → Mark subtask complete, proceed to next subtask or Phase 7
   - **PASS WITH NOTES** → Mark complete, record notes for report
   - **FAIL (critical issues)** → **Reroute** to the original agent:
     - Re-dispatch the **same agent** with the review feedback injected
     - Agent fixes ALL critical issues
     - Re-run success criteria + re-review only changed files
     - Loop until PASS or `maxRetries` exhausted (default: 2 reroute attempts)
4. **Post-fix regression test** — After any critical issue is fixed via reroute, dispatch the **Test Engineer** agent to write a regression test for the specific bug that was caught. This ensures the same bug never passes review again.
5. **If retries exhausted** — Mark subtask as partially complete, record unresolved issues, continue with other subtasks

See [references/verify-and-reroute.md](references/verify-and-reroute.md) for the full protocol.
See [references/code-review.md](references/code-review.md) for review dispatch format.

### Phase 6: Final Integration Check

After ALL subtasks pass their individual verify-and-reroute gates:

1. **Run full test suite** — All tests, not just per-subtask tests
2. **Run build** — Ensure the full project compiles/builds
3. **If failures** — Feed back into Phase 4 (self-healing) with integration context
4. **If passes** — Proceed to Phase 7

This is a lightweight final pass — most issues should already be caught per-subtask in Phase 5.

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

## Evolution Mode

For goals whose success is a *number to improve* (throughput, latency, size, benchmark or
quality score) on something that already works, skip decomposition and run the score-gated
evolution loop: an executable scoring function with correctness as a hard gate (fail = score
0), one agent iterating edit→evaluate→diagnose per step, git commits only for versions that
beat the best committed score, and supervisor intervention when the trajectory stagnates.
Full protocol: [references/evolution-loop.md](references/evolution-loop.md). Pattern derived
from arXiv 2603.24517 (`docs/research/avo-agentic-variation-operators.md`).

## Additional Resources

- [references/verify-and-reroute.md](references/verify-and-reroute.md) — Per-subtask quality gate with automatic reroute loop
- [references/evolution-loop.md](references/evolution-loop.md) — Score-gated continuous improvement loop for measurable-goal tasks
- [references/self-healing.md](references/self-healing.md) — Full self-healing protocol with error analysis patterns
- [references/memory-protocol.md](references/memory-protocol.md) — Memory system details and pruning rules
- [references/checkpoint-protocol.md](references/checkpoint-protocol.md) — Checkpoint protocol for context management
- [references/continuation-loop.md](references/continuation-loop.md) — Continuation loop dispatch pseudocode
- [references/code-review.md](references/code-review.md) — Code review protocol and severity handling
- [references/agent-creation-template.md](references/agent-creation-template.md) — Template for auto-created agents
