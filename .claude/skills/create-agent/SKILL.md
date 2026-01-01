# Create Agent Skill

Use this skill when the user wants to create a new agent for the orchestration framework. This skill ensures agents are properly configured with all required fields and follow the correct patterns.

## Invocation

User says things like:
- "Create an agent for [purpose]"
- "Make a new agent that [does something]"
- "I need an agent to handle [task type]"
- "/create-agent [name]"

## Agent Creation Process

### Step 1: Gather Requirements

Ask the user these questions (use AskUserQuestion tool):

1. **Agent Name**: What should this agent be called?
   - Format: lowercase with hyphens (e.g., `nfc-handler`, `dashboard-builder`)

2. **Purpose**: What does this agent do?
   - This becomes the description

3. **Capabilities**: What task types can this agent handle?
   - Examples: `code-review`, `testing`, `api-design`, `database`, `frontend`, `backend`, `security`, `documentation`
   - These are used for routing tasks to this agent

4. **Trigger Words**: What words/phrases should route to this agent?
   - Examples: `nfc`, `mobile`, `dashboard`, `chart`

5. **Agent Type**: JavaScript or Markdown?
   - **Markdown**: Simple, just instructions for Claude (recommended for most)
   - **JavaScript**: Full code agent with custom logic (for complex processing)

### Step 2: Determine Location

Check if this is for:
- **Framework built-in**: `./agents/{agent-name}/`
- **Project-specific**: `.claude/agents/project/{agent-name}.md`

Ask if unclear.

### Step 3: Create the Agent

#### For Markdown Agents

Create `.claude/agents/project/{agent-name}.md` with this structure:

```markdown
---
id: {agent-name}
name: {Agent Name}
version: 1.0.0
description: |
  {Clear description of when to use this agent}
  Use this agent when: {trigger conditions}
capabilities:
  - {capability-1}
  - {capability-2}
triggers:
  - {trigger-1}
  - {trigger-2}
model: sonnet
input:
  required:
    - {primary-input}
  optional:
    - context
output:
  successCriteria:
    - {what defines success}
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

## Task Execution

When executing tasks:

### 1. Understand the Request
- Analyze the input
- Identify key requirements
- Plan the approach

### 2. Execute
{Step-by-step instructions for the agent}

### 3. Validate
- Ensure output meets requirements
- Check for errors
- Verify quality

## Output Format

Always return results in this structure:
- status: success | failure | partial
- output: The actual result
- confidence: 0.0-1.0
- recommendations: Any follow-up actions

## Error Handling

If you encounter issues:
1. Report the error clearly
2. Suggest solutions
3. Request help if needed (delegation)

## Examples

### Example 1: {Scenario}
**Input:** {description}
**Output:** {expected result}
```

#### For JavaScript Agents

Create directory `./agents/{agent-name}/` with:

**manifest.json:**
```json
{
    "id": "{agent-name}",
    "name": "{Agent Name}",
    "version": "1.0.0",
    "description": "{description}",
    "capabilities": ["{cap-1}", "{cap-2}"],
    "triggers": ["{trigger-1}", "{trigger-2}"],
    "model": "sonnet",
    "input": {
        "required": ["{input}"],
        "optional": ["context"]
    },
    "output": {
        "successCriteria": ["{criteria}"]
    },
    "resources": {
        "maxConcurrentTasks": 3,
        "timeoutSeconds": 300
    }
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
        const { {input} } = task.input;

        this.reportProgress({ percent: 10, message: 'Starting...', stage: 'init' });

        try {
            // Implementation here
            this.reportProgress({ percent: 50, message: 'Processing...', stage: 'process' });

            const result = {
                // Output
            };

            this.reportProgress({ percent: 100, message: 'Complete', stage: 'complete' });

            return {
                status: 'success',
                output: result,
                confidence: 0.9
            };

        } catch (error) {
            return {
                status: 'failure',
                output: {},
                error: {
                    code: 'AGENT_ERROR',
                    message: error.message,
                    recoverable: true
                }
            };
        }
    }
}

export default {AgentClassName}Agent;
```

### Step 4: Validate the Agent

After creating, verify:
- [ ] Frontmatter/manifest has all required fields (id, name, description, capabilities)
- [ ] Capabilities are relevant to the agent's purpose
- [ ] Triggers are unique and specific
- [ ] Instructions are clear and actionable
- [ ] Output format is defined
- [ ] Error handling is included

### Step 5: Confirm Registration

Tell the user:
1. Agent created at: `{path}`
2. Capabilities: `{list}`
3. Triggers: `{list}`
4. The agent will auto-register when the orchestrator runs

## Validation Checklist

Before finishing, ensure:

1. **ID Format**: lowercase, hyphenated, no spaces
2. **Capabilities**: At least 1, ideally 2-4 relevant ones
3. **Triggers**: Specific keywords that route to this agent
4. **Description**: Clear "use when" statement
5. **Model**: Usually `sonnet`, use `opus` only for complex reasoning
6. **Instructions**: Step-by-step, actionable guidance

## Common Mistakes to Avoid

1. ❌ Generic capabilities like "general" - be specific
2. ❌ Overlapping triggers with existing agents
3. ❌ Missing successCriteria - how do we know it worked?
4. ❌ Vague instructions - agents need concrete steps
5. ❌ No error handling section

## Example Conversation

**User:** Create an agent to handle NFC tag operations

**Assistant:** I'll help you create an NFC agent. Let me ask a few questions:

[Uses AskUserQuestion to gather:
- Name: nfc-handler
- Capabilities: nfc, mobile, hardware-integration
- Triggers: nfc, tag, scan, tap
- Type: Markdown]

Then creates the agent file with proper structure.
