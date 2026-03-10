#!/bin/bash
# capture-failure.sh
# PostToolUseFailure hook — captures failure context to failure-log.md
# Receives JSON on stdin with tool_name, tool_input, error details

MEMORY_DIR=".claude/memory"
FAILURE_LOG="$MEMORY_DIR/failure-log.md"

# Ensure memory directory exists
mkdir -p "$MEMORY_DIR"

# Initialize failure log if needed
if [ ! -f "$FAILURE_LOG" ]; then
  cat > "$FAILURE_LOG" << 'HEADER'
# Failure Log

Raw failure records for pattern detection. Auto-pruned to last 100 entries.
HEADER
fi

# Read hook input from stdin
INPUT=$(cat)

# Extract fields
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null || echo "unknown")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Append failure record
cat >> "$FAILURE_LOG" << EOF

## [$TIMESTAMP] FAILURE: $TOOL_NAME tool call
- **Tool**: $TOOL_NAME
- **Resolved**: no
EOF

# Prune to last 100 entries (keep header + last 100 ## blocks)
ENTRY_COUNT=$(grep -c '^## \[' "$FAILURE_LOG" 2>/dev/null)
ENTRY_COUNT=${ENTRY_COUNT:-0}
if [ "$ENTRY_COUNT" -gt 100 ]; then
  # Keep header (first 3 lines) + last 100 entries
  HEADER_LINES=$(head -4 "$FAILURE_LOG")
  ENTRIES=$(grep -n '^## \[' "$FAILURE_LOG" | tail -100 | head -1 | cut -d: -f1)
  if [ -n "$ENTRIES" ]; then
    {
      echo "$HEADER_LINES"
      tail -n +"$ENTRIES" "$FAILURE_LOG"
    } > "${FAILURE_LOG}.tmp"
    mv "${FAILURE_LOG}.tmp" "$FAILURE_LOG"
  fi
fi
