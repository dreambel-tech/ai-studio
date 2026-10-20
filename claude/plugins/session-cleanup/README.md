# session-cleanup

A Claude Code plugin that gives each session what it needs to clean up after its own work: the path
of its history, and the command that lists what it left on the computer, with sizes.

## The problem

Agent sessions leave things behind: worktrees and branches after a merge, browser profiles from
screenshot scripts, copied `.env` files, scratch outputs, entries in launch configurations. One
real case: a session left 174 headless Chrome profiles (8.2 GB), and the disk was so full that the
next session could not create its worktree.

The [`session-cleanup`](../../../skills/session-cleanup/) skill makes cleanup a habit at the end of
each unit of work, with a script that lists the leftovers and removes only what the user picks. To
tell what this session created from what other sessions did, the script reads the session's
history. The session does not know where its history is. The harness does.

## What it does

When a session starts, resumes, or comes back from a compaction or `/clear`, a `SessionStart` hook
adds a short note to the model's context:

- the scan command, ready to run, with this session's transcript as `--history`, and the
  project's launch configurations (`.claude/launch.json`, `.vscode/launch.json`) as `--config`;
- the routine: at the end of each sound unit of work, list what the session left, show the user a
  short list with sizes, and remove only what they pick;
- in the Claude app, that worktrees in `.claude/worktrees` belong to app sessions, so one is offered
  only if its session is archived or the user confirms its work is done;
- when the disk has less than 20 GB free, a request to offer an audit at the next natural break.

The plugin ships its own copy of the skill's script, so the command works even without the skill.
The skill describes the whole routine and works best with the plugin.

## What it never does

- It never deletes anything: removal only happens when the session runs the script's `remove`
  command after the user's answer, and the script checks each item again first.
- It never blocks a session and never fails: every outcome exits successfully.
- It reads nothing but the disk's free space and whether the launch configurations exist, and
  never sends data anywhere.

## Install

```
/plugin install session-cleanup --marketplace dreambel-tech/ai-studio
```

For the full routine, also install the skill: the `studio-skills` plugin includes it.

Requirement: `node` on your `PATH` (any maintained version).

## Settings

Set these in the `env` section of your Claude Code settings:

| Variable | Default | Effect |
| --- | --- | --- |
| `SESSION_CLEANUP_MIN_FREE_GB` | `20` | Below this much free space, the note asks for an audit. |

## Limitations

- The transcript format is not a documented interface. If it changes, the script finds less in the
  history and lists fewer items as this session's, rather than more.
- Whether a worktree in `.claude/worktrees` belongs to a session that is still open is known to the
  Claude app, not to the script: the session checks with the app or asks the user.

## Tests

```bash
node --test
```

Run from the repository root. The tests check that this plugin, the
[Codex plugin](../../../codex/plugins/session-cleanup/) and the skill ship the same script, and that
both plugins ship the same hook.
