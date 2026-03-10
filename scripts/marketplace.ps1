# Agent Orchestrator Marketplace CLI (PowerShell)
#
# Usage:
#   claude-market install          Install the full framework
#   claude-market update           Update to latest version
#   claude-market list             List available packages
#   claude-market info <package>   Show package details
#   claude-market status           Show installed status and check for updates
#   claude-market version          Show installed version
#   claude-market uninstall        Remove the framework

param(
    [Parameter(Position=0)]
    [string]$Command = "help",

    [Parameter(Position=1)]
    [string]$Argument
)

$ErrorActionPreference = "Stop"

# Paths
$OrchestratorDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path "$OrchestratorDir/marketplace/catalog.json")) {
    $OrchestratorDir = Split-Path $PSScriptRoot -Parent
}
$Catalog = Join-Path $OrchestratorDir "marketplace/catalog.json"
$PluginJson = Join-Path $OrchestratorDir ".claude-plugin/plugin.json"
$ClaudeDir = Join-Path $env:USERPROFILE ".claude"
$SkillsDir = Join-Path $ClaudeDir "skills"
$VersionFile = Join-Path $ClaudeDir ".orchestrator-version"
$InstallDir = Join-Path $ClaudeDir "orchestrator"
$RepoUrl = "https://github.com/zanijr/claudesubagents.git"

function Write-Header {
    Write-Host ""
    Write-Host "  Agent Orchestrator Marketplace" -ForegroundColor Cyan
    Write-Host "  ---------------------------------"
    Write-Host ""
}

function Write-Ok { param($Msg) Write-Host "  + $Msg" -ForegroundColor Green }
function Write-Info { param($Msg) Write-Host "  > $Msg" -ForegroundColor Blue }
function Write-Warn { param($Msg) Write-Host "  ! $Msg" -ForegroundColor Yellow }
function Write-Err { param($Msg) Write-Host "  x $Msg" -ForegroundColor Red }

function Get-InstalledVersion {
    if (Test-Path $VersionFile) {
        return (Get-Content $VersionFile -Raw).Trim()
    }
    return "not installed"
}

function Get-LatestVersion {
    if (Test-Path $PluginJson) {
        $json = Get-Content $PluginJson -Raw | ConvertFrom-Json
        return $json.version
    }
    return "unknown"
}

function Invoke-Install {
    Write-Header
    Write-Host "  Installing Agent Orchestrator..." -ForegroundColor White
    Write-Host ""

    if (Test-Path (Join-Path $InstallDir ".git")) {
        Write-Warn "Already installed at $InstallDir"
        Write-Info "Run 'claude-market update' to get the latest version"
        Write-Host ""
        return
    }

    # Clone
    Write-Info "Cloning from $RepoUrl..."
    git clone $RepoUrl $InstallDir
    Write-Host ""

    # Create skill symlinks (junctions on Windows)
    if (-not (Test-Path $SkillsDir)) {
        New-Item -ItemType Directory -Path $SkillsDir -Force | Out-Null
    }

    foreach ($skill in @("orchestrator", "create-agent")) {
        $target = Join-Path $InstallDir ".claude/skills/$skill"
        $link = Join-Path $SkillsDir $skill

        if (Test-Path $link) {
            Remove-Item $link -Force -Recurse
        }

        # Use directory junction (works without admin)
        cmd /c mklink /J "$link" "$target" | Out-Null
        Write-Ok "Linked skill: $skill"
    }

    # Save version
    $version = Get-LatestVersion
    $version | Out-File -FilePath $VersionFile -NoNewline -Encoding utf8
    Write-Ok "Installed version: $version"

    # Create PowerShell alias helper
    $profileDir = Split-Path $PROFILE -Parent
    if (-not (Test-Path $profileDir)) {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    }

    $aliasLine = "Set-Alias -Name claude-market -Value `"$InstallDir\scripts\marketplace.ps1`""
    if (Test-Path $PROFILE) {
        $content = Get-Content $PROFILE -Raw
        if ($content -notmatch "claude-market") {
            Add-Content -Path $PROFILE -Value "`n# Agent Orchestrator Marketplace`n$aliasLine"
            Write-Ok "Added 'claude-market' alias to PowerShell profile"
        }
    } else {
        "# Agent Orchestrator Marketplace`n$aliasLine" | Out-File -FilePath $PROFILE -Encoding utf8
        Write-Ok "Created PowerShell profile with 'claude-market' alias"
    }

    Write-Host ""
    Write-Info "To set up a project, cd into it and run:"
    Write-Host "    claude-market setup" -ForegroundColor Cyan
    Write-Host ""
}

