# agent-skills-bridge

A Claude Code plugin that makes the skills in a project's `.agents/skills/` folder available in Claude Code, without copying them.

## The problem

The cross-tool [Agent Skills](https://agentskills.io) convention keeps a project's skills in `.agents/skills/`. OpenAI Codex and other agents read that folder.

Claude Code does not. It discovers skills in:

- `.claude/skills/` (project);
- `~/.claude/skills/` (personal);
- plugins;
- directories added with `--add-dir`.

So a project that follows the convention has skills that Claude Code never sees.

The fix is to link `.claude/skills` to `.agents/skills` once per project. `.agents/skills/` stays the single source of truth. Every skill in it becomes a real Claude Code skill: listed, invoked automatically when relevant, and available as `/skill-name`. This plugin creates that link for you at the start of every session, on every machine where it is installed.

## What it does

At session start, the plugin looks at the folder you opened and at each of its direct subfolders. It applies the same steps to every one of them that has a `.agents/skills/` folder:

1. If `.claude/skills` does not exist, it links it to `.agents/skills`. It creates `.claude/` first if needed. The link type depends on the OS:
   - **Windows**: a directory junction. A junction needs no administrator rights and no Developer Mode.
   - **macOS and Linux**: a relative symbolic link (`.claude/skills -> ../.agents/skills`).
2. It keeps the new link out of `git status` on your machine only, by adding it to `.git/info/exclude`:
   - in the folder's own repository, as `/.claude/skills`;
   - or, for a plain subfolder of a repository opened at its root, in that repository, as `/<subfolder>/.claude/skills`.
3. If `.claude/skills` is already a link to `.agents/skills`, it does nothing.

When it has created at least one link, it prints a single short message listing the folders concerned, and asks Claude Code to re-scan skills. When there is nothing to do, it prints nothing.

### Umbrella folders

You may open Claude Code in a folder that is not itself a project but holds several, each with its own repository:

```
ailo/                          <- session folder, no .agents
├── ailo-landing-page/
│   └── .agents/skills/        <- linked: ailo-landing-page/.claude/skills
├── ailo-android/              <- no .agents: left alone
└── node_modules/              <- never scanned
```

The plugin links `.claude/skills` in every direct subfolder that has `.agents/skills`, as it would at the root. To keep the session start instant, it looks only one level down, never recursively. It skips:

- hidden folders (names starting with `.`);
- dependency and build folders: `node_modules`, `bower_components`, `vendor`, `dist`, `build`, `out`, `target`, `bin`, `obj`, `coverage`, `__pycache__`, `venv`.

Claude Code loads skills from a subfolder's `.claude/skills/` later than from the session folder, so these skills are not available right away. See [Limitations](#limitations).

## What it never does

- It never modifies, moves or deletes an existing `.claude/skills` folder. It never replaces a link that points somewhere else. In both cases it names the folder in its message, explains what to do, and leaves everything as it is.
- It never edits a `.gitignore` and never commits anything.
- It never scans deeper than one level below the session folder.
- It never copies skills, and never writes to `.agents/skills/`.
- It never blocks a session. Every outcome, including errors, exits successfully with at most one message.
- It adds no skills, commands or agents of its own. The plugin is a single `SessionStart` hook.

## Install

In Claude Code:

```
/plugin marketplace add GuenoleK/agent-skills-bridge
/plugin install agent-skills-bridge@agent-skills-bridge
```

The first command adds this repository as a plugin marketplace. The second installs the plugin from it. Claude Code opens the plugin panel so you can choose the installation scope; the user scope enables it in all your projects.

From a terminal, the equivalent is:

```bash
claude plugin marketplace add GuenoleK/agent-skills-bridge
claude plugin install agent-skills-bridge@agent-skills-bridge
```

Requirements:

- **Windows**: Windows PowerShell 5.1, which ships with Windows. It works with or without Git Bash.
- **macOS and Linux**: a POSIX `sh`.

There are no other dependencies: no Node, Python or `jq`.

## Disable or uninstall

```
/plugin disable agent-skills-bridge@agent-skills-bridge
/plugin uninstall agent-skills-bridge@agent-skills-bridge
```

Disabling or uninstalling the plugin leaves existing links in place, and they keep working. To remove a link from a project:

- **Windows**: `cmd /c rmdir .claude\skills`

  This removes only the junction. Do not use `Remove-Item -Recurse` or `del /s` on a junction: they can delete the files in `.agents/skills` through it.
- **macOS and Linux**: `rm .claude/skills`. Use no trailing slash and no `-r`.

## Manual alternative

You can create the link yourself, once per project, without the plugin. Run the command from the project root.

Windows (Command Prompt):

```bat
mkdir .claude 2>nul & mklink /J .claude\skills .agents\skills
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude | Out-Null; New-Item -ItemType Junction -Path .claude\skills -Target .agents\skills
```

macOS and Linux:

```bash
mkdir -p .claude && ln -s ../.agents/skills .claude/skills
```

Optionally, keep the link out of `git status` on your machine:

```bash
echo /.claude/skills >> .git/info/exclude
```

## How it works

The plugin has one hook, `hooks/hooks.json`, which runs one command at `SessionStart`:

```
exec sh "${CLAUDE_PLUGIN_ROOT}/hooks/link-skills.sh"; powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/hooks/link-skills.ps1"
```

Claude Code has no per-OS hook selection. It runs a hook command with `sh` on macOS and Linux. On Windows it uses Git Bash when installed, and PowerShell otherwise. The single command above is valid in both shells:

- **macOS and Linux** (`sh`): `exec` replaces the shell with `link-skills.sh`, so the PowerShell part never runs.
- **Windows with Git Bash**: same as above. `link-skills.sh` detects Windows and hands over to `link-skills.ps1`, because `ln -s` in Git Bash copies files instead of linking them.
- **Windows without Git Bash** (PowerShell): `exec` is not a PowerShell command. It fails silently, on stderr, and the `powershell` part runs `link-skills.ps1`.

Each script reads the session folder from `CLAUDE_PROJECT_DIR`, falling back to the `cwd` field of the hook input. Messages are returned as `systemMessage`, so they are shown to you and are not added to Claude's context. After creating a link, the hook also returns `reloadSkills: true` so Claude Code re-scans skills in the same session.

## Limitations

- **First session.** Claude Code discovers skills before `SessionStart` hooks finish. For the session folder, the plugin asks for a re-scan, which makes the skills available in the same session with the Claude Code version it was tested on. If they do not appear, restart the session once. Later sessions find the link already in place.
- **Skills in subfolders load later.** This applies to umbrella folders and to subpackages. The Claude Code documentation ([Load skills in monorepos and subdirectories](https://code.claude.com/docs/en/skills)) says that skills in a `.claude/skills/` directory below where you started do not load at startup. They load the first time Claude reads or edits a file in that subdirectory, and stay available for the rest of the session. Until then, they are not in the `/` menu and cannot be invoked by name.
  - To load them at once, run `/add-dir` with the subfolder's path (Claude Code v2.1.257 or later).
  - The re-scan does not help here: with Claude Code 2.1.283, it did not pick up a subfolder's skills.
- **A real `.claude/skills` folder is left untouched.** Move its skills into `.agents/skills`, then delete `.claude/skills`. The link is created at the next session start.
- **Windows junctions store an absolute path.** If you move or rename the project folder, the junction still points to the old location. Remove it with `cmd /c rmdir .claude\skills`; the plugin recreates it at the next session start. Links on macOS and Linux are relative and are not affected.
- **Git worktrees.** In a worktree, `.git` is a file, not a folder. The link is created, but it is not added to `.git/info/exclude`, so it can appear as untracked in `git status`.
- **One level deep.** Only the session folder and its direct subfolders are scanned. A project two levels down is linked when you open Claude Code in it, or in its parent folder.

## Tests

Run the test suite for your platform from the repository root.

Windows (needs git):

```powershell
powershell -ExecutionPolicy Bypass -File tests\run.ps1
```

macOS and Linux (optionally pass the shell to test, such as `dash` or `"bash --posix"`):

```bash
tests/run.sh
```

Each suite creates throwaway projects in a temporary folder and deletes them afterwards. On Windows, it removes each junction with `rmdir` before deleting anything. The suites cover:

- link creation and a silent second run;
- a project without `.agents`;
- an existing real `.claude/skills` folder, a link pointing elsewhere, and a broken link;
- a project path read from the hook input;
- umbrella folders: only the subproject with `.agents/skills` is linked, a subproject's real folder is left alone, and `node_modules`, hidden and build folders are ignored;
- the exact `hooks.json` command, run the way Claude Code runs it.

Version 0.2.0 passes both suites with Claude Code 2.1.283:

- **Windows 11**: Windows PowerShell 5.1. The hook command is run through both Git Bash and PowerShell.
- **Ubuntu (WSL)**: `dash` and `bash --posix`.

macOS was not tested on real hardware. The script uses only POSIX features available in macOS's `/bin/sh`.

## License

[MIT](LICENSE) © 2026 Guénolé Kikabou
