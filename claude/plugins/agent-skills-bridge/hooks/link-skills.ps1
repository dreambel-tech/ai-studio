# agent-skills-bridge: SessionStart hook for Windows (Windows PowerShell 5.1 or PowerShell 7).
#
# For the session folder and each of its direct subfolders (an "umbrella" folder holding
# several projects), when the folder has a .agents/skills folder (the cross-tool Agent Skills
# convention), link its .claude/skills to it with a directory junction so Claude Code discovers
# those skills. A junction needs no admin rights and no Developer Mode.
#
# Never touches an existing .claude/skills folder or a link that points elsewhere.
# Never edits a .gitignore. Prints at most one message. Always exits 0.

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $utf8
[Console]::InputEncoding = $utf8

function Write-Message([string]$text, [switch]$Reload) {
    $output = @{ systemMessage = "agent-skills-bridge: $text" }
    if ($Reload) {
        # Ask Claude Code to re-scan skills so the linked ones appear in this session.
        $output.hookSpecificOutput = @{ hookEventName = 'SessionStart'; reloadSkills = $true }
    }
    $output | ConvertTo-Json -Compress
}

# PowerShell 7 also runs on macOS and Linux, where link-skills.sh does the work.
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { exit 0 }

function Get-FullPath([string]$path) {
    try { (Resolve-Path -LiteralPath $path).ProviderPath.TrimEnd('\') } catch { $null }
}

# Results, reported together in one message at the end.
$linked = New-Object System.Collections.Generic.List[string]
$untouched = New-Object System.Collections.Generic.List[string]
$failed = New-Object System.Collections.Generic.List[string]
$rootLinked = $false
$subLinked = $false

# Subfolders never scanned: hidden ones, and heavy ones that hold dependencies or build output.
$skippedNames = @('node_modules', 'bower_components', 'vendor', 'dist', 'build', 'out', 'target',
    'bin', 'obj', 'coverage', '__pycache__', 'venv')

# Keep a new link out of git without editing any .gitignore: local-only exclude in the
# folder's own repository or, for a plain subfolder, in the session folder's repository.
function Add-GitExclude([string]$dir, [string]$label) {
    if (Test-Path -LiteralPath (Join-Path $dir '.git') -PathType Container) {
        $repo = $dir
        $line = '/.claude/skills'
    } elseif ($dir -ne $root -and (Test-Path -LiteralPath (Join-Path $root '.git') -PathType Container)) {
        $repo = $root
        $line = '/' + ($label -replace '([\[\]*?\\])', '\$1') + '/.claude/skills'
    } else {
        return
    }
    $exclude = Join-Path $repo '.git\info\exclude'
    $existing = if (Test-Path -LiteralPath $exclude) { @(Get-Content -LiteralPath $exclude) } else { @() }
    if ($existing -contains $line) { return }
    New-Item -ItemType Directory -Force -Path (Split-Path $exclude) | Out-Null
    $content = if (Test-Path -LiteralPath $exclude) { [IO.File]::ReadAllText($exclude) } else { '' }
    if ($content -and -not $content.EndsWith("`n")) { $line = "`n$line" }
    [IO.File]::AppendAllText($exclude, "$line`n", $utf8)
}

function Add-SkillsLink([string]$dir, [string]$label) {
    try {
        $target = Get-FullPath (Join-Path $dir '.agents\skills')
        if (-not $target) { $failed.Add("$label (cannot resolve .agents/skills)"); return }
        $claudeDir = Join-Path $dir '.claude'
        $claudeSkills = Join-Path $claudeDir 'skills'

        # Get-Item also finds broken links, which Test-Path reports as missing.
        $item = Get-Item -LiteralPath $claudeSkills -Force -ErrorAction SilentlyContinue
        if ($item) {
            if ($item.LinkType) {
                $current = @($item.Target)[0]
                if ($current -and ((Get-FullPath $current) -eq $target)) { return }
                $untouched.Add("$label (.claude/skills is a link to '$current'; remove it to let the plugin link .agents/skills)")
            } else {
                $untouched.Add("$label (.claude/skills is a real folder; move its skills into .agents/skills, then remove it)")
            }
            return
        }

        if (-not (Test-Path -LiteralPath $claudeDir)) { New-Item -ItemType Directory -Path $claudeDir | Out-Null }
        New-Item -ItemType Junction -Path $claudeSkills -Target $target | Out-Null
        $linked.Add($label)
        if ($dir -eq $root) { $script:rootLinked = $true } else { $script:subLinked = $true }
    } catch {
        $failed.Add("$label ($($_.Exception.Message))")
        return
    }
    try { Add-GitExclude $dir $label } catch { $failed.Add("$label (linked, but not added to .git/info/exclude)") }
}

try {
    $root = $env:CLAUDE_PROJECT_DIR
    if (-not $root) {
        # Tolerate a byte order mark, which Windows PowerShell adds when it pipes text.
        $raw = [Console]::In.ReadToEnd().TrimStart([char]0xFEFF)
        if ($raw.Trim()) { $root = ($raw | ConvertFrom-Json).cwd }
    }
    if (-not $root) { exit 0 }
    $root = $root.TrimEnd('\', '/')
    if ($root -match '^[A-Za-z]:$') { $root += '\' }
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { exit 0 }

    # The session folder itself, then its direct subfolders (one level, never recursive).
    # Without -Force, Get-ChildItem also skips folders with the Windows hidden attribute.
    if (Test-Path -LiteralPath (Join-Path $root '.agents\skills') -PathType Container) {
        Add-SkillsLink $root (Split-Path -Leaf $root)
    }
    foreach ($sub in @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue)) {
        if ($sub.Name.StartsWith('.') -or $skippedNames -contains $sub.Name) { continue }
        if (Test-Path -LiteralPath (Join-Path $sub.FullName '.agents\skills') -PathType Container) {
            Add-SkillsLink $sub.FullName $sub.Name
        }
    }

    $parts = @()
    if ($linked.Count) { $parts += "Linked .claude/skills to .agents/skills in $($linked -join ', ')." }
    if ($untouched.Count) { $parts += "Left untouched: $($untouched -join '; ')." }
    if ($failed.Count) { $parts += "Could not finish: $($failed -join '; ')." }
    if ($parts.Count -eq 0) { exit 0 }
    if ($rootLinked) { $parts += 'If the skills do not appear yet, restart the session.' }
    # Claude Code loads a subfolder's skills the first time it reads or edits a file there.
    if ($subLinked) {
        $parts += 'Skills in a subfolder load once Claude reads or edits a file in it; run /add-dir with the subfolder to load them now.'
    }
    Write-Message ($parts -join ' ') -Reload:($linked.Count -gt 0)
    exit 0
} catch {
    Write-Message "Could not link .claude/skills to .agents/skills: $($_.Exception.Message)"
    exit 0
}