function Invoke-Setup {
    Write-Header
    Write-Host "  Setting up project..." -ForegroundColor White
    Write-Host ""

    $projectDir = Get-Location

    # Create directories
    $agentDir = Join-Path $projectDir ".claude/agents/project"
    $checkpointDir = Join-Path $projectDir ".claude/context/checkpoints"
    New-Item -ItemType Directory -Path $agentDir -Force | Out-Null
    Write-Ok "Created .claude/agents/project/"
    New-Item -ItemType Directory -Path $checkpointDir -Force | Out-Null
    Write-Ok "Created .claude/context/checkpoints/"

    # Copy templates
    $templateSrc = Join-Path $InstallDir "templates/new-agent.md"
    $templateDst = Join-Path $agentDir "_template.md"
    if (-not (Test-Path $templateDst) -and (Test-Path $templateSrc)) {
        Copy-Item $templateSrc $templateDst
        Write-Ok "Copied agent template"
    }

    $configSrc = Join-Path $InstallDir "templates/orchestrator.config.json"
    $configDst = Join-Path $projectDir "orchestrator.config.json"
    if (-not (Test-Path $configDst) -and (Test-Path $configSrc)) {
        Copy-Item $configSrc $configDst
        Write-Ok "Copied config template"
    }

    # Update .gitignore
    $gitignore = Join-Path $projectDir ".gitignore"
    $entry = ".claude/context/checkpoints/"
    if (Test-Path $gitignore) {
        $content = Get-Content $gitignore -Raw
        if ($content -notmatch [regex]::Escape($entry)) {
            Add-Content -Path $gitignore -Value "`n# Agent orchestrator checkpoint files`n$entry"
            Write-Ok "Updated .gitignore"
        }
    } else {
        "# Agent orchestrator checkpoint files`n$entry" | Out-File -FilePath $gitignore -Encoding utf8
        Write-Ok "Created .gitignore"
    }

    Write-Host ""
    Write-Info "Project ready! Say '/orchestrator <goal>' in Claude Code."
    Write-Host ""
}

function Invoke-Update {
    Write-Header
    Write-Host "  Checking for updates..." -ForegroundColor White
    Write-Host ""

    $sourceDir = $InstallDir
    if (-not (Test-Path (Join-Path $sourceDir ".git"))) {
        $sourceDir = $OrchestratorDir
    }

    if (-not (Test-Path (Join-Path $sourceDir ".git"))) {
        Write-Err "Not installed. Run 'claude-market install' first."
        Write-Host ""
        return
    }

    Push-Location $sourceDir

    # Stash local changes
    $stashed = $false
    $diffOutput = git diff --stat 2>&1
    if ($diffOutput) {
        Write-Warn "Stashing local changes..."
        git stash
        $stashed = $true
    }

    $before = git rev-parse HEAD

    # Pull with retries
    $retries = 0
    $delay = 2
    $success = $false
    while ($retries -lt 4) {
        try {
            git pull --ff-only origin main
            $success = $true
            break
        } catch {
            $retries++
            if ($retries -lt 4) {
                Write-Warn "Network error, retrying in ${delay}s..."
                Start-Sleep -Seconds $delay
                $delay *= 2
            }
        }
    }

    if (-not $success) {
        Write-Err "Failed to pull after 4 attempts."
        if ($stashed) { git stash pop }
        Pop-Location
        return
    }

    $after = git rev-parse HEAD

    Write-Host ""
    if ($before -eq $after) {
        Write-Ok "Already up to date!"
    } else {
        Write-Ok "Updated!"
        Write-Host ""
        Write-Host "  Changes:" -ForegroundColor White
        git log --oneline "$before..$after" | ForEach-Object { Write-Host "    $_" }
    }

    # Update version
    $version = Get-LatestVersion
    $version | Out-File -FilePath $VersionFile -NoNewline -Encoding utf8

    if ($stashed) {
        Write-Host ""
        Write-Info "Restoring local changes..."
        git stash pop
    }

    # Re-link any new skills
    Get-ChildItem -Path (Join-Path $sourceDir ".claude/skills") -Directory | ForEach-Object {
        $link = Join-Path $SkillsDir $_.Name
        if (-not (Test-Path $link)) {
            cmd /c mklink /J "$link" $_.FullName | Out-Null
            Write-Ok "Linked new skill: $($_.Name)"
        }
    }

    Pop-Location
    Write-Host ""
}

function Invoke-List {
    Write-Header
    Write-Host "  Available Packages" -ForegroundColor White
    Write-Host ""

    if (-not (Test-Path $Catalog)) {
        Write-Err "Catalog not found"
        return
    }

    $catalog = Get-Content $Catalog -Raw | ConvertFrom-Json

    foreach ($pkg in $catalog.packages) {
        $icon = switch ($pkg.type) {
            "skill" { "[skill]" }
            "agent" { "[agent]" }
            default { "[pkg]  " }
        }
        $nameVer = "$($pkg.name)@$($pkg.version)"
        Write-Host ("  {0,-8} {1,-22} {2}" -f $icon, $nameVer, $pkg.description)
    }

    Write-Host ""
}

