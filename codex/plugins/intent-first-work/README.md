# intent-first-work for Codex

A Codex plugin that pairs the [`intent-first-work`](../../../skills/intent-first-work/) skill with
a silent-by-default, event-driven hook. It is the Codex counterpart of the
[Claude Code plugin](../../../claude/plugins/intent-first-work/) and ships the exact same hook
script, skill, and standalone instructions.

## What it does

- **0 tokens at `SessionStart`:** no permanent instruction tax on clear, routine tasks.
- **`UserPromptSubmit`:** stays silent on clear follow-ups, routine commands, pure questions,
  detailed specs, and replies to an agent's question. On ambiguous, structural, or handed-over
  prompts, injects a concise, model-calibrated nudge (detected from the Codex rollout's model and
  reasoning effort, or overridden via `INTENT_FIRST_PROFILE=guided|standard|minimal|off`). Set
  `INTENT_FIRST_LOG=1` to record optional metadata-only JSONL telemetry (`telemetry.jsonl`) in the
  plugin's data directory.
- **`PreToolUse` (`apply_patch`, `Edit`, `Write`):** checks local decisions, spec deviations,
  scoped `AGENTS.md`, shared blast radius (highly referenced files/symbols or global CSS selectors),
  external consumers, tests, and recent git history for the touched file. Filters out files already
  read in the session and deduplicates once per file per session. Stays completely silent when
  nothing relevant is unread.

Codex installs a plugin by copying its folder into a cache, so this plugin ships its own identical
copies of the skill, hook, and instructions file; the test suite enforces parity.

## Install

```bash
codex plugin marketplace add dreambel-tech/ai-studio
codex plugin add intent-first-work@ai-studio
```

Then review and trust the hooks once with `/hooks` in Codex: Codex runs plugin hooks only after you
trust them, and again after each update.

Requirement: `node` and `git` on your `PATH`.

**Do not also copy [`instructions/intent-first-work.md`](../../../instructions/intent-first-work.md)
into `~/.codex/AGENTS.md` or a project's `AGENTS.md`** when the plugin is enabled.

## Turn it off in one project

Add this to the project's `.codex/config.toml`:

```toml
[plugins."intent-first-work@ai-studio"]
enabled = false
```

## Tests

```bash
node --test
```

Run from the repository root.
