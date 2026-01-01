/**
 * BaseAgent - The contract all agents must implement
 *
 * Every agent in the orchestration system extends this class.
 * This ensures consistent behavior for:
 * - Task execution
 * - Progress reporting
 * - Error handling
 * - Inter-agent communication
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export class BaseAgent extends EventEmitter {
    constructor(manifest) {
        super();

        // Validate manifest
        if (!manifest || !manifest.id) {
            throw new Error('Agent manifest with id is required');
        }

        this.id = manifest.id;
        this.name = manifest.name || manifest.id;
        this.version = manifest.version || '1.0.0';
        this.description = manifest.description || '';
        this.capabilities = manifest.capabilities || [];
        this.triggers = manifest.triggers || [];
        this.model = manifest.model || 'sonnet';
        this.input = manifest.input || { required: [] };
        this.output = manifest.output || {};

        // Runtime state
        this.status = 'idle'; // idle, running, blocked, error
        this.currentTask = null;
        this.progressCallback = null;
        this.orchestrator = null;

        // Metrics
        this.metrics = {
            tasksExecuted: 0,
            tasksSucceeded: 0,
            tasksFailed: 0,
            totalDurationMs: 0,
            lastExecutionAt: null
        };
    }

    /**
     * Set the orchestrator reference for communication
     */
    setOrchestrator(orchestrator) {
        this.orchestrator = orchestrator;
    }

    /**
     * Register a progress callback
     * The orchestrator calls this to receive progress updates
     */
    onProgress(callback) {
        this.progressCallback = callback;
    }

    /**
     * Report progress to the orchestrator
     * @param {Object} progress - { percent: 0-100, message: string, stage?: string }
     */
    reportProgress(progress) {
        const update = {
            agentId: this.id,
            taskId: this.currentTask?.id,
            percent: progress.percent || 0,
            message: progress.message || 'Working...',
            stage: progress.stage,
            timestamp: new Date().toISOString()
        };

        this.emit('progress', update);

        if (this.progressCallback) {
            this.progressCallback(update);
        }
    }

    /**
     * Execute a task - MUST be implemented by subclasses
     *
     * @param {Object} task - The task to execute
     * @param {string} task.id - Unique task identifier
     * @param {string} task.type - Task type
     * @param {Object} task.input - Task input data
     * @param {Object} task.context - Execution context
     *
     * @returns {Promise<AgentResult>} The execution result
     *
     * AgentResult shape:
     * {
     *   status: 'success' | 'failure' | 'partial' | 'blocked',
     *   output: { ... },
     *   confidence?: number (0-1),
     *   error?: { code, message, recoverable, suggestedAction },
     *   delegationRequest?: { capability, input, reason }
     * }
     */
    async execute(task) {
        throw new Error(`Agent ${this.id} must implement execute() method`);
    }

    /**
     * Internal wrapper that handles metrics and state
     */
    async executeTask(task) {
        const startTime = Date.now();
        this.status = 'running';
        this.currentTask = task;

        try {
            this.reportProgress({ percent: 0, message: 'Starting task...', stage: 'init' });

            const result = await this.execute(task);

            // Update metrics
            this.metrics.tasksExecuted++;
            this.metrics.totalDurationMs += Date.now() - startTime;
            this.metrics.lastExecutionAt = new Date().toISOString();

            if (result.status === 'success') {
                this.metrics.tasksSucceeded++;
            } else if (result.status === 'failure') {
                this.metrics.tasksFailed++;
            }

            this.status = 'idle';
            this.currentTask = null;

            return {
                ...result,
                metrics: {
                    durationMs: Date.now() - startTime,
                    agentId: this.id
                }
            };

        } catch (error) {
            this.metrics.tasksExecuted++;
            this.metrics.tasksFailed++;
            this.metrics.totalDurationMs += Date.now() - startTime;

            this.status = 'error';
            this.currentTask = null;

            return {
                status: 'failure',
                output: {},
                error: {
                    code: 'EXECUTION_ERROR',
                    message: error.message,
                    recoverable: true,
                    stack: error.stack
                },
                metrics: {
                    durationMs: Date.now() - startTime,
                    agentId: this.id
                }
            };
        }
    }

    /**
     * Check if this agent can handle a given task
     * Override in subclasses for custom matching logic
     */
    canHandle(task) {
        // Check if task type matches any capability
        if (this.capabilities.some(cap =>
            task.type?.toLowerCase().includes(cap.toLowerCase())
        )) {
            return true;
        }

        // Check if task matches any trigger words
        const taskText = `${task.type} ${task.description || ''}`.toLowerCase();
        if (this.triggers.some(trigger =>
            taskText.includes(trigger.toLowerCase())
        )) {
            return true;
        }

        return false;
    }

    /**
     * Get agent capabilities for registry
     */
    getCapabilities() {
        return {
            id: this.id,
            name: this.name,
            version: this.version,
            description: this.description,
            capabilities: this.capabilities,
            triggers: this.triggers,
            model: this.model,
            status: this.status,
            metrics: this.getMetrics()
        };
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        const successRate = this.metrics.tasksExecuted > 0
            ? this.metrics.tasksSucceeded / this.metrics.tasksExecuted
            : 0;

        return {
            ...this.metrics,
            successRate,
            avgDurationMs: this.metrics.tasksExecuted > 0
                ? this.metrics.totalDurationMs / this.metrics.tasksExecuted
                : 0
        };
    }

    /**
     * Request help from another agent via orchestrator
     * Returns a delegation request that the orchestrator will handle
     */
    requestHelp(capability, input, reason) {
        return {
            delegationRequest: {
                capability,
                input,
                reason,
                requestingAgent: this.id
            }
        };
    }

    /**
     * Health check
     */
    healthCheck() {
        return {
            agentId: this.id,
            status: this.status,
            healthy: this.status !== 'error',
            currentTask: this.currentTask?.id || null,
            timestamp: new Date().toISOString()
        };
    }
}

export default BaseAgent;
