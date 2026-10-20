// Run from the repository root with: node --test
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = (tool) => join(ROOT, tool, "plugins", "session-cleanup");
const HOOKS = { claude: join(plugin("claude"), "hooks", "session-cleanup.mjs"), codex: join(plugin("codex"), "hooks", "session-cleanup.mjs") };
const SKILL_SCRIPT = join(ROOT, "skills", "session-cleanup", "scripts", "leftovers.mjs");

const temporary = [];
after(() => temporary.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function project() {
  const dir = mkdtempSync(join(tmpdir(), "session-cleanup-hook-"));
  temporary.push(dir);
  return dir;
}

function run(hook, input, env = {}) {
  const result = spawnSync(process.execPath, [hook], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: "", SESSION_CLEANUP_MIN_FREE_GB: "0", ...env },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

const context = (output) => output.hookSpecificOutput.additionalContext;

test("the Claude and Codex plugins ship the same hook, and the same script as the skill", () => {
  assert.equal(readFileSync(HOOKS.claude, "utf8"), readFileSync(HOOKS.codex, "utf8"));
  for (const tool of ["claude", "codex"]) {
    assert.equal(readFileSync(join(plugin(tool), "scripts", "leftovers.mjs"), "utf8"), readFileSync(SKILL_SCRIPT, "utf8"), `${tool} copy of leftovers.mjs`);
  }
});

for (const [tool, hook] of Object.entries(HOOKS)) {
  test(`${tool}: gives the scan command with the session's history`, () => {
    const cwd = project();
    const transcript = join(cwd, "session.jsonl");
    const output = run(hook, { session_id: "s1", transcript_path: transcript, cwd, hook_event_name: "SessionStart", source: "startup" });
    assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
    const script = join(plugin(tool), "scripts", "leftovers.mjs");
    assert.ok(context(output).includes(`node "${script}" scan --history "${transcript}"`), context(output));
    assert.match(context(output), /ask the user what to remove, before removing anything/);
    assert.doesNotMatch(context(output), /Free space is low/);
    assert.doesNotMatch(context(output), /Claude app sessions/);
  });

  test(`${tool}: adds the launch configurations of the project`, () => {
    const cwd = project();
    mkdirSync(join(cwd, ".claude"));
    writeFileSync(join(cwd, ".claude", "launch.json"), "{}");
    const output = run(hook, { transcript_path: join(cwd, "s.jsonl"), cwd });
    assert.ok(context(output).includes(`--config "${join(cwd, ".claude", "launch.json")}"`), context(output));
  });

  test(`${tool}: warns when the disk is nearly full`, () => {
    const output = run(hook, { transcript_path: "s.jsonl", cwd: project() }, { SESSION_CLEANUP_MIN_FREE_GB: "100000000" });
    assert.match(context(output), /Free space is low: [\d.]+ GB of \d+ GB/);
  });

  test(`${tool}: never fails, even on bad input`, () => {
    const output = run(hook, "not json");
    assert.match(context(output), /scan/);
    assert.doesNotMatch(context(output), /--history/);
  });
}

test("in Claude Code, the note says that app worktrees belong to sessions", () => {
  const output = run(HOOKS.claude, { transcript_path: "s.jsonl", cwd: project() }, { CLAUDE_PLUGIN_ROOT: plugin("claude") });
  assert.match(context(output), /Worktrees in \.claude\/worktrees belong to Claude app sessions/);
});
