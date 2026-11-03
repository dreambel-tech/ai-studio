#!/usr/bin/env node
// intent-first-work: a SessionStart hook that gives the session the instruction lines of the
// intent-first-work skill, so they apply without being copied into an instruction file. It reads
// the lines at run time from the instructions file given as its argument, and adds the fenced
// block of that file to the context. It never blocks: a missing file or block adds nothing.
// The same file ships in claude/plugins/intent-first-work and codex/plugins/intent-first-work;
// keep both copies identical (the tests check it). See ../README.md.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// The lines to add are the first ```markdown block of the instructions file.
export function block(text) {
  const match = /^```markdown\r?\n([\s\S]*?)\r?\n```\s*$/m.exec(text);
  return match ? match[1].replace(/\r\n/g, "\n").trim() : null;
}

export function message(text) {
  const lines = block(text);
  return lines ? { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines } } : null;
}

function main() {
  const file = process.argv[2];
  if (!file) return;
  const output = message(readFileSync(file, "utf8"));
  if (output) process.stdout.write(JSON.stringify(output));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch {
    // Never block or fail a session.
  }
}
