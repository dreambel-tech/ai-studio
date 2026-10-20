#!/usr/bin/env node
// session-cleanup: a SessionStart hook that gives the session what it needs to clean
// up after its work: the path of its own history, the command that lists what it left,
// and a warning when the disk is nearly full. It never blocks and never deletes
// anything. The same file ships in claude/plugins/session-cleanup and
// codex/plugins/session-cleanup; keep both copies identical (the tests check it).
// See ../README.md.

import { existsSync, readFileSync, statfsSync } from "node:fs";
import { dirname, join, parse as parsePath, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const GB = 1024 ** 3;
// Launch configurations that may point into worktrees.
const CONFIGS = [join(".claude", "launch.json"), join(".vscode", "launch.json")];

export function lowDisk(free, minGb = Number(process.env.SESSION_CLEANUP_MIN_FREE_GB || 20)) {
  return free < minGb * GB;
}

function quote(path) {
  return `"${path}"`;
}

export function message({ transcript, cwd, script, disk, claude }) {
  const configs = cwd ? CONFIGS.map((file) => join(cwd, file)).filter((file) => existsSync(file)) : [];
  const command = ["node", quote(script), "scan", ...(transcript ? ["--history", quote(transcript)] : []), ...configs.flatMap((file) => ["--config", quote(file)])].join(" ");
  const lines = [
    "Session cleanup: at the end of each sound unit of work (validated, merged, or abandoned on purpose), list what this session left on the computer and ask the user what to remove, before removing anything.",
    `To list it, with sizes: ${command}`,
    "Add --claim <path> for what this history cannot show, such as files a script created on its own. Show the user a short list with sizes and the total, in their language, and remove only what they pick, with the remove command the scan prints. The session-cleanup skill, if available, describes the whole routine.",
  ];
  if (claude) {
    lines.push("Worktrees in .claude/worktrees belong to Claude app sessions: offer to remove one only if its session is archived or the user confirms its work is done; the app's storage report shows which session each one belongs to.");
  }
  if (disk && lowDisk(disk.free)) {
    lines.push(`Free space is low: ${(disk.free / GB).toFixed(1)} GB of ${Math.round(disk.total / GB)} GB on ${disk.root}. Do not interrupt the current task; at the next natural break, offer an audit (the same scan with --audit), which also lists older leftovers.`);
  }
  return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") } };
}

function diskOf(path) {
  try {
    const root = parsePath(resolve(path)).root;
    const fs = statfsSync(root);
    return { root, free: fs.bavail * fs.bsize, total: fs.blocks * fs.bsize };
  } catch {
    return null;
  }
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8")) || {};
  } catch {}
  const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
  // At startup the history file may not exist yet; it will when the session scans.
  const transcript = typeof input.transcript_path === "string" && input.transcript_path ? resolve(input.transcript_path) : null;
  const script = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "leftovers.mjs");
  const output = message({ transcript, cwd, script: resolve(script), disk: diskOf(cwd), claude: Boolean(process.env.CLAUDE_PLUGIN_ROOT) });
  process.stdout.write(JSON.stringify(output));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch {
    // Never block or fail a session.
  }
}
