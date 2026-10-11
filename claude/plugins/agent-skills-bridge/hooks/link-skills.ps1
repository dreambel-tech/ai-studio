# agent-skills-bridge: SessionStart hook for Windows (Windows PowerShell 5.1 or PowerShell 7).
#
# When the project has a .agents/skills folder (the cross-tool Agent Skills convention), link
# .claude/skills to it with a directory junction so Claude Code discovers those skills.
# A junction needs no admin rights and no Developer Mode.
#
# Never touches an existing .claude/skills folder or a link that points elsewhere.
# Never edits the project's .gitignore. Always exits 0.

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $utf8
[Console]::InputEncoding = $utf8

function Write-Message([string]$text, [switch]$Linked) {
    $output = @{ systemMessage = "agent-skills-bridge: $text" }
    if ($Linked) {
        # Ask Claude Code to re-scan skills so the linked ones appear in this session.
        $output.systemMessage += ' If the skills do not appear yet, restart the session.'
        $output.hookSpecificOutput = @{ hookEventName = 'SessionStart'; reloadSkills = $true }
    }
    $output | ConvertTo-Json -Compress
}

# PowerShell 7 also runs on macOS and Linux, where link-skills.sh does the work.
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { exit 0 }

function Get-FullPath([string]$path) {
    try { (Resolve-Path -LiteralPath $path).ProviderPath.TrimEnd('\') } catch { $null }
}

try {
    $root = $env:CLAUDE_PROJECT_DIR
    if (-not $root) {
        $raw = [Console]::In.ReadToEnd()
        if ($raw) { $root = ($raw | ConvertFrom-Json).cwd }
    }
    if (-not $root) { exit 0 }

    $agentsSkills = Join-Path $root '.agents\skills'
    if (-not (Test-Path -LiteralPath $agentsSkills -PathType Container)) { exit 0 }

    $claudeDir = Join-Path $root '.claude'
    $claudeSkills = Join-Path $claudeDir 'skills'
    $target = Get-FullPath $agentsSkills

    # Get-Item also finds broken links, which Test-Path reports as missing.
    $item = Get-Item -LiteralPath $claudeSkills -Force -ErrorAction SilentlyContinue
    if ($item) {
        if ($item.LinkType) {
            $current = @($item.Target)[0]
            if ($current -and ((Get-FullPath $current) -eq $target)) { exit 0 }
            Write-Message ".claude/skills is a link to '$current', not to .agents/skills, so it was left untouched. Remove that link to let the plugin link .agents/skills."
        } else {
            Write-Message ".claude/skills is a real folder, so it was left untouched. Move its skills into .agents/skills, then remove .claude/skills; the link is created at the next session start."
        }
        exit 0
    }

    if (-not (Test-Path -LiteralPath $claudeDir)) { New-Item -ItemType Directory -Path $claudeDir | Out-Null }
    New-Item -ItemType Junction -Path $claudeSkills -Target $target | Out-Null

    # Keep the link out of git without editing the project's .gitignore: local-only exclude.
    if (Test-Path -LiteralPath (Join-Path $root '.git') -PathType Container) {
        try {
            $exclude = Join-Path $root '.git\info\exclude'
            $line = '/.claude/skills'
            $existing = if (Test-Path -LiteralPath $exclude) { @(Get-Content -LiteralPath $exclude) } else { @() }
            if ($existing -notcontains $line) {
                New-Item -ItemType Directory -Force -Path (Split-Path $exclude) | Out-Null
                $content = if (Test-Path -LiteralPath $exclude) { [IO.File]::ReadAllText($exclude) } else { '' }
                if ($content -and -not $content.EndsWith("`n")) { $line = "`n$line" }
                [IO.File]::AppendAllText($exclude, "$line`n", $utf8)
            }
        } catch {
            Write-Message 'linked .claude/skills to .agents/skills, but could not add it to .git/info/exclude.' -Linked
            exit 0
        }
    }

    Write-Message 'linked .claude/skills to .agents/skills.' -Linked
    exit 0
} catch {
    Write-Message "could not link .claude/skills to .agents/skills: $($_.Exception.Message)"
    exit 0
}
