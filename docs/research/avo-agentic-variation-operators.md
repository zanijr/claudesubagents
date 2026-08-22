# Paper Analysis: AVO — Agentic Variation Operators for Autonomous Evolutionary Search

**Paper**: arXiv 2603.24517 (NVIDIA, March 2026)
**Analyzed**: 2026-08-22
**Why we care**: AVO is the strongest published evidence to date that the architecture pattern
this repo implements — a coding agent with memory, tools, and a verification loop — can beat
expert-engineered baselines when three specific mechanisms are added. This doc maps those
mechanisms onto our orchestrator and records what we adopted.

## What the paper shows

NVIDIA ran a general-purpose coding agent for 7 days, unattended, against one of the most
hand-optimized pieces of software in existence: attention kernels on Blackwell B200 GPUs.
The agent produced kernels beating cuDNN by up to 3.5% and FlashAttention-4 by up to 10.5%,
and adapted them to grouped-query attention in 30 minutes of autonomous work.

The core claim is architectural, not domain-specific. Prior LLM-evolutionary systems
(FunSearch, AlphaEvolve) confine the LLM to *candidate generation* inside a rigid pipeline:
the framework samples parents, the LLM emits one candidate per call, the framework evaluates.
AVO instead makes the agent the entire **variation operator**:

```
Vary(P_t) = Agent(P_t, K, f)
```

- **P_t (lineage)** — the full history of committed solutions *with their scores*, available
  to the agent as context. The agent decides which prior versions to study.
- **K (knowledge base)** — curated domain references (hardware docs, reference
  implementations). The agent decides what to consult and when.
- **f (scoring function)** — an executable, multi-dimensional evaluator the agent can invoke
  itself. Correctness is a gate: a candidate that fails correctness scores **zero**
  regardless of any other quality.

Inside one variation step the agent runs its own **edit → evaluate → diagnose loop**,
invoking `f` as many times as needed, and commits a new version only when it passes
correctness *and* matches-or-beats the best committed score. Over 7 days: ~500 directions
explored internally, only 40 committed versions. Failed attempts stay in the agent's working
trajectory and never pollute the lineage.

Two other mechanisms mattered for long-horizon autonomy:

- **Supervisor agent** — monitors for *stalls* (agent exhausts its current line of
  exploration) and *unproductive cycles* (edits that repeatedly fail to improve the score).
  When triggered, it reviews the whole trajectory and steers the search toward a few fresh
  candidate directions. It intervenes conditionally — it does not micromanage each step.
- **Git as evolutionary memory** — each committed version is a git commit carrying its
  score, giving full state continuity across the run.

The trajectory analysis (§4.4) is instructive: progress came in **discrete jumps separated by
plateaus** — five architectural inflection points delivered most of the gains, surrounded by
many small refinements. Plateaus are normal, not failure; the supervisor's job is to detect
when a plateau has become a stall.

## Mapping onto this repo

Our orchestrator already had several AVO ingredients before this analysis:

| AVO mechanism | Our equivalent (before) | Gap |
|---|---|---|
| Persistent memory across runs | `.claude/memory/lessons-learned.md`, `failure-log.md` | None — ours also transfers *across* tasks, which AVO's per-run memory does not |
| Verification before accepting work | Verify-and-reroute gate (Code Reviewer + success criteria) | Verification was **external and after the fact** — the worker agent returned once, then a separate review loop began |
| Failure recovery | Self-healing protocol, retry strategies | Retries were **count-bounded**, with no distinction between hard failure and plateau (succeeding without improving) |
| Success criteria | Prose criteria defined in Phase 1 | Often not executable; nothing like a correctness-gated scoring function |
| Lineage | Git history | Attempt scores were not recorded; reroute prompts didn't show prior attempts' results |
| Knowledge base K | — | No convention for curated domain references handed to agents at dispatch |

The single biggest lesson: **we were running the "EVO" architecture the paper critiques.**
Our worker agents were one-shot generators — build, return, then an external gate reviews and
reroutes. Each reroute is a fresh dispatch with feedback bolted on. AVO's data says the win
comes from pushing the evaluate-diagnose loop *inside* the worker: give the agent the exact
verification command at dispatch time and require it to iterate until green before returning.
The external gate stays — as the paper's *commit* gate, not as the primary debugging loop.

## What we adopted

1. **Self-verifying dispatch contract** (SKILL.md Phase 3, CLAUDE.md): every implementation
   dispatch must include (a) the executable verification command(s) for the subtask,
   (b) the instruction to run the edit→evaluate→diagnose loop internally until passing, and
   (c) pointers to relevant knowledge and prior attempts. The verify-and-reroute gate becomes
   the commit gate it was always meant to be.
2. **Executable success criteria** (SKILL.md Phase 1): success criteria must be commands with
   checkable output wherever possible. Correctness gates score: work that fails tests scores
   zero no matter how elegant.
3. **Plateau detection and trajectory intervention** (self-healing.md): a new failure class —
   *stagnation* — distinct from hard failure. Attempts that succeed without improving trigger
   a supervisor-style review of the whole trajectory and a deliberate change of direction,
   instead of burning bounded retries on the same approach.
4. **Evolution loop protocol** (new `references/evolution-loop.md`): an opt-in continuous
   improvement mode for goals with a measurable score (performance tuning, benchmark
   targets, quality metrics): committed lineage with scores in commit messages, a
   correctness-gated scoring script, and stagnation-triggered intervention.
5. **Knowledge base convention**: `.claude/knowledge/` for curated domain references that get
   injected into dispatches, complementing `.claude/memory/` (experience) with reference
   material (expertise).
6. **Scored lineage in reroute prompts** (verify-and-reroute.md): when rerouting, include
   what previous attempts scored, so the agent can compare rather than restart blind.

## What we deliberately did not adopt

- **Population-level evolution** (islands, MAP-Elites archives). The paper itself ran
  single-lineage to isolate the operator's effect, and our tasks are mostly build-to-spec,
  not open-ended search. Revisit if we ever run long optimization campaigns.
- **7-day unattended runs as a default**. The evolution loop is opt-in for goals with a
  numeric score; normal feature work keeps the existing pipeline.
- **Test-time policy updates** (TTT-Discover, ref [22]) — out of scope for a
  prompt-orchestration framework.
