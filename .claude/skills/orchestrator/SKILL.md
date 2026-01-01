# Orchestrator Skill

Use this skill to interact with the multi-agent orchestration framework. This skill provides commands for routing tasks, checking status, and managing agents.

## Invocation

User says things like:
- "/orchestrator [command]"
- "Route this task to an agent"
- "What agents are available?"
- "Check task status"

## Available Commands

### /orchestrator:route [task description]

Route a task to the best available agent based on capabilities.

**Process:**
1. Analyze the task description to identify required capabilities
2. Check available agents in the registry
3. Score agents based on capability match
4. Dispatch to the best available agent
5. Report the assignment and begin tracking

**Example:**
```
User: /orchestrator:route Review this code for security issues

Response: Task routed to security-scanner agent
- Capabilities matched: security, vulnerability-scan
- Match score: 85
- Task ID: abc123
- Status: Running
```

### /orchestrator:list

List all registered agents and their status.

**Output format:**
```
Available Agents (3):

1. code-analyzer [available]
   Capabilities: code-review, static-analysis, metrics
   Triggers: analyze, review, quality

2. security-scanner [available]
   Capabilities: security, vulnerability-scan, secrets-detection
   Triggers: security, audit, scan

3. task-validator [busy]
   Capabilities: validation, completion-check
   Triggers: validate, verify, done
   Current task: xyz789
```

### /orchestrator:status [task-id]

Check the status of a specific task or all active tasks.

**Without task-id:** Shows all active tasks
**With task-id:** Shows detailed status of that task

**Output format:**
```
Task: abc123
Status: running
Progress: 65%
Agent: security-scanner
Started: 2 minutes ago
Current stage: vulnerability-scan
```

### /orchestrator:escalations

Show pending escalations that need user decisions.

**Output format:**
```
Pending Escalations (1):

[HIGH] Task: code-review-456
Agent: code-analyzer
Failed after 3 attempts
Last error: Timeout exceeded

Options:
1. Retry - Try again with same agent
2. Reassign - Try a different agent
3. Cancel - Abandon this task

Respond with: /orchestrator:resolve 456 [option]
```

### /orchestrator:resolve [escalation-id] [action]

Resolve a pending escalation.

**Actions:**
- `retry` - Retry with same agent
- `reassign` - Try different agent
- `cancel` - Cancel the task

**Example:**
```
User: /orchestrator:resolve 456 retry

Response: Escalation resolved. Task requeued for retry.
```

### /orchestrator:stats

Show orchestrator statistics and success rate.

**Output format:**
```
Orchestrator Statistics
=======================
Uptime: 4 hours 23 minutes

Tasks:
- Active: 3
- Completed: 47
- Failed: 2
- Success Rate: 95.9% ✓ (meets 95% threshold)

Agents:
- Total: 6
- Available: 4
- Busy: 2

Escalations:
- Pending: 1
- Resolved today: 3
```

## Task Routing Logic

When routing a task, the skill:

1. **Analyzes the task** to extract:
   - Task type (from explicit type or inferred from description)
   - Required capabilities
   - Keywords that match agent triggers

2. **Scores each agent** based on:
   - Capability matches (30 points each)
   - Trigger keyword matches (15 points each)
   - Historical success rate (up to 20 points)
   - Current availability (+10 if available, -10 if busy)

3. **Selects the best agent**:
   - Highest score wins
   - Must meet minimum score threshold (10)
   - Must be available (not at max concurrent tasks)

4. **Handles failures**:
   - Automatic retry up to 3 times
   - Exponential backoff between retries
   - Switch to different agent after 1 failure with same agent
   - Escalate to user after max retries

## Creating New Agents

To create a new agent, use the `/create-agent` skill:

```
/create-agent nfc-handler
```

This will guide you through:
1. Defining capabilities and triggers
2. Writing agent instructions
3. Proper file placement
4. Validation

## Integration with Dashboard

The orchestrator sends events to the web dashboard:
- Task submitted/started/completed/failed
- Progress updates
- Escalations
- Agent status changes

Dashboard URL is configured in `orchestrator.config.json`:
```json
{
  "dashboard": {
    "url": "https://agents.bananas4life.com"
  }
}
```

## Troubleshooting

### "No agent available"
- Check that agents are registered: `/orchestrator:list`
- Verify capabilities match task requirements
- Check if all agents are busy

### Task keeps failing
- Check the error messages in escalations
- Try with a different agent: `/orchestrator:resolve [id] reassign`
- Modify the task to be more specific

### Agent not appearing
- Verify manifest.json/frontmatter is valid
- Check discovery paths in config
- Restart orchestrator to rediscover agents
