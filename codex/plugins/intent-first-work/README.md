# intent-first-work for Codex

A Codex plugin that brings the [`intent-first-work`](../../../skills/intent-first-work/) skill and its
[instruction lines](../../../instructions/intent-first-work.md) to every session. It is the Codex side
of the [Claude Code plugin of the same name](../../../claude/plugins/intent-first-work/), and ships
the same hook.

## What it does

When a session starts, a `SessionStart` hook adds the lines to the model's context: the fenced block
of `instructions/intent-first-work.md`, read at run time. The plugin also brings the skill.

Codex installs a plugin by copying its folder into a cache, so the plugin cannot read the files at
the root of this repository. It ships its own copies of the skill and the instructions file instead;
the tests check that they stay identical to the originals.

Installed, the lines and the skill are there in every project. Disabled or uninstalled, both are
gone. Nothing is written to your projects or to your instruction files. The hook output is about
300 tokens, well under the 2,500 tokens Codex keeps of a hook's output.

## Install

```bash
codex plugin marketplace add dreambel-tech/ai-studio
codex plugin add intent-first-work@ai-studio
```

Then review and trust the hook once with `/hooks` in Codex: Codex runs a plugin hook only after you
trust it, and again after each change to it.

Requirement: `node` on your `PATH` (any maintained version).

**Do not also copy the lines into an instruction file** (`~/.codex/AGENTS.md` or a project's
`AGENTS.md`): the agent would read them twice. If you copied them before, remove them. The same goes
for a hand copy of the skill in `~/.agents/skills/intent-first-work`.

## Turn it off in one project

Add this to the project's `.codex/config.toml`:

```toml
[plugins."intent-first-work@ai-studio"]
enabled = false
```

Codex reads a project's `.codex/config.toml` only when you trust the project. The file lives in the
project, so in a repository that is not yours, keep it out of commits by adding `.codex/config.toml`
to `.git/info/exclude`, which is never committed. The plugin stays on everywhere else.

## Limitations

- The per-project setting follows Codex's documentation; it has not yet been tried in a live Codex
  session, nor has the hook.

## Tests

```bash
node --test
```

Run from the repository root.
