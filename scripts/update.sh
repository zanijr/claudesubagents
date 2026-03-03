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

# Pull latest
BEFORE=$(git rev-parse HEAD)
git pull --ff-only origin main
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
    echo ""
    echo "Already up to date."
else
    echo ""
    echo "Updated! Changes:"
    git log --oneline "$BEFORE".."$AFTER"
fi

# Restore stashed changes if any
if [ "${STASHED:-0}" = "1" ]; then
    echo ""
    echo "Restoring your local modifications..."
    git stash pop
fi

echo ""
echo "Done."
