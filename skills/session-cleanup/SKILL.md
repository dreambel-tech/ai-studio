---
name: session-cleanup
description: Clean up after agent work without losing anything. Use at the end of every sound unit of work (validated, merged, or abandoned on purpose), after a pull request is merged, when disk space is low or a worktree cannot be created, or when the user asks to clean up, free space or remove worktrees, branches or temporary files. Lists what the session left on the computer with sizes (worktrees, merged branches, browser profiles, copied env files, temporary files), keeps anything that belongs to another session, holds uncommitted work or is still needed, and removes only what the user picks.
---

# Session Cleanup

Agent sessions leave things behind: worktrees and branches after a merge, browser profiles from
screenshot scripts, copied `.env` files, scratch outputs, dev servers, entries in shared config
files. Each is small; together they fill a disk. One real case: 174 browser profiles (8.2 GB) left
by one session, on a disk so full that the next session could not create its worktree.

This skill makes cleanup a habit at the end of each unit of work. It never deletes anything without
first showing the user a list with sizes and getting their answer, and it never touches what
another session, uncommitted work or the user still needs.

## 1. When to clean up

- At the end of a sound unit of work: validated, merged, or abandoned on purpose. A merge is such a
  moment: the worktree and branch of the merged work can usually go.
- Not in the middle of a task, and not after a failure that still needs investigating: leftovers
  can be evidence.
- When the user asks, when free space is low, or when a worktree or file cannot be created for lack
  of space: run an audit (section 2), which also lists older leftovers.

## 2. Scan

Run the script in this skill's folder, from the session's working folder (Node.js required):

```bash
node <this skill's folder>/scripts/leftovers.mjs scan --history <session history file>
node <this skill's folder>/scripts/leftovers.mjs scan --since <session start> --claim <path> ...
```

- `--history`: the session's history file, if the agent tool keeps one (a JSONL transcript or
  rollout) and you know its path, for example because a hook or plugin gave it to you. The script
  reads the files the session wrote and the paths its commands named, takes the session's start
  from it, and keeps what the session published. With it, `--since` is not needed, and `--claim`
  only for what the history cannot show, such as files a script created on its own.
- `--since`: when this session started, as an ISO date. If you do not know it, use the creation
  time of the session's own scratch or temporary folder, or the time of the first message of this
  unit of work. What appeared after it is listed as "created while this session ran".
- `--claim`: each path you created or changed in this session and remember: files written to
  temporary folders, scripts and outputs, screenshots, a copied `.env`, a worktree you created, a
  tracked file a build changed that should not be committed. Claimed paths are listed as this
  session's. Keep a short running list of them while you work.
- `--repo`: another repository you worked in, besides the working folder. A folder that is not a
  repository but holds several (an umbrella folder) is scanned subfolder by subfolder.
- `--config`: a configuration file that may point into worktrees, such as a launch configuration
  for dev servers. A worktree it names is left unchecked, with a note to remove its entries too,
  and entries that point to folders that are gone are reported.
- `--audit`: also list older leftovers (the backlog) with their size, plus caches such as npm and
  Docker, which are reported only.

Scanning is read-only. It prints a report and saves a plan file that the removal reads. If Node.js
is not available, apply the same rules by hand with `git worktree list`, `git branch --merged` and a
look at the temporary folder, and never delete without the list and the answer.

## 3. Read the result

Every item has an id (`w1`, `b2`, `t1`...) and falls in one of four groups:

| Group | Meaning | Checked by default |
| --- | --- | --- |
| Created by this session | claimed with `--claim`, or found in the session history | yes |
| Created while this session ran | appeared after `--since`, but another session may own it | no |
| Older (backlog) | from before this session; listed only with `--audit` | yes in an audit, if nothing argues against it |
| Kept | has a reason to stay, shown next to it; cannot be removed | never |

The script keeps a worktree that is the current folder, is locked, has uncommitted changes, holds a
branch that is not merged or has an open pull request, or was used in the last 24 hours (unless the
session claimed it). It keeps a claimed path that existed before the session, and any folder that
contains a repository or the current folder. It leaves unchecked anything that holds env files,
branches with no commits of their own (they may be new work), merged items whose pull requests could
not be read, and claimed changes to tracked files (restoring them discards the changes).

From the session history, a path counts as the session's only if it still exists and appeared
after the session started. Inside a repository, only ignored files count, such as a copied `.env`:
tracked files and new files are the work itself. A merged branch counts if the history creates it
(`git switch -c`, `git checkout -b`, `git worktree add -b`, `git branch <name>`) and its reflog
shows it was created after the session started. A folder that commands only named, without the
session writing into it, is left unchecked, since it may hold more than the session's files. Files
sent to a tool that publishes pages or documents are kept, and so is the history with its folder.

The script cannot see everything. Add these yourself, from what you did in the session:

- processes you started that still run: dev servers, watchers, containers;
- entries you added to config files that also hold other settings, such as a launch configuration:
  offer to remove only your entries, and remove them by hand once the user agrees;
- worktrees that the agent tool manages for its own sessions: if a worktree may belong to another
  session that is still open, say so and let the user decide;
- test data you wrote to a local database;
- anything that a published page, document or shared artifact was built from: keep it, and say so.

## 4. Offer the cleanup

If nothing was created by or during this session, say nothing about cleanup, unless free space is
low (under 20 GB): then add one sentence offering an audit.

Otherwise, show a short list in the user's language: one line per item or group, with its size and
the total, and whether it is checked. Then one line for what is kept, with the reasons in a few
words. Do not paste the raw report unless the user asks for it. For example:

```
This session left 3.1 GB:
  [x] 12 browser profiles in the temporary folder    2.8 GB
  [x] worktree feature-x (branch merged)              310 MB
  [ ] .env copied into the backend worktree           choose
Kept: the source of the published report, the branch with an open pull request.
```

Ask one question: remove the checked items, choose others, or keep everything. If the agent tool
has a next-step box or suggestion buttons, put the question there; otherwise end the report with
it. If a session-weight offer is due at the same break, the cleanup question comes first and the
other offer goes on the last line.

When the backlog line shows dozens of older items, mention it in one sentence and offer an audit;
do not list them unasked.

## 5. Remove

Only after the user's answer, and only what it names:

```bash
node <this skill's folder>/scripts/leftovers.mjs remove --plan <plan file> selected
node <this skill's folder>/scripts/leftovers.mjs remove --plan <plan file> w2 t1 b3
```

`selected` takes the checked items; ids name others. The script checks each item again before
removing it and skips one that changed since the scan (new changes, a moved branch, a new pull
request). A worktree goes with its branch. Report what was removed, the space freed, and what was
skipped or failed and why. An item "in use" is held by a running process: say which, and offer to
stop it only if this session started it.

Rules:

- Remove listed items only through the script, never with `rm -rf`, `git worktree remove --force`
  or `git branch -D`: the script is what checks them again.
- For what the script cannot see (section 3), act only on the items the user approved.
- Never remove what belongs to another session, uncommitted work, or the user's data, even if asked
  in passing: name the risk and ask again.
- Never run cache cleaning (npm, Docker) yourself: give the command and let the user run it.

## 6. Leave less behind

- For browser checks and screenshots, use the agent tool's own browser or browser extension rather
  than scripts that launch a headless browser. If a script is truly needed, reuse one profile
  folder and delete it at the end.
- Write scratch files to the session's scratch or temporary folder, not to the repository.
- When you copy a secret file such as `.env` to run something, add it to your claims at once, and
  never print its content.
- Do not commit build byproducts that a command changed, such as `*.tsbuildinfo`: claim them so
  they are restored.
