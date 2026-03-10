#!/bin/bash
# save-lessons.sh
# Stop hook — ensures memory directory and files exist for next session
# The actual lesson writing is done by the orchestrator in Phase 6,
# this hook just ensures the infrastructure is ready and prunes if needed

MEMORY_DIR=".claude/memory"
LESSONS_FILE="$MEMORY_DIR/lessons-learned.md"
FAILURE_LOG="$MEMORY_DIR/failure-log.md"

# Ensure memory directory exists
mkdir -p "$MEMORY_DIR"

# Initialize lessons file if needed
if [ ! -f "$LESSONS_FILE" ]; then
  cat > "$LESSONS_FILE" << 'HEADER'
# Lessons Learned

Persistent knowledge from orchestrator runs. Consulted at the start of every task.
HEADER
fi

# Initialize failure log if needed
if [ ! -f "$FAILURE_LOG" ]; then
  cat > "$FAILURE_LOG" << 'HEADER'
# Failure Log

Raw failure records for pattern detection. Auto-pruned to last 100 entries.
HEADER
fi

# Prune lessons-learned to 200 entries max
LESSON_COUNT=$(grep -c '^## \[' "$LESSONS_FILE" 2>/dev/null || echo "0")
if [ "$LESSON_COUNT" -gt 200 ]; then
  HEADER_LINES=$(head -4 "$LESSONS_FILE")
  # Find the start line of the 200th-from-last entry
  KEEP_FROM=$(grep -n '^## \[' "$LESSONS_FILE" | tail -200 | head -1 | cut -d: -f1)
  if [ -n "$KEEP_FROM" ]; then
    {
      echo "$HEADER_LINES"
      tail -n +"$KEEP_FROM" "$LESSONS_FILE"
    } > "${LESSONS_FILE}.tmp"
    mv "${LESSONS_FILE}.tmp" "$LESSONS_FILE"
  fi
fi

# Prune failure log to 100 entries max
FAILURE_COUNT=$(grep -c '^## \[' "$FAILURE_LOG" 2>/dev/null || echo "0")
if [ "$FAILURE_COUNT" -gt 100 ]; then
  HEADER_LINES=$(head -4 "$FAILURE_LOG")
  KEEP_FROM=$(grep -n '^## \[' "$FAILURE_LOG" | tail -100 | head -1 | cut -d: -f1)
  if [ -n "$KEEP_FROM" ]; then
    {
      echo "$HEADER_LINES"
      tail -n +"$KEEP_FROM" "$FAILURE_LOG"
    } > "${FAILURE_LOG}.tmp"
    mv "${FAILURE_LOG}.tmp" "$FAILURE_LOG"
  fi
fi
