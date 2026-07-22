---
name: code-coherence-guardrails
description: Discipline to apply whenever reviewing, correcting, or iterating on a code, architecture, or contract proposal — your own, a human collaborator's, or another AI agent's — especially across multiple back-and-forth rounds. Prevents an agent from drifting into local micro-fixes (improvised naming, a new parallel abstraction, an unverified assumption, a forgotten edge case) instead of anchoring each correction in the real code and already-established conventions. Use systematically before finalizing a multi-file refactor, a new type hierarchy, a contract/schema change, or any code review conducted over several conversation turns. Also trigger whenever reviewing a proposal made by an AI agent (agentic or conversational) to check its consistency before accepting it.
---

# Code Coherence Guardrails

## The problem this skill solves

An AI agent in a long conversation — especially in a correction loop with a human or
another agent — tends to optimize **locally** on the last remark it received rather than
periodically returning to the source of truth: the real code, the already-agreed
contract, the convention already in place. Typical failure pattern observed in practice:

- a fuzzy confidence score/boolean gets corrected, then replaced with another fuzzy score
- a new type hierarchy is withdrawn, then a different parallel hierarchy is reintroduced
  two turns later under another name
- a field name drifts three times in a row (`text` → `query` → `userQuestion` → `prompt`)
  without any of these variants ever being checked against the existing code
- a cardinality bug (`.single()` on a list that can have 0 or several elements) passes
  review because the edge case was never explicitly enumerated

The symptom isn't occasional carelessness — it's **closed-loop reasoning**: each
correction starts from the previous proposal in the conversation, not from the real state
of the system. This skill encodes the opposite reflex.

## General rule

**Before proposing a correction, go back to the source of truth — not to the last reply
in the conversation.** The source of truth is, in priority order: the real code in the
repo, the already-agreed contracts/ADRs/schemas, and only then the ongoing conversation.

## The 8 guardrails

### 1. Check the existing code before naming or structuring anything
Before proposing a field, type, function, or file name, search the code for an existing
convention covering the same family of concepts (grep sibling types). Never name something
by local intuition when it belongs to an already-existing set.
> Quick check: "Did I actually verify this name against the code, or did it just feel
> consistent in my head?"

### 2. Any new abstraction must justify why the existing one isn't enough
Before creating a new structure, mechanism, or layer: explicitly check whether one with a
similar role already exists. If the existing one could be reused or extended, don't create
a new one. This check must be written down *before* presenting the proposal, not
discovered during review.
> Quick check: "Did I just recreate, under a different name, something that already
> exists elsewhere in the system?"

### 3. No "magic" decision variable without verifiable justification
Any score, confidence threshold, probability, or decision boolean (`confidence`,
`requiresX`, `looksLikeY`, `isProbably...`) must be replaced with explicit, verifiable
criteria (typed evidence list, closed structural rule) before being proposed — not after a
review comment.
> Quick check: "If asked 'why this value?', can I answer with a verifiable fact, or only
> with 'it seemed reasonable'?"

### 4. Enumerate edge cases before writing a logic branch
For any condition or collection handling: explicitly list the edge cases (empty list, one
element, several elements, null value, conflicting values) before considering the code
ready. Never use an access that assumes a cardinality (`.single()`, `[0]`, `.first()`...)
without having checked the size right before.
> Quick check: "What does this code do if the collection is empty? If it has two elements
> instead of one?"

### 5. Copy already-validated schemas, don't reconstruct them from memory
Never reconstruct a format, contract, registry schema, or convention already agreed upon
in the conversation or the project from memory. Copy the last validated version as-is,
then edit on top of it. A "close" rewording of an already-fixed schema is a regression,
even an unintentional one.
> Quick check: "Am I copying the validated version, or rewriting it from memory and hoping
> it's the same?"

### 6. Explicitly distinguish "fix" from "design decision"
A fix must never introduce a new concept without flagging it as such ("this is a new
decision, not a simple adjustment") and without separate validation of that decision by
whoever has authority over it.
> Quick check: "Does what I'm proposing fix a bug within the already-agreed rules, or does
> it change the rules themselves?"

### 7. Anti-loop rule: two local fixes of the same kind → global coherence pass
If the same type of error (naming, structure, logic) gets fixed twice in a row on the same
subject within the conversation, don't make a third local micro-fix. Stop, re-read the
whole relevant scope at once (entire file, entire type family), and set a cross-cutting
rule instead of another one-off patch.
> Quick check: "Did I just fix this same kind of problem two turns ago? If so, stop the
> loop and look at the whole picture."

### 8. Anchor reasoning in the real state of the system, not in the discussion
Whenever a conversation is about an existing architecture or convention, read the actual
code or system state before proposing a correction. Don't reason solely from what was said
earlier in the exchange — the conversation may have drifted far from the real code without
anyone noticing.
> Quick check: "Did I verify my latest proposal against the real file, or only against
> what someone wrote earlier in the chat?"

## Checklist before saying "this is ready"

Before considering a code/architecture proposal closed, run through this list once,
explicitly:

- [ ] Names used follow a convention already in place in the code (rule 1)
- [ ] No new abstraction duplicates an existing mechanism (rule 2)
- [ ] No decision relies on an unjustifiable score/boolean (rule 3)
- [ ] Edge cases (empty / one / several / conflicting) are covered, not just the happy
      path (rule 4)
- [ ] Already-agreed schemas/contracts are reused as-is, not reworded (rule 5)
- [ ] Anything new is flagged as a decision, not buried inside a fix (rule 6)
- [ ] No single type of error has been fixed more than once without a global coherence
      pass (rule 7)
- [ ] The latest proposal was checked against the real code/system state, not just against
      the conversation (rule 8)

If any item on this list can't be checked off with confidence, say so explicitly to the
person instead of presenting the proposal as ready.

## Application note

This skill isn't specific to any language, framework, or business domain. It applies
equally to a backend architecture review, an infrastructure config audit, a database
schema iteration, or a system prompt review. The common thread is always the same: an
agent in a long conversation tends to optimize on the last remark it received rather than
periodically returning to the source of truth — this skill encodes that return-to-source
reflex.
