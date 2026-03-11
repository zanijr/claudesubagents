#!/bin/bash
# Agent Orchestrator Marketplace CLI
#
# Usage:
#   claude-market install          Install the full framework
#   claude-market update           Update to latest version
#   claude-market list             List available packages
#   claude-market info <package>   Show package details
#   claude-market status           Show installed status and check for updates
#   claude-market version          Show installed version
#   claude-market uninstall        Remove the framework

set -e

# Resolve paths
if [ -L "$0" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
else
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi
ORCHESTRATOR_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CATALOG="$ORCHESTRATOR_DIR/marketplace/catalog.json"
PLUGIN_JSON="$ORCHESTRATOR_DIR/.claude-plugin/plugin.json"
SKILLS_DIR="$HOME/.claude/skills"
VERSION_FILE="$HOME/.claude/.orchestrator-version"
REPO_URL="https://github.com/zanijr/claudesubagents.git"
INSTALL_DIR="$HOME/.claude/orchestrator"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BOLD}${CYAN}  Agent Orchestrator Marketplace${NC}"
    echo -e "  ─────────────────────────────────"
    echo ""
}

print_success() { echo -e "  ${GREEN}✓${NC} $1"; }
print_info()    { echo -e "  ${BLUE}→${NC} $1"; }
print_warn()    { echo -e "  ${YELLOW}!${NC} $1"; }
print_error()   { echo -e "  ${RED}✗${NC} $1"; }

get_installed_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE"
    else
        echo "not installed"
    fi
}

get_latest_version() {
    if [ -f "$PLUGIN_JSON" ]; then
        grep -o '"version": *"[^"]*"' "$PLUGIN_JSON" | head -1 | grep -o '"[^"]*"$' | tr -d '"'
    else
        echo "unknown"
    fi
}

get_remote_version() {
    local remote_version
    remote_version=$(git ls-remote --tags "$REPO_URL" 2>/dev/null | grep -o 'v[0-9]*\.[0-9]*\.[0-9]*' | sort -V | tail -1 | sed 's/^v//')
    if [ -z "$remote_version" ]; then
        # No tags, check remote HEAD
        echo "latest"
    else
        echo "$remote_version"
    fi
}

