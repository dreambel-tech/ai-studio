#!/usr/bin/env node
// leftovers: lists what agent sessions left on this computer (worktrees, merged
// branches, browser profiles, files a session created, from what it says or from its
// history) with their size,
// and removes only the items the user picked. Scanning is read-only. Removal
// checks every item again first and never touches one with a reason to keep it.
// Run with --help for the commands. See ../SKILL.md.

import { spawnSync } from "node:child_process";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, rmSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, parse as parsePath, relative, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath, pathToFileURL } from "node:url";

const WINDOWS = process.platform === "win32";
const HOUR = 3_600_000;
const DEFAULT_ACTIVE_HOURS = 24;
const DEFAULT_SIZE_SECONDS = 20;
const PLAN_MAX_AGE = 24 * HOUR;

// Folders that browser automation creates in the temporary folder, one per run.
export const TEMP_PATTERNS = [
  { pattern: /^cdp-/, label: "browser profiles (cdp-*)" },
  { pattern: /^puppeteer_dev_(chrome_)?profile-/, label: "Puppeteer browser profiles" },
  { pattern: /^playwright_(chromium|firefox|webkit)dev_profile-/, label: "Playwright browser profiles" },
  { pattern: /^playwright-artifacts-/, label: "Playwright artifacts" },
  { pattern: /^lighthouse\.\d+/, label: "Lighthouse browser profiles" },
];

// .env, .env.local, .env.production...; not the templates meant to be committed.
export const SECRET_FILE = /^\.env(\.(?!(example|sample|template|dist)$)[\w.-]+)?$/i;

const USAGE = `Usage:
  node leftovers.mjs scan [--history <file>] [--since <time>] [--claim <path>]... [--repo <path>]...
                          [--config <file>]... [--audit] [--json] [--active-hours <n>] [--size-seconds <n>]
  node leftovers.mjs remove --plan <file> (<id>... | selected) [--json]

scan lists what was left behind and saves a plan file; it changes nothing.
  --history       the session's history file (a JSONL transcript or rollout): what the
                  session wrote or named and that appeared after it started is listed as
                  this session's, the files it published are kept, and it gives --since
  --since         when this session started (ISO date or epoch ms): what appeared later
                  is listed as "created while this session ran"
  --claim         a path this session created (repeatable): listed as this session's
  --repo          a repository to scan besides the current folder (repeatable)
  --config        a configuration file that may point into worktrees, such as a launch
                  configuration (repeatable): a worktree it names is left unchecked, and
                  the entries that point to missing folders are reported
  --audit         also list everything older (the backlog), with sizes
  --active-hours  worktrees used more recently than this are kept (default ${DEFAULT_ACTIVE_HOURS})
  --size-seconds  time budget for measuring sizes (default ${DEFAULT_SIZE_SECONDS})
remove deletes the named items of a plan, or its checked items with "selected",
after checking each one again.`;

// ---------------------------------------------------------------- helpers

function run(command, args, cwd, timeout = 60_000) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", windowsHide: true, timeout, maxBuffer: 256 * 1024 * 1024 });
  const ok = !result.error && result.status === 0;
  return { ok, out: result.stdout || "", err: (result.stderr || (result.error && result.error.message) || "").trim() };
}

function gitRun(cwd, args) {
  return run("git", ["--no-optional-locks", "-c", "core.quotepath=off", ...args], cwd);
}

function git(cwd, args) {
  const result = gitRun(cwd, args);
  return result.ok ? result.out : null;
}

const lines = (text) => (text || "").split("\n").map((line) => line.replace(/\r$/, "")).filter(Boolean);
const key = (path) => (WINDOWS ? resolve(path).toLowerCase() : resolve(path));

export function samePath(a, b) {
  return key(a) === key(b);
}

