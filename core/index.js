/**
 * Agent Orchestrator - Core Module Exports
 */

export { Orchestrator } from './Orchestrator.js';
export { BaseAgent } from './BaseAgent.js';
export { AgentRegistry } from './AgentRegistry.js';
export { TaskDispatcher } from './TaskDispatcher.js';
export { RetryManager } from './RetryManager.js';

// Convenience function to create and start orchestrator
export async function createOrchestrator(config = {}) {
    const { Orchestrator } = await import('./Orchestrator.js');
    const orchestrator = new Orchestrator(config);
    await orchestrator.start();
    return orchestrator;
}

export default { Orchestrator, BaseAgent, AgentRegistry, TaskDispatcher, RetryManager, createOrchestrator };
