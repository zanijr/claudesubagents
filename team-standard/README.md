# Oscar Wilson — Team Claude Standard

One global Claude Code configuration for the whole team, synthesized from what
all three of us actually built (survey of all 54 `oscarwilsonengines` repos,
2026-08-26), plus the guardrails none of us had. Designed so each person's
existing workflow keeps working — this standardizes the floor, not the style.

**This directory is the package.** Its intended home is
`oscarwilsonengines/claude-team-config` (the repo the team already pulls from);
it lives here first for review.

## What's in the box

| Path | What it is |
|---|---|
| `global/CLAUDE.md` | The org-wide standard — installs at `~/.claude/CLAUDE.md` on every machine |
| `global/settings.json` | Per-repo guardrails — copy to `<repo>/.claude/settings.json` and commit |
| `guardrails/hooks/bash-guard.sh` | Tested PreToolUse hook: blocks force pushes, pushes to main, `--no-verify`, catastrophic `rm`, `curl\|bash`, shell reads of `.env`/keys |
| `guardrails/managed-settings.json` | Optional strict tier: machine-level rules nobody can override |
| `templates/AGENTS.md.template`, `templates/CLAUDE.md.template` | The two-file repo layout (agent-agnostic guide + thin Claude import) |
| `agents/code-reviewer.md` | Shared Code Reviewer agent — the pre-PR quality gate |
| `scripts/install-user.{sh,ps1}` | Per-person install: global CLAUDE.md + team skills/agents mirror (skips `_template.md`) |
| `scripts/apply-to-repo.{sh,ps1}` | Stamp guardrails + templates into any repo, without clobbering existing config |

## The three layers (how config flows)

1. **Person** — `~/.claude/CLAUDE.md` (this standard) + mirrored team
   skills/agents from `claude-team-config`. Installed by `install-user`.
   Personal taste stays in `~/.claude/settings.json` — untouched.
2. **Repo** — checked-in `.claude/settings.json` (guardrails travel with git;
   they apply to anyone who opens the repo after trusting the workspace),
   `AGENTS.md` + thin `CLAUDE.md`, committed `.claude/memory/`. Stamped by
   `apply-to-repo`.
3. **Machine (optional)** — `managed-settings.json` in the OS system dir
   (`/etc/claude-code/` on Linux/WSL, `C:\Program Files\ClaudeCode\` on
   Windows). Rules there cannot be overridden by user, project, or CLI
   settings. For a 3-person team, adopt this only if layer 2 proves too easy
   to bypass.

Precedence is managed > local > project > user, and **deny rules win at any
layer** — so the repo-level deny list is a real guardrail even without MDM.

## Rollout — do this in order

### Step 0 — security fixes FIRST (found in the survey)

1. **Rotate the `FORGE_API_TOKEN`** committed in plaintext in
   `forge/.mcp.json`, and purge it from git history. Move to env-var injection.
2. **Stop the owauth mirror as-is**: `supabase-mirror` copies the plaintext
   `oscarwilson.owauth` password store into Supabase nightly. Hash the store
   (or exclude that table) before the next sync.
3. Move the hardcoded **USPS credentials** out of the ZipCode rule source
   (P21BuinessRules — already flagged in its own Known Issues).
4. Remove the **GitHub PAT in browser localStorage** pattern from
   ProjectDashboard, and the `admin/1234` printer password from the Zebra docs.
5. Git-ignore `.claude/settings.local.json` in `forge` and
   `ow-p21-veeqo-middleware` (currently committed).

### Step 1 — land this package in claude-team-config

Copy this directory's contents into `oscarwilsonengines/claude-team-config`
(PR, not direct push). While there, fix the three known team-config defects:

- Delete or fence `agents/project/_template.md` (installs as a live agent —
  already bit a teammate; the new install scripts also skip it).
- Fix `ruflo-pr-manager` (still says the org is `ZbOscar` and pins a stale
  co-author line).
- Genericize `C:\Users\zbonham` / `C:\Users\mfowler` paths in shared agents to
  `$HOME`-relative with graceful degradation.

### Step 2 — each person runs the user install (5 minutes)

```bash
# Git Bash / WSL
bash team-standard/scripts/install-user.sh
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File team-standard\scripts\install-user.ps1
```

Existing `~/.claude/CLAUDE.md` files are backed up, not destroyed. Personal
settings and personal agents are left alone.

### Step 3 — stamp the active repos

Priority order from the survey (active + production-touching first):
`Mobile3.0`, `FloorCheck`, `CSHelper`, `owint-portal`, `p21-buying-ops`
(settings merge — it already has one), `ow-automation-scripts`, `Pro846s`,
`Mobile3.0-Native`, `ups-rate-calculator`, then the rest as touched.

```bash
bash team-standard/scripts/apply-to-repo.sh /path/to/repo
```

Repos that already have a good `CLAUDE.md` (Zach's developer guides, Fowler's
PM contract) keep it — the script never overwrites instructions. Migrating
them to the `AGENTS.md` + thin `CLAUDE.md` layout can happen opportunistically.

### Step 4 — turn on GitHub branch protection

The hook blocks Claude from pushing to main; **branch protection blocks
everyone**, which is the real guardrail. On each active repo: protect
`main`/`master`, require a PR, and require at least one human approval —
which also enforces the standard's "Claude may not be author, reviewer, and
merger" rule that the wrap-up skill previously bypassed.

## What came from whom (the "best of all")

- **Zach** — the `AGENTS.md` + thin `@AGENTS.md` CLAUDE.md layout; verify-
  before-asserting / 92%-confidence epistemics; single-source-of-truth
  registries updated in the same PR; conventional commits + feature-branch
  discipline; model tiering.
- **Fowler** — the behavioral-contract CLAUDE.md style (standing rules,
  "Are you sure?", numbered responses, an explicit Do-not section); the only
  complete `.claude/` tree in the org (settings + rules + skills + memory);
  "recalled context is lossy reconstruction".
- **Pinson** — committed `.claude/memory/` ops discipline; confirm-before-
  reset / verify-by-readback production safety; the portable agent-bundle idea.
- **The wrap-up skill** (already shared) — test-first, secret scan, PR flow,
  issues for loose ends. Kept, with one change: **no more self-merging PRs**
  (the standard and branch protection now require a human).
- **New in this package** — the deny-rule + hook guardrail layer, the
  managed-settings tier, the repo templates, and install scripts that don't
  install the template as an agent.

## Guardrails summary (what Claude can no longer do on a standard machine)

- Read `.env` files, private keys, `~/.ssh`, `~/.aws` — via file tools
  (deny rules) or shell (hook). `.env.example` stays readable.
- Force-push; push directly to main/master; commit with `--no-verify`;
  rewrite whole history.
- `rm -rf` on `/`, `~`, `.`, or `*`; pipe curl/wget straight into a shell.
- Merge PRs, publish packages, or run Supabase writes/migrations without a
  human confirming (ask-tier).
- Bypass-permissions mode is disabled by settings on stamped repos.
