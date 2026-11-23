---
name: intent-first-work
description: Frame complex, ambiguous, inherited, or cross-cutting tasks before executing so the result serves the user's real goal and stays coherent with the existing system. Load only when upfront framing is warranted (new features, refactors, unclear bugs, architectural trade-offs, handed-over work) — never for clear, local edits.
---

# Intent-first work

Most costly agent failures are not coding mistakes. They come from acting before understanding:
solving the literal wording instead of the real goal, throwing isolated code at a symptom instead
of fitting into the system, or reporting done from a narrow check that missed what mattered.

**Proportionality comes first.** A clear, local edit needs none of this: do it cleanly and check
it. Use this skill only when the task is ambiguous, structural, inherited, or carries real
trade-offs.

## 1. Understand the real intent

State in one sentence what the person wants to obtain and why — not the mechanical action they
named.

- **Separate goal from proposed means.** If the requested approach works against the real goal
  (an XY problem), say so before implementing it.
- **Read the implicit bar.** Past decisions, notes, and neighbouring work show the project's
  standards (taste, simplicity, safety, accessibility, performance).
- **Sort unknowns cleanly:**
  - answerable by reading or running → find out, do not ask;
  - decidable within existing rules → decide, and state it briefly;
  - only the person can judge (goal, product choice, real trade-off) → ask.

## 2. Anchor in the existing system

Understand why the system is shaped the way it is before changing it.

- **Meaning before form.** Read local decisions, rules, and sibling implementations before
  inventing a new pattern or abstraction.
- **Root cause over quick patches.** Do not throw code, flags, or special cases at a request just
  to make a check pass. Treat the real cause so the codebase stays coherent.
- **Respect existing behaviour and consumers.** Before replacing, wrapping, or removing code,
  check who depends on it and what behaviour exists for a reason. Treat surprises as possibly
  intentional until history or code proves otherwise.

## 3. Pause with a 4-line brief when warranted

When the task is ambiguous, structural, inherited, or touches a real trade-off, come back before
executing — light, direct, no ceremony:

- **Goal:** one sentence (what the user wants and why).
- **System coherence:** key existing patterns, decisions, or consumers that bound the work.
- **Out of scope:** what you will deliberately not touch.
- **Questions (0–2 max):** only decisions you cannot make yourself, each with your default if
  unanswered.

If a single interpretation clearly fits and is easy to reverse, skip the pause: state your
assumption in one line and proceed. In an unattended run, write the brief, take your named
defaults, and note them in the result.

## 4. Execute and verify against the goal

- Hold both the goal and system coherence while implementing. If a trade-off or out-of-scope
  change surfaces mid-way, flag it as a decision rather than burying it in the diff.
- Before saying done, check the outcome against the real goal — not only that a narrow test or
  build passed. Test real failure modes (edge inputs, cancellation, repeated calls, real runtime
  behaviour) rather than constants.
- Report concisely: distinguish verified facts from assumptions, and mention existing behaviour
  only if something was changed, dropped, or put at risk.

## With the other skills

- `meaning-first-design`: the same reflex for interfaces.
- `dreambel-deliver-with-evidence`: root-cause proof and verification levels for complex changes.
- `code-coherence-guardrails`: naming, convention checks, and anti-loop discipline during reviews.
