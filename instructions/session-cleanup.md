# Session cleanup

Add these lines to your global agent instructions so that every session cleans up after its own
work. They work with any agent tool that reads an instruction file, with or without the
`session-cleanup` skill installed.

Where to put them:

| Agent tool | Global instruction file |
| --- | --- |
| Claude Code | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/AGENTS.md` |
| Other tools | their user-level instruction file, or each project's `AGENTS.md` |

```markdown
## Cleanup after work

At the end of each sound unit of work (validated, merged, or abandoned on purpose), list what this
session left on the computer, with sizes, using the `session-cleanup` skill if it is available:
worktrees and branches it no longer needs, browser profiles, temporary files, copied env files,
servers it started, entries it added to shared config files. Ask which to remove and remove only
those. Never touch what belongs to another session, uncommitted work or the user's data, and keep
what a published page or document was built from. For browser checks and screenshots, use the
agent tool's browser rather than scripts that launch a headless browser.
```
