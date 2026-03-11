#!/bin/bash
# One-liner installer for Agent Orchestrator
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/zanijr/claudesubagents/main/scripts/get.sh | bash
#   wget -qO- https://raw.githubusercontent.com/zanijr/claudesubagents/main/scripts/get.sh | bash
#
# Works on: Linux, macOS, WSL

set -e

REPO_URL="https://github.com/zanijr/claudesubagents.git"
INSTALL_DIR="$HOME/.claude/orchestrator"
SKILLS_DIR="$HOME/.claude/skills"
BIN_DIR="$HOME/.local/bin"

# Colors (safe for all terminals)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' CYAN='' BOLD='' NC=''
fi

info()    { echo -e "${CYAN}>${NC} $1"; }
success() { echo -e "${GREEN}+${NC} $1"; }
warn()    { echo -e "${YELLOW}!${NC} $1"; }
error()   { echo -e "${RED}x${NC} $1"; exit 1; }

echo ""
echo -e "${BOLD}${CYAN}Agent Orchestrator — Quick Install${NC}"
echo "──────────────────────────────────────"
echo ""

# Check git
command -v git >/dev/null 2>&1 || error "git is required. Install it first."

# Check if already installed
if [ -d "$INSTALL_DIR/.git" ]; then
    warn "Already installed at $INSTALL_DIR"
    info "Updating instead..."
    cd "$INSTALL_DIR"
    # Ensure we're on main
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    if [ "$current_branch" != "main" ]; then
        git checkout main 2>/dev/null
    fi
    git fetch origin main
    # Try fast-forward, fall back to reset if diverged
    if ! git pull --ff-only origin main 2>/dev/null; then
        warn "Local branch diverged. Resetting to origin/main..."
        git reset --hard origin/main
    fi
    success "Updated to latest!"
else
    info "Cloning repository..."
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR" 2>&1 | grep -v "^$"
    success "Cloned to $INSTALL_DIR"
fi

echo ""

# Link skills
mkdir -p "$SKILLS_DIR"

for skill in orchestrator create-agent; do
    target="$INSTALL_DIR/.claude/skills/$skill"
    link="$SKILLS_DIR/$skill"

    if [ -L "$link" ] || [ -e "$link" ]; then
        rm -rf "$link"
    fi

    ln -s "$target" "$link"
    success "Linked skill: $skill"
done

# Install CLI command
mkdir -p "$BIN_DIR"
chmod +x "$INSTALL_DIR/scripts/marketplace.sh"
ln -sf "$INSTALL_DIR/scripts/marketplace.sh" "$BIN_DIR/claude-market"
success "Installed command: claude-market"

# Save version
version=$(grep -o '"version": *"[^"]*"' "$INSTALL_DIR/.claude-plugin/plugin.json" | head -1 | grep -o '"[^"]*"$' | tr -d '"')
echo "$version" > "$HOME/.claude/.orchestrator-version"

echo ""

# Check if BIN_DIR is in PATH
if ! echo "$PATH" | tr ':' '\n' | grep -q "^$BIN_DIR$"; then
    warn "$BIN_DIR is not in your PATH"
    echo ""

    # Detect shell
    user_shell=$(basename "${SHELL:-/bin/bash}")
    case "$user_shell" in
        zsh)  rc_file="$HOME/.zshrc" ;;
        bash)
            if [ -f "$HOME/.bash_profile" ]; then
                rc_file="$HOME/.bash_profile"
            else
                rc_file="$HOME/.bashrc"
            fi
            ;;
        fish) rc_file="$HOME/.config/fish/config.fish" ;;
        *)    rc_file="$HOME/.profile" ;;
    esac

    info "Add this to $rc_file:"
    echo ""
    if [ "$user_shell" = "fish" ]; then
        echo -e "  ${CYAN}set -gx PATH \$HOME/.local/bin \$PATH${NC}"
    else
        echo -e "  ${CYAN}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
    fi
    echo ""
    info "Then restart your terminal, or run:"
    echo -e "  ${CYAN}source $rc_file${NC}"
    echo ""
fi

echo -e "${BOLD}Done!${NC} You can now:"
echo ""
echo -e "  ${CYAN}claude-market list${NC}      — See available packages"
echo -e "  ${CYAN}claude-market status${NC}    — Check installation"
echo -e "  ${CYAN}claude-market setup${NC}     — Set up a project (cd into it first)"
echo -e "  ${CYAN}claude-market update${NC}    — Update to latest"
echo ""
echo -e "Or just open Claude Code and say: ${CYAN}/orchestrator build me a ...${NC}"
echo ""
