# Reviewer checklist

For the person reviewing a change to existing code, whoever or whatever wrote it. It needs no
model: paste the template into a pull request description, have the author fill it in, and check
each answer against the diff.

It targets the defects that look like success: solving the wrong goal, patching a symptom instead
of fitting into the system, silently dropping intentional behaviour, or breaking a consumer nobody
checked.

## Template

```markdown
## Goal

<!-- One sentence: what the user actually wants to obtain, and why. Not the ticket title. -->

## Coherence and root cause

<!-- How this change fits existing patterns and addresses the real cause rather than adding a
local workaround. If existing behaviour was changed, dropped, or put at risk, name it and why;
if none, leave blank. -->

- [ ] ...

## Who depends on what changed

<!-- Every reader of what you removed, moved, or renamed: callers, listeners, config, events,
files. Say how you checked. -->

- [ ] ...

## Relevant decisions

<!-- Decision records or local docs that govern the area touched. Followed, or departed from
with whose approval. -->

- [ ] ...

## Verified or assumed

<!-- What was actually run (tests, replay, screenshot, log) and what was checked only by reading. -->
```

A pure addition or a literal edit can leave the middle sections empty and say so in one line.

## Checking the answers

- [ ] The goal reflects the real user need, and the diff serves it without scope creep.
- [ ] The change fits existing abstractions and conventions instead of layering a one-off patch.
- [ ] Every removed or rewritten block has a clear reason; no intentional behaviour was quietly lost.
- [ ] Renamed or removed symbols were checked beyond direct callers (events, config, docs, tests).
- [ ] Local decision records covering the touched area are respected, or the departure was agreed.
- [ ] Claims of verification match what was actually run.
