---
name: create-agent
version: 2.0.0
description: This skill should be used when the user asks to "create an agent", "make a new agent", "add an agent for X", or needs to interactively define a new AI agent for the orchestration framework.
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, AskUserQuestion
argument-hint: [agent purpose]
---

# Create Agent

Create a new agent as a `.md` file in `.claude/agents/project/`. The agent becomes immediately available for dispatch via the Task tool.

## Existing Agents

!`ls .claude/agents/project/*.md 2>/dev/null | xargs -I{} basename {} .md || echo "No agents yet"`

## Agent Creation Process

### Step 1: Gather Requirements

Ask the user these questions using the AskUserQuestion tool:

1. **Agent Name** — Title Case with spaces (e.g., "Database Management Agent"). Becomes the `name` field and `subagent_type` for the Task tool.
2. **Purpose** — What it specializes in, what problems it solves.
3. **Capabilities** — Task types it handles (e.g., `code-review`, `testing`, `database`, `security`).
4. **Trigger Words** — Keywords for routing (e.g., `nfc`, `dashboard`, `sql`).
5. **Model** — `sonnet` (recommended), `opus` (complex reasoning), or `haiku` (fast, simple tasks).

If the user provided $ARGUMENTS, use that as context to pre-fill answers and ask only for confirmation or missing details.

### Step 2: Create the Agent File

Generate `.claude/agents/project/{agent-id}.md` where `{agent-id}` is the name lowercased with hyphens.

Use the structure from [references/agent-template.md](references/agent-template.md).

Fill all placeholders with content specific to the agent's purpose. The body below frontmatter becomes the agent's system instructions when dispatched.

### Step 3: Validate

After creating the file:

1. Read it back to confirm frontmatter parses correctly
2. Verify `name` field matches an available `subagent_type`
3. Confirm the file is in `.claude/agents/project/`

Report to the user:
- Agent created at: `.claude/agents/project/{agent-id}.md`
- Name (subagent_type): `{Agent Name}`
- Capabilities and triggers
- Ready to use: "route a task to {Agent Name}" to test

## Validation Checklist

- `name` is Title Case with spaces
- `id` is lowercase with hyphens
- At least 2 relevant capabilities
- At least 3 specific trigger keywords
- `description` explains when to use the agent
- `model` is set
- Body has clear, actionable instructions
- File saved in `.claude/agents/project/`

## Additional Resources

- [references/agent-template.md](references/agent-template.md) — Full agent file template with all sections
