# Oscar Wilson team standard — per-user install (Windows PowerShell).
# Installs the global CLAUDE.md and mirrors team skills/agents from a
# claude-team-config checkout into ~/.claude. Safe to re-run any time.
#
# Usage: powershell -ExecutionPolicy Bypass -File install-user.ps1 [-TeamCfg <path>]
param(
  [string]$TeamCfg = "$env:USERPROFILE\source\repos\claude-team-config"
)
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)  # team-standard\

# 1. Global CLAUDE.md (backs up any existing one first)
$claudeDir = "$env:USERPROFILE\.claude"
New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null
$target = "$claudeDir\CLAUDE.md"
$src = "$Here\global\CLAUDE.md"
if ((Test-Path $target) -and ((Get-FileHash $target).Hash -ne (Get-FileHash $src).Hash)) {
  Copy-Item $target "$target.bak.$(Get-Date -Format yyyyMMddHHmmss)"
  Write-Host "Backed up existing ~/.claude/CLAUDE.md"
}
Copy-Item $src $target -Force
Write-Host "Installed global CLAUDE.md -> ~/.claude/CLAUDE.md"

# 2. Mirror team skills and agents from claude-team-config (if checked out)
if (Test-Path $TeamCfg) {
  try { git -C $TeamCfg pull --ff-only 2>$null | Out-Null } catch {}
  $skillsSrc = Join-Path $TeamCfg "skills"
  if (Test-Path $skillsSrc) {
    $skillsDst = "$claudeDir\skills"
    New-Item -ItemType Directory -Force -Path $skillsDst | Out-Null
    Get-ChildItem $skillsSrc -Directory | ForEach-Object {
      $t = Join-Path $skillsDst $_.Name
      if (Test-Path $t) { Remove-Item $t -Recurse -Force }
      Copy-Item $_.FullName $t -Recurse
      Write-Host "Installed skill: $($_.Name)"
    }
  }
  $agentsSrc = Join-Path $TeamCfg "agents"
  if (Test-Path $agentsSrc) {
    $agentsDst = "$claudeDir\agents"
    New-Item -ItemType Directory -Force -Path "$agentsDst\project" | Out-Null
    # _template.md is boilerplate, NOT a live agent — never install it.
    Get-ChildItem $agentsSrc -Filter *.md | Where-Object { $_.Name -ne "_template.md" } |
      ForEach-Object { Copy-Item $_.FullName $agentsDst -Force }
    $proj = Join-Path $agentsSrc "project"
    if (Test-Path $proj) {
      Get-ChildItem $proj -Filter *.md | Where-Object { $_.Name -ne "_template.md" } |
        ForEach-Object { Copy-Item $_.FullName "$agentsDst\project" -Force }
    }
    Remove-Item "$agentsDst\_template.md","$agentsDst\project\_template.md" -ErrorAction SilentlyContinue
    Write-Host "Installed team agents (excluding _template.md)"
  }
} else {
  Write-Host "NOTE: claude-team-config not found at $TeamCfg - skipped skills/agents."
  Write-Host "Clone it and re-run: git clone https://github.com/oscarwilsonengines/claude-team-config `"$TeamCfg`""
}

Write-Host "Done. Remember: never hand-edit ~/.claude mirrors - edit claude-team-config and re-run."
