#!/usr/bin/env node
// context-line: a Claude Code status line that shows the session's context size in the
// terminal footer, quiet while the session is light and coloured once it is heavy. It
// uses the same levels as the context-gauge plugin. See ./README.md.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { thresholds, levelOf } from "../plugins/context-gauge/hooks/context-gauge.mjs";

const DIM = "\x1b[2m";
const AMBER = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

export function contextOf(status) {
  const window = status && status.context_window;
  if (!window) return null;
  const size = window.context_window_size || null;
  const usage = window.current_usage;
  if (usage) {
    const tokens = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
    return { tokens, window: size };
  }
  if (size && typeof window.used_percentage === "number") return { tokens: (window.used_percentage / 100) * size, window: size };
  return null;
}

export function render(status, { color = true } = {}) {
  const context = contextOf(status);
  if (!context) return "";
  const k = Math.round(context.tokens / 1000);
  const share = context.window ? ` (${Math.floor((context.tokens / context.window) * 100)}%)` : "";
  const level = levelOf(context.tokens, thresholds(context.window));
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text);
  if (level === 0) return paint(DIM, `context ${k}k${share}`);
  const name = level === 1 ? "heavy" : "very heavy";
  return paint(level === 1 ? AMBER : RED, `context ${k}k${share}, ${name}: compacting or a fresh session would cost less per step`);
}

function main() {
  let status;
  try {
    status = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return;
  }
  const line = render(status, { color: !process.env.NO_COLOR });
  if (line) process.stdout.write(line + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch {
    // A status line must never break the session.
  }
}
