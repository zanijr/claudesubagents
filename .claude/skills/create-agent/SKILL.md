---
name: create-agent
description: Create a new AI agent for the orchestration framework. Use when creating agents, adding new agents, making a new agent to handle specific tasks.
---

# Create Agent

Use this skill to create a new agent for the orchestration framework. This ensures agents are properly configured with all required fields.

## When This Skill Activates

This skill should be used when the user:
- Wants to create a new agent
- Says "create an agent for X"
- Says "make a new agent"
- Says "I need an agent to handle X"

## Agent Creation Process

### Step 1: Gather Requirements

Ask the user these questions using the AskUserQuestion tool:

1. **Agent Name**: What should this agent be called?
   - Format: lowercase with hyphens (e.g., `nfc-handler`, `dashboard-builder`)

2. **Purpose**: What does this agent do?

3. **Capabilities**: What task types can this agent handle?
   - Examples: `code-review`, `testing`, `api-design`, `database`, `frontend`, `security`

4. **Trigger Words**: What words should route to this agent?
   - Examples: `nfc`, `mobile`, `dashboard`, `chart`

5. **Agent Type**: Markdown or JavaScript?
   - **Markdown**: Simple, just instructions (recommended for most)
   - **JavaScript**: Full code agent with custom logic

### Step 2: Create the Agent

#### For Markdown Agents

Create `.claude/agents/project/{agent-name}.md`:

```markdown
---
id: {agent-name}
name: {Agent Name}
version: 1.0.0
description: |
  {Clear description}
capabilities:
  - {capability-1}
  - {capability-2}
triggers:
  - {trigger-1}
  - {trigger-2}
model: sonnet
---

# {Agent Name}

You are an expert {role} specializing in {domain}.

## Core Competencies

- {Key skill 1}
- {Key skill 2}

## Task Execution

When executing tasks:

### 1. Understand the Request
- Analyze the input
- Identify key requirements

### 2. Execute
{Step-by-step instructions}

### 3. Validate
- Ensure output meets requirements
- Check for errors

## Output Format

Return results as:
- status: success | failure
- output: The result
- confidence: 0.0-1.0
```

#### For JavaScript Agents

Create directory `.claude/orchestrator/agents/{agent-name}/` with:

**manifest.json:**
```json
{
    "id": "{agent-name}",
    "name": "{Agent Name}",
    "version": "1.0.0",
    "description": "{description}",
    "capabilities": ["{cap-1}", "{cap-2}"],
    "triggers": ["{trigger-1}", "{trigger-2}"],
    "model": "sonnet"
}
```

**agent.js:**
```javascript
import { BaseAgent } from '../../core/BaseAgent.js';

export class {AgentClassName}Agent extends BaseAgent {
    constructor(manifest) {
        super(manifest || require('./manifest.json'));
    }

    async execute(task) {
        // Implementation here
        return {
            status: 'success',
            output: result,
            confidence: 0.9
        };
    }
}

export default {AgentClassName}Agent;
```

### Step 3: Confirm

Tell the user:
1. Agent created at: `{path}`
2. Capabilities: `{list}`
3. Triggers: `{list}`

## Validation Checklist

Before finishing, ensure:
- ID is lowercase with hyphens
- At least 1-2 relevant capabilities
- Specific trigger keywords
- Clear description
- Step-by-step instructions
