/**
 * TaskDispatcher - Routes tasks to appropriate agents
 *
 * Features:
 * - Capability-based routing
 * - Agent scoring and selection
 * - Load balancing
 * - Fallback agent selection
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export class TaskDispatcher extends EventEmitter {
    constructor(registry, config = {}) {
        super();

        this.registry = registry;
        this.config = {
            // Allow task to specify preferred agent
            allowPreferredAgent: true,
            // Maximum tasks per agent
            maxTasksPerAgent: config.maxTasksPerAgent || 3,
            // Minimum score required to dispatch
            minMatchScore: config.minMatchScore || 10,
            ...config
        };

        // Track active tasks per agent
        this.agentTaskCounts = new Map();
    }

    /**
     * Analyze task and determine required capabilities
     */
    analyzeTask(task) {
        const analysis = {
            taskId: task.id || uuidv4(),
            type: task.type,
            requiredCapabilities: [],
            suggestedCapabilities: [],
            complexity: 'medium',
            estimatedDurationMs: 60000
        };

        // Extract capabilities from task type
        if (task.type) {
            analysis.requiredCapabilities.push(task.type);
        }

        // Extract from explicit capabilities
        if (task.capabilities) {
            analysis.requiredCapabilities.push(...task.capabilities);
        }

        // Analyze task description for capabilities
        if (task.description) {
            const text = task.description.toLowerCase();

            const capabilityKeywords = {
                'code-review': ['review', 'check', 'analyze code'],
                'security': ['security', 'vulnerability', 'auth', 'password'],
                'testing': ['test', 'spec', 'unit test', 'integration'],
                'documentation': ['document', 'readme', 'docs'],
                'refactoring': ['refactor', 'clean up', 'improve'],
                'debugging': ['debug', 'fix', 'bug', 'error'],
                'frontend': ['ui', 'component', 'react', 'css', 'html'],
                'backend': ['api', 'server', 'database', 'endpoint'],
                'devops': ['deploy', 'ci', 'docker', 'kubernetes']
            };

            for (const [capability, keywords] of Object.entries(capabilityKeywords)) {
                if (keywords.some(kw => text.includes(kw))) {
                    if (!analysis.requiredCapabilities.includes(capability)) {
                        analysis.suggestedCapabilities.push(capability);
                    }
                }
            }
        }

        // Estimate complexity
        if (task.complexity) {
            analysis.complexity = task.complexity;
        } else if (analysis.requiredCapabilities.length > 2) {
            analysis.complexity = 'high';
        } else if (analysis.requiredCapabilities.length === 0) {
            analysis.complexity = 'low';
        }

        return analysis;
    }

    /**
     * Dispatch a task to the best available agent
     */
    async dispatch(task) {
        const analysis = this.analyzeTask(task);

        // If task specifies a preferred agent, try that first
        if (this.config.allowPreferredAgent && task.preferredAgent) {
            const preferred = this.registry.getAgent(task.preferredAgent);
            if (preferred && this.isAgentAvailable(preferred.id)) {
                return this.assignToAgent(task, preferred, analysis, 'preferred');
            }
        }

        // Find best matching agents
        const taskWithCaps = {
            ...task,
            capabilities: [
                ...analysis.requiredCapabilities,
                ...analysis.suggestedCapabilities
            ]
        };

        const candidates = this.registry.findBestAgents(taskWithCaps);

        // Filter to available agents with minimum score
        const available = candidates.filter(({ agent, score }) =>
            this.isAgentAvailable(agent.id) && score >= this.config.minMatchScore
        );

        if (available.length === 0) {
            // No available agents
            return {
                status: 'no_agent_available',
                taskId: task.id,
                analysis,
                reason: candidates.length === 0
                    ? 'No agents match required capabilities'
                    : 'All matching agents are busy'
            };
        }

        // Select the best available agent
        const { agent: selectedAgent, score } = available[0];

        return this.assignToAgent(task, selectedAgent, analysis, 'best_match', score);
    }

    /**
     * Assign task to a specific agent
     */
    assignToAgent(task, agent, analysis, reason, score = 0) {
        // Update task count
        const currentCount = this.agentTaskCounts.get(agent.id) || 0;
        this.agentTaskCounts.set(agent.id, currentCount + 1);

        // Update agent status
        if (currentCount + 1 >= this.config.maxTasksPerAgent) {
            this.registry.updateAgentStatus(agent.id, 'busy');
        }

        const dispatch = {
            status: 'dispatched',
            taskId: task.id || analysis.taskId,
            agentId: agent.id,
            agentName: agent.name,
            analysis,
            selectionReason: reason,
            matchScore: score,
            timestamp: new Date().toISOString()
        };

        this.emit('taskDispatched', dispatch);

        return dispatch;
    }

    /**
     * Check if an agent is available for more tasks
     */
    isAgentAvailable(agentId) {
        const agent = this.registry.getAgent(agentId);
        if (!agent) return false;

        if (agent.status === 'offline' || agent.status === 'error') {
            return false;
        }

        const taskCount = this.agentTaskCounts.get(agentId) || 0;
        return taskCount < this.config.maxTasksPerAgent;
    }

    /**
     * Mark a task as completed (frees agent capacity)
     */
    taskCompleted(agentId) {
        const currentCount = this.agentTaskCounts.get(agentId) || 0;
        if (currentCount > 0) {
            this.agentTaskCounts.set(agentId, currentCount - 1);

            // Update agent status if now available
            if (currentCount - 1 < this.config.maxTasksPerAgent) {
                this.registry.updateAgentStatus(agentId, 'available');
            }
        }
    }

    /**
     * Get dispatch statistics
     */
    getStats() {
        const taskCounts = Array.from(this.agentTaskCounts.entries());

        return {
            activeDispatches: taskCounts.reduce((sum, [, count]) => sum + count, 0),
            agentUtilization: taskCounts.map(([agentId, count]) => ({
                agentId,
                activeTasks: count,
                utilization: count / this.config.maxTasksPerAgent
            }))
        };
    }
}

export default TaskDispatcher;