cmd_install() {
    print_header
    echo -e "  ${BOLD}Installing Agent Orchestrator...${NC}"
    echo ""

    # Check if already installed
    if [ -d "$INSTALL_DIR/.git" ]; then
        print_warn "Already installed at $INSTALL_DIR"
        print_info "Run 'claude-market update' to get the latest version"
        echo ""
        return 0
    fi

    # Clone the repo
    print_info "Cloning from $REPO_URL..."
    git clone "$REPO_URL" "$INSTALL_DIR" 2>&1 | sed 's/^/    /'
    echo ""

    # Create skill symlinks
    mkdir -p "$SKILLS_DIR"

    for skill in orchestrator create-agent; do
        if [ -L "$SKILLS_DIR/$skill" ] || [ -e "$SKILLS_DIR/$skill" ]; then
            rm -f "$SKILLS_DIR/$skill"
        fi
        ln -s "$INSTALL_DIR/.claude/skills/$skill" "$SKILLS_DIR/$skill"
        print_success "Linked skill: $skill"
    done

    # Save version
    local version
    version=$(get_latest_version)
    echo "$version" > "$VERSION_FILE"
    print_success "Installed version: $version"

    # Create marketplace command symlink
    if [ -d "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin"; then
        ln -sf "$INSTALL_DIR/scripts/marketplace.sh" "$HOME/.local/bin/claude-market"
        chmod +x "$HOME/.local/bin/claude-market"
        print_success "Command available: claude-market"
    fi

    echo ""
    print_info "To set up a project, cd into it and run:"
    echo -e "    ${CYAN}claude-market setup${NC}"
    echo ""
}

cmd_setup() {
    print_header
    echo -e "  ${BOLD}Setting up project...${NC}"
    echo ""

    local project_dir
    project_dir="$(pwd)"

    # Create agent directory
    mkdir -p "$project_dir/.claude/agents/project"
    print_success "Created .claude/agents/project/"

    # Create checkpoint directory
    mkdir -p "$project_dir/.claude/context/checkpoints"
    print_success "Created .claude/context/checkpoints/"

    # Copy templates
    if [ ! -f "$project_dir/.claude/agents/project/_template.md" ] && [ -f "$INSTALL_DIR/templates/new-agent.md" ]; then
        cp "$INSTALL_DIR/templates/new-agent.md" "$project_dir/.claude/agents/project/_template.md"
        print_success "Copied agent template"
    fi

    if [ ! -f "$project_dir/orchestrator.config.json" ] && [ -f "$INSTALL_DIR/templates/orchestrator.config.json" ]; then
        cp "$INSTALL_DIR/templates/orchestrator.config.json" "$project_dir/orchestrator.config.json"
        print_success "Copied config template"
    fi

    # Update .gitignore
    local gitignore="$project_dir/.gitignore"
    local entry=".claude/context/checkpoints/"
    if [ -f "$gitignore" ]; then
        if ! grep -qF "$entry" "$gitignore"; then
            echo "" >> "$gitignore"
            echo "# Agent orchestrator checkpoint files" >> "$gitignore"
            echo "$entry" >> "$gitignore"
            print_success "Updated .gitignore"
        fi
    else
        echo "# Agent orchestrator checkpoint files" > "$gitignore"
        echo "$entry" >> "$gitignore"
        print_success "Created .gitignore"
    fi

    echo ""
    print_info "Project ready! Say '/orchestrator <goal>' in Claude Code."
    echo ""
}

cmd_update() {
    print_header
    echo -e "  ${BOLD}Checking for updates...${NC}"
    echo ""

    local source_dir="$INSTALL_DIR"
    if [ ! -d "$source_dir/.git" ]; then
        # Dev mode: running from cloned repo directly
        source_dir="$ORCHESTRATOR_DIR"
    fi

    if [ ! -d "$source_dir/.git" ]; then
        print_error "Not installed. Run 'claude-market install' first."
        echo ""
        return 1
    fi

    local before after
    cd "$source_dir"

    # Stash local changes if any
    local stashed=0
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
        print_warn "Stashing local changes..."
        git stash 2>&1 | sed 's/^/    /'
        stashed=1
    fi

    # Ensure we're on main branch
    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    if [ "$current_branch" != "main" ]; then
        print_info "Switching to main branch..."
        git checkout main 2>&1 | sed 's/^/    /'
    fi

    # Fetch with retries
    before=$(git rev-parse HEAD)
    local retries=0
    local delay=2
    local fetch_ok=0
    while [ $retries -lt 4 ]; do
        if git fetch origin main 2>&1 | sed 's/^/    /'; then
            fetch_ok=1
            break
        fi
        retries=$((retries + 1))
        if [ $retries -lt 4 ]; then
            print_warn "Network error, retrying in ${delay}s..."
            sleep $delay
            delay=$((delay * 2))
        else
            print_error "Failed to fetch after 4 attempts."
            [ $stashed -eq 1 ] && git stash pop 2>/dev/null
            return 1
        fi
    done

    # Pull: try fast-forward first, fall back to reset if diverged
    if ! git pull --ff-only origin main 2>/dev/null; then
        print_warn "Local branch diverged. Resetting to origin/main..."
        git reset --hard origin/main 2>&1 | sed 's/^/    /'
    fi
    after=$(git rev-parse HEAD)

    echo ""
    if [ "$before" = "$after" ]; then
        print_success "Already up to date!"
    else
        print_success "Updated!"
        echo ""
        echo -e "  ${BOLD}Changes:${NC}"
        git log --oneline "$before".."$after" | sed 's/^/    /'
    fi

    # Update version file
    local version
    version=$(get_latest_version)
    echo "$version" > "$VERSION_FILE"

    # Restore stash
    if [ $stashed -eq 1 ]; then
        echo ""
        print_info "Restoring local changes..."
        git stash pop 2>&1 | sed 's/^/    /'
    fi

    # Re-link skills in case new ones were added
    mkdir -p "$SKILLS_DIR"
    for skill_dir in "$source_dir"/.claude/skills/*/; do
        local skill_name
        skill_name=$(basename "$skill_dir")
        if [ ! -L "$SKILLS_DIR/$skill_name" ]; then
            ln -s "$skill_dir" "$SKILLS_DIR/$skill_name"
            print_success "Linked new skill: $skill_name"
        fi
    done

    echo ""
}

cmd_list() {
    print_header
    echo -e "  ${BOLD}Available Packages${NC}"
    echo ""

    if [ ! -f "$CATALOG" ]; then
        print_error "Catalog not found at $CATALOG"
        return 1
    fi

    # Parse catalog with basic tools (no jq dependency)
    local in_package=0
    local name="" type="" version="" description=""

    while IFS= read -r line; do
        case "$line" in
            *'"name":'*)
                if [ $in_package -eq 1 ] && [ -n "$name" ]; then
                    # Print previous package
                    local icon="📦"
                    [ "$type" = "skill" ] && icon="⚡"
                    [ "$type" = "agent" ] && icon="🤖"
                    printf "  %-2s %-20s %-8s %s\n" "$icon" "$name@$version" "[$type]" "$description"
                fi
                name=$(echo "$line" | grep -o '"name": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
                in_package=1
                ;;
            *'"type":'*)
                type=$(echo "$line" | grep -o '"type": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
                ;;
            *'"version":'*)
                [ $in_package -eq 1 ] && version=$(echo "$line" | grep -o '"version": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
                ;;
            *'"description":'*)
                [ $in_package -eq 1 ] && description=$(echo "$line" | grep -o '"description": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
                ;;
        esac
    done < "$CATALOG"

    # Print last package
    if [ $in_package -eq 1 ] && [ -n "$name" ]; then
        local icon="📦"
        [ "$type" = "skill" ] && icon="⚡"
        [ "$type" = "agent" ] && icon="🤖"
        printf "  %-2s %-20s %-8s %s\n" "$icon" "$name@$version" "[$type]" "$description"
    fi

    echo ""
}

cmd_info() {
    local pkg_name="$1"
    if [ -z "$pkg_name" ]; then
        print_error "Usage: claude-market info <package-name>"
        return 1
    fi

    print_header

    if [ ! -f "$CATALOG" ]; then
        print_error "Catalog not found"
        return 1
    fi

    # Use python3 if available, fallback to awk
    local result=""
    if command -v python3 >/dev/null 2>&1; then
        result=$(python3 -c "
import json, sys
with open('$CATALOG') as f:
    catalog = json.load(f)
pkg = next((p for p in catalog['packages'] if p['name'] == '$pkg_name'), None)
if not pkg:
    sys.exit(1)
print('NAME=' + pkg['name'])
print('TYPE=' + pkg.get('type', ''))
print('VERSION=' + pkg.get('version', ''))
print('DESCRIPTION=' + pkg.get('description', ''))
print('PATH=' + pkg.get('path', ''))
print('TAGS=' + ', '.join(pkg.get('tags', [])))
print('DEPS=' + ', '.join(pkg.get('dependencies', [])))
" 2>/dev/null)
    fi

    if [ -z "$result" ]; then
        # Fallback: use awk to extract package block
        result=$(awk -v pkg="$pkg_name" '
        BEGIN { found=0; in_pkg=0; brace=0 }
        /"name":/ && $0 ~ "\"" pkg "\"" { found=1; in_pkg=1 }
        in_pkg && /{/ { brace++ }
        in_pkg && /}/ { brace--; if (brace<=0) in_pkg=0 }
        in_pkg && /"type":/        { gsub(/.*"type": *"|".*/, ""); print "TYPE=" $0 }
        in_pkg && /"version":/     { gsub(/.*"version": *"|".*/, ""); print "VERSION=" $0 }
        in_pkg && /"description":/ { gsub(/.*"description": *"|".*/, ""); print "DESCRIPTION=" $0 }
        in_pkg && /"path":/        { gsub(/.*"path": *"|".*/, ""); print "PATH=" $0 }
        END { if (found) print "NAME=" pkg; else exit 1 }
        ' "$CATALOG" 2>/dev/null)
    fi

    if [ $? -ne 0 ] || [ -z "$result" ]; then
        print_error "Package '$pkg_name' not found"
        echo ""
        print_info "Run 'claude-market list' to see available packages"
        echo ""
        return 1
    fi

    echo -e "  ${BOLD}Package: $pkg_name${NC}"
    echo ""

    local val
    val=$(echo "$result" | grep "^NAME=" | cut -d= -f2-)
    echo -e "  ${BOLD}Name:${NC}         $val"
    val=$(echo "$result" | grep "^TYPE=" | cut -d= -f2-)
    [ -n "$val" ] && echo -e "  ${BOLD}Type:${NC}         $val"
    val=$(echo "$result" | grep "^VERSION=" | cut -d= -f2-)
    [ -n "$val" ] && echo -e "  ${BOLD}Version:${NC}      $val"
    val=$(echo "$result" | grep "^DESCRIPTION=" | cut -d= -f2-)
    [ -n "$val" ] && echo -e "  ${BOLD}Description:${NC}  $val"
    val=$(echo "$result" | grep "^PATH=" | cut -d= -f2-)
    [ -n "$val" ] && echo -e "  ${BOLD}Path:${NC}         $val"
    val=$(echo "$result" | grep "^TAGS=" | cut -d= -f2-)
    [ -n "$val" ] && echo -e "  ${BOLD}Tags:${NC}         $val"
    val=$(echo "$result" | grep "^DEPS=" | cut -d= -f2-)
    [ -n "$val" ] && echo -e "  ${BOLD}Dependencies:${NC} $val"
    echo ""
}

