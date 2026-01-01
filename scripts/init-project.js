#!/usr/bin/env node

/**
 * Initialize Agent Orchestrator in a project
 *
 * Usage: node init-project.js [project-path]
 *
 * This script:
 * 1. Creates the .claude/agents/project directory
 * 2. Copies the config template to project root
 * 3. Appends orchestrator section to CLAUDE.md
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

async function initProject(projectPath = process.cwd()) {
    console.log('\\n🚀 Initializing Agent Orchestrator...\\n');

    const resolvedPath = path.resolve(projectPath);

    try {
        // 1. Create directory structure
        console.log('📁 Creating directory structure...');
        const dirsToCreate = [
            '.claude/agents/project',
            '.claude/workflows'
        ];

        for (const dir of dirsToCreate) {
            const fullPath = path.join(resolvedPath, dir);
            await fs.mkdir(fullPath, { recursive: true });
            console.log(`   Created: ${dir}/`);
        }

        // 2. Copy config template
        console.log('\\n📄 Creating configuration file...');
        const configSrc = path.join(TEMPLATES_DIR, 'orchestrator.config.json');
        const configDest = path.join(resolvedPath, 'orchestrator.config.json');

        if (!await fileExists(configDest)) {
            await fs.copyFile(configSrc, configDest);
            console.log('   Created: orchestrator.config.json');
        } else {
            console.log('   Skipped: orchestrator.config.json (already exists)');
        }

        // 3. Copy agent template
        console.log('\\n📝 Copying agent template...');
        const agentTemplateSrc = path.join(TEMPLATES_DIR, 'new-agent.md');
        const agentTemplateDest = path.join(resolvedPath, '.claude/agents/project', '_template.md');

        if (!await fileExists(agentTemplateDest)) {
            await fs.copyFile(agentTemplateSrc, agentTemplateDest);
            console.log('   Created: .claude/agents/project/_template.md');
        } else {
            console.log('   Skipped: _template.md (already exists)');
        }

        // 4. Update CLAUDE.md
        console.log('\\n📖 Updating CLAUDE.md...');
        const claudeMdPath = path.join(resolvedPath, 'CLAUDE.md');
        const templateContent = await fs.readFile(
            path.join(TEMPLATES_DIR, 'CLAUDE.md.template'),
            'utf8'
        );

        if (await fileExists(claudeMdPath)) {
            const existingContent = await fs.readFile(claudeMdPath, 'utf8');

            if (!existingContent.includes('## Multi-Agent Orchestration')) {
                await fs.appendFile(claudeMdPath, '\\n\\n' + templateContent);
                console.log('   Appended orchestrator section to CLAUDE.md');
            } else {
                console.log('   Skipped: CLAUDE.md already has orchestrator section');
            }
        } else {
            await fs.writeFile(claudeMdPath, templateContent);
            console.log('   Created: CLAUDE.md');
        }

        // 5. Print success message
        console.log('\\n✅ Agent Orchestrator initialized successfully!\\n');
        console.log('Next steps:');
        console.log('  1. Edit orchestrator.config.json to customize settings');
        console.log('  2. Create project agents in .claude/agents/project/');
        console.log('  3. Use /orchestrator:route to submit tasks\\n');

    } catch (error) {
        console.error('\\n❌ Initialization failed:', error.message);
        process.exit(1);
    }
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Run if called directly
const args = process.argv.slice(2);
initProject(args[0]);
