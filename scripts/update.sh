#!/bin/bash
# Update Agent Orchestrator to latest version
#
# Usage: bash ~/.claude/orchestrator/scripts/update.sh

set -e

ORCHESTRATOR_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Updating Agent Orchestrator..."
echo "  Location: $ORCHESTRATOR_DIR"
echo ""

cd "$ORCHESTRATOR_DIR"

# Check for local changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "  Warning: you have local modifications:"
    git diff --stat
    echo ""
    read -p "  Stash local changes and continue? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git stash
        STASHED=1
    else
        echo "  Aborted."
        exit 1
    fi
fi

# Fetch latest from remote
git fetch origin main

# Pull latest (try fast-forward first, fall back to reset if diverged)
BEFORE=$(git rev-parse HEAD)
if ! git pull --ff-only origin main 2>/dev/null; then
    echo "  Local branch diverged from remote. Resetting to origin/main..."
    git reset --hard origin/main
fi
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
    echo ""
    echo "Already up to date."
else
    echo ""
    echo "Updated! Changes:"
    git log --oneline "$BEFORE".."$AFTER"
fi

# Update version file so update checks report correctly
VERSION=$(grep -o '"version": *"[^"]*"' "$ORCHESTRATOR_DIR/.claude-plugin/plugin.json" 2>/dev/null | head -1 | grep -o '"[^"]*"$' | tr -d '"')
if [ -n "$VERSION" ]; then
    echo "$VERSION" > "$HOME/.claude/.orchestrator-version"
fi

# Restore stashed changes if any
if [ "${STASHED:-0}" = "1" ]; then
    echo ""
    echo "Restoring your local modifications..."
    git stash pop
fi

echo ""
echo "Done. v${VERSION:-unknown}"