export function isInside(child, parent) {
  const rel = relative(key(parent), key(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function stat(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function createdAt(path) {
  const st = stat(path);
  return st ? st.birthtimeMs || st.mtimeMs : 0;
}

// Total size of a file or folder, never following links or junctions.
// Stops at the deadline and says so, rather than taking minutes on a large tree.
export function sizeOf(path, deadline = Infinity) {
  let bytes = 0;
  const stack = [path];
  while (stack.length) {
    if (Date.now() > deadline) return { bytes, partial: true };
    const current = stack.pop();
    const st = stat(current);
    if (!st || st.isSymbolicLink()) continue;
    if (!st.isDirectory()) {
      bytes += st.size;
      continue;
    }
    let names;
    try {
      names = readdirSync(current);
    } catch {
      continue;
    }
    for (const name of names) stack.push(join(current, name));
  }
  return { bytes, partial: false };
}

export function formatBytes(bytes, partial = false) {
  if (bytes == null) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const text = unit === 0 ? `${value} B` : `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
  return partial ? `≥ ${text}` : text;
}

// Docker prints sizes such as "10.5GB" or "512kB", in powers of 1000.
export function parseDockerSize(text) {
  const match = /^([\d.]+)\s*([kMGT]?B)$/i.exec(String(text).trim());
  if (!match) return 0;
  const power = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4 }[match[2].toUpperCase()];
  return Math.round(Number(match[1]) * 1000 ** power);
}

// ---------------------------------------------------------------- repositories

export function parseWorktrees(text) {
  const list = [];
  let current = null;
  for (const line of lines(text)) {
    if (line.startsWith("worktree ")) {
      current = { path: resolve(line.slice(9)), head: null, branch: null, bare: false, locked: false, prunable: false };
      list.push(current);
    } else if (!current) continue;
    else if (line.startsWith("HEAD ")) current.head = line.slice(5);
    else if (line.startsWith("branch ")) current.branch = line.slice(7).replace(/^refs\/heads\//, "");
    else if (line === "bare") current.bare = true;
    else if (line === "locked" || line.startsWith("locked ")) current.locked = true;
    else if (line === "prunable" || line.startsWith("prunable ")) current.prunable = true;
  }
  return list;
}

function mainWorktreeOf(dir) {
  const list = git(dir, ["worktree", "list", "--porcelain"]);
  const first = list && parseWorktrees(list)[0];
  return first && !first.bare ? first.path : null;
}

// The repository of the folder, or else the repositories of its direct subfolders,
// plus the ones named with --repo; each repository once, by its main worktree.
export function findRepos(cwd, extra = []) {
  const found = [];
  const add = (dir) => {
    const main = mainWorktreeOf(dir);
    if (main && !found.some((other) => samePath(other, main))) found.push(main);
    return main;
  };
  if (!add(cwd)) {
    let names = [];
    try {
      names = readdirSync(cwd, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {}
    for (const name of names) if (existsSync(join(cwd, name, ".git"))) add(join(cwd, name));
  }
  for (const dir of extra) add(resolve(cwd, dir));
  return found;
}

function defaultRef(main) {
  const head = git(main, ["symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD"]);
  if (head && head.trim()) return head.trim();
  for (const name of ["main", "master"]) if (git(main, ["rev-parse", "-q", "--verify", `refs/heads/${name}`])) return name;
  return null;
}

function pullRequests(main) {
  const setting = process.env.LEFTOVERS_GH;
  if (setting === "none") return null;
  // LEFTOVERS_GH can point to a script that stands in for gh, for the tests.
  const [command, prefix] = setting ? [process.execPath, [setting]] : ["gh", []];
  const result = run(command, [...prefix, "pr", "list", "--state", "all", "--limit", "500", "--json", "number,state,headRefName,headRefOid"], main, 30_000);
  if (!result.ok) return null;
  try {
    return JSON.parse(result.out);
  } catch {
    return null;
  }
}

export function readRepo(main) {
  const worktrees = parseWorktrees(git(main, ["worktree", "list", "--porcelain"]) || "");
  const ref = defaultRef(main);
  const merged = new Set(ref ? lines(git(main, ["branch", "--merged", ref, "--format=%(refname:short)"])) : []);
  const branches = lines(git(main, ["for-each-ref", "refs/heads", "--format=%(refname:short)%09%(objectname)%09%(committerdate:unix)"])).map((line) => {
    const [name, tip, date] = line.split("\t");
    return { name, tip, date: Number(date) * 1000 };
  });
  return { main, name: basename(main), worktrees, ref, defaultBranch: ref ? ref.replace(/^origin\//, "") : null, merged, branches, prs: pullRequests(main) };
}

function openPullRequest(repo, branch) {
  return (repo.prs || []).find((pr) => pr.state === "OPEN" && pr.headRefName === branch) || null;
}

// Whether a branch tip is merged into the default branch, and whether that is proven.
// A branch with no commits of its own also looks merged, so "proven" needs a merged
// pull request or a history of commits on the branch.
export function mergeOf(repo, branch, tip) {
  const prs = repo.prs || [];
  const squashed = prs.find((pr) => pr.state === "MERGED" && pr.headRefName === branch && pr.headRefOid === tip);
  if (squashed) return { merged: true, proven: true };
  if (!repo.ref) return { merged: false };
  const ancestor = branch ? repo.merged.has(branch) : gitRun(repo.main, ["merge-base", "--is-ancestor", tip, repo.ref]).ok;
  if (!ancestor) return { merged: false };
  if (!branch) return { merged: true, proven: false };
  const named = prs.some((pr) => pr.state === "MERGED" && pr.headRefName === branch);
  const history = lines(git(repo.main, ["reflog", "show", "--format=%H", `refs/heads/${branch}`, "--"])).length;
  return { merged: true, proven: named || history > 1 };
}

export function parseStatus(text) {
  const parts = (text || "").split("\0");
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.length < 4) continue;
    const code = part.slice(0, 2);
    entries.push({ code, path: part.slice(3) });
    if (code[0] === "R" || code[0] === "C") i++; // the next part is the old path
  }
  return entries;
}

function lastUsedOf(worktree) {
  let gitdir = null;
  try {
    const match = /^gitdir:\s*(.+)$/m.exec(readFileSync(join(worktree, ".git"), "utf8"));
    if (match) gitdir = resolve(worktree, match[1].trim());
  } catch {}
  const candidates = gitdir ? ["HEAD", "index", join("logs", "HEAD")].map((name) => join(gitdir, name)) : [];
  return Math.max(0, ...candidates.map((path) => (stat(path) ? stat(path).mtimeMs : 0)));
}

// ---------------------------------------------------------------- items

function ownerOf(ctx, path, created) {
  if (ctx.claims.some((claim) => samePath(claim, path))) return "session";
  if (ctx.since != null && created >= ctx.since) return "window";
  return "backlog";
}

function protectedReason(path, ctx, repos) {
  const full = resolve(path);
  if (samePath(parsePath(full).root, full)) return "a drive root";
  if ([homedir(), tmpdir(), ctx.tempRoot].some((dir) => samePath(dir, full))) return "a system folder";
  if (isInside(ctx.cwd, full)) return "contains the current folder";
  if (ctx.history && isInside(ctx.history, full)) return "holds the session history";
  if (ctx.history && isInside(full, historyFolder(ctx.history))) return "part of the session history";
  if (basename(full).toLowerCase() === ".git") return "a git folder";
  for (const repo of repos) {
    if (isInside(repo.main, full)) return "contains a repository";
    if (repo.worktrees.some((worktree) => samePath(worktree.path, full))) return "a worktree";
  }
  return null;
}

function publishedIn(path, ctx) {
  return ctx.published.some((source) => isInside(source, path));
}

// ---------------------------------------------------------------- session history

// The history of a session is the agent tool's log of its tool calls, one JSON object
// per line. Two shapes are read: assistant messages holding "tool_use" parts, and
// "response_item" entries holding function or custom tool calls. Anything else is skipped.
const HISTORY_ENTRY = /"tool_use"|"function_call"|"custom_tool_call"|"local_shell_call"|"session_meta"|"turn_context"/;
const CONTENT_FIELDS = new Set(["content", "new_string", "old_string", "new_source", "edits"]);
// Something the session named counts as its own only if it appeared after the session
// started; the margin covers a worktree or folder made just before the first entry.
const EVIDENCE_MARGIN = 15 * 60_000;

function* readLines(path) {
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(8 * 1024 * 1024);
    const decoder = new StringDecoder("utf8");
    let rest = "";
    let bytes;
    while ((bytes = readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      const parts = (rest + decoder.write(buffer.subarray(0, bytes))).split("\n");
      rest = parts.pop();
      yield* parts;
    }
    rest += decoder.end();
    if (rest) yield rest;
  } finally {
    closeSync(fd);
  }
}

// The folder named after a history file, where an agent tool may keep the session's
// other records, such as the histories of its sub-agents.
function historyFolder(path) {
  return join(dirname(path), basename(path).replace(/\.jsonl$/i, ""));
}

function historyFiles(path) {
  const files = [path];
  const walk = (dir) => {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {}
    for (const entry of entries) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else if (entry.name.endsWith(".jsonl")) files.push(join(dir, entry.name));
    }
  };
  walk(historyFolder(path));
  return files;
}

function stringsOf(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => stringsOf(entry, out));
  else if (value && typeof value === "object") for (const [name, entry] of Object.entries(value)) if (!CONTENT_FIELDS.has(name)) stringsOf(entry, out);
  return out;
}

// The paths a command or a piece of code names: absolute, relative to the folder it
// ran in, quoted or not, including Git Bash paths (/c/...) and paths escaped in code.
export function pathsIn(text, cwd) {
  const found = new Set();
  const source = String(text).replace(/\\\\/g, "\\");
  const tokens = [];
  for (const match of source.matchAll(/"([^"\n]{2,})"|'([^'\n]{2,})'|`([^`\n]{2,})`/g)) tokens.push(match[1] ?? match[2] ?? match[3]);
  tokens.push(...source.split(/[\s"'`;&|()<>{}[\],=]+/));
  for (let token of tokens) {
    token = token.trim().replace(/[.,:]+$/, "");
    if (token.length < 2 || /[$*?%\n]/.test(token) || /^[a-z][\w+.-]*:\/\//i.test(token)) continue;
    if (WINDOWS) {
      const msys = /^\/([a-zA-Z])(\/.*)?$/.exec(token);
      if (msys) token = `${msys[1].toUpperCase()}:${msys[2] || "/"}`;
    }
    if (!/[\\/]/.test(token) && !SECRET_FILE.test(token)) continue;
    if (!isAbsolute(token) && !cwd) continue;
    found.add(resolve(cwd || "", token));
  }
  return found;
}

function addCall(history, name, input, cwd) {
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object") input = parsed;
    } catch {}
  }
  let base = cwd;
  if (input && typeof input === "object") {
    const dir = typeof input.workdir === "string" ? input.workdir : typeof input.cwd === "string" ? input.cwd : null;
    if (dir) base = resolve(base || "", dir);
  }
  const texts = typeof input === "string" ? [input] : stringsOf(input);
  if (/artifact|publish/i.test(String(name))) {
    for (const text of texts) for (const path of pathsIn(text, base)) history.published.add(path);
    return;
  }
  if (input && typeof input === "object" && typeof input.file_path === "string" && base) history.written.add(resolve(base, input.file_path));
  for (const text of texts) {
    for (const match of text.matchAll(/^\*\*\* (?:Add|Update) File: (.+)$/gm)) if (base || isAbsolute(match[1].trim())) history.written.add(resolve(base || "", match[1].trim()));
    for (const path of pathsIn(text, base)) history.mentions.add(path);
  }
}

// What a session did, from its history: when it started, the folders it worked in,
// the files it wrote, the paths its commands named, and the files it published.
export function readHistory(path) {
  const history = { file: path, start: null, cwds: new Set(), written: new Set(), mentions: new Set(), published: new Set() };
  historyFiles(path).forEach((file, index) => {
    let cwd = null;
    for (const line of readLines(file)) {
      if (index === 0 && history.start == null) {
        const time = /"timestamp":"([^"]+)"/.exec(line);
        if (time && Number.isFinite(Date.parse(time[1]))) history.start = Date.parse(time[1]);
      }
      if (!HISTORY_ENTRY.test(line)) continue;
      const entry = parse(line);
      if (!entry) continue;
      const payload = entry.payload || {};
      if (entry.type === "session_meta" || entry.type === "turn_context") {
        if (typeof payload.cwd === "string") history.cwds.add((cwd = resolve(payload.cwd)));
        const started = Date.parse(payload.timestamp);
        if (index === 0 && entry.type === "session_meta" && Number.isFinite(started)) history.start = Math.min(history.start ?? Infinity, started);
      } else if (entry.type === "assistant" && entry.message && Array.isArray(entry.message.content)) {
        if (typeof entry.cwd === "string") history.cwds.add((cwd = resolve(entry.cwd)));
        for (const part of entry.message.content) if (part && part.type === "tool_use") addCall(history, part.name, part.input, cwd);
      } else if (entry.type === "response_item") {
        if (payload.type === "function_call") addCall(history, payload.name, payload.arguments, cwd);
        else if (payload.type === "custom_tool_call") addCall(history, payload.name, payload.input, cwd);
        else if (payload.type === "local_shell_call") addCall(history, "shell", payload.action, cwd);
      }
    }
  });
  return history;
}

function parse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

// The paths of the history that this session left: they exist and appeared after it
// started. A worktree counts. Inside a repository, only ignored files do (a copied
// .env): tracked and new files are the work itself, and folders may be build output.
// Elsewhere, only what lies in the temporary folder counts: a file written anywhere
// else, such as a report or a note, is most likely meant to stay.
function historyClaims(history, ctx, repos) {
  const floor = (ctx.since ?? history.start ?? 0) - EVIDENCE_MARGIN;
  const roots = repos.flatMap((repo) => repo.worktrees.filter((worktree) => !worktree.bare).map((worktree) => worktree.path));
  const statuses = new Map();
  const ignored = (root, path) => {
    if (!statuses.has(key(root))) statuses.set(key(root), parseStatus(git(root, ["status", "--porcelain=v1", "--ignored", "-z"]) || ""));
    const rel = relative(root, path).split("\\").join("/");
    return statuses.get(key(root)).some((entry) => entry.code === "!!" && (entry.path === rel || (entry.path.endsWith("/") && rel.startsWith(entry.path))));
  };
  const seen = new Set();
  const found = [];
  for (const path of [...history.written, ...history.mentions]) {
    if (seen.has(key(path))) continue;
    seen.add(key(path));
    const st = stat(path);
    if (!st || st.isSymbolicLink() || (st.birthtimeMs || st.mtimeMs) < floor) continue;
    if (samePath(path, history.file) || isInside(path, planDir())) continue;
    if (roots.some((root) => samePath(root, path))) {
      found.push({ path, root: true });
      continue;
    }
    if (protectedReason(path, ctx, repos)) continue;
    const inTemp = [ctx.tempRoot, tmpdir()].some((dir) => isInside(path, dir));
    const root = roots.find((other) => isInside(path, other)) || (inTemp ? toplevelOf(path) : null);
    if (root ? st.isDirectory() || !ignored(root, path) : !inTemp) continue;
    // A folder that a command only named may hold more than the session's own files.
    found.push({ path, named: st.isDirectory() && !history.written.has(path) });
  }
  // A folder the session created holds what it wrote inside; a worktree is listed apart.
  found.sort((a, b) => a.path.length - b.path.length);
  return found.filter(({ path }, i) => !found.slice(0, i).some((other) => !other.root && isInside(path, other.path)));
}

export function inspectWorktree(repo, worktree, ctx, owner, created) {
  const item = { kind: "worktree", repo: repo.main, path: worktree.path, branch: worktree.branch, tip: worktree.head, owner, created, action: "remove" };
  item.label = `${display(worktree.path, ctx)} (${worktree.branch || "detached"})`;
  const keep = (reason) => Object.assign(item, { keep: reason });
  if (isInside(ctx.cwd, worktree.path)) return keep("the current folder");
  if (publishedIn(worktree.path, ctx)) return keep("holds the source of a published page");
  if (worktree.locked) return keep("locked");
  const status = git(worktree.path, ["status", "--porcelain=v1", "--ignored", "-z"]);
  if (status === null) return keep("git cannot read it");
  const entries = parseStatus(status);
  if (entries.some((entry) => entry.code !== "!!")) return keep("uncommitted changes");
  const merge = mergeOf(repo, worktree.branch, worktree.head);
  if (!merge.merged) return keep(worktree.branch ? "branch not merged" : "detached HEAD not merged");
  const open = worktree.branch && openPullRequest(repo, worktree.branch);
  if (open) return keep(`open pull request #${open.number}`);
  if (owner !== "session" && Date.now() - lastUsedOf(worktree.path) < ctx.activeMs) return keep(`used in the last ${ctx.activeMs / HOUR} h`);
  const secrets = entries.filter((entry) => entry.code === "!!" && !entry.path.endsWith("/") && SECRET_FILE.test(basename(entry.path)));
  if (secrets.length) item.choose = `holds ${secrets.map((entry) => entry.path).join(", ")}`;
  else if (!merge.proven) item.choose = "no commits of its own: may be new work";
  else if (repo.prs === null) item.choose = "pull request status unknown";
  return item;
}

function worktreeItems(repo, ctx) {
  const items = [];
  const others = repo.worktrees.filter((worktree) => !worktree.bare && !samePath(worktree.path, repo.main));
  const gone = others.filter((worktree) => worktree.prunable || !existsSync(worktree.path));
  if (gone.length && !ctx.audit) ctx.backlog.worktrees += gone.length;
  else if (gone.length) {
    items.push({ kind: "records", repo: repo.main, owner: "backlog", action: "prune", paths: gone.map((worktree) => worktree.path), label: `${gone.length} worktree record${gone.length > 1 ? "s" : ""} whose folder is gone, in ${repo.name}` });
  }
  for (const worktree of others) {
    if (gone.includes(worktree)) continue;
    const created = createdAt(worktree.path);
    const owner = ownerOf(ctx, worktree.path, created);
    if (owner === "backlog" && !ctx.audit) {
      ctx.backlog.worktrees++;
      continue;
    }
    items.push(inspectWorktree(repo, worktree, ctx, owner, created));
  }
  return items;
}

function branchItems(repo, ctx) {
  const checkedOut = new Set(repo.worktrees.filter((worktree) => worktree.branch).map((worktree) => worktree.branch));
  const groups = new Map();
  for (const branch of repo.branches) {
    if (branch.name === repo.defaultBranch || checkedOut.has(branch.name)) continue;
    const merge = mergeOf(repo, branch.name, branch.tip);
    if (!merge.merged) continue;
    const owner = ctx.since != null && branch.date >= ctx.since ? "window" : "backlog";
    if (owner === "backlog" && !ctx.audit) {
      ctx.backlog.branches++;
      continue;
    }
    const open = openPullRequest(repo, branch.name);
    const keep = open ? "open pull request" : null;
    const choose = keep ? null : !merge.proven ? "no commits of their own: may be new work" : repo.prs === null ? "pull request status unknown" : null;
    const id = `${owner}|${keep}|${choose}`;
    if (!groups.has(id)) groups.set(id, { kind: "branches", repo: repo.main, owner, keep, choose, action: "remove", members: [] });
    groups.get(id).members.push({ name: branch.name, tip: branch.tip, ...(open ? { pr: open.number } : {}) });
  }
  return [...groups.values()].map((group) => {
    const names = group.members.map((member) => member.name);
    const shown = names.length > 5 ? `${names.slice(0, 5).join(", ")} and ${names.length - 5} more` : names.join(", ");
    return { ...group, label: `${names.length} merged branch${names.length > 1 ? "es" : ""} in ${repo.name}: ${shown}` };
  });
}

function tempItems(ctx) {
  let names = [];
  try {
    names = readdirSync(ctx.tempRoot);
  } catch {
    return [];
  }
  const groups = new Map();
  for (const name of names) {
    const kind = TEMP_PATTERNS.find((entry) => entry.pattern.test(name));
    const path = join(ctx.tempRoot, name);
    const st = kind && stat(path);
    if (!st || st.isSymbolicLink()) continue;
    const owner = ownerOf(ctx, path, st.birthtimeMs || st.mtimeMs);
    if (owner === "backlog" && !ctx.audit) {
      ctx.backlog.temp++;
      continue;
    }
    const id = `${kind.label}|${owner}`;
    if (!groups.has(id)) groups.set(id, { kind: "temp", owner, action: "remove", type: kind.label, members: [] });
    groups.get(id).members.push({ path });
  }
  return [...groups.values()].map((group) => ({ ...group, label: `${group.members.length} ${group.type}, in ${display(ctx.tempRoot, ctx)}` }));
}

function toplevelOf(path) {
  const st = stat(path);
  const dir = st && st.isDirectory() ? path : dirname(path);
  const top = git(dir, ["rev-parse", "--show-toplevel"]);
  return top ? resolve(top.trim()) : null;
}

function inspectClaim(path, ctx, repos) {
  const st = stat(path);
  const item = { kind: "path", path, owner: "session", created: st ? st.birthtimeMs || st.mtimeMs : 0, action: "remove", label: display(path, ctx) };
  if (!st) return null;
  const top = toplevelOf(path);
  if (top) {
    const rel = relative(top, path).split("\\").join("/");
    if (rel && git(top, ["ls-files", "--error-unmatch", "--", rel]) !== null) {
      if (st.isDirectory()) return { ...item, keep: "a folder tracked by git" };
      if (!(git(top, ["status", "--porcelain", "--", rel]) || "").trim()) return null; // tracked and unchanged: nothing to undo
      return { ...item, kind: "change", action: "restore", repo: top, choose: "restoring discards its uncommitted changes" };
    }
  }
  if (publishedIn(path, ctx)) return { ...item, keep: "source of a published page" };
  const guard = protectedReason(path, ctx, repos);
  if (guard) return { ...item, keep: guard };
  const margin = ctx.found.some((found) => samePath(found, path)) ? EVIDENCE_MARGIN : 0;
  if (ctx.since != null && item.created < ctx.since - margin) return { ...item, keep: "existed before this session" };
  if (SECRET_FILE.test(basename(path))) return { ...item, choose: "may hold secrets" };
  if (ctx.named.some((named) => samePath(named, path))) return { ...item, choose: "named by this session's commands: check that nothing else uses it" };
  return item;
}

function claimItems(ctx, repos) {
  const items = [];
  for (const claim of ctx.claims) {
    if (!existsSync(claim)) {
      ctx.notes.push(`Claimed path not found: ${claim}`);
      continue;
    }
    if (repos.some((repo) => repo.worktrees.some((worktree) => samePath(worktree.path, claim)))) continue; // listed as a worktree
    if (samePath(dirname(claim), ctx.tempRoot) && TEMP_PATTERNS.some((entry) => entry.pattern.test(basename(claim)))) continue; // listed with the temporary folders
    const item = inspectClaim(claim, ctx, repos);
    if (item) items.push(item);
  }
  return items;
}

function cacheItems(ctx) {
  const items = [];
  const npm = process.env.LEFTOVERS_NPM_CACHE ?? process.env.npm_config_cache ?? (WINDOWS ? join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "npm-cache") : join(homedir(), ".npm"));
  if (npm && existsSync(npm)) items.push({ kind: "cache", path: npm, owner: "backlog", action: "report", label: `npm cache, ${display(npm, ctx)}`, hint: "to free it, run npm cache clean --force" });
  if (process.env.LEFTOVERS_DOCKER !== "none") {
    const result = run("docker", ["system", "df", "--format", "{{json .}}"], ctx.cwd, 15_000);
    if (result.ok) {
      const rows = lines(result.out).map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);
      const bytes = rows.reduce((sum, row) => sum + parseDockerSize(row.Size), 0);
      const detail = rows.map((row) => `${String(row.Type).toLowerCase()} ${row.Size} (reclaimable ${String(row.Reclaimable).split(" ")[0]})`).join(", ");
      if (rows.length) items.push({ kind: "cache", owner: "backlog", action: "report", bytes, label: `Docker: ${detail}`, hint: "to free it, look with docker system df -v, then run docker system prune (with --volumes only if no volume holds data you need)" });
    }
  }
  return items;
}

function diskFree(paths) {
  const roots = [];
  for (const path of paths) {
    const root = parsePath(resolve(path)).root;
    if (!roots.some((other) => samePath(other, root))) roots.push(root);
  }
  return roots.flatMap((root) => {
    try {
      const fs = statfsSync(root);
      return [{ root, free: fs.bavail * fs.bsize, total: fs.blocks * fs.bsize }];
    } catch {
      return [];
    }
  });
}

function display(path, ctx) {
  if (isInside(path, ctx.cwd) && !samePath(path, ctx.cwd)) return relative(ctx.cwd, path);
  return path;
}

const SECTIONS = ["session", "window", "backlog"];
const PREFIX = { worktree: "w", records: "r", branches: "b", temp: "t", path: "p", change: "c", cache: "x", reference: "e" };

// Relative paths in a file of a dot-folder (.vscode/launch.json) are read from the
// project folder above it; elsewhere, from the file's own folder.
function configBase(file) {
  const dir = dirname(file);
  return basename(dir).startsWith(".") ? dirname(dir) : dir;
}

// Worktrees that a configuration file names, and the folders it names that are gone.
function configItems(items, repos, ctx, configs) {
  const out = [];
  for (const file of configs) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      ctx.notes.push(`Configuration file not found: ${file}`);
      continue;
    }
    const refs = [...pathsIn(text, configBase(file))];
    for (const item of items) {
      if (item.kind !== "worktree" || item.keep || !refs.some((ref) => isInside(ref, item.path))) continue;
      const reason = `named in ${display(file, ctx)}: remove its entries too`;
      item.choose = item.choose ? `${item.choose}; ${reason}` : reason;
    }
    const missing = refs.filter((ref) => !existsSync(ref) && repos.some((repo) => isInside(ref, repo.main)));
    for (const ref of missing) {
      out.push({ kind: "reference", path: file, target: ref, owner: "backlog", action: "report", label: `${display(file, ctx)} points to a missing folder: ${display(ref, ctx)}`, hint: "remove that entry by hand" });
    }
  }
  return out;
}

