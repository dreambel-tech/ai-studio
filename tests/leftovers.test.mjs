// Run from the repository root with: node --test
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { SECRET_FILE, formatBytes, isInside, parseDockerSize, parseStatus, samePath } from "../skills/session-cleanup/scripts/leftovers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "skills", "session-cleanup", "scripts", "leftovers.mjs");

const temporary = [];
after(() => temporary.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

// A repository with an origin, worktrees and branches in every state the scan tells
// apart, a fake gh, and a temporary folder holding browser profiles.
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "leftovers-test-"));
  temporary.push(dir);
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
  return { dir, env, git, paths, scan, remove, leftovers };
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
