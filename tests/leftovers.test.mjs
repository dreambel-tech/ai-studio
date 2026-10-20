// Run from the repository root with: node --test
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { SECRET_FILE, branchesIn, formatBytes, isInside, parseDockerSize, parseStatus, pathsIn, samePath } from "../skills/session-cleanup/scripts/leftovers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "skills", "session-cleanup", "scripts", "leftovers.mjs");

const temporary = [];
after(() => temporary.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

// A repository with an origin, worktrees and branches in every state the scan tells
// apart, a fake gh, and a temporary folder holding browser profiles.
function fixture() {
  const started = Date.now() - 1000;
  const dir = mkdtempSync(join(tmpdir(), "leftovers-test-"));
  temporary.push(dir);
  mkdirSync(join(dir, "tmp"));
  const config = join(dir, "gitconfig");
  writeFileSync(config, "[user]\n\tname = Test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n[core]\n\tautocrlf = false\n");
  const prsFile = join(dir, "prs.json");
  const fakeGh = join(dir, "fake-gh.mjs");
  writeFileSync(fakeGh, `import { readFileSync } from "node:fs";\nprocess.stdout.write(readFileSync(${JSON.stringify(prsFile)}, "utf8"));\n`);
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: config,
    GIT_CONFIG_NOSYSTEM: "1",
    LEFTOVERS_TEMP: join(dir, "tmp"),
    TEMP: join(dir, "tmp"),
    TMP: join(dir, "tmp"),
    TMPDIR: join(dir, "tmp"),
    LEFTOVERS_PLAN_DIR: join(dir, "plans"),
    LEFTOVERS_GH: fakeGh,
    LEFTOVERS_DOCKER: "none",
    LEFTOVERS_NPM_CACHE: join(dir, "no-npm-cache"),
  };
  const git = (cwd, ...args) => {
    const result = spawnSync("git", args, { cwd, env, encoding: "utf8" });
    assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
    return result.stdout.trim();
  };

  git(dir, "init", "-q", "--bare", "origin.git");
  git(dir, "clone", "-q", "origin.git", "project");
  const repo = join(dir, "project");
  writeFileSync(join(repo, ".gitignore"), ".env\n.env.*\nnode_modules/\n");
  writeFileSync(join(repo, "app.txt"), "v1\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "init");
  git(repo, "push", "-q", "-u", "origin", "main");
  git(repo, "remote", "set-head", "origin", "main");

  const commitOn = (branch) => {
    git(repo, "switch", "-q", "-c", branch);
    writeFileSync(join(repo, `${branch}.txt`), `${branch}\n`);
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", branch);
    git(repo, "switch", "-q", "main");
    return git(repo, "rev-parse", branch);
  };
  const merge = (branch) => git(repo, "merge", "-q", "--no-ff", "-m", `merge ${branch}`, branch);
  const worktrees = join(dir, "worktrees");
  const worktree = (name, ...extra) => {
    const path = join(worktrees, name);
    git(repo, "worktree", "add", "-q", path, ...extra);
    return path;
  };

  for (const branch of ["merged-a", "merged-b", "dirty", "with-env", "locked", "old-a", "op"]) {
    commitOn(branch);
    merge(branch);
  }
  git(repo, "push", "-q", "origin", "main");
  commitOn("unmerged");
  commitOn("wip");
  const squashTip = commitOn("sq");

  const paths = {
    repo,
    mergedA: worktree("merged-a", "merged-a"),
    mergedB: worktree("merged-b", "merged-b"),
    dirty: worktree("dirty", "dirty"),
    withEnv: worktree("with-env", "with-env"),
    locked: worktree("locked", "locked"),
    unmerged: worktree("unmerged", "unmerged"),
    fresh: worktree("fresh", "-b", "fresh"),
    gone: worktree("gone", "-b", "gone"),
    temp: join(dir, "tmp"),
    outside: join(dir, "outside"),
  };
  writeFileSync(join(paths.dirty, "scratch.txt"), "not committed\n");
  writeFileSync(join(paths.withEnv, ".env"), "SECRET=1\n");
  git(repo, "worktree", "lock", paths.locked);
  rmSync(paths.gone, { recursive: true, force: true });

  writeFileSync(prsFile, JSON.stringify([
    { number: 7, state: "MERGED", headRefName: "sq", headRefOid: squashTip },
    { number: 8, state: "OPEN", headRefName: "op", headRefOid: git(repo, "rev-parse", "op") },
  ]));

  mkdirSync(join(paths.temp, "cdp-1", "Default"), { recursive: true });
  writeFileSync(join(paths.temp, "cdp-1", "Default", "Preferences"), "x".repeat(2048));
  mkdirSync(join(paths.temp, "cdp-2"));
  mkdirSync(join(paths.temp, "unrelated-folder"));
  mkdirSync(paths.outside);
  writeFileSync(join(paths.outside, "precious.txt"), "keep me\n");
  mkdirSync(join(paths.temp, "cdp-link"));
  symlinkSync(paths.outside, join(paths.temp, "cdp-link", "linked"), process.platform === "win32" ? "junction" : "dir");

  const leftovers = (args, { cwd = repo, extraEnv = {} } = {}) => {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env: { ...env, ...extraEnv }, encoding: "utf8" });
    return { ...result, json: args.includes("--json") && result.stdout ? JSON.parse(result.stdout) : null };
  };
  const scan = (args = [], options) => {
    const result = leftovers(["scan", "--json", ...args], options);
    assert.equal(result.status, 0, result.stderr);
    return result.json;
  };
  const remove = (plan, ids) => leftovers(["remove", "--plan", plan.planFile, "--json", ...ids]);
  return { dir, env, git, paths, scan, remove, leftovers, started };
}

