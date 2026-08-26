# Oscar Wilson team standard — stamp the guardrails into one repo (Windows).
# Same behavior as apply-to-repo.sh: adds guardrail settings, the bash-guard
# hook, AGENTS.md/CLAUDE.md templates (only if the repo has neither), memory
# scaffold, and .gitignore entries. Never overwrites existing config.
#
# Usage: powershell -ExecutionPolicy Bypass -File apply-to-repo.ps1 -Repo C:\path\to\repo
param([Parameter(Mandatory=$true)][string]$Repo)
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)  # team-standard\

if (-not (Test-Path "$Repo\.git")) { throw "Not a git repo: $Repo" }
New-Item -ItemType Directory -Force -Path "$Repo\.claude\hooks" | Out-Null

Copy-Item "$Here\guardrails\hooks\bash-guard.sh" "$Repo\.claude\hooks\bash-guard.sh" -Force
Write-Host "Installed .claude/hooks/bash-guard.sh"

if (Test-Path "$Repo\.claude\settings.json") {
  Write-Host "SKIPPED .claude/settings.json (exists) - merge global/settings.json manually"
} else {
  Copy-Item "$Here\global\settings.json" "$Repo\.claude\settings.json"
  Write-Host "Installed .claude/settings.json"
}

if ((Test-Path "$Repo\CLAUDE.md") -or (Test-Path "$Repo\AGENTS.md")) {
  Write-Host "SKIPPED CLAUDE.md/AGENTS.md (repo already has instructions)"
} else {
  Copy-Item "$Here\templates\AGENTS.md.template" "$Repo\AGENTS.md"
  Copy-Item "$Here\templates\CLAUDE.md.template" "$Repo\CLAUDE.md"
  Write-Host "Installed AGENTS.md + CLAUDE.md templates - fill in the {placeholders}"
}

$gi = "$Repo\.gitignore"
if (-not (Test-Path $gi)) { New-Item -ItemType File -Path $gi | Out-Null }
$existing = Get-Content $gi -ErrorAction SilentlyContinue
foreach ($entry in @(".claude/settings.local.json","CLAUDE.local.md",".env",".env.*","!.env.example","exports/")) {
  if ($existing -notcontains $entry) { Add-Content $gi $entry }
}
Write-Host "Ensured .gitignore entries"

New-Item -ItemType Directory -Force -Path "$Repo\.claude\memory" | Out-Null
$lessons = "$Repo\.claude\memory\lessons-learned.md"
if (-not (Test-Path $lessons)) {
  @"
# Lessons Learned

Concise, actionable, dated. Newest at the bottom.
Format: - [YYYY-MM-DD] fact - why it matters - what to do instead.
"@ | Set-Content $lessons
}
Write-Host "Ensured .claude/memory/lessons-learned.md"
Write-Host "Done. Review 'git status', fill any {placeholders}, then commit on a feature branch."
