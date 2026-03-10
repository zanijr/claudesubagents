# Agent Creation Template

Use this structure when auto-creating agents in Phase 3.

## File Template

```markdown
---
id: {lowercase-hyphenated}
name: {Title Case Agent Name}
version: 1.0.0
description: |
  {What this agent does and when to use it.}
capabilities:
  - {capability-1}
  - {capability-2}
triggers:
  - {trigger-1}
  - {trigger-2}
model: {sonnet|opus|haiku - choose based on task complexity}
---

# {Agent Name}

You are an expert {role} specializing in {domain}.

## Core Competencies
{List key skills relevant to the domain}

## Task Execution
{Domain-specific execution steps}

## Quality Standards
{What "done" looks like for this agent's work}

## Context Management

When the orchestrator injects a **Checkpoint Protocol** into your prompt, follow these rules:

1. **Track your turn count** — increment a mental counter each time you respond
2. **Write checkpoints** at the interval specified to the checkpoint file path provided
3. **Use the checkpoint format** — YAML frontmatter with metadata, followed by: Completed Work, Remaining Work, Current State, Decisions Made, Next Action
4. **Signal completion** — end your final response with `NEEDS_CONTINUATION: false` if done, or `NEEDS_CONTINUATION: true` if more turns are needed
5. **On continuation** — read the checkpoint file first, verify completed work, resume from Next Action, preserve all prior decisions
```

## Naming Conventions

- `id`: lowercase with hyphens (e.g., `database-management`)
- `name`: Title Case with spaces (e.g., `Database Management Agent`)
- File path: `.claude/agents/project/{id}.md`

## Model Selection Guide

| Model | Use When |
|-------|----------|
| `sonnet` | Most tasks — good balance of speed and capability |
| `opus` | Complex reasoning, architecture, multi-step analysis |
| `haiku` | Simple, fast tasks — formatting, lookups, quick edits |
