// Run from the repository root with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "../claude/statusline/context-line.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "claude", "statusline", "context-line.mjs");

function status(tokens, size = 1_000_000) {
  return {
    session_id: "s1",
    context_window: {
      context_window_size: size,
      used_percentage: (tokens / size) * 100,
      current_usage: { input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: tokens - 1010, output_tokens: 50 },
    },
  };
}

test("stays quiet while the session is light", () => {
  assert.equal(render(status(120_000), { color: false }), "context 120k (12%)");
  assert.equal(render(status(120_000)), "\x1b[2mcontext 120k (12%)\x1b[0m");
});

test("turns amber, then red, as the levels are crossed", () => {
  assert.equal(render(status(300_000), { color: false }), "context 300k (30%), heavy: compacting or a fresh session would cost less per step");
  assert.match(render(status(300_000)), /^\x1b\[33m/);
  assert.match(render(status(450_000)), /^\x1b\[31m.*very heavy/);
});

test("uses a share of a small window", () => {
  assert.equal(render(status(100_000, 200_000), { color: false }), "context 100k (50%)");
  assert.match(render(status(130_000, 200_000), { color: false }), /^context 130k \(65%\), heavy/);
});

test("falls back to the percentage when the usage is not there yet", () => {
  const value = { context_window: { context_window_size: 1_000_000, used_percentage: 26, current_usage: null } };
  assert.match(render(value, { color: false }), /^context 260k \(26%\), heavy/);
});

test("prints nothing when the context is unknown", () => {
  assert.equal(render({ context_window: { current_usage: null, used_percentage: null } }), "");
  assert.equal(render({}), "");
});

test("runs as a status line command and honours NO_COLOR", () => {
  const result = spawnSync("node", [SCRIPT], { input: JSON.stringify(status(300_000)), env: { ...process.env, NO_COLOR: "1" }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "context 300k (30%), heavy: compacting or a fresh session would cost less per step\n");
  const bad = spawnSync("node", [SCRIPT], { input: "not json", encoding: "utf8" });
  assert.equal(bad.status, 0);
  assert.equal(bad.stdout, "");
});