function measure(items, deadline) {
  for (const item of items) {
    if (item.keep || item.bytes != null || item.kind === "reference") continue;
    const targets = item.members ? item.members.map((member) => member.path).filter(Boolean) : item.path ? [item.path] : [];
    if (!targets.length) continue;
    let bytes = 0;
    let partial = false;
    for (const target of targets) {
      const size = sizeOf(target, deadline);
      bytes += size.bytes;
      partial = partial || size.partial;
    }
    Object.assign(item, { bytes, partial });
  }
}

function makeContext(options) {
  const cwd = resolve(options.cwd || process.cwd());
  return {
    cwd,
    since: options.since ?? null,
    claims: (options.claims || []).map((claim) => resolve(cwd, claim)),
    published: (options.published || []).map((path) => resolve(cwd, path)),
    named: (options.named || []).map((path) => resolve(cwd, path)),
    found: (options.found || []).map((path) => resolve(cwd, path)),
    history: options.history ? resolve(cwd, options.history) : null,
    audit: Boolean(options.audit),
    activeMs: (options.activeHours ?? DEFAULT_ACTIVE_HOURS) * HOUR,
    tempRoot: resolve(process.env.LEFTOVERS_TEMP || tmpdir()),
    backlog: { worktrees: 0, branches: 0, temp: 0 },
    notes: [],
  };
}

