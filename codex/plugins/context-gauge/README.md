# context-gauge for Codex

A Codex plugin that tells the session, once per level, when its context has grown heavy, so the
agent can offer a fresh session at the next natural break. It is the Codex side of the
[Claude Code plugin of the same name](../../../claude/plugins/context-gauge/), and ships the same
script.

## What it does

On every prompt you send, a `UserPromptSubmit` hook reads the last `token_count` event of the
session rollout: the size of the last request and the model's context window. When the context
crosses a level for the first time, it adds a short note to the model's context, asking it not to
interrupt the current task and to offer one move at the next natural break: `/compact` if the same
thread continues, or a fresh session from a relay brief if the topic changes or the session was
already compacted twice.

Levels:

- for a context window under 500k tokens: 60% (heavy) and 80% (very heavy) of the window;
- for larger windows: 250k (heavy), then 400k and 600k tokens (very heavy).

The [`session-relay`](../../../skills/session-relay/) skill describes how the agent assesses the
session and writes the brief. Each level warns once; after a compaction brings the context back
down, the levels can warn again. The hook never blocks and prints nothing below the first level.

## Install

```bash
codex plugin marketplace add dreambel-tech/ai-studio
codex plugin add context-gauge@ai-studio
```

Then review and trust the hook once with `/hooks` in Codex: Codex runs a plugin hook only after
you trust it, and again after each change to it.

Requirement: `node` on your `PATH` (any maintained version).

## Settings

| Variable | Default | Effect |
| --- | --- | --- |
| `CONTEXT_GAUGE_LEVELS` | see above | Comma-separated levels, in tokens (`150000`) or as a share of the window (`60%`). |
| `CONTEXT_GAUGE_NOTIFY_USER` | unset | `1` also shows you a one-line notice when a level is crossed. |

## Limitations

- The rollout format is not a documented interface. If it changes, the gauge goes silent rather
  than wrong.
- Tested against real Codex 0.163.0 rollouts and with a local install; not yet observed inside a
  live Codex session.

## Tests

```bash
node --test
```

Run from the repository root. The tests cover both formats and check that the Claude and Codex
copies of the script are identical.
