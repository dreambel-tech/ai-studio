# ai-studio

Dreambel Tech's toolkit for working with AI agents: skills and instructions that work with any
agent tool, plus thin adapters for the tools that can do more.

## Layout

```
skills/             Agent Skills (SKILL.md), for any agent tool
instructions/       Lines to add to your agent instruction files (AGENTS.md, CLAUDE.md)
claude/plugins/     Claude Code plugins
claude/statusline/  Claude Code status line
codex/              Codex adapters
tests/              Tests for the scripts shared by several adapters
```

The shared parts, `skills/` and `instructions/`, name no agent tool. Each tool folder only adds
what that tool makes possible, such as an exact context count or a one-step install. Everything in
the shared parts works without the adapters.

## Skills

<!-- agents-skills:index:start -->
| Skill | Description |
| --- | --- |
| [code-coherence-guardrails](skills/code-coherence-guardrails/) | Guardrails for coherent code and architecture reviews. |
| [dreambel-deliver-with-evidence](skills/dreambel-deliver-with-evidence/) | Evidence-first delivery for complex changes |
| [meaning-first-design](skills/meaning-first-design/) | Avoid generic AI-looking interfaces by letting the meaning of the project drive every design choice |
| [react-scss-architecture](skills/react-scss-architecture/) | React architecture with strict TypeScript and global SCSS |
| [session-relay](skills/session-relay/) | Keep long sessions affordable: assess their weight, offer a fresh session, write the relay brief |
<!-- agents-skills:index:end -->

Each skill is a folder with a `SKILL.md`, following the [Agent Skills](https://agentskills.io)
standard. Copy a folder into your agent tool's skills folder, such as `.agents/skills/` in a
project, or install them all as a Claude Code plugin (below).

## Instructions

| File | Purpose |
| --- | --- |
| [session-relay.md](instructions/session-relay.md) | Makes every session assess its own weight at natural breaks. |

## Claude Code

| Plugin | What it does |
| --- | --- |
| `studio-skills` | Every skill in `skills/`, as Claude Code skills. |
| [agent-skills-bridge](claude/plugins/agent-skills-bridge/) | Links a project's `.claude/skills` to its `.agents/skills`, so Claude Code sees the same skills as other agent tools. |
| [context-gauge](claude/plugins/context-gauge/) | Tells the session once per level when its context grows heavy, so it can offer a fresh session. |

In the terminal, the [context-line](claude/statusline/) status line also shows the context size in
the footer, dim while the session is light and coloured once it is heavy. A plugin cannot set a
status line, so it goes in your settings.

Install a plugin in one step (Claude Code 2.1.275 or later):

```
/plugin install studio-skills --marketplace dreambel-tech/ai-studio
/plugin install context-gauge --marketplace dreambel-tech/ai-studio
```

Or add the marketplace once, then install any plugin from it:

```
/plugin marketplace add dreambel-tech/ai-studio
/plugin install agent-skills-bridge@ai-studio
```

## Codex

Codex reads the standard `SKILL.md` format, so the skills in `skills/` need no adapter: copy them
into `~/.agents/skills/` or a project's `.agents/skills/`.

| Plugin | What it does |
| --- | --- |
| [context-gauge](codex/plugins/context-gauge/) | Tells the session once per level when its context grows heavy, so it can offer a fresh session. |

```bash
codex plugin marketplace add dreambel-tech/ai-studio
codex plugin add context-gauge@ai-studio
```

Codex reads its own marketplace, [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json),
before the Claude Code one, so each tool only sees the plugins written for it.

## Tests

```bash
node --test
```

The `agent-skills-bridge` plugin has its own shell test suites, described in its README.

## History

This repository brings together two earlier repositories, with their full history:

- `dreambel-tech/agents-skills`, now in `skills/`;
- `GuenoleK/agent-skills-bridge`, now in `claude/plugins/agent-skills-bridge/`.

## License

[MIT](LICENSE) © 2026 Dreambel Tech. The `agent-skills-bridge` plugin keeps its own
[MIT license](claude/plugins/agent-skills-bridge/LICENSE) © 2026 Guénolé Kikabou.