const byPath = (plan, path) => plan.items.find((item) => item.path && samePath(item.path, path));
const byKind = (plan, kind) => plan.items.filter((item) => item.kind === kind);
const memberNames = (item) => item.members.map((member) => member.name ?? basename(member.path)).sort();

let shared;
const sharedFixture = () => (shared ||= fixture());

test("scanning changes nothing", () => {
  const { git, paths, scan } = sharedFixture();
  const snapshot = () => [
    git(paths.repo, "for-each-ref"),
    git(paths.repo, "worktree", "list", "--porcelain"),
    readdirSync(paths.temp).join(","),
    git(paths.dirty, "status", "--porcelain"),
  ];
  const before = snapshot();
  scan(["--audit", "--active-hours", "0"]);
  assert.deepEqual(snapshot(), before);
});

test("tells apart worktrees that can go from the ones to keep", () => {
  const { paths, scan } = sharedFixture();
  const plan = scan(["--audit", "--active-hours", "0"]);
  const merged = byPath(plan, paths.mergedA);
  assert.equal(merged.keep, undefined);
  assert.equal(merged.choose, undefined);
  assert.equal(merged.owner, "backlog");
  assert.equal(merged.selected, true);
  assert.equal(byPath(plan, paths.dirty).keep, "uncommitted changes");
  assert.equal(byPath(plan, paths.unmerged).keep, "branch not merged");
  assert.equal(byPath(plan, paths.locked).keep, "locked");
  assert.match(byPath(plan, paths.fresh).choose, /no commits of its own/);
  assert.match(byPath(plan, paths.withEnv).choose, /holds \.env/);
  assert.equal(byPath(plan, paths.withEnv).selected, false);
  const [records] = byKind(plan, "records");
  assert.equal(records.paths.length, 1);
  assert.ok(samePath(records.paths[0], paths.gone));
});

test("lists merged branches without a worktree, and keeps the ones with an open pull request", () => {
  const { scan } = sharedFixture();
  const plan = scan(["--audit", "--active-hours", "0"]);
  const groups = byKind(plan, "branches");
  const removable = groups.find((group) => !group.keep);
  assert.deepEqual(memberNames(removable), ["old-a", "sq"]);
  assert.equal(removable.selected, true);
  const kept = groups.find((group) => group.keep);
  assert.deepEqual(memberNames(kept), ["op"]);
  assert.equal(kept.keep, "open pull request");
  assert.ok(!groups.some((group) => memberNames(group).includes("wip")));
});

test("groups browser profiles from the temporary folder and ignores other folders", () => {
  const { scan } = sharedFixture();
  const [temp] = byKind(scan(["--audit"]), "temp");
  assert.deepEqual(memberNames(temp), ["cdp-1", "cdp-2", "cdp-link"]);
  assert.ok(temp.bytes >= 2048);
});

test("keeps worktrees used in the last 24 hours by default", () => {
  const { paths, scan } = sharedFixture();
  assert.match(byPath(scan(["--audit"]), paths.mergedA).keep, /used in the last 24 h/);
});

