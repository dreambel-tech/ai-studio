// Run from the repository root with: node --test
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, appendFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COPIES = {
  claude: join(ROOT, "claude", "plugins", "context-gauge", "hooks", "context-gauge.mjs"),
  codex: join(ROOT, "codex", "plugins", "context-gauge", "hooks", "context-gauge.mjs"),
};

// A Claude Code transcript line for a request of `tokens` context.
function claudeTurn(tokens, extra = {}) {
  return JSON.stringify({
    type: "assistant",
    message: {
      model: "claude-test",
      usage: { input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: tokens - 1010, output_tokens: 50 },
    },
    ...extra,
  });
}

// A Codex rollout line for a request of `tokens` context in a `window` context window.
function codexTurn(tokens, window = 258_400) {
  return JSON.stringify({
    timestamp: "2026-10-19T13:36:03.856Z",
    ordinal: 1,
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: { input_tokens: tokens * 3, total_tokens: tokens * 3 },
        last_token_usage: { input_tokens: tokens - 100, cached_input_tokens: tokens - 2000, output_tokens: 100, total_tokens: tokens },
        model_context_window: window,
      },
    },
  });
}

const temporary = [];
after(() => temporary.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(dir);
  return dir;
}

function setup(script) {
  const dir = tempDir("context-gauge-test-");
  const transcript = join(dir, "session.jsonl");
  writeFileSync(transcript, JSON.stringify({ type: "user", message: { content: "hello" } }) + "\n");
  const data = join(dir, "data");
  const run = (env = {}, stdin) => {
    const result = spawnSync("node", [script], {
      input: stdin ?? JSON.stringify({ session_id: "s1", transcript_path: transcript, hook_event_name: "UserPromptSubmit" }),
      env: { ...process.env, PLUGIN_DATA: "", CLAUDE_PLUGIN_DATA: data, CONTEXT_GAUGE_LEVELS: "", CONTEXT_GAUGE_NOTIFY_USER: "", ...env },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout ? JSON.parse(result.stdout) : null;
  };
  const add = (line) => appendFileSync(transcript, line + "\n");
  return { run, add };
}

test("the Claude and Codex plugins ship the same script", () => {
  assert.equal(readFileSync(COPIES.claude, "utf8"), readFileSync(COPIES.codex, "utf8"));
});

for (const [name, script] of Object.entries(COPIES)) {
  test(`${name}: stays silent below the first level`, () => {
    const { run, add } = setup(script);
    add(claudeTurn(120_000));
    assert.equal(run(), null);
  });

  test(`${name}: warns once per level, for the model only by default`, () => {
    const { run, add } = setup(script);
    add(claudeTurn(300_000));
    const first = run();
    assert.match(first.hookSpecificOutput.additionalContext, /about 300k tokens \(heavy\)/);
    assert.equal(first.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.equal(first.systemMessage, undefined);
    add(claudeTurn(320_000));
    assert.equal(run(), null);
    add(claudeTurn(450_000));
    assert.match(run().hookSpecificOutput.additionalContext, /about 450k tokens \(very heavy\)/);
    add(claudeTurn(460_000));
    assert.equal(run(), null);
  });

  test(`${name}: shows a notice to the user when asked to`, () => {
    const { run, add } = setup(script);
    add(claudeTurn(260_000));
    assert.match(run({ CONTEXT_GAUGE_NOTIFY_USER: "1" }).systemMessage, /^Context: about 260k tokens \(heavy\)/);
  });

  test(`${name}: warns again after a compaction brings the context back down`, () => {
    const { run, add } = setup(script);
    add(claudeTurn(300_000));
    assert.ok(run());
    add(JSON.stringify({ type: "system", subtype: "compact_boundary" }));
    assert.equal(run(), null);
    add(claudeTurn(90_000));
    assert.equal(run(), null);
    add(claudeTurn(280_000));
    assert.ok(run());
  });

  test(`${name}: does not repeat a warning for a small dip around a threshold`, () => {
    const { run, add } = setup(script);
    add(claudeTurn(255_000));
    assert.ok(run());
    add(claudeTurn(240_000));
    assert.equal(run(), null);
    add(claudeTurn(270_000));
    assert.equal(run(), null);
  });

  test(`${name}: ignores sub-agent and synthetic entries`, () => {
    const { run, add } = setup(script);
    add(claudeTurn(100_000));
    add(claudeTurn(700_000, { isSidechain: true }));
    add(JSON.stringify({ type: "assistant", message: { model: "<synthetic>", usage: { input_tokens: 900_000 } } }));
    assert.equal(run(), null);
  });

  test(`${name}: reads Codex rollouts and warns at a share of a small window`, () => {
    const { run, add } = setup(script);
    add(codexTurn(140_000));
    assert.equal(run(), null);
    add(codexTurn(160_000));
    assert.match(run().hookSpecificOutput.additionalContext, /about 160k tokens, 61% of the window \(heavy\)/);
    add(codexTurn(210_000));
    assert.match(run().hookSpecificOutput.additionalContext, /81% of the window \(very heavy\)/);
  });

  test(`${name}: treats a Codex compaction as a boundary`, () => {
    const { run, add } = setup(script);
    add(codexTurn(170_000));
    assert.ok(run());
    add(JSON.stringify({ timestamp: "2026-10-19T14:00:00.000Z", ordinal: 2, type: "compacted", payload: {} }));
    assert.equal(run(), null);
    add(codexTurn(40_000));
    assert.equal(run(), null);
    add(codexTurn(165_000));
    assert.ok(run());
  });

  test(`${name}: uses absolute levels for a large Codex window`, () => {
    const { run, add } = setup(script);
    add(codexTurn(300_000, 1_000_000));
    assert.match(run().hookSpecificOutput.additionalContext, /about 300k tokens, 30% of the window \(heavy\)/);
  });

  test(`${name}: honours custom levels, absolute or relative`, () => {
    const { run, add } = setup(script);
    add(claudeTurn(150_000));
    assert.ok(run({ CONTEXT_GAUGE_LEVELS: "100000, 200000" }));
    const codex = setup(script);
    codex.add(codexTurn(110_000));
    assert.ok(codex.run({ CONTEXT_GAUGE_LEVELS: "40%" }));
  });

  test(`${name}: finds the last usage behind a very large line`, () => {
    const { run, add } = setup(script);
    add(claudeTurn(300_000));
    add(JSON.stringify({ type: "user", message: { content: "x".repeat(6 * 1024 * 1024) } }));
    assert.ok(run());
  });

  test(`${name}: keeps its state in PLUGIN_DATA when the tool provides it`, () => {
    const { run, add } = setup(script);
    const data = tempDir("context-gauge-data-");
    add(claudeTurn(300_000));
    assert.ok(run({ PLUGIN_DATA: data }));
    assert.deepEqual(JSON.parse(readFileSync(join(data, "s1.json"), "utf8")), { level: 1 });
  });

  test(`${name}: never fails on bad input`, () => {
    const { run } = setup(script);
    assert.equal(run({}, "not json"), null);
    assert.equal(run({}, JSON.stringify({ session_id: "s2", transcript_path: "/does/not/exist.jsonl" })), null);
    assert.equal(run({}, ""), null);
  });
}
