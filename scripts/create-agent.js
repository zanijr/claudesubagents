#!/usr/bin/env node

/**
 * Create a new agent from template
 *
 * Usage: node create-agent.js <agent-name> [--js]
 *
 * Options:
 *   --js    Create a JavaScript agent (with agent.js and manifest.json)
 *           Default is markdown agent
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

async function createAgent(name, options = {}) {
    if (!name) {
        console.error('Usage: create-agent <agent-name> [--js]');
        process.exit(1);
    }

    // Normalize agent name
    const agentId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const agentName = name.split('-').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');

    console.log(`\\n🤖 Creating agent: ${agentName} (${agentId})\\n`);

    const projectPath = process.cwd();
    const agentDir = path.join(projectPath, '.claude', 'agents', 'project');

    try {
        // Ensure directory exists
        await fs.mkdir(agentDir, { recursive: true });

        if (options.js) {
            // Create JavaScript agent
            await createJsAgent(agentDir, agentId, agentName);
        } else {
            // Create markdown agent
            await createMdAgent(agentDir, agentId, agentName);
        }

        console.log('\\n✅ Agent created successfully!\\n');
        console.log('Next steps:');
        console.log(`  1. Edit the agent file to customize behavior`);
        console.log(`  2. The agent will auto-register on next orchestrator run\\n`);

    } catch (error) {
        console.error('\\n❌ Failed to create agent:', error.message);
        process.exit(1);
    }
}

async function createMdAgent(agentDir, agentId, agentName) {
    const templatePath = path.join(TEMPLATES_DIR, 'new-agent.md');
    const template = await fs.readFile(templatePath, 'utf8');

    // Replace placeholders
    const content = template
        .replace(/my-custom-agent/g, agentId)
        .replace(/My Custom Agent/g, agentName);

    const outputPath = path.join(agentDir, `${agentId}.md`);

    if (await fileExists(outputPath)) {
        console.error(`Agent already exists: ${outputPath}`);
        process.exit(1);
    }

    await fs.writeFile(outputPath, content);
    console.log(`Created: .claude/agents/project/${agentId}.md`);
}

async function createJsAgent(agentDir, agentId, agentName) {
    const agentFolder = path.join(agentDir, agentId);
    await fs.mkdir(agentFolder, { recursive: true });

    // Create manifest.json
    const manifest = {
        id: agentId,
        name: agentName,
        version: '1.0.0',
        description: `${agentName} - A custom agent`,
        capabilities: ['custom'],
        triggers: [agentId.split('-')[0]],
        model: 'sonnet',
        input: {
            required: ['input'],
            optional: ['context']
        },
        output: {
            successCriteria: ['Result provided']
        }
    };

    await fs.writeFile(
        path.join(agentFolder, 'manifest.json'),
        JSON.stringify(manifest, null, 4)
    );
    console.log(`Created: .claude/agents/project/${agentId}/manifest.json`);

    // Create agent.js
    const agentJs = `/**
 * ${agentName}
 *
 * A custom JavaScript agent.
 */

import { BaseAgent } from '../../../.claude/orchestrator/core/BaseAgent.js';

export class ${agentId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Agent extends BaseAgent {
    constructor(manifest) {
        super(manifest || require('./manifest.json'));
    }

    async execute(task) {
        const { input, context } = task.input;

        this.reportProgress({ percent: 10, message: 'Starting...', stage: 'init' });

        try {
            // TODO: Implement your agent logic here
            this.reportProgress({ percent: 50, message: 'Processing...', stage: 'process' });

            const result = {
                // Your output here
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

export default ${agentId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Agent;
`;

    await fs.writeFile(path.join(agentFolder, 'agent.js'), agentJs);
    console.log(`Created: .claude/agents/project/${agentId}/agent.js`);
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Parse arguments
const args = process.argv.slice(2);
const name = args.find(a => !a.startsWith('--'));
const isJs = args.includes('--js');

createAgent(name, { js: isJs });