export function scan(options = {}) {
  const historyFile = options.history ? resolve(options.cwd || process.cwd(), options.history) : null;
  const history = historyFile && existsSync(historyFile) ? readHistory(historyFile) : null;
  const ctx = makeContext({ ...options, history: history ? history.file : null, since: options.since ?? (history ? history.start : null), published: history ? [...history.published] : [] });
  if (historyFile && !history) ctx.notes.push(`History file not found: ${historyFile}`);
  const worked = history ? [...history.cwds].filter((dir) => existsSync(dir)) : [];
  const repos = findRepos(ctx.cwd, [...(options.repos || []), ...worked]).map(readRepo);
  if (history) {
    for (const { path, named } of historyClaims(history, ctx, repos)) {
      if (ctx.claims.some((claim) => samePath(claim, path))) continue;
      ctx.claims.push(path);
      ctx.found.push(path);
      if (named) ctx.named.push(path);
    }
  }
  for (const repo of repos) {
    if (!repo.ref) ctx.notes.push(`${repo.name}: no default branch found, so no branch counts as merged.`);
  }
  if (repos.some((repo) => repo.prs === null)) ctx.notes.push("Pull requests could not be read (gh missing, signed out or offline): their status is unknown.");

  let items = [];
  for (const repo of repos) items.push(...worktreeItems(repo, ctx), ...branchItems(repo, ctx));
  items.push(...tempItems(ctx), ...claimItems(ctx, repos));
  items.push(...configItems(items, repos, ctx, (options.configs || []).map((file) => resolve(ctx.cwd, file))));
  if (ctx.audit) items.push(...cacheItems(ctx));

  const order = (item) => (item.keep ? 3 : SECTIONS.indexOf(item.owner));
  items = items.sort((a, b) => order(a) - order(b));
  measure(items, Date.now() + (options.sizeSeconds ?? DEFAULT_SIZE_SECONDS) * 1000);
  if (items.some((item) => item.partial)) ctx.notes.push("Sizes marked ≥ were cut short by the time budget (--size-seconds).");

  const counters = {};
  for (const item of items) {
    const prefix = PREFIX[item.kind];
    counters[prefix] = (counters[prefix] || 0) + 1;
    item.id = `${prefix}${counters[prefix]}`;
    item.selected = !item.keep && !item.choose && item.action !== "report" && (item.owner === "session" || (ctx.audit && item.owner === "backlog"));
  }

  return {
    version: 1,
    created: new Date().toISOString(),
    cwd: ctx.cwd,
    since: ctx.since,
    history: history ? history.file : null,
    claims: ctx.claims,
    published: ctx.published,
    named: ctx.named,
    found: ctx.found,
    audit: ctx.audit,
    activeHours: ctx.activeMs / HOUR,
    repos: repos.map((repo) => repo.main),
    tempRoot: ctx.tempRoot,
    disk: diskFree([ctx.tempRoot, ...repos.map((repo) => repo.main)]),
    backlog: ctx.audit ? null : ctx.backlog,
    notes: ctx.notes,
    items,
  };
}

