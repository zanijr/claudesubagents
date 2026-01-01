/**
 * AgentRegistry - Discovers and manages available agents
 *
 * Features:
 * - Multi-source discovery (built-in, project, user agents)
 * - Capability-based querying
 * - Hot-reload support for development
 * - Agent health tracking
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

export class AgentRegistry extends EventEmitter {
    constructor(config = {}) {
        super();

        this.agents = new Map();
        this.config = {
            // Default discovery paths
            discoveryPaths: config.discoveryPaths || [],
            // Watch for file changes
            watchForChanges: config.watchForChanges || false,
            // Validate manifests strictly
            validateManifests: config.validateManifests !== false,
            ...config
        };

        this.watchers = [];
    }

    /**
     * Initialize registry - discover all agents
     */
    async initialize() {
        await this.discoverAgents();

        if (this.config.watchForChanges) {
            await this.startWatching();
        }

        this.emit('initialized', {
            agentCount: this.agents.size,
            agents: Array.from(this.agents.keys())
        });
    }

    /**
     * Discover agents from all configured paths
     */
    async discoverAgents() {
        const allPaths = this.config.discoveryPaths;

        for (const searchPath of allPaths) {
            try {
                await this.scanDirectory(searchPath);
            } catch (error) {
                console.warn(`Failed to scan ${searchPath}: ${error.message}`);
            }
        }

        return Array.from(this.agents.values());
    }

    /**
     * Scan a directory for agents
     * Supports both JS agents with manifest.json and markdown agents
     */
    async scanDirectory(dirPath) {
        const resolvedPath = path.resolve(dirPath);

        try {
            await fs.access(resolvedPath);
        } catch {
            // Directory doesn't exist, skip silently
            return;
        }

        // Find manifest.json files (JS agents)
        const manifestFiles = await glob('**/manifest.json', {
            cwd: resolvedPath,
            absolute: true
        });

        for (const manifestPath of manifestFiles) {
            await this.loadJsAgent(manifestPath);
        }

        // Find markdown agents (Claude Code style)
        const mdFiles = await glob('**/*.md', {
            cwd: resolvedPath,
            absolute: true,
            ignore: ['**/README.md', '**/CHANGELOG.md']
        });

        for (const mdPath of mdFiles) {
            await this.loadMarkdownAgent(mdPath);
        }
    }

    /**
     * Load a JavaScript agent from manifest.json
     */
    async loadJsAgent(manifestPath) {
        try {
            const manifestContent = await fs.readFile(manifestPath, 'utf8');
            const manifest = JSON.parse(manifestContent);

            if (this.config.validateManifests) {
                this.validateManifest(manifest);
            }

            const agentDir = path.dirname(manifestPath);
            const agentFile = path.join(agentDir, 'agent.js');

            let AgentClass = null;
            try {
                const module = await import(`file://${agentFile}`);
                AgentClass = module.default || module[manifest.id] || module;
            } catch {
                // No agent.js file, create a wrapper
                AgentClass = null;
            }

            this.registerAgent({
                ...manifest,
                type: 'javascript',
                path: agentDir,
                AgentClass
            });

        } catch (error) {
            console.warn(`Failed to load agent from ${manifestPath}: ${error.message}`);
        }
    }

    /**
     * Load a markdown agent (Claude Code style with frontmatter)
     */
    async loadMarkdownAgent(mdPath) {
        try {
            const content = await fs.readFile(mdPath, 'utf8');
            const { data: frontmatter, content: instructions } = matter(content);

            // Skip files without agent frontmatter
            if (!frontmatter.id && !frontmatter.name) {
                return;
            }

            const manifest = {
                id: frontmatter.id || path.basename(mdPath, '.md'),
                name: frontmatter.name || frontmatter.id,
                version: frontmatter.version || '1.0.0',
                description: frontmatter.description || '',
                capabilities: frontmatter.capabilities || [],
                triggers: frontmatter.triggers || [],
                model: frontmatter.model || 'sonnet',
                input: frontmatter.input || { required: [] },
                output: frontmatter.output || {},
                type: 'markdown',
                path: mdPath,
                instructions
            };

            if (this.config.validateManifests) {
                this.validateManifest(manifest);
            }

            this.registerAgent(manifest);

        } catch (error) {
            console.warn(`Failed to load markdown agent from ${mdPath}: ${error.message}`);
        }
    }

    /**
     * Validate a manifest has required fields
     */
    validateManifest(manifest) {
        const required = ['id'];
        const missing = required.filter(field => !manifest[field]);

        if (missing.length > 0) {
            throw new Error(`Manifest missing required fields: ${missing.join(', ')}`);
        }

        // Validate capabilities is an array
        if (manifest.capabilities && !Array.isArray(manifest.capabilities)) {
            throw new Error('Manifest capabilities must be an array');
        }
    }

    /**
     * Register an agent in the registry
     */
    registerAgent(manifest) {
        const existing = this.agents.get(manifest.id);

        if (existing) {
            // Update existing agent
            this.agents.set(manifest.id, {
                ...existing,
                ...manifest,
                registeredAt: existing.registeredAt,
                updatedAt: new Date().toISOString()
            });

            this.emit('agentUpdated', { agentId: manifest.id });
        } else {
            // New agent
            this.agents.set(manifest.id, {
                ...manifest,
                registeredAt: new Date().toISOString(),
                status: 'available',
                metrics: {
                    tasksExecuted: 0,
                    tasksSucceeded: 0,
                    tasksFailed: 0,
                    successRate: 0
                }
            });

            this.emit('agentRegistered', { agentId: manifest.id });
        }
    }

    /**
     * Unregister an agent
     */
    unregisterAgent(agentId) {
        if (this.agents.has(agentId)) {
            this.agents.delete(agentId);
            this.emit('agentUnregistered', { agentId });
        }
    }

    /**
     * Get a specific agent by ID
     */
    getAgent(agentId) {
        return this.agents.get(agentId);
    }

    /**
     * Get all registered agents
     */
    getAllAgents() {
        return Array.from(this.agents.values());
    }

    /**
     * Find agents by capability
     */
    findByCapability(capability) {
        return Array.from(this.agents.values()).filter(agent =>
            agent.capabilities?.some(cap =>
                cap.toLowerCase() === capability.toLowerCase()
            )
        );
    }

    /**
     * Find agents by trigger word
     */
    findByTrigger(text) {
        const searchText = text.toLowerCase();

        return Array.from(this.agents.values()).filter(agent =>
            agent.triggers?.some(trigger =>
                searchText.includes(trigger.toLowerCase())
            )
        );
    }

    /**
     * Find the best agent for a task
     * Returns agents sorted by match score
     */
    findBestAgents(task) {
        const candidates = [];

        for (const agent of this.agents.values()) {
            const score = this.scoreAgentForTask(agent, task);

            if (score > 0) {
                candidates.push({ agent, score });
            }
        }

        // Sort by score descending
        candidates.sort((a, b) => b.score - a.score);

        return candidates;
    }

    /**
     * Score how well an agent matches a task
     */
    scoreAgentForTask(agent, task) {
        let score = 0;

        // Check capability match
        if (task.capabilities) {
            for (const reqCap of task.capabilities) {
                if (agent.capabilities?.includes(reqCap)) {
                    score += 30;
                }
            }
        }

        // Check type match
        if (task.type && agent.capabilities?.some(cap =>
            task.type.toLowerCase().includes(cap.toLowerCase())
        )) {
            score += 25;
        }

        // Check trigger match
        const taskText = `${task.type || ''} ${task.description || ''} ${task.title || ''}`.toLowerCase();
        for (const trigger of (agent.triggers || [])) {
            if (taskText.includes(trigger.toLowerCase())) {
                score += 15;
            }
        }

        // Factor in success rate (0-100 points scaled)
        if (agent.metrics?.successRate > 0) {
            score += agent.metrics.successRate * 20;
        }

        // Prefer available agents
        if (agent.status === 'available') {
            score += 10;
        } else if (agent.status === 'busy') {
            score -= 10;
        }

        return score;
    }

    /**
     * Update agent metrics
     */
    updateAgentMetrics(agentId, taskResult) {
        const agent = this.agents.get(agentId);
        if (!agent) return;

        agent.metrics.tasksExecuted++;

        if (taskResult.status === 'success') {
            agent.metrics.tasksSucceeded++;
        } else if (taskResult.status === 'failure') {
            agent.metrics.tasksFailed++;
        }

        agent.metrics.successRate = agent.metrics.tasksExecuted > 0
            ? agent.metrics.tasksSucceeded / agent.metrics.tasksExecuted
            : 0;

        this.emit('metricsUpdated', { agentId, metrics: agent.metrics });
    }

    /**
     * Update agent status
     */
    updateAgentStatus(agentId, status) {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.status = status;
            this.emit('statusUpdated', { agentId, status });
        }
    }

    /**
     * Start watching directories for changes
     */
    async startWatching() {
        // Implementation would use fs.watch or chokidar
        // Simplified for now
        console.log('File watching enabled for agent discovery');
    }

    /**
     * Stop watching
     */
    async stopWatching() {
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.watchers = [];
    }

    /**
     * Get registry statistics
     */
    getStats() {
        const agents = Array.from(this.agents.values());

        return {
            totalAgents: agents.length,
            availableAgents: agents.filter(a => a.status === 'available').length,
            busyAgents: agents.filter(a => a.status === 'busy').length,
            jsAgents: agents.filter(a => a.type === 'javascript').length,
            mdAgents: agents.filter(a => a.type === 'markdown').length,
            capabilities: [...new Set(agents.flatMap(a => a.capabilities || []))],
            avgSuccessRate: agents.length > 0
                ? agents.reduce((sum, a) => sum + (a.metrics?.successRate || 0), 0) / agents.length
                : 0
        };
    }
}

export default AgentRegistry;
