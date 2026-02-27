---
name: create-agent
description: Create a new AI agent for the orchestration framework. Use when creating agents, adding new agents, making a new agent to handle specific tasks.
---

# Create Agent

Create a new agent as a `.md` file in `.claude/agents/project/`. The agent will be immediately available for dispatch via the Task tool.

## When This Skill Activates

- User says "create an agent for X"
- User says "make a new agent"
- User says "I need an agent to handle X"

## Agent Creation Process

### Step 1: Gather Requirements

Ask the user these questions using the AskUserQuestion tool:

1. **Agent Name**: What should this agent be called?
   - Format: Title Case with spaces (e.g., "Database Management Agent", "NFC Handler Agent")
   - This becomes the `name` field in frontmatter and the `subagent_type` for the Task tool

2. **Purpose**: What does this agent specialize in? What problems does it solve?

3. **Capabilities**: What task types can this agent handle?
   - Examples: `code-review`, `testing`, `api-design`, `database`, `frontend`, `security`
   - These are used for routing - be specific

4. **Trigger Words**: What words should route tasks to this agent?
   - Examples: `nfc`, `mobile`, `dashboard`, `chart`, `database`, `sql`
   - These are matched against user task descriptions

5. **Model**: Which model should power this agent?
   - `sonnet` - Good for most tasks (recommended)
   - `opus` - For complex reasoning and architecture
   - `haiku` - For simple, fast tasks

### Step 2: Create the Agent File

Generate a `.md` file at `.claude/agents/project/{agent-id}.md` where `{agent-id}` is the name lowercased with hyphens (e.g., "Database Management Agent" becomes `database-management.md`).

Use this structure:

```markdown
---
id: {agent-id}
name: {Agent Name}
version: 1.0.0
description: |
  {Clear description of when to use this agent and what it specializes in.
  Written so the orchestrator can match tasks to this agent.}
capabilities:
  - {capability-1}
  - {capability-2}
triggers:
  - {trigger-1}
  - {trigger-2}
model: {model}
---

# {Agent Name}

You are an expert {role} specializing in {domain}.

## Core Competencies

- {Key skill 1}
- {Key skill 2}
- {Key skill 3}

## When to Use This Agent

This agent should be invoked when:
1. {Condition 1}
2. {Condition 2}

## Task Execution Process

When executing tasks, follow these steps:

### 1. Analysis Phase
- Understand the task requirements
- Identify key inputs and constraints

### 2. Execution Phase
- {Domain-specific steps}

### 3. Validation Phase
- Verify output meets requirements
- Check for errors or issues
```

Fill in all placeholders with content specific to the agent's purpose. The body of the file (below the frontmatter) becomes the agent's system instructions when dispatched via the Task tool.

### Step 3: Validate

After creating the file:

1. Read it back to confirm frontmatter parses correctly (valid YAML between `---` delimiters)
2. Verify the `name` field matches an available `subagent_type` in the Task tool
3. Confirm the file is in the correct directory: `.claude/agents/project/`

Tell the user:
- Agent created at: `.claude/agents/project/{agent-id}.md`
- Name (subagent_type): `{Agent Name}`
- Capabilities: `{list}`
- Triggers: `{list}`
- Model: `{model}`
- Ready to use: say "route a task to {Agent Name}" to test it

## Validation Checklist

Before finishing, ensure:
- [ ] `name` field is Title Case with spaces (this is the subagent_type)
- [ ] `id` field is lowercase with hyphens
- [ ] At least 2 relevant capabilities listed
- [ ] At least 3 specific trigger keywords
- [ ] `description` clearly explains when to use the agent
- [ ] `model` is set (sonnet, opus, or haiku)
- [ ] Body has clear, actionable instructions for the agent
- [ ] File is saved in `.claude/agents/project/`
