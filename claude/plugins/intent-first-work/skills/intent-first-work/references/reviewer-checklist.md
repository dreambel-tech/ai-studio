# Reviewer checklist

For the person (or agent) reviewing a change to existing code, whoever or whatever wrote it. It
needs no model: paste the template into a pull request description, have the author fill it in, and
check each answer against the diff.

It targets the defects that look like success: solving the wrong goal, patching a symptom instead
of fitting into the system, silently dropping intentional behaviour, or breaking a consumer nobody
checked.

## Before reading the diff (anti-anchoring)

Reviewers — human or AI — easily get anchored on the author's patch and start optimizing a bad
approach (e.g., pausing a polling loop instead of removing it, or tweaking an oversized column
instead of validating inputs). Break the anchor before opening the diff:

1. **Restate the real user goal** in one sentence from the ticket and domain rules — not the
   literal wording if the ticket looks vague or AI-reworded.
2. **Locate the root cause** on the base branch first. What would you change if this PR did not
   exist?
3. **Judge the approach before the lines.** Once you open the diff, decide first whether it treats
   the root cause or patches a symptom, and whether any shared surface (data model, common
   component, global CSS, generic helper) was changed without justification. Do not polish a
   workaround that should be replaced.

## PR description template

```markdown
## Goal

<!-- One sentence: what the user actually wants to obtain, and why. Not the ticket title. -->

## Root cause and approach

<!-- Where the issue originates in existing code, why this change treats the cause rather than a
symptom, and how it fits existing patterns. If existing behaviour was changed, dropped, or put at
risk, name it and why; if none, leave blank. -->

- [ ] ...

## Shared surfaces and consumers

<!-- Shared types/domains, common components, global styles, generic helpers, or callers/listeners
affected by what changed. Say how you checked. -->

- [ ] ...

## Relevant decisions

<!-- Decision records, spec deviations, or javadoc/code rules governing the area touched. Followed,
or departed from with whose approval. -->

- [ ] ...

## Open points and verification

<!-- What was actually run (tests, replay, UI check, log), what was checked only by reading, and
any model gaps or edge cases intentionally left out of scope. -->
```

A pure addition or a literal edit can leave the middle sections empty and say so in one line.

## Checking the answers

- [ ] The approach addresses the root cause rather than layering a workaround or fabricating data.
- [ ] The goal reflects the real user need, and the diff serves it without scope creep.
- [ ] The rule is not duplicated across sibling paths (load vs. action, multiple screens) where copies can diverge.
- [ ] Existing tests invoked as justification (or left green) were traced to their origin — a test describes past behaviour, not necessarily the intended rule.
- [ ] Shared surfaces (domains, helpers, common components, global CSS) were not altered without
      checking field semantics and blast radius.
- [ ] Every removed or rewritten block has a clear reason; no intentional behaviour was quietly lost.
- [ ] Renamed or removed symbols were checked beyond direct callers (events, config, docs, tests).
- [ ] Local decision records and code-level rules covering the touched area are respected, or the
      departure was agreed.
- [ ] Claims of verification match what was actually run (including visual checks for layout/CSS).

## Writing review feedback that lands cleanly

Broad directives ("apply the same rule everywhere else") often trigger new regressions, especially
when implemented by lighter models. When requesting changes, group feedback into explicit actions
anchored to files and functions:

- **Remove:** workarounds or out-of-scope edits to revert (exact file and symbol).
- **Keep:** parts of the diff that are right and should stay intact.
- **Fix:** concrete changes needed, with the exact file, function, and expected rule.
