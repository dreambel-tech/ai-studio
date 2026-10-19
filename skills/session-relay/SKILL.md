---
name: session-relay
description: Keep long agent sessions affordable without losing quality. Use at the end of every completed unit of work (a batch, a pull request, a report, a validated change), after the conversation has been compacted or summarized, when the agent tool reports a large context, when the user moves to an unrelated topic in a long session, or when the user asks to hand off, continue elsewhere or start fresh. Assesses how heavy the session has become, offers a fresh session in one sentence at a natural break, and writes a self-contained relay brief so the next session, in any agent tool, loses nothing.
---

# Session Relay

Every turn re-reads the whole conversation. A short command costs as much as the context it sits
in: at 600k tokens of context, one `ls` costs 600k tokens. Most of the spend of a long session comes
from its last, heaviest turns, not from the work itself. A fresh session that starts from a good
brief does the same work for a fraction of the cost, and usually with sharper attention.

This skill never blocks, never interrupts a task, and never lowers the bar for verification.

## 1. Assess the session at natural breaks

Assess only at a natural break: a batch delivered, a pull request opened, a report sent, a
validation received, a topic closed. Never in the middle of a task.

If the agent tool states the context size (a status line, a hook message, a usage tool), use it:

| Context | Level |
| --- | --- |
| under 250k tokens, or under 60% of a smaller window | light |
| 250k to 400k, or 60% to 80% of a smaller window | heavy |
| over 400k, or over 80% of a smaller window | very heavy |

Otherwise, count the signals you can observe yourself:

- two or more units of work already completed in this session;
- the conversation has been compacted or summarized at least once;
- the session spans more than one day, or the topic has changed along the way;
- many screenshots or images were taken (roughly ten or more);
- large files (roughly 1,000 lines or more) or large design files were read in full;
- many sub-agents, reviews or cross-session messages ran from this session;
- you notice yourself re-reading files or re-checking facts already established earlier.

One signal means light, two or three mean heavy, four or more mean very heavy.

## 2. Offer the relay in one sentence

- **Light**: say nothing.
- **Heavy**: when the next step is a new unit of work, add one sentence at the end of your report.
- **Very heavy**: add the sentence at the end of your report, even if the next step continues
  the same work.

The sentence states the fact and the benefit, in the user's language, with no alarm and no
apology. For example: "This session is heavy (about 450k of context). If this batch is done, a
fresh session would start from a brief and cost much less per step." Then stop. Do not repeat the
offer until the session reaches the next level or the user brings it up. If the user wants to keep
going here, keep going.

## 3. Write the relay brief

When the user accepts, write a brief that lets a new session continue without this conversation.
Write it in the user's language, between 300 and 900 words, using these headings:

1. **Goal**: what the user wants, in their words when possible.
2. **State**: repository paths, branches, commits (pushed or not), pull requests, deployments,
   running processes or sessions, and anything left uncommitted.
3. **Decisions and validations**: what was decided, who validated it, and the user's exact words
   for any approval that the next session relies on.
4. **Learned constraints**: preferences, pitfalls and rules discovered in this session that are not
   already in the repository's instruction files.
5. **Verified facts**: what was already checked and how, so the next session does not redo it.
6. **Open questions**: what is still unknown or waiting on someone.
7. **Next steps**: ordered, concrete, with the first one ready to start.
8. **Read first**: the few files to open first, with line ranges when useful.

Rules for the brief:

- Facts only, with paths, identifiers and numbers. No narrative of how the session went.
- Never include secrets, tokens, passwords or personal data.
- Name what is not done or not verified as plainly as what is done.
- An approval in the brief informs the next session; it does not extend to new actions.

## 4. Hand over

- If the agent tool can start a new session or thread with a prompt, start it with the brief as its
  first message, and tell the user where to find it.
- Otherwise, give the brief in one fenced block, ready to paste into a new session of any agent
  tool. Save it to a file only if the user asks.
- Then stop working in this session, unless the user says otherwise.

## 5. Keep each turn light while working

These habits cut cost without removing any check. When a full read or a screenshot is what
correctness needs, do it.

- Search before reading a large file, then read only the relevant range.
- Do not re-read a file that is already in context and has not changed.
- Prefer the page text or accessibility tree over screenshots; keep screenshots as final proof of
  visual changes.
- Bound command output (filters, `head`, `tail`, `--stat`, `-q`) instead of printing everything.
- Group independent commands in one step rather than many small steps.
- Delegate broad searches to a sub-agent that returns its conclusion, not the files it read.
- Start each new unit of work from a light session when the current one is already heavy.
