/**
 * Orchestrator - Central coordinator for multi-agent task execution
 *
 * This is the main entry point for the orchestration system.
 * It coordinates:
 * - Task submission and lifecycle
 * - Agent discovery and dispatch
 * - Retry and escalation handling
 * - Progress tracking and reporting
 * - Success rate monitoring (95% threshold)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentRegistry } from './AgentRegistry.js';
import { TaskDispatcher } from './TaskDispatcher.js';
import { RetryManager } from './RetryManager.js';

export class Orchestrator extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // Success rate threshold (default 95%)
            successThreshold: config.successThreshold || 0.95,
            // Dashboard webhook URL for notifications
            dashboardUrl: config.dashboardUrl || null,
            // Max concurrent tasks
            maxConcurrentTasks: config.maxConcurrentTasks || 10,
            // Agent discovery paths
            discoveryPaths: config.discoveryPaths || ['./agents'],
            // Retry configuration
            retry: {
                maxRetries: 3,
                backoffStrategy: 'exponential',
                initialDelayMs: 1000,
                ...(config.retry || {})
            },
            ...config
        };

        // Initialize components
        this.registry = new AgentRegistry({
            discoveryPaths: this.config.discoveryPaths,
            watchForChanges: this.config.watchForChanges
        });

        this.dispatcher = new TaskDispatcher(this.registry, {
            maxTasksPerAgent: config.maxTasksPerAgent || 3
        });

        this.retryManager = new RetryManager(this.config.retry);

        // Task tracking
        this.tasks = new Map();
        this.taskHistory = [];

        // Agent instances (for JS agents)
        this.agentInstances = new Map();

        // Runtime state
        this.isRunning = false;
        this.startTime = null;

        // Wire up events
        this.setupEventHandlers();
    }

    /**
     * Set up internal event handlers
     */
    setupEventHandlers() {
        // Registry events
        this.registry.on('agentRegistered', (data) => {
            this.emit('agent:registered', data);
            this.notifyDashboard('agent_registered', data);
        });

        // Retry manager events
        this.retryManager.on('taskEscalated', (escalation) => {
            this.emit('task:escalated', escalation);
            this.notifyDashboard('escalation', escalation);
        });

        this.retryManager.on('escalationResolved', (data) => {
            this.emit('escalation:resolved', data);
            this.handleEscalationResolution(data);
        });
    }

    /**
     * Initialize and start the orchestrator
     */
    async start() {
        if (this.isRunning) return;

        console.log('Starting Agent Orchestrator...');

        // Initialize registry and discover agents
        await this.registry.initialize();

        // Instantiate JS agents
        await this.instantiateAgents();

        this.isRunning = true;
        this.startTime = new Date();

        const stats = this.registry.getStats();
        console.log(`Orchestrator started with ${stats.totalAgents} agents`);

        this.emit('started', {
            timestamp: this.startTime,
            agents: stats.totalAgents
        });

        return this;
    }

    /**
     * Stop the orchestrator
     */
    async stop() {
        this.isRunning = false;

        // Stop all agent instances
        for (const agent of this.agentInstances.values()) {
            if (agent.stop) {
                await agent.stop();
            }
        }

        this.emit('stopped', { timestamp: new Date() });
    }

    /**
     * Instantiate JavaScript agent classes
     */
    async instantiateAgents() {
        for (const agentData of this.registry.getAllAgents()) {
            if (agentData.type === 'javascript' && agentData.AgentClass) {
                try {
                    const instance = new agentData.AgentClass(agentData);
                    instance.setOrchestrator(this);
                    this.agentInstances.set(agentData.id, instance);
                } catch (error) {
                    console.warn(`Failed to instantiate agent ${agentData.id}: ${error.message}`);
                }
            }
        }
    }

    /**
     * Submit a task for execution
     *
     * @param {Object} taskInput - Task definition
     * @param {string} taskInput.type - Task type
     * @param {string} taskInput.title - Human-readable title
     * @param {string} taskInput.description - Detailed description
     * @param {Object} taskInput.input - Input data for the agent
     * @param {string[]} taskInput.capabilities - Required capabilities
     * @param {string} taskInput.preferredAgent - Optional preferred agent ID
     *
     * @returns {Promise<TaskHandle>} Handle to track and control the task
     */
    async submitTask(taskInput) {
        if (!this.isRunning) {
            throw new Error('Orchestrator is not running. Call start() first.');
        }

        // Create task object
        const task = {
            id: taskInput.id || uuidv4(),
            type: taskInput.type,
            title: taskInput.title || taskInput.type,
            description: taskInput.description,
            input: taskInput.input || {},
            capabilities: taskInput.capabilities || [],
            preferredAgent: taskInput.preferredAgent,
            priority: taskInput.priority || 'medium',
            status: 'pending',
            progress: 0,
            createdAt: new Date().toISOString(),
            startedAt: null,
            completedAt: null,
            result: null,
            agentId: null,
            retryCount: 0,
            metadata: taskInput.metadata || {}
        };

        // Store task
        this.tasks.set(task.id, task);

        this.emit('task:submitted', { taskId: task.id, task });
        this.notifyDashboard('task_submitted', task);

        // Start execution
        this.executeTask(task);

        // Return handle
        return {
            taskId: task.id,
            getStatus: () => this.getTaskStatus(task.id),
            getResult: () => this.getTaskResult(task.id),
            cancel: () => this.cancelTask(task.id),
            waitForCompletion: () => this.waitForTask(task.id)
        };
    }

    /**
     * Execute a task (internal)
     */
    async executeTask(task) {
        task.status = 'dispatching';
        task.startedAt = new Date().toISOString();

        // Dispatch to best agent
        const dispatch = await this.dispatcher.dispatch(task);

        if (dispatch.status === 'no_agent_available') {
            // No agent available - wait and retry or escalate
            task.status = 'waiting';
            this.emit('task:waiting', { taskId: task.id, reason: dispatch.reason });

            // Schedule retry after delay
            setTimeout(() => this.executeTask(task), 5000);
            return;
        }

        // Agent assigned
        task.status = 'running';
        task.agentId = dispatch.agentId;

        this.emit('task:started', {
            taskId: task.id,
            agentId: dispatch.agentId
        });
        this.notifyDashboard('task_started', {
            taskId: task.id,
            agentId: dispatch.agentId,
            agentName: dispatch.agentName
        });

        // Execute on agent
        try {
            const result = await this.runOnAgent(task, dispatch.agentId);
            await this.handleTaskResult(task, result);
        } catch (error) {
            await this.handleTaskResult(task, {
                status: 'failure',
                output: {},
                error: {
                    code: 'EXECUTION_ERROR',
                    message: error.message,
                    recoverable: true
                }
            });
        }
    }

    /**
     * Run task on a specific agent
     */
    async runOnAgent(task, agentId) {
        const agentInstance = this.agentInstances.get(agentId);
        const agentData = this.registry.getAgent(agentId);

        if (agentInstance) {
            // JavaScript agent - call directly
            agentInstance.onProgress((progress) => {
                task.progress = progress.percent;
                this.emit('task:progress', { taskId: task.id, ...progress });
                this.notifyDashboard('task_progress', { taskId: task.id, ...progress });
            });

            return await agentInstance.executeTask(task);
        } else if (agentData?.type === 'markdown') {
            // Markdown agent - would integrate with Claude Code
            // For now, return a placeholder that indicates this needs Claude Code integration
            return {
                status: 'blocked',
                output: {},
                error: {
                    code: 'MARKDOWN_AGENT',
                    message: `Agent ${agentId} is a markdown agent requiring Claude Code integration`,
                    recoverable: false,
                    suggestedAction: 'Use JavaScript agent or integrate Claude Code runtime'
                }
            };
        } else {
            return {
                status: 'failure',
                output: {},
                error: {
                    code: 'AGENT_NOT_FOUND',
                    message: `Agent ${agentId} not found or not instantiated`,
                    recoverable: false
                }
            };
        }
    }

    /**
     * Handle task execution result
     */
    async handleTaskResult(task, result) {
        // Free agent capacity
        this.dispatcher.taskCompleted(task.agentId);

        // Update registry metrics
        this.registry.updateAgentMetrics(task.agentId, result);

        if (result.status === 'success') {
            // Task succeeded
            task.status = 'completed';
            task.completedAt = new Date().toISOString();
            task.result = result;
            task.progress = 100;

            // Clear retry state
            this.retryManager.clearRetryState(task.id);

            this.emit('task:completed', { taskId: task.id, result });
            this.notifyDashboard('task_completed', {
                taskId: task.id,
                status: 'success',
                result: result.output
            });

            // Move to history
            this.moveToHistory(task);

        } else if (result.status === 'blocked' && result.delegationRequest) {
            // Agent needs help from another agent
            await this.handleDelegation(task, result.delegationRequest);

        } else {
            // Task failed - handle retry/escalation
            task.retryCount++;
            const decision = await this.retryManager.handleFailure(task, result, task.agentId);

            if (decision.action === 'retry') {
                // Wait and retry
                task.status = 'retrying';
                this.emit('task:retrying', {
                    taskId: task.id,
                    attemptNumber: decision.attemptNumber,
                    delay: decision.delayMs
                });
                this.notifyDashboard('task_retrying', {
                    taskId: task.id,
                    attemptNumber: decision.attemptNumber
                });

                // Clear preferred agent if switching
                if (decision.switchAgent) {
                    task.preferredAgent = null;
                    // Exclude failed agents
                    task.excludeAgents = decision.excludeAgents;
                }

                setTimeout(() => this.executeTask(task), decision.delayMs);

            } else if (decision.action === 'escalate') {
                // Escalate to user
                task.status = 'escalated';
                task.escalationId = decision.escalationId;

                this.emit('task:escalated', {
                    taskId: task.id,
                    escalation: decision.escalation
                });
            }
        }
    }

    /**
     * Handle agent delegation request
     */
    async handleDelegation(parentTask, delegationRequest) {
        // Create sub-task for the delegation
        const subTask = {
            id: uuidv4(),
            type: delegationRequest.capability,
            title: `Delegation: ${delegationRequest.reason}`,
            description: delegationRequest.reason,
            input: delegationRequest.input,
            capabilities: [delegationRequest.capability],
            parentTaskId: parentTask.id,
            priority: parentTask.priority
        };

        this.emit('task:delegated', {
            parentTaskId: parentTask.id,
            subTaskId: subTask.id,
            capability: delegationRequest.capability
        });

        // Submit sub-task
        const handle = await this.submitTask(subTask);

        // Wait for sub-task to complete
        const subResult = await handle.waitForCompletion();

        // Resume parent task with sub-task result
        parentTask.input.delegationResult = subResult;
        await this.executeTask(parentTask);
    }

    /**
     * Handle escalation resolution from user
     */
    async handleEscalationResolution(data) {
        const task = this.tasks.get(data.taskId);
        if (!task) return;

        if (data.resolution.action === 'retry') {
            task.status = 'pending';
            if (data.resolution.modifiedTask) {
                Object.assign(task, data.resolution.modifiedTask);
            }
            await this.executeTask(task);

        } else if (data.resolution.action === 'assign_different_agent') {
            task.status = 'pending';
            task.preferredAgent = data.resolution.preferredAgent;
            task.excludeAgents = [];
            await this.executeTask(task);

        } else if (data.resolution.action === 'cancel') {
            task.status = 'cancelled';
            task.completedAt = new Date().toISOString();
            this.emit('task:cancelled', { taskId: task.id });
            this.moveToHistory(task);
        }
    }

    /**
     * Get task status
     */
    getTaskStatus(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            // Check history
            const historical = this.taskHistory.find(t => t.id === taskId);
            if (historical) {
                return { found: true, task: historical, historical: true };
            }
            return { found: false };
        }

        return {
            found: true,
            task: {
                id: task.id,
                status: task.status,
                progress: task.progress,
                agentId: task.agentId,
                retryCount: task.retryCount,
                createdAt: task.createdAt,
                startedAt: task.startedAt
            }
        };
    }

    /**
     * Get task result (waits if not complete)
     */
    async getTaskResult(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            const historical = this.taskHistory.find(t => t.id === taskId);
            if (historical) {
                return historical.result;
            }
            throw new Error(`Task ${taskId} not found`);
        }

        if (task.status === 'completed' || task.status === 'cancelled') {
            return task.result;
        }

        // Wait for completion
        return this.waitForTask(taskId);
    }

    /**
     * Wait for a task to complete
     */
    waitForTask(taskId) {
        return new Promise((resolve, reject) => {
            const checkStatus = () => {
                const task = this.tasks.get(taskId);
                if (!task) {
                    const historical = this.taskHistory.find(t => t.id === taskId);
                    if (historical) {
                        resolve(historical.result);
                        return;
                    }
                    reject(new Error(`Task ${taskId} not found`));
                    return;
                }

                if (task.status === 'completed') {
                    resolve(task.result);
                } else if (task.status === 'cancelled' || task.status === 'escalated') {
                    resolve({ status: task.status, output: {} });
                } else {
                    // Check again after delay
                    setTimeout(checkStatus, 500);
                }
            };

            checkStatus();
        });
    }

    /**
     * Cancel a task
     */
    async cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        if (task.status === 'completed' || task.status === 'cancelled') {
            return { success: false, reason: 'Task already finished' };
        }

        task.status = 'cancelled';
        task.completedAt = new Date().toISOString();

        this.emit('task:cancelled', { taskId });
        this.notifyDashboard('task_cancelled', { taskId });

        this.moveToHistory(task);

        return { success: true };
    }

    /**
     * Move completed task to history
     */
    moveToHistory(task) {
        this.taskHistory.push({ ...task });
        this.tasks.delete(task.id);

        // Keep history limited
        if (this.taskHistory.length > 100) {
            this.taskHistory = this.taskHistory.slice(-100);
        }
    }

    /**
     * Get all active tasks
     */
    getActiveTasks() {
        return Array.from(this.tasks.values());
    }

    /**
     * Get task history
     */
    getTaskHistory(limit = 50) {
        return this.taskHistory.slice(-limit).reverse();
    }

    /**
     * Get pending escalations
     */
    getPendingEscalations() {
        return this.retryManager.getPendingEscalations();
    }

    /**
     * Resolve an escalation
     */
    async resolveEscalation(escalationId, resolution) {
        return this.retryManager.resolveEscalation(escalationId, resolution);
    }

    /**
     * Notify dashboard via webhook
     */
    async notifyDashboard(eventType, data) {
        if (!this.config.dashboardUrl) return;

        try {
            await fetch(`${this.config.dashboardUrl}/api/events/ingest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Event-Type': eventType
                },
                body: JSON.stringify({
                    type: eventType,
                    data,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            // Silently fail dashboard notifications
            console.warn(`Dashboard notification failed: ${error.message}`);
        }
    }

    /**
     * Get orchestrator statistics
     */
    getStats() {
        const registryStats = this.registry.getStats();
        const dispatcherStats = this.dispatcher.getStats();
        const retryStats = this.retryManager.getStats();

        const activeTasks = Array.from(this.tasks.values());
        const completedTasks = this.taskHistory.filter(t => t.status === 'completed');
        const failedTasks = this.taskHistory.filter(t => t.status === 'failed' || t.status === 'cancelled');

        const successRate = completedTasks.length + failedTasks.length > 0
            ? completedTasks.length / (completedTasks.length + failedTasks.length)
            : 0;

        return {
            isRunning: this.isRunning,
            uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
            agents: registryStats,
            tasks: {
                active: activeTasks.length,
                completed: completedTasks.length,
                failed: failedTasks.length,
                total: this.taskHistory.length + activeTasks.length,
                successRate,
                meetsThreshold: successRate >= this.config.successThreshold
            },
            dispatcher: dispatcherStats,
            retry: retryStats
        };
    }
}

export default Orchestrator;
