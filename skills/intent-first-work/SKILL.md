---
name: intent-first-work
description: How to take on any task (a feature, a fix, a refactor, a review, a document, a design, a piece of research) so that the result serves what the person actually wants and keeps what already works. Use at the start of every task, when work is handed over (inherited code, another agent's pull request, a document received), when the task changes along the way, before correcting something that looks wrong, and before declaring work done. It finds the intention and the existing state first, comes back with a short analysis and precise questions when the task warrants it, then checks the result against the intention, not only against the written instruction.
---

# Intent-first work

Most serious defects are not lapses of skill. They come from an intention or an existing state that
was misunderstood: a guarantee lost in a rewrite, a signal removed without looking for who read it,
a "bug" fixed that was a feature, a note claiming done what was not. Review catches some of them.
Understanding first prevents them.

For any task:

1. Understand the intention.
2. Understand what exists.
3. See the gap between the two, and what you do not know.
4. Come back first when the task warrants it.
5. Do the work, holding both.
6. Check the result against the intention.

## 1. Understand the intention

Write one sentence: what the person wants to obtain, and why. Not what they asked you to do.

"Rewrite the cards in Compose" is a request. "Cards that match the redesign and still give people
three seconds to cancel before anything happens" is an intention: it can decide things.

- **Look for their history.** Memory, notes, decision records, earlier conversations, past
  refusals. A request continues a story, and their past decisions are part of it.
- **Separate the goal from the proposed means.** If the means serves the goal badly, say so before
  following it.
- **Find the implicit bar.** What they do not say because, for them, it goes without saying:
  finish, taste, tone, safety, accessibility, privacy. Read it in their past work and reactions, not
  in your defaults.
- **Treat a surprise as possibly intended.** Before correcting behaviour that looks wrong, look for
  a reason in the code, the history and the docs. "Fix this" can mean "rename this".
- **Restate the intention when the task moves.** A new instruction mid-task may change the goal,
  not only the next step.

## 2. Understand what exists

A new task has an existing state too: it lands in a product, a direction, neighbours and habits.

- **Meaning before form.** Read what gives the sense (vision, principles, decision records, the
  brief, the issue) before what gives the shape (code, files, layouts).
- **How it is already done here.** Look for the place's own rules for this kind of work
  (contributing or release guides, review checklists, decision records), and for where the same
  problem is already solved. Follow them, or say why you depart from them.
- **What was decided here.** Search the decision records and docs for the names of the files,
  components and features you touch, not only for the topic. A decision may already name the
  behaviour you are about to choose: follow it, or ask before departing from it.
- **What it guarantees today: the keep list.** When you change existing code, even to fix one bug,
  write this list before you edit. First, everything the code you replace, wrap or bypass does
  today, item by item, never "the same behaviour": what it shows, says or announces, checks,
  stores, triggers. Then the promises around it: runs once, lasts at least so long, can be
  cancelled, stays visible while pending, keeps data private, works with accessibility settings,
  stays fast. A new condition, exemption or early exit changes every other path through it too:
  list what those paths must keep doing. These promises are rarely written down; read them in the
  code, the tests, the comments and the history.
- **Who depends on it.** Before you remove, move or rename anything, find every reader: the callers,
  and also whatever reads a signal, a flag, a side effect, a file or an event it produces.
- **Who else works here.** People, other agents, other sessions, and shared resources: devices,
  daemons, logs, branches, ports. Do not take one without saying so.
- **What you verified, what you assume.** Mark the difference, and keep marking it.

When watching the thing run says more than reading it (an app, a page, logs, a device), watch it,
with the tools the person allows. Reading alone misses what behaviour shows.

## 3. See the gap, and what you do not know

Put the two side by side. What does the task really change in what exists? Which guarantee, reader
or decision does it touch? Where does the request, read literally, go against the intention?

Then sort what you do not know:

- what reading or running would answer: find out, do not ask;
- what you can decide within the agreed rules: decide, and say so;
- what only the person can answer (a goal, a taste, a trade-off): ask.

## 4. Come back first when the task warrants it

When the task is large, inherited, ambiguous, or touches a guarantee or a decision, come back before
executing, with three short parts and no ceremony:

1. **The intention**, in one sentence.
2. **A matrix**, one row per element that matters for the task:

   | Element | What it is for | What it guarantees, or who depends on it | Verified or assumed | Risk for this task |
   | --- | --- | --- | --- | --- |

3. **Questions, only if there are any.** Each says why you ask and what you will do by default if
   nobody answers.

Keep it light:

- one row per real element; write "?" rather than fill a cell for form;
- never ask what reading would answer, or what you can decide yourself;
- a question that hides a trade-off or a change outside the task is put as a decision, with its
  consequences.

For a small, clear task, one line of intention is enough: go. A bug fix is not small when the code
it changes does other things too: write its keep list, even when you do not come back first. An
edit that only applies what the person spelled out needs none of this. When nobody can answer (an unattended
run), write the analysis anyway, take the default you named, and say so in the result.

## 5. Do the work, holding both

The traps that turned a misunderstanding into a defect, with real examples, are in
`references/traps.md`. In short:

- Keep every item of the keep list from section 2, or name the one you drop and why. Follow what a
  decision record decides, or ask before departing from it.
- State comes from the source that owns it, never from a label, a colour or a layout.
- Whatever becomes invisible is cancelled or made visible: no hidden pending action.
- An early exit claims there is nothing left to do. Check the claim where the value is set: can the
  condition hold while something still runs? Cancel first, branch after.
- Check what each primitive does where it will really run: the regex engine, the text an empty
  field reports, animation and accessibility settings, the locale, the shell's quoting.
- A trade-off, or a change outside the task, leaves the change or is presented as a decision.
- Before correcting a defect, confirm it is one, then prove its cause.
- Read the output of your own tools: a command that ran may have done nothing.

## 6. Check the result against the intention

Before you say done:

1. **The intention.** Will the person get what they wanted, not only what they wrote?
2. **The keep list and the matrix.** Each item still holds, with its proof (a test, a log, a
   replay, a screenshot), or is listed as dropped, with why. Your report names each item, not only
   the one that was asked for.
3. **Adversarially.** How does this fail, and for whom? At least: twice in a row, cancelled at the
   wrong moment, interrupted and resumed, empty or missing input, accessibility and reduced-motion
   settings, another user or recipient.
4. **Claims.** Every statement in your report, note or document is verified, or written as assumed
   or not done. What exists, ships or works is checked against what decides it (what was merged,
   enabled, run), not against a list of plans. Records of past decisions are added to, never
   rewritten.
5. **Tests.** Each test proves a guarantee or a failure scenario, not a constant.

Report what holds, what does not, and what you could not verify.

## With the other skills

- `meaning-first-design`: the same reflex for interfaces. Use it for any design task.
- `dreambel-deliver-with-evidence`: diagnosis, proof of cause, verification levels.
- `code-coherence-guardrails`: names, conventions, and fix versus decision during reviews.
