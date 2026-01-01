# Agent Orchestrator

A portable multi-agent orchestration framework for AI-powered task execution. Drop it into any project to coordinate AI agents that work autonomously, validate each other's work, and escalate to you when needed.

## Features

- **Autonomous Execution**: Agents work independently on assigned tasks
- **Automatic Retry**: Failed tasks retry up to 3 times with exponential backoff
- **Smart Routing**: Tasks automatically dispatched to the best available agent
- **Validation**: Built-in task validator ensures work is actually complete
- **Escalation**: After max retries, tasks escalate to you for decision
- **Web Dashboard**: Real-time monitoring of agent progress and escalations
- **95% Success Threshold**: Ensures high-quality task completion

## Quick Start

### 1. Add to Your Project

```bash
# As a git submodule
git submodule add https://github.com/zanijr/claudesubagents.git .claude/orchestrator

# Initialize in your project
node .claude/orchestrator/scripts/init-project.js
```

### 2. Configure

Edit `orchestrator.config.json`:

```json
{
    "agents": {
        "enabled": ["code-analyzer", "task-validator", "security-scanner"],
        "projectSpecific": [".claude/agents/project/"]
    },
    "retry": {
        "maxRetries": 3
    },
    "successThreshold": 0.95
}
```

### 3. Use

```javascript
import { createOrchestrator } from './.claude/orchestrator/core/index.js';

const orchestrator = await createOrchestrator({
    discoveryPaths: [
        './.claude/orchestrator/agents',
        './.claude/agents/project'
    ]
});

const task = await orchestrator.submitTask({
    type: 'code-review',
    title: 'Review authentication module',
    description: 'Check for security issues in auth.js',
    input: { code: fs.readFileSync('auth.js', 'utf8') }
});

const result = await task.waitForCompletion();
console.log(result);
```

## Built-in Agents

| Agent | Capabilities | Description |
|-------|-------------|-------------|
| `code-analyzer` | code-review, static-analysis | Analyzes code quality, complexity, and patterns |
| `task-validator` | validation, completion-check | Validates task completions are real, not superficial |
| `security-scanner` | security, vulnerability-scan | Scans for vulnerabilities and exposed secrets |

## Creating Custom Agents

### Markdown Agent (Simple)

Create `.claude/agents/project/my-agent.md`:

```markdown
---
id: my-agent
name: My Custom Agent
description: Does something specific
capabilities: [my-capability]
triggers: [my-keyword]
model: sonnet
---

# Agent Instructions

You are an expert at [task].
...
```

### JavaScript Agent (Advanced)

```bash
node .claude/orchestrator/scripts/create-agent.js my-agent --js
```

This creates:
- `manifest.json` - Agent metadata and capabilities
- `agent.js` - Agent implementation extending `BaseAgent`

## Task Lifecycle

```
User submits task
        ↓
   Dispatching
   (find best agent)
        ↓
     Running
   (agent executes)
        ↓
   ┌─ Success ──→ Complete (95%+ confidence)
   │
   └─ Failure ──→ Retry (up to 3x)
                      ↓
               Still failing?
                      ↓
                 Escalate
               (notify user)
                      ↓
              User decision:
              - Retry
              - Modify task
              - Cancel
```

## Web Dashboard

Start the dashboard:

```bash
cd dashboard
npm install
npm run dev
```

Features:
- Active tasks with real-time progress
- Escalation queue with approve/reject
- Agent status monitoring
- Task history and analytics

## API Reference

### Orchestrator

```javascript
const orchestrator = new Orchestrator(config);
await orchestrator.start();

// Submit a task
const handle = await orchestrator.submitTask({
    type: 'code-review',
    input: { code: '...' }
});

// Get status
const status = handle.getStatus();

// Wait for completion
const result = await handle.waitForCompletion();

// Cancel
await handle.cancel();
```

### BaseAgent

```javascript
class MyAgent extends BaseAgent {
    async execute(task) {
        this.reportProgress({ percent: 50, message: 'Working...' });

        return {
            status: 'success',
            output: { result: '...' },
            confidence: 0.95
        };
    }
}
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `successThreshold` | 0.95 | Minimum success rate to mark complete |
| `retry.maxRetries` | 3 | Max retry attempts before escalation |
| `retry.backoffStrategy` | 'exponential' | linear, exponential, or fixed |
| `maxConcurrentTasks` | 10 | Max parallel tasks |
| `maxTasksPerAgent` | 3 | Max tasks per agent |

## License

MIT