cmd_status() {
    print_header
    echo -e "  ${BOLD}Installation Status${NC}"
    echo ""

    local installed_version
    installed_version=$(get_installed_version)

    if [ "$installed_version" = "not installed" ]; then
        print_warn "Not installed"
        print_info "Run 'claude-market install' to get started"
        echo ""
        return 0
    fi

    print_success "Installed: v$installed_version"

    # Check skill symlinks
    for skill in orchestrator create-agent; do
        if [ -L "$SKILLS_DIR/$skill" ]; then
            print_success "Skill linked: $skill"
        else
            print_warn "Skill missing: $skill"
        fi
    done

    # Check if source dir exists
    local source_dir="$INSTALL_DIR"
    [ ! -d "$source_dir/.git" ] && source_dir="$ORCHESTRATOR_DIR"

    if [ -d "$source_dir/.git" ]; then
        cd "$source_dir"
        local local_head remote_head
        local_head=$(git rev-parse HEAD 2>/dev/null)
        git fetch origin main --quiet 2>/dev/null || true
        remote_head=$(git rev-parse origin/main 2>/dev/null || echo "")

        if [ -n "$remote_head" ] && [ "$local_head" != "$remote_head" ]; then
            echo ""
            print_warn "Update available!"
            print_info "Run 'claude-market update' to get the latest"
        else
            echo ""
            print_success "Up to date"
        fi
    fi

    echo ""
}

