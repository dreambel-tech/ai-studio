#!/usr/bin/env node
// context-gauge: a UserPromptSubmit hook that tells the session, once per level,
// when its context has grown heavy. It never blocks and prints nothing below the
// first level. It reads Claude Code transcripts and Codex rollouts alike, so the
// same file ships in claude/plugins/context-gauge and codex/plugins/context-gauge;
// keep both copies identical (the tests check it). See ../README.md.

import { openSync, readSync, fstatSync, closeSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

// Absolute levels suit large windows; small windows warn at a share of the window instead.
const LARGE_WINDOW_LEVELS = ["250000", "400000", "600000"];
const SMALL_WINDOW_LEVELS = ["60%", "80%"];
const SMALL_WINDOW = 500_000;
const FIRST_CHUNK = 4 * 1024 * 1024;
const MAX_CHUNK = 32 * 1024 * 1024;

export function thresholds(window, raw = process.env.CONTEXT_GAUGE_LEVELS) {
  let specs = raw ? raw.split(",").map((value) => value.trim()).filter(Boolean) : null;
  if (!specs || !specs.length) specs = window && window < SMALL_WINDOW ? SMALL_WINDOW_LEVELS : LARGE_WINDOW_LEVELS;
  const values = specs
    .map((spec) => (spec.endsWith("%") ? (window ? (Number(spec.slice(0, -1)) / 100) * window : NaN) : Number(spec)))
    .filter((n) => Number.isFinite(n) && n > 0);
  return values.sort((a, b) => a - b);
}

function readTail(path, bytes) {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const buffer = Buffer.alloc(size - start);
    readSync(fd, buffer, 0, buffer.length, start);
    return { text: buffer.toString("utf8"), complete: start === 0 };
  } finally {
    closeSync(fd);
  }
}

function parse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

// One transcript line to { tokens, window }, null to keep looking, or "boundary" after a compaction.
function readLine(line) {
  // Claude Code: input + cache writes + cache reads of the last main-thread request.
  if (line.includes('"compact_boundary"') || line.includes('"isCompactSummary":true')) return "boundary";
  if (line.includes('"usage"') && line.includes('"assistant"')) {
    const entry = parse(line);
    if (!entry || entry.type !== "assistant" || entry.isSidechain) return null;
    const usage = entry.message && entry.message.usage;
    if (!usage || entry.message.model === "<synthetic>") return null;
    const tokens = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
    return { tokens, window: null };
  }
  // Codex: the last request's token count and the model's context window.
  if (line.includes('"token_count"')) {
    const entry = parse(line);
    const info = entry && entry.payload && entry.payload.type === "token_count" && entry.payload.info;
    const last = info && info.last_token_usage;
    if (!last) return null;
    return { tokens: last.total_tokens || last.input_tokens || 0, window: info.model_context_window || null };
  }
  if (line.startsWith('{"timestamp"') && line.includes('"type":"compacted"')) return "boundary";
  return null;
}

// Size of the session's context at its last request, or null when unknown,
// including right after a compaction.
export function lastContext(transcriptPath) {
  for (let bytes = FIRST_CHUNK; bytes <= MAX_CHUNK; bytes *= 2) {
    const { text, complete } = readTail(transcriptPath, bytes);
    const lines = text.split("\n");
    if (!complete) lines.shift(); // first line is probably cut
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i]) continue;
      const found = readLine(lines[i]);
      if (found === "boundary") return null;
      if (found) return found;
    }
    if (complete) return null;
  }
  return null;
}

export function levelOf(tokens, levels) {
  let level = 0;
  for (const threshold of levels) if (tokens >= threshold) level++;
  return level;
}

function stateFile(sessionId) {
  const dir = process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || join(tmpdir(), "context-gauge");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${String(sessionId).replace(/[^\w.-]/g, "_")}.json`);
}

function readWarnedLevel(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8")).level || 0;
  } catch {
    return 0;
  }
}

export function message({ tokens, window }, level, notifyUser) {
  const size = `about ${Math.round(tokens / 1000)}k tokens` + (window ? `, ${Math.floor((tokens / window) * 100)}% of the window` : "");
  const name = level === 1 ? "heavy" : "very heavy";
  const context =
    `Context gauge: this session's context is ${size} (${name}). ` +
    "Every step now re-reads all of it. Do not interrupt the current task for this. " +
    "At the next natural break (a batch delivered, a pull request opened, a report sent), offer one move, once: " +
    "compacting here if the same task or thread continues (only the user can run the compaction command, so give it " +
    "ready to copy on one line; some tools send the text after it as the user's next message, so make that text one " +
    "imperative line naming where the work stands and the next step the user already decided, or give the bare " +
    "command if there is none), or a fresh session from a relay " +
    "brief if the topic changes or the session was already compacted twice. Put the offer in the agent tool's next-step " +
    "box or suggestion buttons if it has them and add nothing to your text; otherwise put it on the last line of your " +
    "report after a blank line, in at most 25 words in the user's language besides the command. No heading, no bold, " +
    "no explanation of this note. The session-relay skill, if available, describes the choice and the brief. " +
    "If the user prefers to continue as is, continue.";
  const output = { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context } };
  if (notifyUser) output.systemMessage = `Context: ${size} (${name}). Compacting or a fresh session would cost much less per step.`;
  return output;
}

function main() {
  const input = parse(readFileSync(0, "utf8"));
  if (!input || !input.transcript_path || !input.session_id) return;

  let context;
  try {
    context = lastContext(input.transcript_path);
  } catch {
    return;
  }
  if (!context) return;

  const levels = thresholds(context.window);
  const level = levelOf(context.tokens, levels);
  const file = stateFile(input.session_id);
  const warned = readWarnedLevel(file);

  // After a compaction, lower the mark so the next climb warns again. The 25% margin
  // keeps small dips around a threshold from repeating the same warning.
  const released = levelOf(context.tokens * 1.25, levels);
  if (released < warned) writeFileSync(file, JSON.stringify({ level: released }));
  if (level === 0 || level <= warned) return;

  writeFileSync(file, JSON.stringify({ level }));
  process.stdout.write(JSON.stringify(message(context, level, process.env.CONTEXT_GAUGE_NOTIFY_USER === "1")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch {
    // Never block or fail a session.
  }
}
