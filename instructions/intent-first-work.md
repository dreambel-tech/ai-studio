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

In Claude Code and Codex, the `intent-first-work` plugin gives these lines to each session instead,
with the skill, and takes them away when it is disabled. With the plugin, do not also copy them into
an instruction file: the agent would read them twice.

```markdown
## Intent first

Before any task that is more than a quick, clear edit, load the `intent-first-work` skill if it is
available and follow it. In any case: state in one sentence what the person wants and why, read what already exists (decisions, how the problem is already handled,
what the current state guarantees, who else depends on it or works there), and tell what you
verified from what you assume. When you change existing code, even to fix a bug, first write down
what it does today that must survive: everything the code you replace or wrap shows, says,
announces, checks or triggers, and what the decision records and docs of that area decide (search
them for the names you touch). A few lines, from reading what you change, are enough. Keep each
one, or say plainly which you drop and why, and name each in your final message; when you cannot
run the code, say it was checked by reading. An edit that only applies what the person spelled out
needs none of this.
Then do the task on the most plausible reading. Stop and ask first only if two readings lead to
different changes and the wrong one would be costly to undo, if the request contradicts a recorded
decision, or if the change would delete data or change something outside the task; otherwise act,
and put your questions and assumptions in your report. Before saying done, check the result against that sentence and
that list, not only against the written instruction.
```
