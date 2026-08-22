# Lessons Learned

Persistent knowledge from orchestrator runs. Consulted at the start of every task.

## [2026-03-11] Full-stack task management system (FastAPI + SQLite + CLI + tests + docs)
- **What worked**: Dispatching backend first, then CLI/tests/docs in parallel once the API existed. 4 agents created and used effectively. All subtasks succeeded on first attempt.
- **What failed**: Code review found a critical bug — `PUT /tasks/{id}` with `{"title": null}` caused HTTP 500 (SQLite NOT NULL constraint). Import endpoints also accepted invalid enum values.
- **Root cause**: Pydantic `Optional[str]` accepts `null` without enforcing `min_length`. The route blindly passed `None` to the database. Import paths skipped enum validation entirely.
- **Fix applied**: Added non-nullable field guard in the update route (returns 422 for null on required fields). Added enum validation in both JSON and CSV import paths (skips rows with invalid values).
- **Agent notes**: `general-purpose` agent handled all subtasks well. Code Reviewer agent caught a real bug that 73 tests missed — always run code review on API code. Backend agent found and fixed a race condition during development (reading stale data in update_task).
- **For next time**: (1) Always validate null explicitly for non-nullable fields in partial update endpoints — Pydantic `Optional` doesn't protect against this. (2) Always validate enum values at import boundaries, not just API endpoints. (3) Dispatch backend first, then parallelize dependent work. (4) Include negative test cases for null fields in update endpoints.

## [2026-08-22] Adopted AVO paper patterns into the orchestrator (arXiv 2603.24517)
- **What worked**: Analyzed NVIDIA's AVO paper (agent-as-variation-operator beating cuDNN/FlashAttention-4) and mapped it onto our protocols. Full analysis: `docs/research/avo-agentic-variation-operators.md`.
- **What changed**: (1) Dispatch contract — every implementation dispatch now includes executable verification commands and requires the agent to iterate edit→evaluate→diagnose until green before returning; verify-and-reroute is the commit gate, not the debug loop. (2) Plateau detection in self-healing — attempts that succeed without improving trigger a trajectory review and direction change, not another retry. (3) New evolution-loop protocol for measurable-score goals. (4) Synced the stale top-level `skills/` distribution tree (was 3.1.2, missing verify-and-reroute entirely) with `.claude/skills/` and fixed version drift → 3.4.0.
- **For next time**: (1) When dispatching, always pass the exact verify command — agents that can't check their own work return broken code. (2) The two skill trees (`skills/` and `.claude/skills/`) drift — any protocol change must be applied to both (or synced with `cp -r`). (3) Version lives in 5 places: both SKILL.md files, package.json, .claude-plugin/plugin.json, marketplace/catalog.json, templates/orchestrator.config.json.
