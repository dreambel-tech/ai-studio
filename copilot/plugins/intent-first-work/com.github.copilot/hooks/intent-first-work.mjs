#!/usr/bin/env node
// intent-first-work: event-driven UserPromptSubmit + PreToolUse hook for Claude Code, Codex, and GitHub Copilot.
// Silent by default (0 tokens on clear tasks and on files with no unread decisions, shared blast radius, or consumers).
// Adapts guidance to the active model and reasoning effort, and pushes unread local context
// (decisions, shared blast-radius warnings, external readers, tests, recent git history) right before edits.
// Never blocks or fails a session. The same file ships in claude/plugins/intent-first-work,
// codex/plugins/intent-first-work, and copilot/plugins/intent-first-work; keep all copies identical (the tests check it).

import { spawnSync } from "node:child_process";
import { appendFileSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FIRST_CHUNK = 2 * 1024 * 1024;
const MAX_CHUNK = 16 * 1024 * 1024;
const MAX_LINES = 7;
const MAX_DECISIONS = 3;
const MAX_READERS = 3;
const MAX_TESTS = 2;
const MAX_HISTORY = 2;
const MAX_SYMBOLS = 6;
const SNIPPET_LEN = 80;
const HARD_CAP = 1500;
const MAX_DISK_READ = 64 * 1024;

// Language keywords, base types, and overly generic identifiers that are poor search terms.
export const STOP = new Set((
  "abstract actual annotation async await boolean break byte case catch char class companion const constructor continue " +
  "crossinline data debugger default def delegate delete double dynamic elif else enum expect export extends external false " +
  "final finally float for from function goto implements import infix init inline inner instanceof interface internal is " +
  "lambda lateinit let long native new noinline none null object open operator override package pass private protected " +
  "public reified require return sealed self short static super suspend switch synchronized tailrec this throw throws " +
  "transient true try type typealias typeof undefined val value var vararg void volatile when where while with yield " +
  "string int integer number bool any unit nothing list map set array char float double nil fn pub mut impl trait struct " +
  "item items elem element index count length size name text label title key keys value values result results output input " +
  "error err msg message info warn debug log logs file files path dir line lines state props config opts options params args " +
  "next prev start end init main run test tests spec mock stub setup helper utils util common shared types type model view " +
  "render handle update create delete remove fetch load save read write parse format check valid validate build make get set " +
  "push pop shift map filter reduce find some every includes length toString valueOf json"
).split(/\s+/));

const GENERIC_BASENAMES = new Set([
  "index", "main", "app", "mod", "lib", "init", "__init__", "types", "utils", "helpers",
  "constants", "config", "styles", "style", "readme", "changelog", "license", "package",
  "test", "tests", "spec", "specs", "setup",
]);

const DOC_EXT = /\.(md|markdown|txt|rst|adoc)$/i;
const STYLE_EXT = /\.(?:css|scss|sass|less)$/i;
const GLOBAL_STYLE_RE = /(?:^|[\s{,])(?:::ng-deep|:global\b|mat-[a-z0-9-]+|html\s*[{,:]|body\s*[{,:]|\*\s*\{)/m;
const DECISION_PATH = /(^|\/)(adr|decisions?|r[eè]gles?|rules?|agents|instructions|architecture|[ée]carts?|sfd|specs?|conventions?|rfcs?|design[-_]?docs?)([^/]*)(\/|$)|(^|\/)(CLAUDE|AGENTS|CONTRIBUTING)\.md$/i;
// Root instruction/rule files already auto-loaded by Claude Code, Codex, Copilot, and Antigravity,
// plus installed skill folders that are not code consumers.
const AUTO_LOADED_RULE = /^(?:CLAUDE|AGENTS|GEMINI)\.md$|^\.(?:claude|agents|github)\/(?:rules|skills|instructions)\/|^\.github\/copilot-instructions\.md$/i;
const TEST_PATH = /(^|\/)(tests?|__tests__|specs?|e2e)(\/|$)|\.(test|spec)\.[^.]+$/i;
const HASH_COMMENT = /\.(py|sh|bash|rb|ya?ml|toml|ps1|r|pl|conf|ini)$/i;

const SMALL_MODEL_RE = /(?<![a-z])(?:haiku|luna|hydrogen|mini|nano|flash|lite|small|raptor)(?![a-z])/i;
const FRONTIER_MODEL_RE = /(?<![a-z])(?:opus|fable|mythos|sol|astra|carbon)(?![a-z])/i;
const LOW_EFFORT_RE = /^(low|minimal|none|off)$/i;
const HIGH_EFFORT_RE = /^(high|xhigh|max|maximum)$/i;

const EDIT_TOOL_RE = /^(?:Edit|MultiEdit|Write|apply_patch|replace_string_in_file|multi_replace_string_in_file|create_file|edit_file|editFile|editFiles)$/i;

const SHORT_ACK_RE = /^(?:yes|yeah|yep|yup|ok|okay|sure|go|go ahead|continue|proceed|do it|looks good|lgtm|ship it|approved|thanks|thank you|thx|merci|oui|ouais|d['’]accord|dac|ça marche|ca marche|ça me va|ca me va|vas[- ]y|parfait|c['’]est bon|c est bon|fais[- ]le|lance|next|retry|again|try again|done|stop|cancel|annule|exact|correct|agreed|sounds good|all good|fine|great|nice|super|top|cool)[\s.,!?:;-]*$/i;
const SHORT_CONFIRM_PREFIX_RE = /^(?:yes|yeah|yep|yup|ok|okay|sure|oui|ouais|d['’]accord|dac|vas[- ]y|go ahead)\b[\s,.:;!-]/i;
const SHORT_PRONOUN_ACTION_RE = /^(?:remove|delete|drop|fix|merge|push|commit|archive|keep|revert|supprime\w*|corrige\w*|fusionne\w*|pousse\w*|archive\w*|garde\w*)\s+(?:it|them|all|them all|this|that|that one|le|la|les|tout|ça|ca)[\s.,!?:;-]*$/i;
const ENVELOPE_TAG_RE = /^<[a-z][a-z0-9_-]*(?:\s[^>]*)?>/i;
const MECHANICAL_RE = /^(?:(?:please|pls|can you|could you|peux[- ]tu|merci de)\s+)?(?:run|re-?run|execute|check|fix|format|lint|typecheck|build|compile|install|update|upgrade|git|commit|push|pull|fetch|rebase|merge|stash|status|diff|branch|checkout|list|show|print|open|lance\w*|ex[ée]cute\w*|v[ée]rifie\w*|formate\w*|compile\w*|installe\w*|fais\s+un\s+commit|commit\w*|pousse\w*|affiche\w*)\s+(?:the\s+|les?\s+|la\s+|un\s+|une\s+|all\s+)?(?:tests?|unit tests?|test suite|suite|lint(?:er|ing)?|eslint|prettier|formatter|typecheck|types|tsc|build|git\s+\w+|status|diff|commit|branch|branches|pr|pull request|dependencies|deps|packages?)(?:[\s.,!?:;-].*)?$/i;
const PURE_QUESTION_RE = /^(?:what|where|which|when|who|why|how\s+(?:does|do|is|are|did)|explain|show\s+me|tell\s+me|list|read|summarize|describe|qu['’]est[- ]ce|o[ùu]\s+est|o[ùu]\s+sont|comment\s+fonctionne|explique|montre|liste|lis|r[ée]sume|d[ée]cris)\b/i;
const QUESTION_WITH_ACTION_RE = /\b(?:and|then|also|puis|et)\s+(?:then\s+)?(?:implement|build|create|add|change|modify|edit|update|fix|refactor|rewrite|replace|migrate|remove|delete|redesign|improve|optimize|simplify|clean\s+up|impl[ée]ment\w*|cr[ée]\w*|ajoute\w*|modifie\w*|corrige\w*|refactoris\w*|r[ée][ée]cri\w*|remplace\w*|migre\w*|supprime\w*|am[ée]liore\w*|optimis\w*|simplifi\w*|nettoie\w*)\b/i;
const CHANGE_INTENT_RE = /\b(?:implement|build|create|add|change|modify|edit|update|fix|refactor|rewrite|replace|migrate|remove|delete|redesign|improve|optimize|simplify|clean\s+up|propose|design|impl[ée]ment\w*|cr[ée]\w*|ajoute\w*|modifie\w*|corrige\w*|refactoris\w*|r[ée][ée]cri\w*|remplace\w*|migre\w*|supprime\w*|am[ée]liore\w*|optimis\w*|simplifi\w*|nettoie\w*|propose\w*|con[çc]oi\w*)\b/i;
const STRUCTURAL_RE = /\b(?:replace|migrate|migration|rewrite|remove|delete|deprecate|redesign|rearchitect|architecture|refactor|overhaul|extract|split|switch\s+from|move\s+away\s+from|breaking\s+change|schema|contract|remplace\w*|migre\w*|r[ée][ée]cri\w*|supprime\w*|refonte|refactoris\w*|r[ée]organis\w*|d[ée]coupe\w*|architecture|sch[ée]ma|contrat)\b/i;
const SWEEPING_RE = /\b(?:all\s+fields|every\s+field|all\s+tabs|all\s+screens|all\s+pages|real[- ]?time|tous\s+les\s+champs|chaque\s+champ|tous\s+les\s+onglets|tous\s+les\s+[ée]crans|temps\s+r[ée]el)\b/i;
const INHERITED_OR_BUG_RE = /\b(?:take\s+over|inherited|handoff|hand\s+over|pick\s+up|another\s+agent|previous\s+agent|doesn['’]t\s+work|not\s+working|broken|weird|strange|buggy|investigate|audit|reprend\w*|h[ée]rit[ée]\w*|autre\s+agent|pr[ée]c[ée]dent\s+agent|marche\s+pas|ne\s+fonctionne\s+pas|cass[ée]\w*|bizarre|enqu[êe]t\w*)\b/i;
const SYMPTOM_RE = /\b(?:plantage|plante|crash(?:es|ing)?|ne\s+s['’]affiche\s+pas|absent\s+d(?:e|es|u)|dispara[îi]t|missing\s+from|overflow(?:s|ing)?)\b/i;
const OPEN_GOAL_RE = /\b(?:improve|optimize|clean\s+up|simplify|better|enhance|rework|polish|make\s+it|add|build|implement|create|design|support|fix|handle|am[ée]liore\w*|optimis\w*|nettoie\w*|simplifi\w*|ajoute\w*|cr[ée]\w*|impl[ée]ment\w*|con[çc]oi\w*|corrige\w*|g[èe]re\w*|fais\s+en\s+sorte)\b/i;

const FILE_LINE_ANCHOR_RE = /(?:[\w./\\-]+\.[a-zA-Z0-9]{1,8}:\d+|\b(?:line|ligne)\s+\d+\b)/i;
const FILE_PATH_RE = /(?:^|[\s`'"(])(?:[a-zA-Z0-9_.-]+[\\/])+[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]{1,8}\b/;
const STACKTRACE_RE = /(?:^\s*at\s+\S+\s+\([^)]+:\d+:\d+\)|Traceback \(most recent call last\)|^\s*File "[^"]+", line \d+|^(?:TypeError|ReferenceError|SyntaxError|RangeError|AssertionError|Error):)/m;
const DIFF_RE = /^(?:diff --git |@@ -\d+,\d+ \+\d+,\d+ @@)/m;

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizePosix(p) {
  return String(p || "").replace(/\\/g, "/");
}

function toRepoRelative(repo, filePath) {
  if (!repo || !filePath) return null;
  const abs = isAbsolute(filePath) ? resolve(filePath) : resolve(repo, filePath);
  const rel = relative(resolve(repo), abs);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return normalizePosix(rel);
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

function extractTextFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (!block) continue;
    if (typeof block === "string") parts.push(block);
    else if (block.type === "text" && typeof block.text === "string") parts.push(block.text);
    else if (block.type === "output_text" && typeof block.text === "string") parts.push(block.text);
  }
  return parts.join("\n");
}

function endsWithQuestion(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const paragraphs = trimmed.split(/\n\s*\n/);
  const last = paragraphs[paragraphs.length - 1].trim();
  return /\?[\s"')\]*`]*$/.test(last);
}

function extractPathsFromCommand(cmd, repo) {
  const found = [];
  if (typeof cmd !== "string" || !repo) return found;
  // Common read-only file inspection commands in Codex/shell rollouts.
  if (!/\b(?:cat|head|tail|sed|less|more|bat|Get-Content|gc|type)\b/.test(cmd)) return found;
  const tokens = cmd.match(/(?:"[^"]+"|'[^']+'|[^\s|;&><]+)/g) || [];
  for (const raw of tokens) {
    const token = raw.replace(/^['"]|['"]$/g, "");
    if (!token || token.startsWith("-") || !/[./\\]/.test(token)) continue;
    const rel = toRepoRelative(repo, token);
    if (rel) found.push(rel);
  }
  return found;
}

// Inspects a Claude Code transcript or Codex rollout to recover:
// - active model & reasoning effort / thinking presence
// - whether the last assistant turn ended by asking the user a question
// - which repository files the agent has already read in this session
export function readTranscriptInfo(transcriptPath, repo = null) {
  const info = {
    model: null,
    effort: null,
    hasThinking: null,
    lastAssistantAskedQuestion: false,
    readFiles: new Set(),
    assistantTurns: 0,
  };
  if (!transcriptPath || !existsSync(transcriptPath)) return info;

  let text = "";
  try {
    let chunk = readTail(transcriptPath, FIRST_CHUNK);
    if (!chunk.complete) chunk = readTail(transcriptPath, MAX_CHUNK);
    text = chunk.text;
  } catch {
    return info;
  }

  const lines = text.split("\n");
  let lastAssistantText = "";

  for (const line of lines) {
    if (!line || line[0] !== "{") continue;
    const entry = parseJson(line);
    if (!entry || entry.isSidechain) continue;

    // Reset read-file cache after a compaction boundary so critical unread context can resurface.
    if (
      (entry.type === "system" && entry.subtype === "compact_boundary") ||
      entry.isCompactSummary === true ||
      entry.type === "compacted"
    ) {
      info.readFiles.clear();
      info.lastAssistantAskedQuestion = false;
      continue;
    }

    // Claude Code assistant message.
    if (entry.type === "assistant" && entry.message) {
      const msg = entry.message;
      if (msg.model && msg.model !== "<synthetic>") {
        info.model = msg.model;
        info.assistantTurns++;
      }
      if (Array.isArray(msg.content)) {
        let turnHasThinking = false;
        for (const block of msg.content) {
          if (!block) continue;
          if (block.type === "thinking" || block.type === "redacted_thinking") {
            turnHasThinking = true;
          }
          if (block.type === "tool_use") {
            const tool = String(block.name || "");
            const inp = block.input || {};
            if (/^(?:Read|read_file|open_file|view)$/i.test(tool) && typeof inp.file_path === "string") {
              const rel = toRepoRelative(repo, inp.file_path);
              if (rel) info.readFiles.add(rel);
            } else if (/^(?:Read|read_file|open_file|view)$/i.test(tool) && typeof inp.path === "string") {
              const rel = toRepoRelative(repo, inp.path);
              if (rel) info.readFiles.add(rel);
            } else if (/^(?:Bash|shell|run_command)$/i.test(tool) && typeof inp.command === "string") {
              for (const rel of extractPathsFromCommand(inp.command, repo)) info.readFiles.add(rel);
            }
          }
        }
        if (msg.model && msg.model !== "<synthetic>") info.hasThinking = turnHasThinking;
      }
      const txt = extractTextFromContent(msg.content);
      if (txt.trim()) lastAssistantText = txt;
      continue;
    }

    // Claude Code settings/meta entries if present.
    if (typeof entry.effort === "string") info.effort = entry.effort;
    if (typeof entry.effortLevel === "string") info.effort = entry.effortLevel;

    // Codex rollout entries.
    if (entry.payload && typeof entry.payload === "object") {
      const p = entry.payload;
      if (typeof p.model === "string") info.model = p.model;
      if (p.info && typeof p.info.model === "string") info.model = p.info.model;
      const eff = p.effort || p.reasoning_effort || p.model_reasoning_effort || (p.reasoning && p.reasoning.effort);
      if (typeof eff === "string") info.effort = eff;

      // Codex assistant text & tool calls.
      if (entry.type === "response_item") {
        if (p.type === "message" && p.role === "assistant") {
          info.assistantTurns++;
          const txt = extractTextFromContent(p.content);
          if (txt.trim()) lastAssistantText = txt;
        } else if (p.type === "reasoning") {
          info.hasThinking = true;
        } else if (p.type === "function_call" || p.type === "custom_tool_call") {
          const name = String(p.name || "");
          const args = typeof p.arguments === "string" ? parseJson(p.arguments) : p.arguments || {};
          if (args && typeof args === "object") {
            if (/^(?:read_file|open_file|Read)$/i.test(name)) {
              const rel = toRepoRelative(repo, args.path || args.file_path);
              if (rel) info.readFiles.add(rel);
            } else if (/^(?:shell|exec_command|bash)$/i.test(name)) {
              const cmd = Array.isArray(args.command) ? args.command.join(" ") : args.command || args.cmd;
              for (const rel of extractPathsFromCommand(cmd, repo)) info.readFiles.add(rel);
            }
          }
        }
      }
    }
  }

  info.lastAssistantAskedQuestion = endsWithQuestion(lastAssistantText);
  return info;
}

// Optional turn-1 fallback when the transcript does not yet contain an assistant message.
function readHostSettings() {
  const out = { model: null, effort: null, hasThinking: null };
  const home = homedir();
  if (!home) return out;

  const preferClaude = Boolean(process.env.CLAUDE_PLUGIN_ROOT);
  const candidates = preferClaude ? ["claude", "codex"] : ["codex", "claude"];

  for (const kind of candidates) {
    if (kind === "claude") {
      try {
        const file = join(home, ".claude", "settings.json");
        if (!existsSync(file)) continue;
        const data = parseJson(readFileSync(file, "utf8"));
        if (!data || typeof data !== "object") continue;
        if (typeof data.model === "string") out.model = data.model;
        if (typeof data.effortLevel === "string") out.effort = data.effortLevel;
        if (typeof data.alwaysThinkingEnabled === "boolean") out.hasThinking = data.alwaysThinkingEnabled;
        if (out.model || out.effort) return out;
      } catch {}
    } else {
      try {
        const file = join(home, ".codex", "config.toml");
        if (!existsSync(file)) continue;
        const text = readFileSync(file, "utf8");
        const modelMatch = /^\s*model\s*=\s*"([^"]+)"/m.exec(text);
        const effortMatch = /^\s*model_reasoning_effort\s*=\s*"([^"]+)"/m.exec(text);
        if (modelMatch) out.model = modelMatch[1];
        if (effortMatch) out.effort = effortMatch[1];
        if (out.model || out.effort) return out;
      } catch {}
    }
  }
  return out;
}

// Model size tier: 0 = small/fast, 1 = medium (also the safe default for unknown models), 2 = large/frontier.
export function modelSizeTier(model) {
  const m = String(model || "").trim();
  if (!m) return 1;
  if (SMALL_MODEL_RE.test(m)) return 0;
  if (FRONTIER_MODEL_RE.test(m)) return 2;
  return 1;
}

// Reasoning effort offset: -1 = low / no thinking, 0 = medium / default, +1 = high / max.
export function effortOffset({ effort = null, hasThinking = null } = {}) {
  const eff = effort ? String(effort).trim() : null;
  if (eff) {
    if (LOW_EFFORT_RE.test(eff)) return -1;
    if (HIGH_EFFORT_RE.test(eff)) return 1;
    return 0;
  }
  if (hasThinking === false) return -1;
  return 0;
}

// Combines model size (0/1/2) and reasoning effort (-1/0/+1): <=0 guided, 1 standard, >=2 minimal.
export function classifyModel(model, effortInfo = {}) {
  const score = modelSizeTier(model) + effortOffset(effortInfo);
  if (score <= 0) return "guided";
  if (score >= 2) return "minimal";
  return "standard";
}

export function detectProfile(input = {}, transcriptInfo = null, options = {}) {
  const envOverride = (options.env?.INTENT_FIRST_PROFILE ?? process.env.INTENT_FIRST_PROFILE ?? "").trim().toLowerCase();
  if (envOverride === "off" || envOverride === "none" || envOverride === "disabled") return "off";
  if (envOverride === "guided" || envOverride === "light") return "guided";
  if (envOverride === "standard") return "standard";
  if (envOverride === "minimal") return "minimal";

  let model = input.model || (transcriptInfo && transcriptInfo.model) || null;
  let effort = input.reasoning_effort || input.effort || (transcriptInfo && transcriptInfo.effort) || null;
  let hasThinking = transcriptInfo ? transcriptInfo.hasThinking : null;

  const allowSettings = options.readSettings !== false && (options.env?.INTENT_FIRST_NO_SETTINGS ?? process.env.INTENT_FIRST_NO_SETTINGS) !== "1";
  if (!model && allowSettings) {
    const host = readHostSettings();
    model = host.model || model;
    effort = effort || host.effort;
    if (hasThinking === null) hasThinking = host.hasThinking;
  }

  return classifyModel(model, { effort, hasThinking });
}

// Explicit, structural prompt classifier. Fails silent (returns null) unless a concrete signal matches.
export function analyzePrompt(prompt, context = {}) {
  if (context.lastAssistantAskedQuestion) return null;
  if (typeof prompt !== "string") return null;

  const trimmed = prompt.trim();
  if (!trimmed || trimmed.startsWith("/") || ENVELOPE_TAG_RE.test(trimmed)) return null;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 8 && SHORT_ACK_RE.test(trimmed)) return null;
  if (words.length <= 6 && SHORT_CONFIRM_PREFIX_RE.test(trimmed)) return null;
  if (words.length <= 4 && SHORT_PRONOUN_ACTION_RE.test(trimmed)) return null;
  if (words.length <= 3 && !CHANGE_INTENT_RE.test(trimmed) && !INHERITED_OR_BUG_RE.test(trimmed)) return null;
  if (words.length <= 18 && MECHANICAL_RE.test(trimmed) && !STRUCTURAL_RE.test(trimmed)) return null;
  if (PURE_QUESTION_RE.test(trimmed) && !QUESTION_WITH_ACTION_RE.test(trimmed)) return null;

  const bulletLines = trimmed.split(/\r?\n/).filter((l) => /^\s*(?:[-*+]|\d+[.)])\s+\S/.test(l)).length;
  const hasDetailedSpec = bulletLines >= 3;
  const hasStackOrDiff = STACKTRACE_RE.test(trimmed) || DIFF_RE.test(trimmed);
  const hasLineAnchor = FILE_LINE_ANCHOR_RE.test(trimmed);
  const hasFilePath = FILE_PATH_RE.test(trimmed);
  const hasStructuralOrSweeping = STRUCTURAL_RE.test(trimmed) || SWEEPING_RE.test(trimmed);
  const hasBugOrSymptom = INHERITED_OR_BUG_RE.test(trimmed) || SYMPTOM_RE.test(trimmed);

  // A detailed multi-point spec stays silent unless it still carries unanchored structural, sweeping, or symptom red flags
  // (e.g. an AI-reworded ticket asking for "real-time" or "all fields" without naming the root cause).
  if (hasDetailedSpec) {
    if (!hasStackOrDiff && !hasLineAnchor) {
      if (hasStructuralOrSweeping) return { reason: "structural_change" };
      if (SYMPTOM_RE.test(trimmed)) return { reason: "inherited_or_review" };
    }
    return null;
  }

  // Structural or sweeping changes warrant a coherence check unless already fully specified as a diff.
  if (hasStructuralOrSweeping && !DIFF_RE.test(trimmed)) {
    return { reason: "structural_change" };
  }

  // Handed-over work or vague bug/symptom reports without stacktrace/diff/line anchor.
  if (hasBugOrSymptom && !hasStackOrDiff && !hasLineAnchor) {
    return { reason: "inherited_or_review" };
  }

  // Open-ended creation / improvement / fix requests lacking concrete technical anchors.
  if (OPEN_GOAL_RE.test(trimmed) && !hasStackOrDiff && !hasLineAnchor && !hasFilePath) {
    return { reason: "ambiguous_goal" };
  }

  return null;
}

export function promptNudge(reason, profile) {
  if (!reason || profile === "off") return null;

  if (profile === "minimal") {
    // Frontier high-reasoning models already think well; only lift compliance bias on open/structural prompts.
    if (reason === "ambiguous_goal" || reason === "structural_change") {
      return "Intent first: if the proposed means works against the real goal or two product/architectural choices diverge materially, pause and ask 1-2 concise questions (with defaults) before implementing.";
    }
    return null;
  }

  if (profile === "guided") {
    if (reason === "ambiguous_goal") {
      return "Intent first: state the real goal in 1 sentence before editing. If 2+ interpretations lead to different designs or the requested approach hurts the goal, stop and ask at most 2 concrete questions (each with a default). Otherwise state your assumption in 1 line and implement cleanly. Do not load the full skill.";
    }
    return "Intent first: state the real goal in 1 sentence. Read how this area already works (decisions, patterns, root cause) before editing — do not patch symptoms, fabricate data, or widen shared types/styles without checking semantics. If a trade-off or goal is unclear, ask at most 2 questions with defaults. Name existing behaviour in your reply only if changed or dropped.";
  }

  // standard
  if (reason === "ambiguous_goal") {
    return "Intent first: separate the real goal from the proposed means. If the goal is ambiguous, the means works against it, or a choice has a real trade-off, pause before coding with the goal (1 line), out-of-scope (1 line), and at most 2 questions with defaults. Otherwise state your assumption briefly and fit into existing patterns.";
  }
  return "Intent first: read local decisions, patterns, and root cause before changing existing behaviour — fix the cause rather than patching symptoms or altering shared types/styles without checking semantics. If scope or a trade-off is unclear, confirm with 1-2 focused questions (with defaults) first. Report existing behaviour only if dropped or put at risk.";
}

function git(repo, args) {
  const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 1 << 24,
  });
  if (result.error) return { status: 1, stdout: "", stderr: result.error.message };
  return result;
}

export function repoRoot(dir) {
  if (!dir || !existsSync(dir)) return null;
  const result = git(dir, ["rev-parse", "--show-toplevel"]);
  return result.status === 0 ? resolve(result.stdout.trim()) : null;
}

function fileCount(repo) {
  const tracked = git(repo, ["ls-files", "-z"]).stdout.split("\0").filter(Boolean).length;
  const untracked = git(repo, ["ls-files", "-z", "--others", "--exclude-standard"]).stdout.split("\0").filter(Boolean).length;
  return tracked + untracked;
}

function grepMany(repo, terms, { word = true } = {}) {
  const unique = [...new Set(terms.filter(Boolean))];
  if (!unique.length) return [];
  const args = ["grep", "-z", "-n", "-I", "-F", "--untracked", ...(word ? ["-w"] : [])];
  for (const term of unique) args.push("-e", term);
  const out = git(repo, args).stdout || "";
  const hits = [];
  for (const record of out.split("\n")) {
    if (!record) continue;
    const [file, line, ...rest] = record.split("\0");
    if (!file || !line) continue;
    hits.push({ file: normalizePosix(file), line: Number(line), text: rest.join("\0") });
  }
  return hits;
}

function recentHistory(repo, relPath) {
  const res = git(repo, ["log", "-n", String(MAX_HISTORY + 1), "--no-merges", "--format=%h %s", "--", relPath]);
  if (res.status !== 0 || !res.stdout) return [];
  return res.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_HISTORY);
}

function isDoc(file) {
  return DOC_EXT.test(file);
}

function isDecision(file) {
  return isDoc(file) && DECISION_PATH.test(file);
}

function isTest(file) {
  return TEST_PATH.test(file);
}

function isCommentLine(file, text) {
  const t = text.trim();
  if (/^(\/\/|\/\*|\*|<!--)/.test(t)) return true;
  return HASH_COMMENT.test(file) && t.startsWith("#");
}

function snippet(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > SNIPPET_LEN ? t.slice(0, SNIPPET_LEN - 1) + "…" : t;
}

function usableSymbol(name) {
  return typeof name === "string" && name.length >= 4 && !STOP.has(name.toLowerCase());
}

export function extractSymbols(text) {
  if (typeof text !== "string" || !text.trim()) return [];
  const declared = [];
  const referenced = [];
  const seen = new Set();

  const declRe = /\b(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var|def|fun|fn|struct|trait|record|object|val|typealias)\s+([A-Za-z_][A-Za-z0-9_]{3,})/g;
  let m;
  while ((m = declRe.exec(text)) !== null) {
    const sym = m[1];
    if (usableSymbol(sym) && !seen.has(sym)) {
      seen.add(sym);
      declared.push(sym);
    }
  }

  // Distinctive camelCase, PascalCase, or snake_case identifiers.
  const idRe = /\b([A-Za-z_][A-Za-z0-9_]{3,})\b/g;
  while ((m = idRe.exec(text)) !== null) {
    const sym = m[1];
    if (seen.has(sym) || !usableSymbol(sym)) continue;
    const distinctive = /[a-z][A-Z]/.test(sym) || /^[A-Z][a-z]/.test(sym) || (sym.includes("_") && /[A-Za-z]/.test(sym));
    if (distinctive) {
      seen.add(sym);
      referenced.push(sym);
    }
  }

  return [...declared, ...referenced].slice(0, MAX_SYMBOLS);
}

function parseApplyPatch(patchText) {
  const targets = [];
  if (typeof patchText !== "string" || !patchText) return targets;
  const lines = patchText.split(/\r?\n/);
  let current = null;

  for (const line of lines) {
    const updateMatch = /^\*\*\* (?:Update|Delete|Add) File:\s*(.+?)\s*$/.exec(line);
    if (updateMatch) {
      if (current) targets.push(current);
      const isAdd = line.startsWith("*** Add File:");
      current = { rawPath: updateMatch[1], isAdd, removedLines: [], changedLines: [] };
      continue;
    }
    if (current && line.startsWith("-") && !line.startsWith("---")) {
      const content = line.slice(1);
      current.removedLines.push(content);
      current.changedLines.push(content);
    } else if (current && line.startsWith("+") && !line.startsWith("+++")) {
      current.changedLines.push(line.slice(1));
    }
  }
  if (current) targets.push(current);
  return targets;
}

function firstString(...values) {
  for (const v of values) {
    if (typeof v === "string" && v) return v;
  }
  return null;
}

export function extractEditTargets(toolName, toolInput, repo) {
  const name = String(toolName || "");
  const inp = typeof toolInput === "string"
    ? parseJson(toolInput) || {}
    : toolInput && typeof toolInput === "object"
      ? toolInput
      : {};
  const targets = [];

  const pushFile = (rawPath, symbolSource, { forceNew = false, editedText = "" } = {}) => {
    const rel = toRepoRelative(repo, rawPath);
    if (!rel) return;
    const abs = join(repo, rel);
    const exists = existsSync(abs);
    let symbols = extractSymbols(symbolSource || "");
    if (!symbols.length && exists && !forceNew) {
      try {
        const content = readFileSync(abs, "utf8").slice(0, MAX_DISK_READ);
        symbols = extractSymbols(content);
      } catch {}
    }
    targets.push({ path: rel, symbols, isNewFile: forceNew || !exists, editedText: editedText || symbolSource || "" });
  };

  if (/^(?:Edit|replace_string_in_file|edit_file|editFile)$/i.test(name)) {
    const rawPath = firstString(inp.file_path, inp.filePath, inp.path);
    if (rawPath) {
      const oldText = firstString(inp.old_string, inp.oldString, inp.old_str) || "";
      const newText = firstString(inp.new_string, inp.newString, inp.new_str) || "";
      const source = [oldText, newText].join("\n");
      pushFile(rawPath, source, { editedText: newText || source });
    }
  } else if (/^MultiEdit$/i.test(name) && typeof inp.file_path === "string") {
    const edits = Array.isArray(inp.edits) ? inp.edits : [];
    const source = edits.map((e) => `${e?.old_string || ""}\n${e?.new_string || ""}`).join("\n");
    const added = edits.map((e) => e?.new_string || "").join("\n");
    pushFile(inp.file_path, source, { editedText: added || source });
  } else if (/^multi_replace_string_in_file$/i.test(name) && Array.isArray(inp.replacements)) {
    const byFile = new Map();
    for (const r of inp.replacements) {
      if (!r || typeof r !== "object") continue;
      const rawPath = firstString(r.filePath, r.file_path, r.path);
      if (!rawPath) continue;
      const entry = byFile.get(rawPath) || { source: [], added: [] };
      const oldText = firstString(r.oldString, r.old_string) || "";
      const newText = firstString(r.newString, r.new_string) || "";
      entry.source.push(`${oldText}\n${newText}`);
      if (newText) entry.added.push(newText);
      byFile.set(rawPath, entry);
    }
    for (const [rawPath, entry] of byFile.entries()) {
      const source = entry.source.join("\n");
      pushFile(rawPath, source, { editedText: entry.added.join("\n") || source });
    }
  } else if (/^(?:Write|create_file)$/i.test(name)) {
    const rawPath = firstString(inp.file_path, inp.filePath, inp.path);
    if (rawPath) {
      const rel = toRepoRelative(repo, rawPath);
      if (rel) {
        const abs = join(repo, rel);
        const exists = existsSync(abs);
        let existingText = "";
        if (exists) {
          try {
            existingText = readFileSync(abs, "utf8").slice(0, MAX_DISK_READ);
          } catch {}
        }
        const written = firstString(inp.content, inp.new_string, inp.text) || "";
        targets.push({
          path: rel,
          symbols: exists ? extractSymbols(existingText) : [],
          isNewFile: !exists,
          editedText: written,
        });
      }
    }
  } else if (/^editFiles$/i.test(name)) {
    const files = Array.isArray(inp.files) ? inp.files : [inp];
    for (const item of files) {
      if (typeof item === "string") {
        pushFile(item, "");
      } else if (item && typeof item === "object") {
        const rawPath = firstString(item.filePath, item.file_path, item.path);
        const source = [firstString(item.oldString, item.old_string) || "", firstString(item.newString, item.new_string, item.content) || ""].join("\n");
        if (rawPath) pushFile(rawPath, source);
      }
    }
  } else if (/^apply_patch$/i.test(name)) {
    const patch = typeof inp.input === "string" ? inp.input : typeof inp.patch === "string" ? inp.patch : "";
    for (const entry of parseApplyPatch(patch)) {
      pushFile(entry.rawPath, entry.removedLines.join("\n"), {
        forceNew: entry.isAdd,
        editedText: entry.changedLines.join("\n"),
      });
    }
  }

  return targets;
}

// Finds ancestor AGENTS.md / CLAUDE.md files strictly below repo root (root ones are already auto-loaded).
function findScopedRuleFiles(repo, relPath, readFiles) {
  const hits = [];
  let dir = dirname(relPath);
  while (dir && dir !== "." && dir !== "/") {
    for (const ruleName of ["AGENTS.md", "CLAUDE.md"]) {
      const candidate = normalizePosix(join(dir, ruleName));
      if (candidate === relPath || readFiles.has(candidate)) continue;
      const abs = join(repo, candidate);
      if (!existsSync(abs)) continue;
      let preview = "local instructions for this folder";
      try {
        const firstLine = readFileSync(abs, "utf8")
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith("#"));
        if (firstLine) preview = firstLine;
      } catch {}
      hits.push({ kind: "decision", file: candidate, line: 1, text: preview });
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return hits;
}

export function collectLocalContext(repo, target, readFiles = new Set(), shownDecisions = new Set()) {
  // Editing markdown/plain docs needs no code-consumer lookup.
  if (isDoc(target.path)) return null;

  const excluded = new Set([target.path, ...readFiles]);
  let frequentAbove = null;
  const maxFrequent = () => {
    if (frequentAbove === null) {
      const totalFiles = Math.max(1, fileCount(repo));
      frequentAbove = Math.max(6, Math.ceil(totalFiles * 0.02));
    }
    return frequentAbove;
  };

  const wordTerms = [];
  for (const sym of (target.symbols || []).slice(0, 4)) {
    if (usableSymbol(sym)) wordTerms.push(sym);
  }

  const fileName = target.path.split("/").pop();
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const substrTerms = [];
  if (fileName && !GENERIC_BASENAMES.has(baseName.toLowerCase())) {
    substrTerms.push(fileName);
    if (baseName !== fileName) {
      if (/^[A-Za-z_][\w-]*$/.test(baseName) && usableSymbol(baseName)) {
        wordTerms.push(baseName);
      } else if (baseName.length >= 4 && !GENERIC_BASENAMES.has(baseName.split(".")[0].toLowerCase())) {
        // Multi-dot module names (e.g. app-input.component.ts) are imported without the final extension.
        substrTerms.push(baseName);
      }
    }
  }
  const folder = target.path.includes("/") ? target.path.slice(0, target.path.lastIndexOf("/") + 1) : null;

  const shared = [];
  const decisions = findScopedRuleFiles(repo, target.path, new Set([...readFiles, ...shownDecisions]));
  const docs = [];
  const readers = [];
  const comments = [];
  const tests = [];
  const seenFiles = new Set(decisions.map((d) => d.file));

  const recordBlastRadius = (label, hits) => {
    if (shared.length >= 1) return;
    const codeFiles = new Set();
    for (const h of hits) {
      if (h.file === target.path || isDoc(h.file) || isTest(h.file) || AUTO_LOADED_RULE.test(h.file)) continue;
      codeFiles.add(h.file);
    }
    if (codeFiles.size < maxFrequent()) return;
    const areas = new Set([...codeFiles].map((f) => dirname(f)));
    if (areas.size < 2) return;
    const sample = [...codeFiles].slice(0, 2).join(", ");
    shared.push({
      kind: "shared",
      file: label,
      line: 1,
      text: `used in ${codeFiles.size} files (${areas.size} areas, e.g. ${sample}) — confirm scope before changing shared behaviour`,
    });
  };

  if (STYLE_EXT.test(target.path) && typeof target.editedText === "string" && GLOBAL_STYLE_RE.test(target.editedText)) {
    shared.push({
      kind: "shared",
      file: target.path,
      line: 1,
      text: "global or unscoped CSS selector touched — verify layout impact across other views and tabs",
    });
  }

  const ingestHits = (hits, { rulesOnly = false } = {}) => {
    const filtered = hits.filter(
      (h) => !excluded.has(h.file) && !AUTO_LOADED_RULE.test(h.file) && !/^\s*package\s/.test(h.text),
    );
    for (const h of filtered) {
      if (rulesOnly && !isDecision(h.file)) continue;
      if (seenFiles.has(h.file)) continue;
      if (isDoc(h.file) && shownDecisions.has(h.file)) continue;
      seenFiles.add(h.file);

      if (isDecision(h.file)) decisions.push({ ...h, kind: "decision" });
      else if (isDoc(h.file)) docs.push({ ...h, kind: "doc" });
      else if (isTest(h.file)) tests.push({ ...h, kind: "test" });
      else if (isCommentLine(h.file, h.text)) comments.push({ ...h, kind: "reader" });
      else readers.push({ ...h, kind: "reader" });
    }
  };

  // Batch whole-word symbol/basename lookup into a single git grep call.
  if (wordTerms.length) {
    const raw = grepMany(repo, wordTerms, { word: true });
    // Filter out overly generic terms only if the combined batch hit many files;
    // when a distinctive symbol or non-generic basename exceeds the threshold across multiple areas,
    // surface a 1-line blast-radius warning instead of silently dropping it.
    const rawFiles = new Set(raw.map((h) => h.file));
    if (rawFiles.size <= 6 || rawFiles.size <= maxFrequent()) {
      ingestHits(raw);
    } else {
      for (const term of wordTerms) {
        const single = grepMany(repo, [term], { word: true });
        if (new Set(single.map((h) => h.file)).size <= maxFrequent()) {
          ingestHits(single);
        } else {
          recordBlastRadius(`${target.path} (${term})`, single);
          ingestHits(single, { rulesOnly: true });
        }
      }
    }
  }

  // Batch filename + folder rule lookups.
  if (substrTerms.length) {
    const raw = grepMany(repo, substrTerms, { word: false });
    if (new Set(raw.map((h) => h.file)).size <= 6 || new Set(raw.map((h) => h.file)).size <= maxFrequent()) {
      ingestHits(raw);
    } else {
      recordBlastRadius(target.path, raw);
      ingestHits(raw, { rulesOnly: true });
    }
  }
  if (folder) {
    ingestHits(grepMany(repo, [folder], { word: false }), { rulesOnly: true });
  }

  const pickedDecisions = [...decisions, ...docs].slice(0, MAX_DECISIONS);
  const pickedReaders = [...readers, ...comments].slice(0, MAX_READERS);
  const pickedTests = tests.slice(0, MAX_TESTS);

  const lines = [...shared, ...pickedDecisions, ...pickedReaders, ...pickedTests].slice(0, MAX_LINES);
  if (!lines.length) return null;

  const history = target.isNewFile ? [] : recentHistory(repo, target.path);
  return { lines, history };
}

export function formatPreToolContext(targetPath, facts, profile) {
  if (!facts || !facts.lines.length || profile === "off") return null;

  const width = Math.max(...facts.lines.map((l) => l.kind.length), facts.history.length ? "history".length : 0);
  const rows = facts.lines.map((l) =>
    l.kind === "shared"
      ? `${l.kind.padEnd(width)}  ${l.file}  ${l.text}`
      : `${l.kind.padEnd(width)}  ${l.file}:${l.line}  ${snippet(l.text)}`,
  );
  for (const h of facts.history) {
    rows.push(`${"history".padEnd(width)}  ${snippet(h)}`);
  }

  let footer = "";
  if (profile === "guided") {
    footer = "Keep these decisions and contracts intact, or state plainly which one you change and why (say nothing about unchanged ones).";
  } else if (profile === "standard") {
    footer = "Check these unread references before finalizing so the change stays coherent with existing decisions and callers.";
  }

  const header = `Intent-first context for ${targetPath} (not yet read in this session):`;
  const parts = [header, ...rows];
  if (footer) parts.push(footer);

  let text = parts.join("\n");
  while (text.length > HARD_CAP && rows.length > 1) {
    rows.pop();
    const trimmed = [header, ...rows];
    if (footer) trimmed.push(footer);
    text = trimmed.join("\n");
  }
  return text.length > HARD_CAP ? text.slice(0, HARD_CAP - 1) + "…" : text;
}

function dataDirectory(dataDir, env = process.env) {
  const dir = dataDir || env.PLUGIN_DATA || env.CLAUDE_PLUGIN_DATA || join(tmpdir(), "intent-first-work");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function stateFile(sessionId, dataDir, env = process.env) {
  const dir = dataDirectory(dataDir, env);
  return join(dir, `${String(sessionId).replace(/[^\w.-]/g, "_")}.json`);
}

// Optional privacy-safe local telemetry (INTENT_FIRST_LOG=1): metadata only, never prompts or file paths.
function logTelemetry(entry, options = {}) {
  const env = options.env || process.env;
  if (env.INTENT_FIRST_LOG !== "1") return;
  try {
    const dir = dataDirectory(options.dataDir, env);
    appendFileSync(join(dir, "telemetry.jsonl"), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  } catch {}
}

function loadState(file) {
  try {
    const parsed = parseJson(readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object") {
      return {
        promptTurn: Number(parsed.promptTurn) || 0,
        lastPromptNudgeTurn: Number(parsed.lastPromptNudgeTurn) || 0,
        nudgedFiles: Array.isArray(parsed.nudgedFiles) ? parsed.nudgedFiles : [],
        shownDecisions: Array.isArray(parsed.shownDecisions) ? parsed.shownDecisions : [],
      };
    }
  } catch {}
  return { promptTurn: 0, lastPromptNudgeTurn: 0, nudgedFiles: [], shownDecisions: [] };
}

function saveState(file, state) {
  try {
    writeFileSync(file, JSON.stringify(state));
  } catch {}
}

// Normalizes hook payloads across Claude Code, Codex, VS Code Copilot (PascalCase), and Copilot CLI (camelCase).
export function normalizeHookInput(input) {
  if (!input || typeof input !== "object") return null;

  const hasStandardEvent = typeof input.hook_event_name === "string" && input.hook_event_name.length > 0;
  const rawEvent = input.hook_event_name || input.hookEventName || input.event || "";
  let event = null;
  if (/^UserPromptSubmit(?:ted)?$/i.test(rawEvent)) event = "UserPromptSubmit";
  else if (/^PreToolUse$/i.test(rawEvent)) event = "PreToolUse";
  else if (!rawEvent) {
    if (typeof input.toolName === "string" || typeof input.tool_name === "string") event = "PreToolUse";
    else if (typeof input.prompt === "string" || typeof input.user_prompt === "string") event = "UserPromptSubmit";
  }
  if (!event) return null;

  const isCopilotCamel =
    !hasStandardEvent &&
    (typeof input.toolName === "string" ||
      typeof input.sessionId === "string" ||
      typeof input.hookEventName === "string" ||
      input.toolArgs !== undefined);

  return {
    dialect: isCopilotCamel ? "copilot" : "standard",
    event,
    sessionId: firstString(input.session_id, input.sessionId),
    transcriptPath: firstString(input.transcript_path, input.transcriptPath),
    cwd: firstString(input.cwd),
    prompt: typeof input.prompt === "string" ? input.prompt : typeof input.user_prompt === "string" ? input.user_prompt : "",
    toolName: firstString(input.tool_name, input.toolName) || "",
    toolInput: input.tool_input ?? input.toolArgs ?? input.toolInput ?? {},
    model: firstString(input.model),
    effort: firstString(input.reasoning_effort, input.effort, input.reasoningEffort),
  };
}

function formatHookOutput(dialect, event, text) {
  if (dialect === "copilot") {
    return event === "PreToolUse"
      ? { permissionDecision: "allow", additionalContext: text }
      : { additionalContext: text };
  }
  return { hookSpecificOutput: { hookEventName: event, additionalContext: text } };
}

export function handleHook(input, options = {}) {
  const norm = normalizeHookInput(input);
  if (!norm) return null;

  const { dialect, event } = norm;
  const t0 = performance.now();
  const finish = (output, profile, reason) => {
    const context = output
      ? output.hookSpecificOutput?.additionalContext ?? output.additionalContext ?? ""
      : "";
    logTelemetry(
      {
        event,
        dialect,
        profile,
        triggered: Boolean(output),
        reason,
        chars: context.length,
        latencyMs: Math.round((performance.now() - t0) * 10) / 10,
      },
      options,
    );
    return output;
  };

  // Fast exit for non-edit tools (important in Copilot where preToolUse fires on every tool call).
  if (event === "PreToolUse" && !EDIT_TOOL_RE.test(norm.toolName)) {
    return finish(null, "skipped", "non_edit_tool");
  }

  const cwd = norm.cwd || options.cwd || process.cwd();
  const repo = repoRoot(cwd);
  const transcript = readTranscriptInfo(norm.transcriptPath, repo);
  const profile = detectProfile({ model: norm.model, effort: norm.effort }, transcript, options);
  if (profile === "off") return finish(null, profile, "profile_off");

  const env = options.env || process.env;
  const file = norm.sessionId ? stateFile(norm.sessionId, options.dataDir, env) : null;
  const state = file ? loadState(file) : { promptTurn: 0, lastPromptNudgeTurn: 0, nudgedFiles: [], shownDecisions: [] };

  if (event === "UserPromptSubmit") {
    state.promptTurn += 1;
    const cooledDown = state.lastPromptNudgeTurn > 0 && state.promptTurn - state.lastPromptNudgeTurn <= 1;
    if (cooledDown) {
      if (file) saveState(file, state);
      return finish(null, profile, "cooldown");
    }

    const signal = analyzePrompt(norm.prompt, { lastAssistantAskedQuestion: transcript.lastAssistantAskedQuestion });
    const text = signal ? promptNudge(signal.reason, profile) : null;
    if (!text) {
      if (file) saveState(file, state);
      const silentReason = transcript.lastAssistantAskedQuestion
        ? "answered_question"
        : signal
          ? "profile_silent"
          : "clear_prompt";
      return finish(null, profile, silentReason);
    }

    state.lastPromptNudgeTurn = state.promptTurn;
    if (file) saveState(file, state);
    return finish(formatHookOutput(dialect, event, text), profile, signal.reason);
  }

  // PreToolUse
  if (!repo) return finish(null, profile, "no_repo");
  const targets = extractEditTargets(norm.toolName, norm.toolInput, repo);
  if (!targets.length) return finish(null, profile, "no_targets");

  const alreadyNudged = new Set(state.nudgedFiles);
  const shownDecisions = new Set(state.shownDecisions);
  const blocks = [];

  for (const target of targets) {
    if (alreadyNudged.has(target.path)) continue;
    const facts = collectLocalContext(repo, target, transcript.readFiles, shownDecisions);
    if (!facts) continue;
    const formatted = formatPreToolContext(target.path, facts, profile);
    if (!formatted) continue;
    alreadyNudged.add(target.path);
    for (const l of facts.lines) {
      if (l.kind === "decision" || l.kind === "doc") shownDecisions.add(l.file);
    }
    blocks.push(formatted);
  }

  if (!blocks.length) return finish(null, profile, "deduped_or_silent");

  state.nudgedFiles = [...alreadyNudged];
  state.shownDecisions = [...shownDecisions];
  if (file) saveState(file, state);
  return finish(formatHookOutput(dialect, event, blocks.join("\n\n")), profile, "unread_context");
}

function main() {
  const input = parseJson(readFileSync(0, "utf8"));
  const output = handleHook(input);
  if (output) process.stdout.write(JSON.stringify(output));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch {
    // Never block or fail a session.
  }
}