cmd_version() {
    local installed
    installed=$(get_installed_version)
    local latest
    latest=$(get_latest_version)
    echo "Agent Orchestrator v$latest (installed: $installed)"
}

cmd_uninstall() {
    print_header
    echo -e "  ${BOLD}Uninstalling Agent Orchestrator...${NC}"
    echo ""

    # Remove skill symlinks
    for skill in orchestrator create-agent; do
        if [ -L "$SKILLS_DIR/$skill" ]; then
            rm -f "$SKILLS_DIR/$skill"
            print_success "Removed skill: $skill"
        fi
    done

    # Remove CLI symlink
    if [ -L "$HOME/.local/bin/claude-market" ]; then
        rm -f "$HOME/.local/bin/claude-market"
        print_success "Removed command: claude-market"
    fi

    # Remove version file
    rm -f "$VERSION_FILE"

    print_warn "Source code left at: $INSTALL_DIR"
    print_info "Remove manually with: rm -rf $INSTALL_DIR"
    echo ""
}

cmd_help() {
    print_header
    echo -e "  ${BOLD}Commands:${NC}"
    echo ""
    echo -e "  ${CYAN}install${NC}          Install the framework from GitHub"
    echo -e "  ${CYAN}setup${NC}            Set up the current project for orchestrator"
    echo -e "  ${CYAN}update${NC}           Update to the latest version"
    echo -e "  ${CYAN}list${NC}             List available packages (skills & agents)"
    echo -e "  ${CYAN}info <package>${NC}   Show details for a package"
    echo -e "  ${CYAN}status${NC}           Show installation status and check for updates"
    echo -e "  ${CYAN}version${NC}          Show version info"
    echo -e "  ${CYAN}uninstall${NC}        Remove the framework"
    echo -e "  ${CYAN}help${NC}             Show this help"
    echo ""
    echo -e "  ${BOLD}Quick Start:${NC}"
    echo ""
    echo -e "    ${CYAN}curl -fsSL https://raw.githubusercontent.com/zanijr/claudesubagents/main/scripts/get.sh | bash${NC}"
    echo ""
}

# Main dispatch
case "${1:-help}" in
    install)    cmd_install ;;
    setup)      cmd_setup ;;
    update)     cmd_update ;;
    list)       cmd_list ;;
    info)       cmd_info "$2" ;;
    status)     cmd_status ;;
    version)    cmd_version ;;
    uninstall)  cmd_uninstall ;;
    help|--help|-h) cmd_help ;;
    *)
        print_error "Unknown command: $1"
        cmd_help
        exit 1
        ;;
esac
