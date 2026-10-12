# Tests for hooks/link-skills.ps1 on Windows. Usage: powershell -ExecutionPolicy Bypass -File tests\run.ps1
# Needs git on PATH. Also runs the hooks.json command through Git Bash when Git for Windows has it.

# Continue: in Windows PowerShell 5.1, Stop turns a native command's stderr into an exception.
$ErrorActionPreference = 'Continue'
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

$repo = Split-Path -Parent $PSScriptRoot
$script = Join-Path $repo 'hooks\link-skills.ps1'
$T = Join-Path ([IO.Path]::GetTempPath()) ('agent-skills-bridge-tests-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $T | Out-Null
$script:pass = 0
$script:fails = 0

function Check([string]$name, [bool]$condition, [string]$got = '') {
    if ($condition) { Write-Output "PASS  $name"; $script:pass++ }
    else { Write-Output "FAIL  $name"; if ($got) { Write-Output "      got: $got" }; $script:fails++ }
}

function Invoke-Hook([string]$dir) {
    $env:CLAUDE_PROJECT_DIR = $dir
    try { (& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $script) -join "`n" }
    finally { Remove-Item Env:\CLAUDE_PROJECT_DIR -ErrorAction SilentlyContinue }
}

# A project with one skill; -NoGit leaves it outside git.
function New-Project([string]$dir, [switch]$NoGit) {
    $skill = Join-Path $dir '.agents\skills\demo'
    New-Item -ItemType Directory -Force -Path $skill | Out-Null
    [IO.File]::WriteAllText((Join-Path $skill 'SKILL.md'), "---`nname: demo`ndescription: Demo skill.`n---`nHello from demo`n")
    if (-not $NoGit) { git -C $dir init -q }
}

function Test-Json([string]$text) { try { $null = $text | ConvertFrom-Json; $true } catch { $false } }
function Get-LinkType([string]$path) { $i = Get-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue; if ($i) { [string]$i.LinkType } else { '' } }
function Test-Linked([string]$dir) {
    if ((Get-LinkType (Join-Path $dir '.claude\skills')) -ne 'Junction') { return $false }
    (Get-Content -LiteralPath (Join-Path $dir '.claude\skills\demo\SKILL.md') -Raw) -match 'Hello from demo'
}
function Test-Excluded([string]$dir, [string]$line) {
    $file = Join-Path $dir '.git\info\exclude'
    (Test-Path -LiteralPath $file) -and (@(Get-Content -LiteralPath $file) -contains $line)
}
function Test-GitClean([string]$dir) { -not ((git -C $dir status --porcelain --untracked-files=all) -match '\.claude') }

try {
    Write-Output "== hooks\link-skills.ps1 ($($PSVersionTable.PSVersion)) =="

    Write-Output '-- session folder is the project'
    $P = Join-Path $T 'create'; New-Project $P; $out = Invoke-Hook $P
    Check 'creates the link, one JSON object with reloadSkills' ($out -like '*Linked .claude/skills to .agents/skills in create.*' -and $out -like '*"reloadSkills":true*' -and (Test-Json $out)) $out
    Check 'junction, skill visible through .claude/skills' (Test-Linked $P)
    Check 'adds /.claude/skills to .git/info/exclude, git status clean' ((Test-Excluded $P '/.claude/skills') -and (Test-GitClean $P))
    Check 'never creates a .gitignore' (-not (Test-Path (Join-Path $P '.gitignore')))
    $out = Invoke-Hook $P
    Check 'second run is silent' (-not $out -and @(Get-Content (Join-Path $P '.git\info\exclude') | Where-Object { $_ -eq '/.claude/skills' }).Count -eq 1) $out

    $P = Join-Path $T 'no-agents'; New-Item -ItemType Directory -Path $P | Out-Null; $out = Invoke-Hook $P
    Check 'no .agents folder: silent, nothing created' (-not $out -and -not (Test-Path (Join-Path $P '.claude'))) $out

    $P = Join-Path $T 'real-folder'; New-Project $P
    New-Item -ItemType Directory -Force -Path (Join-Path $P '.claude\skills\own') | Out-Null
    Set-Content -LiteralPath (Join-Path $P '.claude\skills\own\SKILL.md') -Value 'mine'
    $out = Invoke-Hook $P
    Check 'real .claude/skills folder: explained and left untouched' ($out -like '*real folder*' -and (Test-Json $out) -and -not (Get-LinkType (Join-Path $P '.claude\skills')) -and (Get-Content (Join-Path $P '.claude\skills\own\SKILL.md')) -eq 'mine' -and -not (Test-Excluded $P '/.claude/skills')) $out

    $P = Join-Path $T 'link-elsewhere'; New-Project $P
    New-Item -ItemType Directory -Force -Path (Join-Path $T 'elsewhere'), (Join-Path $P '.claude') | Out-Null
    New-Item -ItemType Junction -Path (Join-Path $P '.claude\skills') -Target (Join-Path $T 'elsewhere') | Out-Null
    $out = Invoke-Hook $P
    Check 'link to somewhere else: explained and left untouched' ($out -like '*is a link to*' -and -not (Test-Path (Join-Path $P '.claude\skills\demo'))) $out

    $P = Join-Path $T "stdin proj $([char]0xE9)"; New-Project $P
    $json = @{ session_id = 't'; cwd = $P; hook_event_name = 'SessionStart'; source = 'startup' } | ConvertTo-Json -Compress
    $out = ($json | & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $script) -join "`n"
    Check 'project path read from the hook input (space, accent)' ($out -like '*Linked*' -and (Test-Linked $P)) $out

    $P = Join-Path $T 'exclude-eol'; New-Project $P
    [IO.File]::WriteAllText((Join-Path $P '.git\info\exclude'), 'foo')
    $null = Invoke-Hook $P
    $got = [IO.File]::ReadAllText((Join-Path $P '.git\info\exclude'))
    Check 'exclude without a final newline: line added on its own line' ($got -eq "foo`n/.claude/skills`n") $got

    $P = Join-Path $T 'no-git'; New-Project $P -NoGit; $out = Invoke-Hook $P
    Check 'not a git repository: link only' ($out -like '*Linked*' -and -not (Test-Path (Join-Path $P '.git'))) $out

    Write-Output '-- umbrella folder holding several projects'
    $U = Join-Path $T 'umbrella'; New-Project (Join-Path $U 'app-a')
    New-Item -ItemType Directory -Path (Join-Path $U 'app-b') | Out-Null; git -C (Join-Path $U 'app-b') init -q
    $out = Invoke-Hook $U
    Check 'links the subproject that has .agents/skills, names it' ($out -like '*Linked .claude/skills to .agents/skills in app-a.*' -and (Test-Json $out) -and (Test-Linked (Join-Path $U 'app-a'))) $out
    Check 'message explains when subfolder skills load' ($out -like '*/add-dir*' -and $out -notlike '*restart the session*') $out
    Check 'subproject without .agents and parent are left alone' (-not (Test-Path (Join-Path $U 'app-b\.claude')) -and -not (Test-Path (Join-Path $U '.claude')))
    Check "subproject's own .git/info/exclude updated, git status clean" ((Test-Excluded (Join-Path $U 'app-a') '/.claude/skills') -and (Test-GitClean (Join-Path $U 'app-a')))
    $out = Invoke-Hook $U
    Check 'umbrella second run is silent' (-not $out) $out

    $U = Join-Path $T 'umbrella-real'; New-Project (Join-Path $U 'app-a'); New-Project (Join-Path $U 'app-c')
    New-Item -ItemType Directory -Force -Path (Join-Path $U 'app-c\.claude\skills\own') | Out-Null
    Set-Content -LiteralPath (Join-Path $U 'app-c\.claude\skills\own\SKILL.md') -Value 'mine'
    $out = Invoke-Hook $U
    Check 'one message for both: app-a linked, app-c left untouched' ($out -like '*in app-a.*' -and $out -like '*Left untouched: app-c (.claude/skills is a real folder*' -and (Test-Json $out) -and @($out -split "`n").Count -eq 1) $out
    Check "subproject's real .claude/skills folder untouched" (-not (Get-LinkType (Join-Path $U 'app-c\.claude\skills')) -and (Get-Content (Join-Path $U 'app-c\.claude\skills\own\SKILL.md')) -eq 'mine')

    $U = Join-Path $T 'umbrella-skip'
    foreach ($d in 'node_modules', '.hidden', 'dist') { New-Project (Join-Path $U $d) -NoGit }
    $out = Invoke-Hook $U
    Check 'node_modules, hidden and build folders are ignored' (-not $out -and -not (Test-Path (Join-Path $U 'node_modules\.claude')) -and -not (Test-Path (Join-Path $U '.hidden\.claude')) -and -not (Test-Path (Join-Path $U 'dist\.claude'))) $out

    $U = Join-Path $T 'umbrella-deep'; New-Project (Join-Path $U 'group\app') -NoGit
    $out = Invoke-Hook $U
    Check 'only one level deep: grandchildren are not scanned' (-not $out -and -not (Test-Path (Join-Path $U 'group\app\.claude'))) $out

    $U = Join-Path $T 'monorepo'; New-Project $U; New-Project (Join-Path $U 'pkg') -NoGit
    $out = Invoke-Hook $U
    Check 'project with a subpackage: both linked in one message' ($out -like '*in monorepo, pkg.*' -and $out -like '*restart the session*' -and $out -like '*/add-dir*' -and (Test-Linked $U) -and (Test-Linked (Join-Path $U 'pkg'))) $out
    Check "plain subfolder excluded in the session folder's repository" ((Test-Excluded $U '/pkg/.claude/skills') -and (Test-GitClean $U)) ((git -C $U status --porcelain) -join ' ')

    Write-Output '-- hooks.json command, as Claude Code runs it on Windows'
    $command = (Get-Content -Raw (Join-Path $repo 'hooks\hooks.json') | ConvertFrom-Json).hooks.SessionStart[0].hooks[0].command
    # Without Git Bash: PowerShell, with ${VAR} rewritten to ${env:VAR}.
    $P = Join-Path $T 'hook-powershell'; New-Project $P
    $env:CLAUDE_PLUGIN_ROOT = $repo; $env:CLAUDE_PROJECT_DIR = $P
    $psCommand = $command.Replace('${CLAUDE_PLUGIN_ROOT}', '${env:CLAUDE_PLUGIN_ROOT}')
    $out = (& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command $psCommand 2>$null) -join "`n"; $code = $LASTEXITCODE
    Check 'PowerShell: link created, one JSON object, exit 0' ($code -eq 0 -and (Test-Json $out) -and (Test-Linked $P)) "code=$code out=$out"
    # With Git Bash: bash, with forward slashes in the paths.
    # git.exe is in Git\cmd or Git\mingw64\bin; Git Bash is Git\bin\bash.exe.
    $bash = $null
    $dir = Split-Path (@(Get-Command git -CommandType Application)[0].Source)
    while ($dir -and -not $bash) {
        if (Test-Path (Join-Path $dir 'bin\bash.exe')) { $bash = Join-Path $dir 'bin\bash.exe' }
        $dir = Split-Path $dir
    }
    if ($bash) {
        $P = Join-Path $T 'hook-gitbash'; New-Project $P
        $env:CLAUDE_PLUGIN_ROOT = $repo.Replace('\', '/'); $env:CLAUDE_PROJECT_DIR = $P.Replace('\', '/')
        $out = (& $bash -c $command 2>$null) -join "`n"; $code = $LASTEXITCODE
        Check 'Git Bash: link created, one JSON object, exit 0' ($code -eq 0 -and (Test-Json $out) -and (Test-Linked $P)) "code=$code out=$out"
    } else {
        Write-Output 'SKIP  Git Bash: not found next to git'
    }
    Remove-Item Env:\CLAUDE_PLUGIN_ROOT, Env:\CLAUDE_PROJECT_DIR -ErrorAction SilentlyContinue
} finally {
    # Remove every junction with rmdir first: a recursive delete must never go through one.
    $links = @(Get-ChildItem -LiteralPath $T -Recurse -Force -Directory -Attributes ReparsePoint -ErrorAction SilentlyContinue)
    foreach ($link in $links) { & cmd.exe /d /c rmdir "$($link.FullName)" }
    if (@(Get-ChildItem -LiteralPath $T -Recurse -Force -Attributes ReparsePoint -ErrorAction SilentlyContinue).Count -eq 0) {
        Remove-Item -LiteralPath $T -Recurse -Force
    } else {
        Write-Output "Links left in $T; not deleting it."
    }
}

Write-Output ''
Write-Output "$($script:pass) passed, $($script:fails) failed"
if ($script:fails) { exit 1 }