test("without --audit, only counts the older items", () => {
  const { scan } = sharedFixture();
  const plan = scan(["--active-hours", "0"]);
  assert.deepEqual(plan.items.filter((item) => !item.keep), []);
  assert.ok(plan.backlog.worktrees >= 1);
  assert.equal(plan.backlog.branches, 3); // old-a, sq and op, which has an open pull request
  assert.equal(plan.backlog.temp, 3);
});

test("items that appeared while the session ran are listed but never checked", () => {
  const { paths, scan } = sharedFixture();
  const plan = scan(["--since", "0", "--active-hours", "0"]);
  const merged = byPath(plan, paths.mergedA);
  assert.equal(merged.owner, "window");
  assert.equal(merged.selected, false);
  const [temp] = byKind(plan, "temp");
  assert.equal(temp.owner, "window");
  assert.equal(temp.selected, false);
});

test("without pull requests, merged items are left unchecked", () => {
  const { paths, scan } = sharedFixture();
  const plan = scan(["--audit", "--active-hours", "0"], { extraEnv: { LEFTOVERS_GH: "none" } });
  assert.equal(byPath(plan, paths.mergedA).choose, "pull request status unknown");
  assert.ok(plan.notes.some((note) => /Pull requests could not be read/.test(note)));
  // Without the merged pull request, the squashed branch no longer counts as merged.
  assert.ok(!byKind(plan, "branches").some((group) => memberNames(group).includes("sq")));
});

test("finds the repositories in the subfolders of an umbrella folder", () => {
  const { dir, paths, scan } = sharedFixture();
  const plan = scan(["--audit"], { cwd: dir });
  assert.equal(plan.repos.length, 1);
  assert.ok(samePath(plan.repos[0], paths.repo));
});

test("the text report shows sizes, the plan and the commands", () => {
  const { leftovers } = sharedFixture();
  const result = leftovers(["scan", "--audit", "--active-hours", "0"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Older \(backlog\)$/m);
  assert.match(result.stdout, /\[x\] t1 +3 browser profiles \(cdp-\*\)/);
  assert.match(result.stdout, /^Kept$/m);
  assert.match(result.stdout, /remove --plan ".+" selected/);
  assert.match(result.stdout, /^Free space: /m);
});

test("claimed paths belong to the session; older or secret ones are not checked", async () => {
  const { paths, scan } = fixture();
  writeFileSync(join(paths.repo, ".env"), "REAL=1\n");
  await pause(50);
  const since = Date.now();
  await pause(50);
  writeFileSync(join(paths.repo, "notes.tmp"), "scratch\n");
  writeFileSync(join(paths.withEnv, ".env.preview"), "COPY=1\n");
  writeFileSync(join(paths.repo, "app.txt"), "changed by a build\n");
  const claims = [join(paths.repo, "notes.tmp"), join(paths.repo, ".env"), join(paths.withEnv, ".env.preview"), join(paths.repo, "app.txt"), paths.mergedA];
  const plan = scan(["--since", String(since), ...claims.flatMap((claim) => ["--claim", claim])]);
  const notes = byPath(plan, claims[0]);
  assert.equal(notes.owner, "session");
  assert.equal(notes.selected, true);
  assert.equal(byPath(plan, claims[1]).keep, "existed before this session");
  assert.equal(byPath(plan, claims[2]).choose, "may hold secrets");
  const change = byPath(plan, claims[3]);
  assert.equal(change.kind, "change");
  assert.equal(change.selected, false);
  // A claimed worktree is the session's own, so the recent-activity rule does not keep it.
  const merged = byPath(plan, paths.mergedA);
  assert.equal(merged.owner, "session");
  assert.equal(merged.selected, true);
});

test("removes the named items and checks each one again first", () => {
  const { git, paths, scan, remove } = fixture();
  const plan = scan(["--audit", "--active-hours", "0"]);
  const ids = (predicate) => plan.items.filter(predicate).map((item) => item.id);
  writeFileSync(join(paths.mergedB, "late.txt"), "written after the scan\n");
  const result = remove(plan, [
    ...ids((item) => [paths.mergedA, paths.mergedB, paths.dirty].some((path) => item.path && samePath(item.path, path))),
    ...ids((item) => item.kind === "temp" || (item.kind === "branches" && !item.keep)),
  ]);
  assert.equal(result.status, 0, result.stderr);
  const outcome = Object.fromEntries(result.json.results.map((entry) => [entry.id, entry]));
  assert.equal(outcome[byPath(plan, paths.mergedA).id].status, "removed");
  assert.equal(outcome[byPath(plan, paths.mergedB).id].reason, "kept: uncommitted changes");
  assert.equal(outcome[byPath(plan, paths.dirty).id].reason, "kept: uncommitted changes");
  assert.ok(!existsSync(paths.mergedA));
  assert.ok(existsSync(paths.mergedB));
  assert.ok(existsSync(paths.dirty));
  const branches = git(paths.repo, "branch", "--format=%(refname:short)").split("\n");
  for (const gone of ["merged-a", "old-a", "sq"]) assert.ok(!branches.includes(gone), `${gone} should be deleted`);
  for (const kept of ["merged-b", "dirty", "op", "wip"]) assert.ok(branches.includes(kept), `${kept} should stay`);
  assert.deepEqual(readdirSync(paths.temp), ["unrelated-folder"]);
  assert.equal(readFileSync(join(paths.outside, "precious.txt"), "utf8"), "keep me\n");
});

test("'selected' removes only the checked items", async () => {
  const { paths, scan, remove } = fixture();
  const since = Date.now() - 60_000;
  writeFileSync(join(paths.repo, "notes.tmp"), "scratch\n");
  const plan = scan(["--since", String(since), "--active-hours", "0", "--claim", join(paths.repo, "notes.tmp")]);
  const result = remove(plan, ["selected"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.results.length, 1);
  assert.ok(!existsSync(join(paths.repo, "notes.tmp")));
  assert.ok(existsSync(paths.mergedA));
  assert.ok(existsSync(join(paths.temp, "cdp-1")));
});

test("restores a claimed change to a tracked file, and prunes records of gone worktrees", () => {
  const { git, paths, scan, remove } = fixture();
  writeFileSync(join(paths.repo, "app.txt"), "changed by a build\n");
  const plan = scan(["--audit", "--claim", join(paths.repo, "app.txt")]);
  const ids = plan.items.filter((item) => item.kind === "change" || item.kind === "records").map((item) => item.id);
  assert.equal(ids.length, 2);
  const result = remove(plan, ids);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(paths.repo, "app.txt"), "utf8"), "v1\n");
  assert.ok(!git(paths.repo, "worktree", "list").includes("gone"));
});

