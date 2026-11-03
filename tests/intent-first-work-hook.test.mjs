// Run from the repository root with: node --test
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = (tool) => join(ROOT, tool, "plugins", "intent-first-work");
const HOOKS = { claude: join(plugin("claude"), "hooks", "intent-first-work.mjs"), codex: join(plugin("codex"), "hooks", "intent-first-work.mjs") };
const INSTRUCTIONS = join(ROOT, "instructions", "intent-first-work.md");
const SKILL = join(ROOT, "skills", "intent-first-work");

const temporary = [];
after(() => temporary.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function files(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
}

function run(hook, args) {
  const result = spawnSync(process.execPath, [hook, ...args], { input: "{}", encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

// The lines a user would otherwise copy by hand: the fenced block of the instructions file.
function expected() {
  return /```markdown\r?\n([\s\S]*?)\r?\n```/.exec(readFileSync(INSTRUCTIONS, "utf8"))[1].replace(/\r\n/g, "\n").trim();
}

test("the Claude and Codex plugins ship the same hook, and Codex the same skill and instructions", () => {
  assert.equal(readFileSync(HOOKS.claude, "utf8"), readFileSync(HOOKS.codex, "utf8"));
  assert.equal(readFileSync(join(plugin("codex"), "instructions", "intent-first-work.md"), "utf8"), readFileSync(INSTRUCTIONS, "utf8"));
  const copy = join(plugin("codex"), "skills", "intent-first-work");
  assert.deepEqual(files(copy), files(SKILL));
  for (const file of files(SKILL)) {
    assert.equal(readFileSync(join(copy, file), "utf8"), readFileSync(join(SKILL, file), "utf8"), `Codex copy of ${file}`);
  }
});

test("the Claude Code marketplace entry loads only this skill, and runs the hook on the original instructions", () => {
  const marketplace = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "marketplace.json"), "utf8"));
  const entry = marketplace.plugins.find((p) => p.name === "intent-first-work");
  assert.equal(entry.source, "./");
  assert.deepEqual(entry.skills, ["./skills/intent-first-work"]);
  const [hook] = entry.hooks.SessionStart[0].hooks;
  assert.equal(hook.command, "node");
  assert.deepEqual(hook.args, ["${CLAUDE_PLUGIN_ROOT}/claude/plugins/intent-first-work/hooks/intent-first-work.mjs", "${CLAUDE_PLUGIN_ROOT}/instructions/intent-first-work.md"]);
});

test("the Codex marketplace lists the plugin", () => {
  const marketplace = JSON.parse(readFileSync(join(ROOT, ".agents", "plugins", "marketplace.json"), "utf8"));
  assert.equal(marketplace.plugins.find((p) => p.name === "intent-first-work").source.path, "./codex/plugins/intent-first-work");
});

for (const [tool, hook] of Object.entries(HOOKS)) {
  const instructions = tool === "claude" ? INSTRUCTIONS : join(plugin("codex"), "instructions", "intent-first-work.md");

  test(`${tool}: adds the instruction lines, and only them`, () => {
    const output = run(hook, [instructions]);
    assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
    const context = output.hookSpecificOutput.additionalContext;
    assert.equal(context, expected());
    assert.match(context, /^## Intent first\n/);
    assert.match(context, /load the `intent-first-work` skill/);
    assert.doesNotMatch(context, /```|Add these lines/);
  });

  test(`${tool}: stays under Codex's cap on hook output`, () => {
    // Codex keeps about 2,500 tokens of each hook output; 4 characters a token is a safe estimate.
    assert.ok(run(hook, [instructions]).hookSpecificOutput.additionalContext.length < 2500 * 4);
  });

  test(`${tool}: never fails, and adds nothing without the lines`, () => {
    const dir = mkdtempSync(join(tmpdir(), "intent-first-work-hook-"));
    temporary.push(dir);
    const empty = join(dir, "empty.md");
    writeFileSync(empty, "# No block here\n");
    assert.equal(run(hook, [empty]), null);
    assert.equal(run(hook, [join(dir, "missing.md")]), null);
    assert.equal(run(hook, []), null);
  });
}

test("reads lines written with Windows line endings", () => {
  const dir = mkdtempSync(join(tmpdir(), "intent-first-work-hook-"));
  temporary.push(dir);
  const file = join(dir, "crlf.md");
  writeFileSync(file, readFileSync(INSTRUCTIONS, "utf8").replace(/\r?\n/g, "\r\n"));
  assert.equal(run(HOOKS.claude, [file]).hookSpecificOutput.additionalContext, expected());
});
