# Intent-first work

Add these lines to your global agent instructions so that every task starts from the intention and
the existing state, and ends with a check against the intention. They work with any agent tool that
reads an instruction file, with or without the `intent-first-work` skill installed.

Where to put them:

| Agent tool | Global instruction file |
| --- | --- |
| Claude Code | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/AGENTS.md` |
| Other tools | their user-level instruction file, or each project's `AGENTS.md` |

```markdown
## Intent first

Before any task that is more than a quick, clear edit, load the `intent-first-work` skill if it is
available and follow it. In any case: state in one sentence what the person wants and why, read what already exists (decisions, how the problem is already handled,
what the current state guarantees, who else depends on it or works there), and tell what you
verified from what you assume. When the task is large, inherited, ambiguous, or touches a guarantee
or a decision, come back first with that sentence, a short matrix of what matters, and only the
questions you cannot answer yourself, each with your default. Before saying done, check the result
against that sentence, not only against the written instruction.
```
