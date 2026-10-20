# session-cleanup for Codex

A Codex plugin that gives each session what it needs to clean up after its own work: the path of
its rollout, and the command that lists what it left on the computer, with sizes. It is the Codex
side of the [Claude Code plugin of the same name](../../../claude/plugins/session-cleanup/), and
ships the same hook and script.

## What it does

When a session starts, a `SessionStart` hook adds a short note to the model's context: the scan
command of the [`session-cleanup`](../../../skills/session-cleanup/) skill, ready to run with this
session's rollout as `--history` and the project's launch configurations as `--config`, and the
routine: at the end of each sound unit of work, list what the session left, show the user a short
list with sizes, and remove only what they pick. When the disk has less than 20 GB free, it also asks
the session to offer an audit at the next natural break.

The hook never deletes anything and never blocks. The script checks each item again before
removing it, and only on the user's answer.

## Install

```bash
codex plugin marketplace add dreambel-tech/ai-studio
codex plugin add session-cleanup@ai-studio
```

Then review and trust the hook once with `/hooks` in Codex: Codex runs a plugin hook only after
you trust it, and again after each change to it. Codex reads the skill from `~/.agents/skills/` or a
project's `.agents/skills/`: copy [`skills/session-cleanup`](../../../skills/session-cleanup/) there
for the full routine.

Requirement: `node` on your `PATH` (any maintained version).

## Settings

| Variable | Default | Effect |
| --- | --- | --- |
| `SESSION_CLEANUP_MIN_FREE_GB` | `20` | Below this much free space, the note asks for an audit. |

## Limitations

- The rollout format is not a documented interface. If it changes, the script finds less in the
  rollout and lists fewer items as this session's, rather than more.
- Tested against real Codex rollouts of the desktop app; the hook has not yet been observed inside a
  live Codex session.

## Tests

```bash
node --test
```

Run from the repository root. The tests check that both plugins and the skill ship the same script,
and that both plugins ship the same hook.