test("refuses kept items and unknown ids", () => {
  const { paths, scan, remove } = sharedFixture();
  const plan = scan(["--audit", "--active-hours", "0"]);
  const locked = byPath(plan, paths.locked);
  const result = remove(plan, [locked.id, "zz9"]);
  assert.equal(result.json.results[0].reason, "kept: locked");
  assert.deepEqual(result.json.unknown, ["zz9"]);
  assert.ok(existsSync(paths.locked));
});

test("helpers", () => {
  for (const name of [".env", ".env.local", ".ENV.production"]) assert.ok(SECRET_FILE.test(name), name);
  for (const name of [".env.example", ".env.sample", ".env.template", "env", ".envrc.txt"]) assert.ok(!SECRET_FILE.test(name), name);
  assert.equal(parseDockerSize("10.5GB"), 10_500_000_000);
  assert.equal(parseDockerSize("512kB"), 512_000);
  assert.equal(parseDockerSize("0B"), 0);
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(3 * 1024 ** 3, true), "≥ 3.0 GB");
  assert.deepEqual(parseStatus("R  new.txt\0old.txt\0!! .env\0"), [{ code: "R ", path: "new.txt" }, { code: "!!", path: ".env" }]);
  assert.ok(isInside(join("a", "b", "c"), join("a", "b")));
  assert.ok(!isInside(join("a", "bc"), join("a", "b")));
  if (process.platform === "win32") assert.ok(samePath("C:\\Dev\\X", "c:/dev/x"));
});

// History lines in the two shapes the script reads.
const claudeCall = (cwd, name, input) => JSON.stringify({ type: "assistant", cwd, timestamp: new Date().toISOString(), message: { content: [{ type: "tool_use", name, input }] } });
const write = (path, text = "x\n") => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