// ---------------------------------------------------------------- report

const HEADINGS = {
  session: "Created by this session",
  window: "Created while this session ran, owner not proven",
  backlog: "Older (backlog)",
};

function localTime(ms) {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function render(plan, planFile) {
  const out = [];
  const since = plan.since != null ? ` since ${localTime(plan.since)}` : "";
  out.push(`Leftovers${since} in ${plan.repos.map((repo) => basename(repo)).join(", ") || "no repository"}${plan.history ? ", from the session history" : ""}`);
  const line = (item, mark) => {
    const size = formatBytes(item.bytes, item.partial);
    const note = item.keep || item.choose || item.hint || "";
    return `  ${mark} ${item.id.padEnd(4)} ${item.label}${size ? `  ${size}` : ""}${note ? `  (${note})` : ""}`;
  };
  for (const section of SECTIONS) {
    const items = plan.items.filter((item) => !item.keep && item.owner === section);
    if (!items.length) continue;
    out.push("", HEADINGS[section]);
    for (const item of items) out.push(line(item, item.action === "report" ? " - " : item.selected ? "[x]" : "[ ]"));
  }
  const kept = plan.items.filter((item) => item.keep);
  if (kept.length) {
    out.push("", "Kept");
    for (const item of kept) out.push(line(item, "   "));
  }
  if (!plan.items.some((item) => !item.keep)) out.push("", "Nothing to remove.");
  if (plan.backlog) {
    const { worktrees, branches, temp } = plan.backlog;
    const parts = [worktrees && `${worktrees} worktrees`, branches && `${branches} merged branches`, temp && `${temp} temporary browser folders`].filter(Boolean);
    if (parts.length) out.push("", `Older, not listed: ${parts.join(", ")}. Run the scan with --audit to list them with their size.`);
  }
  if (plan.disk.length) out.push("", `Free space: ${plan.disk.map((disk) => `${disk.root} ${formatBytes(disk.free)} of ${formatBytes(disk.total)}`).join(", ")}`);
  for (const note of plan.notes) out.push(`Note: ${note}`);
  if (planFile && plan.items.some((item) => !item.keep && item.action !== "report")) {
    const script = fileURLToPath(import.meta.url);
    out.push("", `Plan: ${planFile}`, `Remove the checked items: node "${script}" remove --plan "${planFile}" selected`, `Or name the items: node "${script}" remove --plan "${planFile}" <id>...`);
  }
  return out.join("\n");
}

function planDir() {
  return resolve(process.env.LEFTOVERS_PLAN_DIR || join(tmpdir(), "leftovers"));
}

function savePlan(plan) {
  const dir = planDir();
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (/^plan-.*\.json$/.test(name) && Date.now() - statSync(path).mtimeMs > PLAN_MAX_AGE) rmSync(path, { force: true });
  }
  const file = join(dir, `plan-${Date.now()}-${process.pid}.json`);
  writeFileSync(file, JSON.stringify(plan, null, 2));
  return file;
}

