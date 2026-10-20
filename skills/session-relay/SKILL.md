---
name: session-relay
description: Keep long agent sessions affordable without losing quality. Use at the end of every completed unit of work (a batch, a pull request, a report, a validated change), after the conversation has been compacted or summarized, when the agent tool reports a large context, when the user moves to an unrelated topic in a long session, or when the user asks to compact, hand off, continue elsewhere or start fresh. Assesses how heavy the session has become, offers the right move at a natural break (compact here or start a fresh session), and writes the relay brief that carries the work over without losing anything.
---

# Session Relay

Every turn re-reads the whole conversation. A short command costs as much as the context it sits
in: at 600k tokens of context, one `ls` costs 600k tokens. Most of the spend of a long session comes
from its last, heaviest turns, not from the work itself. Compacting at the right moment, or
starting a fresh session from a good brief, does the same work for a fraction of the cost, and
usually with sharper attention.

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

- **Light**: offer nothing.
- **Heavy**: offer a move when the next step is a new unit of work.
- **Very heavy**: offer a move even if the next step continues the same work.

## 2. Choose the move

Compacting replaces the conversation with a summary and keeps the session: same folder, same task
list, same linked sessions. A fresh session starts clean from a brief. Choose by where the work
stands:

| Where the work stands | Move |
| --- | --- |
| In the middle of a task, with useful working state (a bug being traced, files just read) | none yet: finish the step first |
| Heavy, and the same task or thread continues (the next pull request of a stack, the same topic) | compact here, with a focus |
| The topic changes for the next unit of work | fresh session from the brief |
| Already compacted twice or more, or the session spans several days | fresh session from the brief |

A summary of a summary loses detail; after two compactions, prefer a fresh session.

## 3. Offer it once, in one place

Put the offer in exactly one place:

1. If the agent tool has a dedicated place for next-step suggestions, such as a next-step box or
   suggestion buttons, put it there and nowhere else. Add nothing to the text of your report.
2. Otherwise, add it as the last line of your report, after a blank line.

How each move is offered:

- **Fresh session**: if the tool can start one for the user, a short button label such as "New
  session"; otherwise one sentence.
- **Compact**: in most tools only the user can run the compaction command, so give it ready to copy
  on one line. Compacting only compacts: it does not start the next step, so the user sends one
  short message afterwards (such as "continue") to pick the work up. When the command takes
  instructions for the summary (Claude Code: `/compact <instructions>`), add one clear line, at most
  30 words, naming where the work stands and the next step the user already decided, so the summary
  carries it, such as
  `/compact Kura+ batch 2: C2 is integrated; next, the guardian review, then the PRs.`
  Use full words, not shorthand, and only what the user has already decided. Otherwise, or if there
  is no agreed next step, give the bare command (Codex: `/compact`).

Wording: the fact and the benefit, in the user's language, with no alarm and no apology. At most 25
words besides the command, no heading, no bold, no list, and no explanation of how the gauge or this
skill works. Say once that a short message after compacting resumes the work. For example: "This
session is heavy (about 300k of context); compacting keeps the thread for much less per step. Then
send 'continue':" followed by the command on its own line.

Then stop. Do not repeat the offer until the session reaches the next level or the user brings it
up. If the user wants to keep going as is, keep going.

## 4. Write the relay brief

For a compaction, the line after the command is enough. For a fresh session, write a brief that lets
the new session continue without this conversation, in the user's language, between 300 and 900
words, using these headings:

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

Rules for the brief and the focus:

- Facts only, with paths, identifiers and numbers. No narrative of how the session went.
- Never include secrets, tokens, passwords or personal data.
- Name what is not done or not verified as plainly as what is done.
- An approval in the brief informs the next session; it does not extend to new actions.

## 5. Hand over

- **Compaction**: once the user has compacted and sent their next message, continue from the
  summary with the next step it names. Re-read only the files that step needs.
- **Fresh session**: if the agent tool can start a new session or thread with a prompt, start it
  with the brief as its first message, and tell the user where to find it. Otherwise, give the
  brief in one fenced block, ready to paste into a new session of any agent tool. Save it to a file
  only if the user asks. Then stop working in this session, unless the user says otherwise.

## 6. Keep each turn light while working

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
