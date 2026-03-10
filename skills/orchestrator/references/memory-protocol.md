# Memory Protocol

The orchestrator maintains persistent memory that makes every run smarter than the last.

## Memory Location

All memory files live in `.claude/memory/`:

```
.claude/memory/
├── lessons-learned.md    # What worked, what failed, actionable advice
└── failure-log.md        # Raw failure records for pattern detection
```

Create this directory on first use: `mkdir -p .claude/memory`

## Lessons Learned Format

Each entry in `lessons-learned.md` follows this structure:

```markdown
## [{date}] {task summary}
- **What worked**: {description of successful approach}
- **What failed**: {description of failed approach, if any}
- **Root cause**: {why it failed}
- **Fix applied**: {what resolved it}
- **Agent notes**: {agent-specific observations — e.g., "sonnet struggled with X, opus handled it"}
- **For next time**: {concise, actionable advice for similar tasks}
```

### Examples

```markdown
## [2026-03-10] Set up Docker monitoring stack
- **What worked**: Using prometheus + grafana with docker-compose
- **What failed**: Initial attempt to use custom metrics exporter
- **Root cause**: The exporter required Go compilation, no Go toolchain in environment
- **Fix applied**: Switched to node-exporter which ships as a prebuilt binary
- **Agent notes**: Infrastructure Agent handled this well after the fix
- **For next time**: Check available toolchains before choosing monitoring exporters

## [2026-03-10] Add authentication to REST API
- **What worked**: JWT with refresh tokens using jsonwebtoken library
- **What failed**: First agent tried passport.js but project uses Fastify, not Express
- **Root cause**: Agent assumed Express — subtask description didn't specify framework
- **Fix applied**: Rewrote subtask to explicitly say "Fastify with @fastify/jwt"
- **Agent notes**: API Development Agent works better when framework is specified
- **For next time**: Always include the web framework in subtask descriptions for API work
```

## Failure Log Format

Each entry in `failure-log.md`:

```markdown
## [{timestamp}] FAILURE: {subtask}
- **Agent**: {agent name}
- **Error**: {exact error}
- **Attempted**: {what was tried}
- **Category**: {code-bug|missing-dep|wrong-approach|env-issue|insufficient-context|complexity-overflow}
- **Resolved**: {yes/no}
- **Resolution**: {if resolved, what fixed it}
```

## How Memory Is Used

### Injection (Every Run)

The SKILL.md injects memory via dynamic context:

```
Lessons learned: !`cat .claude/memory/lessons-learned.md 2>/dev/null | tail -50`
Recent failures: !`cat .claude/memory/failure-log.md 2>/dev/null | tail -20`
```

This means the orchestrator sees the most recent 50 lessons and 20 failures before it starts planning. It can:
- Avoid approaches that failed before
- Reuse fixes that worked
- Choose the right agent based on past performance

### During Planning (Phase 1)

When decomposing a goal, check lessons for:
- Similar tasks attempted before
- Known pitfalls with specific technologies
- Agent preferences for certain task types

### During Self-Healing (Phase 4)

When a failure occurs, check lessons for:
- Matching error patterns → apply known fix
- Agent-specific notes → switch to a better agent
- Framework-specific gotchas → adjust subtask description

### After Completion (Phase 6)

Always append new lessons, even on success. Success lessons are just as valuable — they document what works.

## Pruning Rules

Keep memory useful, not bloated:

1. **Max entries**: 200 in lessons-learned.md
2. **When exceeded**: Remove the oldest entries first
3. **Never remove**: Entries tagged with `**Critical**` or entries less than 7 days old
4. **Failure log**: Keep last 100 entries, prune older ones
5. **Pruning command**: Orchestrator runs pruning at the start of Phase 6

## Memory Initialization

On first run (no memory files exist):
1. Create `.claude/memory/` directory
2. Create `lessons-learned.md` with header:
   ```markdown
   # Lessons Learned

   Persistent knowledge from orchestrator runs. Consulted at the start of every task.
   ```
3. Create `failure-log.md` with header:
   ```markdown
   # Failure Log

   Raw failure records for pattern detection. Auto-pruned to last 100 entries.
   ```

## .gitignore Considerations

Add to `.gitignore` if memory should be local-only:
```
.claude/memory/
```

Or commit it to share lessons across team members. Both are valid — depends on whether the lessons are project-specific or machine-specific.