// ---------------------------------------------------------------- removal

function freshContext(plan) {
  const ctx = makeContext({ cwd: plan.cwd, since: plan.since, claims: plan.claims, published: plan.published, named: plan.named, found: plan.found, history: plan.history, audit: true, activeHours: plan.activeHours });
  ctx.tempRoot = plan.tempRoot;
  return ctx;
}

function removeWorktree(item, repo, ctx) {
  const worktree = repo.worktrees.find((other) => samePath(other.path, item.path));
  if (!worktree || !existsSync(item.path)) return { status: "skipped", reason: "no longer exists" };
  const now = inspectWorktree(repo, worktree, ctx, item.owner, item.created);
  if (now.keep) return { status: "skipped", reason: `kept: ${now.keep}` };
  if (now.branch !== item.branch || now.tip !== item.tip) return { status: "skipped", reason: "changed since the scan" };
  const removed = gitRun(repo.main, ["worktree", "remove", item.path]);
  if (!removed.ok) return { status: "failed", reason: removed.err.split("\n")[0] };
  if (item.branch) {
    // The merge was checked just above, against the default branch, so -D is safe here
    // and also deletes a branch merged through a squashed pull request.
    const deleted = gitRun(repo.main, ["branch", "-D", item.branch]);
    if (!deleted.ok) return { status: "removed", freed: item.bytes, reason: `branch ${item.branch} kept: ${deleted.err.split("\n")[0]}` };
  }
  return { status: "removed", freed: item.bytes };
}

