# intent-first-work

A Claude Code plugin that brings the [`intent-first-work`](../../../skills/intent-first-work/) skill
and its [instruction lines](../../../instructions/intent-first-work.md) to every session, so each
task starts from the intention and the existing state, and ends with a check against the intention.

## The problem

The skill alone is rarely loaded: an agent that has not been told to use it at the start of a task
seldom reaches for it. With the instruction lines, it does. Until now those lines had to be copied
by hand into each machine's instruction file, kept up to date there, and removed by hand.

## What it does

When a session starts, resumes, or comes back from a compaction or `/clear`, a `SessionStart` hook
adds the lines to the model's context. It reads them at run time from
[`instructions/intent-first-work.md`](../../../instructions/intent-first-work.md), the fenced block
only, so they are never copied and always match the published file. The plugin also brings the
skill itself, and only that skill.

Installed, the lines and the skill are there in every project. Disabled or uninstalled, both are
gone. Nothing is written to your projects or to your instruction files.

The hook never blocks a session and never fails: without the file or its block, it adds nothing.

## Install

```
/plugin install intent-first-work --marketplace dreambel-tech/ai-studio
```

Or from the command line, for all your projects:

```bash
claude plugin install intent-first-work@ai-studio
```

Requirement: `node` on your `PATH` (any maintained version).

**Do not also copy the lines into an instruction file** (`~/.claude/CLAUDE.md`, a project's
`CLAUDE.md` or `AGENTS.md`): the agent would read them twice. If you copied them before, remove
them. The same goes for a hand copy of the skill in `~/.claude/skills/intent-first-work`, which
would be listed next to the plugin's.

The `studio-skills` plugin also includes the skill, but not the lines. With both installed, the
lines come once and the skill is listed twice, under each plugin's name.

## Turn it off in one project

Run this in the project:

```bash
claude plugin disable intent-first-work@ai-studio --scope local
```

It writes `"intent-first-work@ai-studio": false` under `enabledPlugins` in the project's
`.claude/settings.local.json`, a file for you alone that is not meant to be committed. The plugin
stays on everywhere else. To turn it back on there:

```bash
claude plugin enable intent-first-work@ai-studio --scope local
```

The change applies to sessions started after it.

## Remove it

```bash
claude plugin uninstall intent-first-work@ai-studio
```

## Tests

```bash
node --test
```

Run from the repository root. The tests check that the hook adds exactly the fenced block of the
instructions file, that the marketplace entry loads only this skill, and that the
[Codex plugin](../../../codex/plugins/intent-first-work/) ships the same hook and identical copies of
the skill and the instructions.
