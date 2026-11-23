# Intent-first work

Add these lines to your global agent instructions when you use an agent tool without the
`intent-first-work` plugin. They keep every task anchored in the real user need, system coherence,
and honest verification — without adding ceremony to clear, local edits.

Where to put them:

| Agent tool | Instruction file |
| --- | --- |
| Claude Code | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/AGENTS.md` |
| GitHub Copilot (VS Code, JetBrains, Visual Studio, GitHub.com) | Project `AGENTS.md` (read natively — no need to duplicate in `.github/copilot-instructions.md`), or path-scoped `.github/instructions/*.instructions.md` |
| Other tools | Their user-level instruction file, or each project's `AGENTS.md` |

In Claude Code, Codex, and GitHub Copilot (VS Code / CLI), prefer the `intent-first-work` plugin
instead: it stays silent on clear tasks (0 token overhead), injects model-calibrated guidance only
on ambiguous or structural prompts, and pushes unread local decisions, blast-radius warnings, and
consumers right before edits. With the plugin installed, do not also copy these lines into an
instruction file.

```markdown
## Intent first

Match effort to the task: a clear, local edit needs no ceremony.

For anything ambiguous, structural, inherited, or touching shared behaviour:
- **Intent first.** Separate the real goal from the proposed means (do not take vague or reworded tickets literally). If the means works against the goal, or two directions carry a real trade-off, pause with the goal in one line and at most two questions (each with a default); otherwise act and state your assumption briefly.
- **Root cause & coherence.** Read local decisions, patterns, callers, and root cause before editing. Fix the cause instead of patching symptoms, fabricating data, or widening shared types, components, or global styles without checking semantics and blast radius. Keep intentional behaviour, or name plainly what you drop or risk (say nothing about what stays unchanged).
- **Verified against the goal.** Check the user gets what they wanted, not only a narrow check, and separate verified facts from assumptions.

Load the `intent-first-work` skill only when a task needs upfront framing.
```