function removeBranches(item, repo) {
  const checkedOut = new Set(repo.worktrees.filter((worktree) => worktree.branch).map((worktree) => worktree.branch));
  const problems = [];
  let done = 0;
  for (const member of item.members) {
    const branch = repo.branches.find((other) => other.name === member.name);
    if (!branch) {
      done++;
      continue;
    }
    let reason = null;
    if (branch.tip !== member.tip) reason = "moved since the scan";
    else if (checkedOut.has(member.name)) reason = "checked out";
    else if (!mergeOf(repo, member.name, branch.tip).merged) reason = "not merged";
    else if (openPullRequest(repo, member.name)) reason = "open pull request";
    else {
      const deleted = gitRun(repo.main, ["branch", "-D", member.name]);
      if (deleted.ok) done++;
      else reason = deleted.err.split("\n")[0];
    }
    if (reason) problems.push(`${member.name}: ${reason}`);
  }
  return summarize(done, item.members.length, problems, null);
}

function removePaths(item, paths, ctx, repos) {
  const problems = [];
  let done = 0;
  for (const path of paths) {
    if (!existsSync(path)) {
      done++;
      continue;
    }
    const guard = protectedReason(path, ctx, repos);
    if (guard) {
      problems.push(`${display(path, ctx)}: ${guard}`);
      continue;
    }
    try {
      rmSync(path, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 });
      done++;
    } catch (error) {
      const busy = error && (error.code === "EBUSY" || error.code === "EPERM");
      problems.push(`${display(path, ctx)}: ${busy ? "in use" : error.code || error.message}`);
    }
  }
  return summarize(done, paths.length, problems, item.bytes);
}

function summarize(done, total, problems, bytes) {
  if (!problems.length) return { status: "removed", freed: bytes };
  return { status: done ? "partly removed" : "failed", reason: `${done} of ${total} removed; ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? "; ..." : ""}`, freed: done && bytes ? Math.round((bytes * done) / total) : 0 };
}

