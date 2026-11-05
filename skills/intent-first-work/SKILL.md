---
name: intent-first-work
description: How to take on any task (a feature, a fix, a refactor, a review, a document, a design, a piece of research) so that the result serves what the person actually wants and keeps what already works. Use at the start of every task, when work is handed over (inherited code, another agent's pull request, a document received), when the task changes along the way, before correcting something that looks wrong, and before declaring work done. It states the intention, lists what the existing state guarantees, does the task on the most plausible reading, stops to ask only when a wrong guess would be costly, then checks the result against the intention, not only against the written instruction.
---

# Intent-first work

Most serious defects come from an intention or an existing state that was misunderstood, not from a
lack of skill. Before any change, write three short things, then do the task.

## First: is this heavy work?

Read `references/full.md` now, before the three things, if one of these is true:

- you take over work you did not do: another agent's change, a pull request, a review, code
  handed over to you;
- the change will touch more than two existing files, or remove, move or rename something that
  other code may read;
- the request is a redesign, a migration or a rewrite.

It takes a minute, and it holds the analysis matrix and the full checks. Otherwise this page is
enough.

## The three things

1. **Intention.** One sentence: what the person wants and why, not what they wrote. Look at their
   history (notes, decision records, past conversations) when there is one. Behaviour that looks
   wrong may be intended: look for its reason before correcting it.
2. **Keep list.** If you change existing code, even to fix one bug, list what it does today that
   must survive: what it shows, says, announces, checks, stores, triggers, and the promises around
   it (can be cancelled, stays visible, works with accessibility settings). A few lines, from
   reading the code you touch. Search the docs and decision records for the names you touch, and
   follow what they decide. Before you remove, move or rename anything, find who reads it: the
   callers, and whatever reads a flag, an event or a file it produces.
3. **Assumptions.** What you checked, and what you assume.

## Then act

Sort what you do not know. What reading or running would answer: find out, do not ask. What you can
decide within the agreed rules: decide, and say so. What only the person can answer (a goal, a
taste, a trade-off) is a question.

Do the task on the most plausible reading of the request. Stop and ask instead of acting only if
one of these is true:

- two readings lead to different changes, and the wrong one would be costly to undo;
- the request contradicts a recorded decision;
- the change would delete data, or change something outside the task.

Otherwise a question is not a reason to stop: act, and put the question in your report with what
you assumed. When nobody can answer (an unattended run), never stop: take your default and say so.

## Before saying done

1. Check the result against the intention and each item of the keep list: it holds, with its proof
   (a test, a log, a screenshot, or "checked by reading, not run"), or you name it as dropped, and
   why.
2. Try to break it: twice in a row, cancelled or interrupted midway, empty or missing input,
   accessibility settings, another user.
3. Every claim in your report is verified, or written as assumed or not done.

Report what holds, what you dropped, and what you could not verify. The traps that turned a
misunderstanding into a defect are in `references/traps.md`.
