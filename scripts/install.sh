#!/bin/bash
# Install Agent Orchestrator for Claude Code
#
# Usage: bash install.sh
#
# This script:
# 1. Creates skill symlinks in ~/.claude/skills/
# 2. Creates .claude/agents/project/ in the current directory
# 3. Copies config and agent templates

set -e

ORCHESTRATOR_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
PROJECT_DIR="$(pwd)"

echo "Installing Agent Orchestrator..."
echo "  Source: $ORCHESTRATOR_DIR"
echo ""

# 1. Create skill symlinks
mkdir -p "$SKILLS_DIR"

if [ -L "$SKILLS_DIR/orchestrator" ] || [ -e "$SKILLS_DIR/orchestrator" ]; then
    echo "  Skill 'orchestrator' already exists, updating..."
    rm -f "$SKILLS_DIR/orchestrator"
fi
ln -s "$ORCHESTRATOR_DIR/.claude/skills/orchestrator" "$SKILLS_DIR/orchestrator"
echo "  Linked: ~/.claude/skills/orchestrator"

if [ -L "$SKILLS_DIR/create-agent" ] || [ -e "$SKILLS_DIR/create-agent" ]; then
    echo "  Skill 'create-agent' already exists, updating..."
    rm -f "$SKILLS_DIR/create-agent"
fi
ln -s "$ORCHESTRATOR_DIR/.claude/skills/create-agent" "$SKILLS_DIR/create-agent"
echo "  Linked: ~/.claude/skills/create-agent"

# 2. Create agent directory in current project
mkdir -p "$PROJECT_DIR/.claude/agents/project"
echo "  Created: .claude/agents/project/"

# 3. Copy templates if they don't exist
if [ ! -f "$PROJECT_DIR/.claude/agents/project/_template.md" ]; then
    cp "$ORCHESTRATOR_DIR/templates/new-agent.md" "$PROJECT_DIR/.claude/agents/project/_template.md"
    echo "  Copied: .claude/agents/project/_template.md"
fi

if [ ! -f "$PROJECT_DIR/orchestrator.config.json" ]; then
    cp "$ORCHESTRATOR_DIR/templates/orchestrator.config.json" "$PROJECT_DIR/orchestrator.config.json"
    echo "  Copied: orchestrator.config.json"
fi

echo ""
echo "Done! Say 'list available agents' in Claude Code to get started."