function removeOne(item, plan, ctx, repoCache) {
  const repoOf = (main) => {
    if (!repoCache.has(key(main))) repoCache.set(key(main), readRepo(main));
    return repoCache.get(key(main));
  };
  const repos = plan.repos.map(repoOf);
  if (item.keep) return { status: "skipped", reason: `kept: ${item.keep}` };
  switch (item.kind) {
    case "worktree":
      return removeWorktree(item, repoOf(item.repo), ctx);
    case "records": {
      const pruned = gitRun(item.repo, ["worktree", "prune"]);
      return pruned.ok ? { status: "removed" } : { status: "failed", reason: pruned.err.split("\n")[0] };
    }
    case "branches":
      return removeBranches(item, repoOf(item.repo));
    case "temp":
      return removePaths(item, item.members.map((member) => member.path).filter((path) => TEMP_PATTERNS.some((entry) => entry.pattern.test(basename(path)))), ctx, repos);
    case "path": {
      if (!existsSync(item.path)) return { status: "removed", freed: 0 };
      const now = inspectClaim(item.path, ctx, repos);
      if (!now || now.kind !== "path") return { status: "skipped", reason: "changed since the scan" };
      if (now.keep) return { status: "skipped", reason: `kept: ${now.keep}` };
      return removePaths(item, [item.path], ctx, repos);
    }
    case "change": {
      const rel = relative(item.repo, item.path).split("\\").join("/");
      if (!(git(item.repo, ["status", "--porcelain", "--", rel]) || "").trim()) return { status: "removed", freed: 0 };
      const restored = gitRun(item.repo, ["restore", "--staged", "--worktree", "--", rel]);
      return restored.ok ? { status: "restored" } : { status: "failed", reason: restored.err.split("\n")[0] };
    }
    default:
      return { status: "skipped", reason: `report only${item.hint ? `: ${item.hint}` : ""}` };
  }
}

export function remove(plan, ids) {
  const wanted = new Set();
  for (const id of ids) {
    if (id === "selected") plan.items.filter((item) => item.selected).forEach((item) => wanted.add(item.id));
    else wanted.add(id);
  }
  const unknown = [...wanted].filter((id) => !plan.items.some((item) => item.id === id));
  const ctx = freshContext(plan);
  const repoCache = new Map();
  // Files and folders first, worktrees next, branches last: a worktree removal frees its branch.
  const rank = { change: 0, path: 1, temp: 2, worktree: 3, records: 4, branches: 5, cache: 6, reference: 7 };
  const chosen = plan.items.filter((item) => wanted.has(item.id)).sort((a, b) => rank[a.kind] - rank[b.kind]);
  const results = chosen.map((item) => {
    let result;
    try {
      result = removeOne(item, plan, ctx, repoCache);
    } catch (error) {
      result = { status: "failed", reason: error.message };
    }
    if (["worktree", "records", "branches"].includes(item.kind)) repoCache.delete(key(item.repo));
    return { id: item.id, label: item.label, ...result };
  });
  return { results, unknown, freed: results.reduce((sum, result) => sum + (result.freed || 0), 0) };
}

export function renderRemoval(outcome) {
  const out = [];
  for (const result of outcome.results) {
    const size = result.freed ? `  ${formatBytes(result.freed)}` : "";
    out.push(`${result.status.padEnd(14)} ${result.id.padEnd(4)} ${result.label}${size}${result.reason ? `  (${result.reason})` : ""}`);
  }
  if (outcome.unknown.length) out.push(`Unknown ids, nothing done: ${outcome.unknown.join(", ")}`);
  if (!outcome.results.length && !outcome.unknown.length) out.push("Nothing to remove.");
  out.push(`Freed: ${formatBytes(outcome.freed)}`);
  return out.join("\n");
}

// ---------------------------------------------------------------- command line

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, claims: [], repos: [], configs: [], ids: [] };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    const value = () => {
      if (i + 1 >= rest.length) throw new Error(`${arg} needs a value`);
      return rest[++i];
    };
    if (arg === "--since") {
      const raw = value();
      const time = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
      if (!Number.isFinite(time)) throw new Error(`--since: not a date: ${raw}`);
      options.since = time;
    } else if (arg === "--claim") options.claims.push(value());
    else if (arg === "--history") options.history = value();
    else if (arg === "--repo") options.repos.push(value());
    else if (arg === "--config") options.configs.push(value());
    else if (arg === "--plan") options.plan = value();
    else if (arg === "--active-hours") options.activeHours = Number(value());
    else if (arg === "--size-seconds") options.sizeSeconds = Number(value());
    else if (arg === "--audit") options.audit = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.command = "help";
    else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else options.ids.push(arg);
  }
  for (const name of ["activeHours", "sizeSeconds"]) {
    if (options[name] != null && !(options[name] >= 0)) throw new Error(`--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} needs a number`);
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}\n`);
    return 2;
  }
  if (options.command === "scan") {
    const plan = scan(options);
    const file = savePlan(plan);
    process.stdout.write(options.json ? JSON.stringify({ planFile: file, ...plan }, null, 2) + "\n" : render(plan, file) + "\n");
    return 0;
  }
  if (options.command === "remove") {
    if (!options.plan || !options.ids.length) {
      process.stderr.write(`remove needs --plan and at least one id\n\n${USAGE}\n`);
      return 2;
    }
    const plan = JSON.parse(readFileSync(options.plan, "utf8"));
    const outcome = remove(plan, options.ids);
    process.stdout.write(options.json ? JSON.stringify(outcome, null, 2) + "\n" : renderRemoval(outcome) + "\n");
    return outcome.results.some((result) => result.status === "failed") ? 1 : 0;
  }
  process.stdout.write(`${USAGE}\n`);
  return options.command === "help" || !options.command ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
