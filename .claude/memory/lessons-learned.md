# Lessons Learned

Persistent knowledge from orchestrator runs. Consulted at the start of every task.

## [2026-03-11] Full-stack task management system (FastAPI + SQLite + CLI + tests + docs)
- **What worked**: Dispatching backend first, then CLI/tests/docs in parallel once the API existed. 4 agents created and used effectively. All subtasks succeeded on first attempt.
- **What failed**: Code review found a critical bug — `PUT /tasks/{id}` with `{"title": null}` caused HTTP 500 (SQLite NOT NULL constraint). Import endpoints also accepted invalid enum values.
- **Root cause**: Pydantic `Optional[str]` accepts `null` without enforcing `min_length`. The route blindly passed `None` to the database. Import paths skipped enum validation entirely.
- **Fix applied**: Added non-nullable field guard in the update route (returns 422 for null on required fields). Added enum validation in both JSON and CSV import paths (skips rows with invalid values).
- **Agent notes**: `general-purpose` agent handled all subtasks well. Code Reviewer agent caught a real bug that 73 tests missed — always run code review on API code. Backend agent found and fixed a race condition during development (reading stale data in update_task).
- **For next time**: (1) Always validate null explicitly for non-nullable fields in partial update endpoints — Pydantic `Optional` doesn't protect against this. (2) Always validate enum values at import boundaries, not just API endpoints. (3) Dispatch backend first, then parallelize dependent work. (4) Include negative test cases for null fields in update endpoints.