test("reads a session history: what it left in the temporary folder is its own, what it published is kept", () => {
  const { dir, paths, scan, started } = fixture();
  const history = join(dir, "history", "session.jsonl");
  const scratch = join(paths.temp, "scratch");
  const notes = join(dir, "notes", "report.md");
  write(join(scratch, "shot.png"));
  write(join(scratch, "canvas.html"));
  write(join(paths.temp, "out", "report.txt"));
  write(notes);
  write(join(paths.withEnv, ".env.local"), "COPY=1\n");
  write(join(paths.repo, "new-feature.js"));
  write(join(history.replace(/\.jsonl$/, ""), "subagents", "agent-1.jsonl"), claudeCall(paths.repo, "Write", { file_path: join(scratch, "from-agent.txt"), content: "x" }) + "\n");
  write(join(scratch, "from-agent.txt"));
  write(history, [
    JSON.stringify({ type: "queue-operation", timestamp: new Date(started).toISOString() }),
    claudeCall(paths.repo, "Write", { file_path: join(scratch, "shot.png"), content: `see ${join(dir, "not-created")}` }),
    claudeCall(paths.repo, "Write", { file_path: join(scratch, "canvas.html"), content: "<html>" }),
    claudeCall(paths.repo, "Write", { file_path: notes, content: "A report meant to stay" }),
    claudeCall(paths.repo, "Artifact", { file_path: join(scratch, "canvas.html") }),
    claudeCall(paths.repo, "Bash", { command: `mkdir -p "${join(paths.temp, "out")}" && echo hi > "${join(paths.temp, "out", "report.txt")}"` }),
    claudeCall(paths.repo, "Bash", { command: `cp .env "${join(paths.withEnv, ".env.local")}" && cd "${paths.mergedA}" && cat app.txt new-feature.js` }),
    claudeCall(paths.repo, "Bash", { command: `ls "${dirname(history)}" "${join(history.replace(/\.jsonl$/, ""), "subagents")}"` }),
    "",
  ].join("\n"));

  const plan = scan(["--history", history]);
  assert.equal(plan.since, started);
  const item = (path) => byPath(plan, path);
  assert.equal(item(join(scratch, "shot.png")).selected, true);
  assert.equal(item(join(scratch, "from-agent.txt")).owner, "session");
  assert.equal(item(join(scratch, "canvas.html")).keep, "source of a published page");
  assert.match(item(join(paths.temp, "out")).choose, /named by this session's commands/);
  assert.equal(item(join(paths.temp, "out", "report.txt")), undefined); // inside a folder the session created
  assert.equal(item(join(paths.withEnv, ".env.local")).choose, "may hold secrets");
  const merged = item(paths.mergedA);
  assert.equal(merged.owner, "session");
  assert.equal(merged.selected, true); // the session's own worktree, so recent use does not keep it
  for (const notListed of [notes, join(paths.repo, "app.txt"), join(paths.repo, "new-feature.js"), dirname(history), join(dir, "not-created")]) {
    assert.equal(item(notListed), undefined, notListed);
  }
});

test("reads a Codex rollout: commands, patches and code that runs commands", () => {
  const { dir, paths, scan, started } = fixture();
  const history = join(dir, "rollout.jsonl");
  write(join(paths.temp, "codex-out", "log.txt"));
  write(join(paths.temp, "patched.md"));
  write(join(paths.temp, "from-code.txt"));
  const escapedInCode = join(paths.temp, "from-code.txt").replace(/\\/g, "\\\\");
  const item = (payload) => JSON.stringify({ timestamp: new Date().toISOString(), type: "response_item", payload });
  write(history, [
    JSON.stringify({ timestamp: new Date(started).toISOString(), type: "session_meta", payload: { timestamp: new Date(started).toISOString(), cwd: paths.repo } }),
    item({ type: "function_call", name: "shell", arguments: JSON.stringify({ command: ["bash", "-lc", "mkdir codex-out && date > codex-out/log.txt"], workdir: paths.temp }) }),
    item({ type: "custom_tool_call", name: "apply_patch", input: `*** Begin Patch\n*** Add File: ${join(paths.temp, "patched.md")}\n+hello\n*** End Patch` }),
    item({ type: "custom_tool_call", name: "exec", input: `await tools.exec_command({cmd:"echo hi > '${escapedInCode}'"});` }),
    "",
  ].join("\n"));
  const plan = scan(["--history", history]);
  assert.equal(plan.since, started);
  assert.equal(byPath(plan, join(paths.temp, "patched.md")).selected, true);
  assert.equal(byPath(plan, join(paths.temp, "from-code.txt")).owner, "session");
  // The command names the file, relative to its working folder, and not the folder alone.
  assert.equal(byPath(plan, join(paths.temp, "codex-out", "log.txt")).selected, true);
});

test("what a session named but that existed before it started is not its own", () => {
  const { dir, paths, scan } = fixture();
  const history = join(dir, "later.jsonl");
  write(join(paths.temp, "scratch", "old.txt"));
  const later = new Date(Date.now() + 3_600_000).toISOString();
  write(history, JSON.stringify({ type: "queue-operation", timestamp: later }) + "\n" + claudeCall(paths.repo, "Write", { file_path: join(paths.temp, "scratch", "old.txt") }) + "\n");
  const plan = scan(["--history", history]);
  assert.deepEqual(plan.claims, []);
  assert.equal(byPath(plan, join(paths.temp, "scratch", "old.txt")), undefined);
});

test("finds the paths a command names", () => {
  const cwd = resolve(sep);
  const found = (text) => [...pathsIn(text, join(cwd, "work"))];
  assert.ok(found(`cat "${join(cwd, "a b", "c.txt")}"`).includes(join(cwd, "a b", "c.txt")));
  assert.ok(found("cp .env out/.env.local").includes(join(cwd, "work", "out", ".env.local")));
  assert.ok(found("cp .env out/.env.local").includes(join(cwd, "work", ".env")));
  assert.deepEqual(found("curl https://example.com/a/b $HOME/x *.log"), []);
  if (process.platform === "win32") assert.ok(found("rm -rf /c/Users/me/tmp/cdp-1").includes("C:\\Users\\me\\tmp\\cdp-1"));
});

test("a worktree named in a launch configuration is left unchecked, and missing targets are reported", () => {
  const { dir, paths, scan } = sharedFixture();
  const config = join(dir, "launch-project", ".claude", "launch.json");
  write(config, JSON.stringify({ configurations: [
    { name: "a", runtimeArgs: ["--prefix", paths.mergedA] },
    { name: "b", runtimeArgs: ["--prefix", join(paths.repo, "gone-folder")] },
  ] }));
  const plan = scan(["--audit", "--active-hours", "0", "--config", config]);
  const merged = byPath(plan, paths.mergedA);
  assert.match(merged.choose, /named in .*launch\.json: remove its entries too/);
  assert.equal(merged.selected, false);
  const [reference] = byKind(plan, "reference");
  assert.ok(samePath(reference.target, join(paths.repo, "gone-folder")));
  assert.equal(reference.action, "report");
});

test("a merged branch that the session's history created is its own", () => {
  const { dir, paths, scan, started } = sharedFixture();
  const history = join(dir, "branches.jsonl");
  write(history, [
    JSON.stringify({ type: "queue-operation", timestamp: new Date(started).toISOString() }),
    claudeCall(paths.repo, "Bash", { command: "git switch -c old-a && git switch main" }),
    "",
  ].join("\n"));
  const groups = byKind(scan(["--history", history]), "branches");
  const own = groups.find((group) => group.owner === "session");
  assert.deepEqual(memberNames(own), ["old-a"]);
  assert.equal(own.selected, true);
  // sq was created while the session ran, but its history does not create it.
  assert.ok(groups.some((group) => group.owner === "window" && memberNames(group).includes("sq")));
});

test("a branch of the same name created before the session started is not its own", () => {
  const { dir, paths, scan } = sharedFixture();
  const history = join(dir, "branches-later.jsonl");
  const later = new Date(Date.now() + 3_600_000).toISOString();
  write(history, JSON.stringify({ type: "queue-operation", timestamp: later }) + "\n" + claudeCall(paths.repo, "Bash", { command: "git switch -c old-a" }) + "\n");
  const plan = scan(["--history", history]);
  assert.ok(!byKind(plan, "branches").some((group) => group.owner === "session"));
});

test("finds the branches a command creates", () => {
  const found = (text) => [...branchesIn(text)].sort();
  assert.deepEqual(found('git switch -c feat/a && git checkout -b "fix-b"'), ["feat/a", "fix-b"]);
  assert.deepEqual(found("git -C 'C:/a b' worktree add ../w -b claude/c"), ["claude/c"]);
  assert.deepEqual(found("git branch d main; git branch -D e; git branch --format=x; git branch && ls"), ["d"]);
  assert.deepEqual(found(String.raw`await tools.exec_command({cmd:"git switch -c \"g-1\""})`), ["g-1"]);
  assert.deepEqual(found("git checkout main && git switch feature"), []);
});
