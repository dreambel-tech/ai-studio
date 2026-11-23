# intent-first-work

A Claude Code plugin that pairs the [`intent-first-work`](../../../skills/intent-first-work/) skill
with a silent-by-default, event-driven hook. It keeps agents aligned on the real user need and
coherent with the existing codebase — without adding a permanent token tax to clear tasks.

## The problem

Always-on instruction blocks act like a flat tax: they add extra turns and tokens on every clear,
routine task while treating a fast small model and a high-reasoning frontier model the same way.
At the same time, asking an LLM to remember to search for decisions and callers burns turns that a
50 ms local script can save.

## How it works

The plugin adds **0 tokens at `SessionStart`** and speaks only when a local, deterministic check
finds a concrete signal:

1. **On `UserPromptSubmit` (intent intelligence):**
   - **Silent (0 tokens)** on clear follow-ups, slash commands, routine commands (`run tests`,
     `commit`), pure questions, clean multi-point specs, anchored file:line/stacktrace prompts,
     and whenever the assistant's previous message ended with a question.
   - **Model-calibrated micro-nudge** on open-ended, ambiguous, structural, sweeping ("all fields",
     "real-time"), symptom-only, or handed-over prompts: encourages separating the real goal from
     the proposed means, pausing with at most 2 questions (each with a default) when a choice
     carries a real trade-off, and fixing the root cause instead of patching symptoms or altering
     shared types/styles without checking semantics.
   - Enforces a 1-turn cooldown so it never nags on consecutive turns.

2. **On `PreToolUse` for `Edit`, `Write`, and `MultiEdit` (system coherence):**
   - Inspects the target file and touched symbols locally via `git grep` and `git log` (no network,
     no dependencies, no extra LLM turn).
   - **Transcript-aware filter:** ignores any decision record, consumer, or test file the agent has
     already read in the current session.
   - **Blast-radius detection:** when a touched file, symbol, or global CSS selector (`::ng-deep`,
     `mat-*`, `body`, `*`) affects many files across multiple areas, surfaces a 1-line `shared`
     warning instead of silently dropping high-fan-out matches.
   - **Silent (0 tokens)** when nothing relevant is unread or when the file was already enriched
     earlier in the session.
   - Otherwise pushes a compact factual brief (shared blast radius, unread decisions/spec
     deviations/scoped `AGENTS.md`, external readers, tests, and recent commit subjects) right
     before the edit lands.

## Model & reasoning profiles

The hook automatically detects the active model and reasoning effort from the session transcript
(with a turn-1 fallback to host settings) and combines **size tier** (`0` small: Haiku, Luna,
Hydrogen, Mini, Nano, Flash, Lite, Small, Raptor · `1` medium/default: Sonnet, Terra, Neon, Argon,
or any unknown model · `2` large: Opus, Fable, Mythos, Sol, Astra, Carbon) with **reasoning effort**
(`-1` low / no thinking · `0` medium · `+1` high / max):

| Score (`size + effort`) | Profile | Typical combinations | Prompt nudge | Pre-edit brief |
| --- | --- | --- | --- | --- |
| `<= 0` | `guided` | Small (low/medium) · Medium (low) | Crisp 1-goal + max-2-questions framing; never loads the full skill | Facts + concise contract-handling rule |
| `1` | `standard` | Small (high) · Medium (medium) · Large (low) | Goal vs. means + out-of-scope + coherence reminder | Facts + brief coherence check |
| `>= 2` | `minimal` | Medium (high) · Large (medium/high) | Only lifts compliance bias on open/structural prompts (~30 tokens) | Raw unread facts only, zero lecturing |

Override at any time with `INTENT_FIRST_PROFILE=guided|standard|minimal|off`.

To measure real-world trigger rate, injected size, and latency locally, set `INTENT_FIRST_LOG=1`:
it appends one metadata-only JSONL line per hook call to `telemetry.jsonl` inside the plugin's
data directory (`PLUGIN_DATA`, `CLAUDE_PLUGIN_DATA`, or the OS temp folder) — never prompt text,
code, or file paths.

## Human review & retirement discipline

- **Human PR review:** [`reviewer-checklist.md`](../../../skills/intent-first-work/references/reviewer-checklist.md)
  brings the same intent and coherence questions to pull requests without needing a model.
- **Retirement test:** each time a new model family ships, re-weigh the plugin across four balanced
  baskets (clear tasks, ambiguous/XY prompts, changes in existing code, honest reporting). Remove
  any nudge that no longer improves outcomes for that tier.

## Install

```
/plugin install intent-first-work --marketplace dreambel-tech/ai-studio
```

Or from the command line, for all your projects:

```bash
claude plugin install intent-first-work@ai-studio
```

Requirement: `node` and `git` on your `PATH`.

**Do not also copy [`instructions/intent-first-work.md`](../../../instructions/intent-first-work.md)
into an instruction file** (`~/.claude/CLAUDE.md` or a project's `CLAUDE.md`): the plugin replaces
always-on instructions with event-driven hooks.

## Turn it off in one project

```bash
claude plugin disable intent-first-work@ai-studio --scope local
```

To turn it back on:

```bash
claude plugin enable intent-first-work@ai-studio --scope local
```

## Remove it

```bash
claude plugin uninstall intent-first-work@ai-studio
```

## Tests

```bash
node --test
```

Run from the repository root. The tests check Claude/Codex parity, model/effort profile detection,
prompt silence and triggers, transcript-aware `PreToolUse` filtering, and per-session deduplication.
