# Intent-first work

Add these lines to your global agent instructions when you use an agent tool without the
`intent-first-work` plugin. They keep every task anchored in the real user need, system coherence,
and honest verification — without adding ceremony to clear, local edits.

Where to put them:

| Agent tool | Global instruction file |
| --- | --- |
| Claude Code | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/AGENTS.md` |
| Other tools | their user-level instruction file, or each project's `AGENTS.md` |

In Claude Code and Codex, prefer the `intent-first-work` plugin instead: it stays silent on clear
tasks (0 token overhead), injects model-calibrated guidance only on ambiguous or structural
prompts, and pushes unread local decisions and consumers right before edits. With the plugin
installed, do not also copy these lines into an instruction file.

```markdown
## Intent first

Match effort to the task: a clear, local edit needs no ceremony.

For anything ambiguous, structural, inherited, or touching shared behaviour:
- **Intent first.** Separate the real goal from the proposed means. If the means works against the goal, or two directions carry a real trade-off, pause before coding with the goal in one line and at most two decisive questions (each with a default); otherwise act and state your assumption briefly.
- **Coherence over quick patches.** Read how the area already works — decisions, patterns, callers, root cause — before changing it. Fit into the system instead of throwing code at a symptom. Keep existing behaviour that has a reason to exist, or name plainly what you drop or put at risk (say nothing about what stays unchanged).
- **Verified against the goal.** Check that the user actually gets what they wanted, not only that a narrow check passes, and distinguish verified facts from assumptions.

Load the `intent-first-work` skill only when a task needs upfront framing (large, ambiguous, inherited, or cross-cutting).
```
