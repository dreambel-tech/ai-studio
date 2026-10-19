# Session relay

Add these lines to your global agent instructions so that every session assesses its own weight at
natural breaks. They work with any agent tool that reads an instruction file, with or without the
`session-relay` skill installed.

Where to put them:

| Agent tool | Global instruction file |
| --- | --- |
| Claude Code | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/AGENTS.md` |
| Other tools | their user-level instruction file, or each project's `AGENTS.md` |

```markdown
## Session weight

At the end of each completed unit of work (a batch, a pull request, a report, a validated change),
assess how heavy this session has become, using the `session-relay` skill if it is available. If it
is heavy, offer one move, once and in one place: compacting here if the same thread continues (give
the compaction command ready to copy), or a fresh session from a relay brief if the topic changes or
the session was already compacted twice. Put it in the agent tool's next-step box or suggestion
buttons if it has them, otherwise on the last line of your report. Never interrupt a task for this,
never block, and do not repeat the offer at the same level.
```
