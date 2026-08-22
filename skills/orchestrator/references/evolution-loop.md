# Evolution Loop Protocol

An opt-in continuous-improvement mode for goals with a **measurable score** — performance
tuning, benchmark targets, size/latency budgets, quality metrics. Instead of decomposing into
subtasks, the orchestrator runs one agent in a score-gated improvement loop and commits only
versions that measurably improve.

Based on the Agentic Variation Operator pattern (arXiv 2603.24517; see
`docs/research/avo-agentic-variation-operators.md`): the agent — not the framework — decides
what to study, what to change, and when to measure. The framework's job is the scoring
function, the committed lineage, and stagnation supervision.

## When to Use

Use the evolution loop when ALL of these hold:

1. The goal is *improvement of an existing working thing*, not building something new.
2. Success is a number: TFLOPS, requests/sec, p95 latency, bundle size, test coverage,
   benchmark score.
3. Correctness is independently checkable (a test suite or reference implementation exists).

Otherwise use the standard Phase 1–8 pipeline.

## Setup (before the first iteration)

### 1. Scoring function `f`

Create an executable scoring script (commit it — it is part of the deliverable):

- Runs the **correctness check first**. If correctness fails, the score is **0** — no
  exceptions, regardless of how fast/small/pretty the candidate is.
- Then measures the target metric(s). Multi-dimensional is fine (e.g. one score per
  configuration); report each dimension plus a single aggregate (geomean works well).
- Deterministic enough to compare runs: fixed seeds, warm-up runs, repeat-and-average for
  noisy metrics. Record the noise floor — improvements within noise are not improvements.
- Output machine-readable (one JSON line or `score=<number>` on the last line).

### 2. Baseline

Run `f` on the current implementation. Record the baseline score. This is the number to beat;
if the baseline can't be measured, stop and fix that first.

### 3. Knowledge base `K`

Collect domain references into `.claude/knowledge/` (or list existing paths): relevant docs,
reference implementations, profiling guides, past lessons from `.claude/memory/`. The agent
chooses what to read — the orchestrator's job is only to make the material discoverable.

## The Iteration (one variation step)

Dispatch ONE agent per iteration with this contract:

```
You are improving {target} in a score-gated evolution loop.

## Scoring function
Run: {exact command}
Current best committed score: {score} (baseline: {baseline})
Correctness failure means score 0. Improvements below {noise floor} are noise.

## Lineage
Committed versions so far (git log on this branch):
{version → score table, plus one-line description of each change}

## Knowledge base
{paths to reference material}

## Your loop
1. Study the current best version and its profile/measurements. Consult the lineage —
   including what did NOT work — and the knowledge base as needed.
2. Pick ONE optimization direction and implement it.
3. Run the scoring function yourself. If correctness fails or the score regresses,
   diagnose and either repair or abandon the direction and pick another.
4. Repeat the edit→evaluate→diagnose cycle until you have a candidate that passes
   correctness AND beats the best committed score, or you conclude this direction is
   exhausted.

## Commit rule
Commit ONLY a candidate that passes correctness and matches-or-beats the best committed
score. Commit message: "evolve: {what changed} [score: {new} <- {old}]".
Do NOT commit failed experiments — describe them in your final report instead.

## Report back
- New score (or "no improvement found")
- What you tried, including abandoned directions and why they failed
- The most promising untried directions you identified
```

After each iteration, the orchestrator records the outcome (score, direction tried, result)
in its working notes — this becomes the lineage context for the next iteration.

## Stagnation Supervision

The orchestrator acts as supervisor between iterations. Track consecutive non-improving
iterations (`evolution.maxStagnantIterations`, default 3). Two failure modes:

- **Stall** — the agent reports it has exhausted its current line of exploration.
- **Unproductive cycle** — iterations keep committing marginal or no improvements while
  circling the same area of the code.

When either triggers, do NOT dispatch another identical iteration. Intervene:

1. Review the whole trajectory: every direction tried, every score, every abandoned attempt.
2. Generate 2–3 genuinely fresh candidate directions (different subsystem, different
   technique, something from the knowledge base nobody has consulted yet, revisiting an
   early abandoned idea with new information).
3. Dispatch the next iteration explicitly steered toward one of them, with the trajectory
   summary included so the agent knows what is already exhausted.

Expect plateaus: real improvement arrives in discrete jumps separated by flat stretches of
refinement. A plateau is only a stall once the intervention above also fails to find a new
direction.

## Stopping

Stop the loop when any of:

- Target score reached (if the user set one).
- Iteration budget exhausted (`evolution.maxIterations`, default 10 — the user can raise it).
- Two consecutive supervisor interventions produce no new improvement.

Then run Phase 5 (verify-and-reroute) on the final version as the commit gate, and Phase 7
(Learn & Remember): record which directions paid off and which were dead ends —
lessons-learned entries from evolution runs are unusually transferable.
