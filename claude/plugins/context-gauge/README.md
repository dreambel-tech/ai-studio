# context-gauge

A Claude Code plugin that tells the session, once per level, when its context has grown heavy, so
the agent can offer a fresh session at the next natural break.

## The problem

Every turn re-sends the whole conversation. A short command costs as much as the context it sits
in: at 600k tokens of context, one `ls` costs 600k input tokens. With a 1M context window and
auto-compaction near the limit, a long session can spend most of its tokens in its last, heaviest
turns.

Measured on one real session of 2,342 turns over six days: 1.15 billion input tokens, 93% of them
spent in turns above 250k of context, 79% in turns above 400k.

The model cannot see its own context size, so it cannot notice this on its own. The harness can.

## What it does

On every prompt you send, a `UserPromptSubmit` hook reads the size of the last request from the
session transcript (input + cache writes + cache reads). When the context crosses a level for the
first time, it adds a short note to the model's context:

- the current size and level (250k: heavy; 400k and 600k: very heavy);
- an instruction not to interrupt the current task, and to offer a fresh session from a relay brief
  at the next natural break (a batch delivered, a pull request opened, a report sent), once and in
  one place: in the tool's next-step box or suggestion buttons when it has them, as in the Claude
  desktop app, otherwise as one short sentence on the last line of the report.

In the terminal, the [context-line](../../statusline/) status line shows the same levels to you in
the footer, outside the conversation.

The [`session-relay`](../../../skills/session-relay/) skill describes how the agent assesses the
session and writes the brief. The plugin works without it, but works best with it.

Each level warns once. After a compaction brings the context back down, the levels can warn again.

## What it never does

- It never blocks a prompt and never fails a session: every outcome exits successfully.
- It prints nothing below the first level, and nothing at a level that already warned.
- It never reads anything but the end of the session transcript, and never sends data anywhere.
- It never writes outside its plugin data folder, where it keeps one small file per session.

## Install

```
/plugin install context-gauge --marketplace dreambel-tech/ai-studio
```

Requirement: `node` on your `PATH` (any maintained version).

## Settings

Set these in the `env` section of your Claude Code settings:

| Variable | Default | Effect |
| --- | --- | --- |
| `CONTEXT_GAUGE_LEVELS` | `250000,400000,600000` | Comma-separated levels, in tokens (`250000`) or, when the window size is known, as a share of it (`60%`). |
| `CONTEXT_GAUGE_NOTIFY_USER` | unset | `1` also shows you a one-line notice when a level is crossed. |

By default only the agent sees the note, and it tells you in its own words at the right moment.
That keeps it to one sentence instead of two.

Claude Code can also compact earlier on its own: `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (for example
`50`) lowers the auto-compaction threshold. A relay brief keeps more than a compaction summary, so
the gauge and an earlier compaction work well together.

## Limitations

- The transcript format is not a documented interface. If it changes, the gauge goes silent rather
  than wrong, and the tests in `tests/context-gauge.test.mjs` show what to update.
- The display of the optional user notice in the Claude desktop app is not documented.

## Tests

```bash
node --test
```

Run from the repository root. The same script ships in the
[Codex plugin](../../../codex/plugins/context-gauge/), which also reads Codex rollouts; the tests
cover both formats and check that the two copies are identical.
