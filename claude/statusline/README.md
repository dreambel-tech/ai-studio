# context-line

A Claude Code status line that shows the session's context size in the terminal footer, outside
the conversation:

- while the session is light, in dim text: `context 120k (12%)`;
- once it is heavy, in amber: `context 300k (30%), heavy: compacting or a fresh session would cost less per step`;
- once it is very heavy, in red, with the same text.

It uses the same levels as the [context-gauge](../plugins/context-gauge/) plugin: 250k, 400k and
600k tokens for windows of 500k tokens or more, 60% and 80% of the window for smaller ones, or the
`CONTEXT_GAUGE_LEVELS` setting. The plugin tells the agent; the status line tells you, without
adding anything to the conversation.

## Install

A plugin cannot set a status line, so this one goes in your Claude Code settings. Clone this
repository, then add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /path/to/ai-studio/claude/statusline/context-line.mjs"
  }
}
```

The script imports the level logic from `../plugins/context-gauge/hooks/`, so run it from a full
clone. `git pull` keeps it up to date.

Requirements: `node` on your `PATH`; a terminal with ANSI colours (set `NO_COLOR=1` to turn them
off). The status line runs locally and uses no tokens.

## Where it shows

The status line is part of the Claude Code terminal interface. Other surfaces, such as the desktop
app, may not show it; there, the agent's offer at the next natural break is the only signal.