function Invoke-Info {
    param($PackageName)

    if (-not $PackageName) {
        Write-Err "Usage: claude-market info <package-name>"
        return
    }

    Write-Header

    if (-not (Test-Path $Catalog)) {
        Write-Err "Catalog not found"
        return
    }

    $catalog = Get-Content $Catalog -Raw | ConvertFrom-Json
    $pkg = $catalog.packages | Where-Object { $_.name -eq $PackageName }

    if (-not $pkg) {
        Write-Err "Package '$PackageName' not found"
        Write-Info "Run 'claude-market list' to see available packages"
        Write-Host ""
        return
    }

    Write-Host "  Package: $($pkg.name)" -ForegroundColor White
    Write-Host ""
    Write-Host "  Name:        $($pkg.name)"
    Write-Host "  Type:        $($pkg.type)"
    Write-Host "  Version:     $($pkg.version)"
    Write-Host "  Description: $($pkg.description)"
    Write-Host "  Path:        $($pkg.path)"
    if ($pkg.tags) {
        Write-Host "  Tags:        $($pkg.tags -join ', ')"
    }
    Write-Host ""
}

function Invoke-Status {
    Write-Header
    Write-Host "  Installation Status" -ForegroundColor White
    Write-Host ""

    $installed = Get-InstalledVersion

    if ($installed -eq "not installed") {
        Write-Warn "Not installed"
        Write-Info "Run 'claude-market install' to get started"
        Write-Host ""
        return
    }

    Write-Ok "Installed: v$installed"

    # Check skills
    foreach ($skill in @("orchestrator", "create-agent")) {
        $link = Join-Path $SkillsDir $skill
        if (Test-Path $link) {
            Write-Ok "Skill linked: $skill"
        } else {
            Write-Warn "Skill missing: $skill"
        }
    }

    # Check for updates
    $sourceDir = $InstallDir
    if (-not (Test-Path (Join-Path $sourceDir ".git"))) {
        $sourceDir = $OrchestratorDir
    }

    if (Test-Path (Join-Path $sourceDir ".git")) {
        Push-Location $sourceDir
        $localHead = git rev-parse HEAD
        git fetch origin main --quiet 2>&1 | Out-Null
        $remoteHead = git rev-parse origin/main 2>&1

        Write-Host ""
        if ($localHead -ne $remoteHead) {
            Write-Warn "Update available!"
            Write-Info "Run 'claude-market update' to get the latest"
        } else {
            Write-Ok "Up to date"
        }
        Pop-Location
    }

    Write-Host ""
}

function Invoke-Version {
    $installed = Get-InstalledVersion
    $latest = Get-LatestVersion
    Write-Host "Agent Orchestrator v$latest (installed: $installed)"
}

function Invoke-Uninstall {
    Write-Header
    Write-Host "  Uninstalling Agent Orchestrator..." -ForegroundColor White
    Write-Host ""

    foreach ($skill in @("orchestrator", "create-agent")) {
        $link = Join-Path $SkillsDir $skill
        if (Test-Path $link) {
            Remove-Item $link -Force -Recurse
            Write-Ok "Removed skill: $skill"
        }
    }

    # Remove version file
    if (Test-Path $VersionFile) {
        Remove-Item $VersionFile -Force
    }

    Write-Warn "Source code left at: $InstallDir"
    Write-Info "Remove manually with: Remove-Item -Recurse -Force '$InstallDir'"
    Write-Host ""
}

function Invoke-Help {
    Write-Header
    Write-Host "  Commands:" -ForegroundColor White
    Write-Host ""
    Write-Host "  install          " -NoNewline -ForegroundColor Cyan; Write-Host "Install the framework from GitHub"
    Write-Host "  setup            " -NoNewline -ForegroundColor Cyan; Write-Host "Set up the current project for orchestrator"
    Write-Host "  update           " -NoNewline -ForegroundColor Cyan; Write-Host "Update to the latest version"
    Write-Host "  list             " -NoNewline -ForegroundColor Cyan; Write-Host "List available packages (skills & agents)"
    Write-Host "  info <package>   " -NoNewline -ForegroundColor Cyan; Write-Host "Show details for a package"
    Write-Host "  status           " -NoNewline -ForegroundColor Cyan; Write-Host "Show installation status and check for updates"
    Write-Host "  version          " -NoNewline -ForegroundColor Cyan; Write-Host "Show version info"
    Write-Host "  uninstall        " -NoNewline -ForegroundColor Cyan; Write-Host "Remove the framework"
    Write-Host "  help             " -NoNewline -ForegroundColor Cyan; Write-Host "Show this help"
    Write-Host ""
    Write-Host "  Quick Start:" -ForegroundColor White
    Write-Host ""
    Write-Host "    git clone https://github.com/zanijr/claudesubagents.git ~/.claude/orchestrator" -ForegroundColor Cyan
    Write-Host "    ~/.claude/orchestrator/scripts/marketplace.ps1 install" -ForegroundColor Cyan
    Write-Host ""
}

# Main dispatch
switch ($Command.ToLower()) {
    "install"   { Invoke-Install }
    "setup"     { Invoke-Setup }
    "update"    { Invoke-Update }
    "list"      { Invoke-List }
    "info"      { Invoke-Info -PackageName $Argument }
    "status"    { Invoke-Status }
    "version"   { Invoke-Version }
    "uninstall" { Invoke-Uninstall }
    { $_ -in "help", "--help", "-h" } { Invoke-Help }
    default {
        Write-Err "Unknown command: $Command"
        Invoke-Help
    }
}
