/**
 * RetryManager - Handles task failures, retries, and escalation
 *
 * Key behavior:
 * - Automatic retry up to maxRetries (default 3)
 * - Exponential backoff between retries
 * - Option to switch to different agent on retry
 * - Escalate to user after max retries exceeded
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export class RetryManager extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            maxRetries: config.maxRetries || 3,
            backoffStrategy: config.backoffStrategy || 'exponential',
            initialDelayMs: config.initialDelayMs || 1000,
            maxDelayMs: config.maxDelayMs || 30000,
            // Try different agent after this many failures
            switchAgentAfter: config.switchAgentAfter || 1,
            // Success rate threshold for task completion
            successThreshold: config.successThreshold || 0.95,
            ...config
        };

        // Track retry state per task
        this.retryState = new Map();

        // Escalation queue
        this.escalations = new Map();
    }

    /**
     * Handle a task failure and decide what to do next
     *
     * @param {Object} task - The failed task
     * @param {Object} result - The failure result from agent
     * @param {string} agentId - The agent that failed
     *
     * @returns {Object} Decision: { action, delayMs?, switchAgent?, escalation? }
     */
    async handleFailure(task, result, agentId) {
        const taskId = task.id;

        // Get or initialize retry state
        let state = this.retryState.get(taskId);
        if (!state) {
            state = {
                taskId,
                attempts: [],
                totalAttempts: 0,
                failedAgents: new Set()
            };
            this.retryState.set(taskId, state);
        }

        // Record this attempt
        state.attempts.push({
            attemptNumber: state.totalAttempts + 1,
            agentId,
            error: result.error,
            timestamp: new Date().toISOString()
        });
        state.totalAttempts++;
        state.failedAgents.add(agentId);

        this.emit('attemptFailed', {
            taskId,
            agentId,
            attemptNumber: state.totalAttempts,
            error: result.error
        });

        // Check if we should escalate
        if (state.totalAttempts >= this.config.maxRetries) {
            return this.createEscalation(task, state, result);
        }

        // Check if error is recoverable
        if (result.error?.recoverable === false) {
            return this.createEscalation(task, state, result);
        }

        // Calculate retry delay
        const delay = this.calculateDelay(state.totalAttempts);

        // Determine if we should switch agents
        const switchAgent = this.shouldSwitchAgent(state, agentId);

        const decision = {
            action: 'retry',
            taskId,
            attemptNumber: state.totalAttempts + 1,
            delayMs: delay,
            switchAgent,
            excludeAgents: switchAgent ? Array.from(state.failedAgents) : [],
            reason: result.error?.message || 'Task failed',
            timestamp: new Date().toISOString()
        };

        this.emit('retryScheduled', decision);

        return decision;
    }

    /**
     * Calculate delay before next retry
     */
    calculateDelay(attemptNumber) {
        let delay;

        switch (this.config.backoffStrategy) {
            case 'exponential':
                delay = this.config.initialDelayMs * Math.pow(2, attemptNumber - 1);
                break;
            case 'linear':
                delay = this.config.initialDelayMs * attemptNumber;
                break;
            case 'fixed':
                delay = this.config.initialDelayMs;
                break;
            default:
                delay = this.config.initialDelayMs;
        }

        return Math.min(delay, this.config.maxDelayMs);
    }

    /**
     * Determine if we should try a different agent
     */
    shouldSwitchAgent(state, currentAgentId) {
        // Switch after configured number of failures with same agent
        const failuresWithCurrent = state.attempts
            .filter(a => a.agentId === currentAgentId)
            .length;

        return failuresWithCurrent >= this.config.switchAgentAfter;
    }

    /**
     * Create an escalation for user intervention
     */
    createEscalation(task, state, result) {
        const escalationId = uuidv4();

        const escalation = {
            id: escalationId,
            taskId: task.id,
            task: {
                id: task.id,
                type: task.type,
                title: task.title || task.description?.substring(0, 100),
                description: task.description
            },
            status: 'pending',
            priority: this.calculatePriority(task, state),
            reason: `Task failed after ${state.totalAttempts} attempts`,
            message: this.buildEscalationMessage(task, state, result),
            failureHistory: state.attempts,
            agentsTried: Array.from(state.failedAgents),
            lastError: result.error,
            options: ['retry', 'assign_different_agent', 'modify_task', 'cancel'],
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            resolution: null
        };

        this.escalations.set(escalationId, escalation);

        this.emit('taskEscalated', escalation);

        return {
            action: 'escalate',
            taskId: task.id,
            escalationId,
            escalation,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Build a human-readable escalation message
     */
    buildEscalationMessage(task, state, result) {
        const agentList = Array.from(state.failedAgents).join(', ');
        const lastError = result.error?.message || 'Unknown error';

        return `Task "${task.title || task.type}" failed after ${state.totalAttempts} attempts.

Agents tried: ${agentList}

Last error: ${lastError}

${result.error?.suggestedAction ? `Suggested action: ${result.error.suggestedAction}` : ''}

Please choose how to proceed:
- Retry: Try again with the same or different agent
- Modify: Change the task parameters and retry
- Cancel: Abandon this task`;
    }

    /**
     * Calculate escalation priority
     */
    calculatePriority(task, state) {
        // Higher priority for more attempts, urgent tasks
        if (task.priority === 'urgent' || task.priority === 'high') {
            return 'high';
        }
        if (state.totalAttempts >= this.config.maxRetries) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Resolve an escalation with user decision
     */
    async resolveEscalation(escalationId, resolution) {
        const escalation = this.escalations.get(escalationId);
        if (!escalation) {
            throw new Error(`Escalation ${escalationId} not found`);
        }

        escalation.status = 'resolved';
        escalation.resolvedAt = new Date().toISOString();
        escalation.resolution = resolution;

        this.emit('escalationResolved', {
            escalationId,
            taskId: escalation.taskId,
            resolution
        });

        // Clear retry state if retrying
        if (resolution.action === 'retry' || resolution.action === 'assign_different_agent') {
            // Reset retry count but keep history
            const state = this.retryState.get(escalation.taskId);
            if (state) {
                state.totalAttempts = 0;
                if (resolution.action === 'assign_different_agent') {
                    // Clear failed agents to allow fresh start
                    state.failedAgents.clear();
                }
            }
        }

        return {
            action: resolution.action,
            taskId: escalation.taskId,
            escalationId,
            modifiedTask: resolution.modifiedTask,
            preferredAgent: resolution.preferredAgent,
            userComment: resolution.comment
        };
    }

    /**
     * Get pending escalations
     */
    getPendingEscalations() {
        return Array.from(this.escalations.values())
            .filter(e => e.status === 'pending')
            .sort((a, b) => {
                // Sort by priority then by date
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (pDiff !== 0) return pDiff;
                return new Date(a.createdAt) - new Date(b.createdAt);
            });
    }

    /**
     * Get escalation by ID
     */
    getEscalation(escalationId) {
        return this.escalations.get(escalationId);
    }

    /**
     * Get retry state for a task
     */
    getRetryState(taskId) {
        return this.retryState.get(taskId);
    }

    /**
     * Clear retry state for a completed task
     */
    clearRetryState(taskId) {
        this.retryState.delete(taskId);
    }

    /**
     * Get statistics
     */
    getStats() {
        const escalations = Array.from(this.escalations.values());

        return {
            pendingEscalations: escalations.filter(e => e.status === 'pending').length,
            resolvedEscalations: escalations.filter(e => e.status === 'resolved').length,
            totalEscalations: escalations.length,
            tasksBeingRetried: this.retryState.size,
            avgRetryAttempts: this.calculateAvgRetries()
        };
    }

    /**
     * Calculate average retry attempts across all tasks
     */
    calculateAvgRetries() {
        const states = Array.from(this.retryState.values());
        if (states.length === 0) return 0;

        const totalAttempts = states.reduce((sum, s) => sum + s.totalAttempts, 0);
        return totalAttempts / states.length;
    }
}

export default RetryManager;
