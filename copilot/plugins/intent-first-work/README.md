# intent-first-work for GitHub Copilot

A GitHub Copilot [Agent Plugin 1.0](https://agent-plugins.org) (for **VS Code** and **GitHub
Copilot CLI**) that pairs the [`intent-first-work`](../../../skills/intent-first-work/) skill with
a silent-by-default, event-driven hook. It ships the exact same hook script and skill as the
[Claude Code](../../../claude/plugins/intent-first-work/) and
[Codex](../../../codex/plugins/intent-first-work/) plugins.

## What it does

- **0 tokens at `SessionStart`:** no permanent instruction tax on clear, routine tasks.
- **`userPromptSubmitted` (`UserPromptSubmit`):** stays silent on clear follow-ups, routine
  commands, pure questions, and clean specs. On ambiguous, structural, sweeping ("all fields",
  "real-time"), or symptom-only prompts, injects a concise nudge calibrated to model capability
  (lightweight models like `mini`/`flash`/`haiku` get `guided`; override via
  `INTENT_FIRST_PROFILE=guided|standard|minimal|off`).
- **`preToolUse` (`PreToolUse`):** exits immediately (0 tokens, no `git` calls) on non-edit tools.
  Before edits (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`,
  `edit_file`, `editFiles`, `Edit`, `Write`, `apply_patch`), checks local decisions, spec
  deviations, scoped `AGENTS.md`, shared blast radius (highly referenced files/symbols or global
  CSS selectors), external consumers, tests, and recent git history. Deduplicates once per file per
  session.

Because Copilot installs a plugin by copying its folder into `~/.copilot/installed-plugins/`, this
plugin bundles its own identical copies of the skill and hook; the test suite enforces parity.

## Install (VS Code & GitHub Copilot CLI)

```bash
copilot plugin marketplace add dreambel-tech/ai-studio
copilot plugin install intent-first-work@ai-studio
```

VS Code automatically discovers plugins installed via the Copilot CLI (you can also manage them via
*Chat: Open Customizations* with `chat.plugins.enabled`).

Requirement: `node` and `git` on your `PATH`.

### Lightweight models tip

Copilot command hooks do not always include the active model name in `stdin`. If you primarily run
lightweight models (`mini`, `flash`, `haiku`, etc.), set `INTENT_FIRST_PROFILE=guided` in your
shell or VS Code environment to ensure the tighter anti-workaround framing is always used.

### JetBrains (IntelliJ, PyCharm…) & Visual Studio

In IDEs where Copilot does not yet execute plugin hooks natively, use your repository's `AGENTS.md`
directly (GitHub Copilot reads root and nested `AGENTS.md` files natively — no need to duplicate
into `.github/copilot-instructions.md`) with the compact block in
[`instructions/intent-first-work.md`](../../../instructions/intent-first-work.md). For file-type
rules (e.g. `**/*.scss` or `**/migrations/**`), you can complement `AGENTS.md` with glob-scoped
`.github/instructions/*.instructions.md` files.

**When the plugin is active in VS Code / Copilot CLI, do not also copy
`instructions/intent-first-work.md` into `AGENTS.md`.**

## Tests

```bash
node --test
```

Run from the repository root.
