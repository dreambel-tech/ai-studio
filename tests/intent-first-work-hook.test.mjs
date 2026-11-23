// Run from the repository root with: node --test
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = (tool) => join(ROOT, tool, "plugins", "intent-first-work");
const HOOKS = {
  claude: join(plugin("claude"), "hooks", "intent-first-work.mjs"),
  codex: join(plugin("codex"), "hooks", "intent-first-work.mjs"),
  copilot: join(plugin("copilot"), "com.github.copilot", "hooks", "intent-first-work.mjs"),
};
const INSTRUCTIONS = join(ROOT, "instructions", "intent-first-work.md");
const SKILL = join(ROOT, "skills", "intent-first-work");

const mod = await import(pathToFileURL(HOOKS.claude).href);

const temporary = [];
after(() => temporary.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(dir);
  return dir;
}

function readFileSyncOrNull(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function files(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
}

function runHook(hook, payload, env = {}) {
  const result = spawnSync(process.execPath, [hook], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    env: {
      ...process.env,
      PLUGIN_DATA: "",
      CLAUDE_PLUGIN_DATA: "",
      INTENT_FIRST_PROFILE: "",
      INTENT_FIRST_LOG: "",
      INTENT_FIRST_NO_SETTINGS: "1",
      ...env,
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

function git(dir, args) {
  const res = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr || res.stdout);
  return res.stdout;
}

function makeRepo(fileMap, commitMsg = "initial architecture") {
  const dir = tempDir("intent-first-repo-");
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  for (const [rel, content] of Object.entries(fileMap)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  git(dir, ["add", "."]);
  git(dir, ["commit", "-q", "-m", commitMsg]);
  return dir;
}

function claudeAssistant(model, content, extra = {}) {
  return JSON.stringify({ type: "assistant", message: { model, content }, ...extra });
}

function codexMeta(model, effort) {
  return JSON.stringify({ type: "turn_context", payload: { model, effort } });
}

test("the Claude, Codex, and Copilot plugins ship the same hook and only the intent-first-work skill", () => {
  assert.equal(readFileSync(HOOKS.claude, "utf8"), readFileSync(HOOKS.codex, "utf8"));
  assert.equal(readFileSync(HOOKS.claude, "utf8"), readFileSync(HOOKS.copilot, "utf8"));
  assert.equal(readFileSync(join(plugin("codex"), "instructions", "intent-first-work.md"), "utf8"), readFileSync(INSTRUCTIONS, "utf8"));
  for (const tool of ["claude", "codex", "copilot"]) {
    const skillsDir = join(plugin(tool), "skills");
    assert.deepEqual(readdirSync(skillsDir), ["intent-first-work"], `${tool} plugin must ship only intent-first-work`);
    const copy = join(skillsDir, "intent-first-work");
    assert.deepEqual(files(copy), files(SKILL));
    for (const file of files(SKILL)) {
      assert.equal(readFileSync(join(copy, file), "utf8"), readFileSync(join(SKILL, file), "utf8"), `${tool} copy of ${file}`);
    }
  }
});

test("the GitHub Copilot marketplace, Agent Plugins 1.0 manifest, and hooks.json are valid", () => {
  const marketplace = JSON.parse(readFileSync(join(ROOT, ".github", "plugin", "marketplace.json"), "utf8"));
  const entry = marketplace.plugins.find((p) => p.name === "intent-first-work");
  assert.equal(entry.source, "./copilot/plugins/intent-first-work");

  const manifest = JSON.parse(readFileSync(join(plugin("copilot"), "plugin.json"), "utf8"));
  assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(manifest.name, "intent-first-work");
  assert.equal(manifest.author.name, "Dreambel Tech");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  const allowedTopLevel = new Set([
    "$schema", "name", "version", "description", "author", "homepage", "repository", "license", "keywords", "extensions",
  ]);
  for (const key of Object.keys(manifest)) {
    assert.ok(allowedTopLevel.has(key), `unexpected Agent Plugins 1.0 property: ${key}`);
  }

  const hooks = JSON.parse(readFileSync(join(plugin("copilot"), "com.github.copilot", "hooks", "hooks.json"), "utf8"));
  assert.equal(hooks.version, 1);
  assert.equal(hooks.hooks.sessionStart, undefined);
  assert.ok(hooks.hooks.userPromptSubmitted[0].bash.includes("intent-first-work.mjs"));
  assert.ok(hooks.hooks.userPromptSubmitted[0].powershell.includes("intent-first-work.mjs"));
  assert.ok(hooks.hooks.preToolUse[0].bash.includes("intent-first-work.mjs"));
  assert.ok(hooks.hooks.preToolUse[0].powershell.includes("intent-first-work.mjs"));
});

test("the Claude Code plugin is self-contained with Dreambel Tech metadata and silent-by-default hooks (no SessionStart)", () => {
  const marketplace = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "marketplace.json"), "utf8"));
  const entry = marketplace.plugins.find((p) => p.name === "intent-first-work");
  assert.equal(entry.source, "./claude/plugins/intent-first-work");

  const manifest = JSON.parse(readFileSync(join(plugin("claude"), ".claude-plugin", "plugin.json"), "utf8"));
  assert.equal(manifest.name, "intent-first-work");
  assert.equal(manifest.author.name, "Dreambel Tech");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);

  const hooks = JSON.parse(readFileSync(join(plugin("claude"), "hooks", "hooks.json"), "utf8"));
  assert.equal(hooks.hooks.SessionStart, undefined);
  assert.equal(hooks.hooks.UserPromptSubmit[0].hooks[0].command, "node");
  assert.deepEqual(hooks.hooks.UserPromptSubmit[0].hooks[0].args, [
    "${CLAUDE_PLUGIN_ROOT}/hooks/intent-first-work.mjs",
  ]);
  assert.equal(hooks.hooks.PreToolUse[0].matcher, "Edit|Write|MultiEdit");
  assert.deepEqual(hooks.hooks.PreToolUse[0].hooks[0].args, [
    "${CLAUDE_PLUGIN_ROOT}/hooks/intent-first-work.mjs",
  ]);
});

test("the Codex marketplace and hooks.json register UserPromptSubmit and PreToolUse (no SessionStart)", () => {
  const marketplace = JSON.parse(readFileSync(join(ROOT, ".agents", "plugins", "marketplace.json"), "utf8"));
  assert.equal(marketplace.plugins.find((p) => p.name === "intent-first-work").source.path, "./codex/plugins/intent-first-work");
  const hooks = JSON.parse(readFileSync(join(plugin("codex"), "hooks", "hooks.json"), "utf8"));
  assert.equal(hooks.hooks.SessionStart, undefined);
  assert.ok(hooks.hooks.UserPromptSubmit[0].hooks[0].command.includes("intent-first-work.mjs"));
  assert.equal(hooks.hooks.PreToolUse[0].matcher, "apply_patch|Edit|Write");
});

test("standalone instructions stay concise and focused on intent, coherence, and proof", () => {
  const raw = readFileSync(INSTRUCTIONS, "utf8").replace(/\r\n/g, "\n");
  const block = /^```markdown\n([\s\S]*?)\n```$/m.exec(raw)[1].trim();
  assert.match(block, /^## Intent first\n/);
  assert.match(block, /Intent first/i);
  assert.match(block, /Coherence/i);
  assert.match(block, /Verified against the goal/i);
  assert.match(block, /say nothing about what stays unchanged/i);
  assert.ok(block.length < 1200, `instructions block too long: ${block.length}`);
});

test("classifyModel & detectProfile combine model size tier (0/1/2) and reasoning effort (-1/0/+1)", () => {
  // Size tiers: 0 small (Haiku, Luna, Hydrogen), 1 medium/default (Sonnet, Terra, Neon, Argon, unknown), 2 large (Opus, Fable, Mythos, Sol, Astra, Carbon).
  assert.equal(mod.modelSizeTier("claude-haiku-5-5"), 0);
  assert.equal(mod.modelSizeTier("gpt-6-luna"), 0);
  assert.equal(mod.modelSizeTier("gemini-4-hydrogen"), 0);
  assert.equal(mod.modelSizeTier("gpt-5-mini"), 0);
  assert.equal(mod.modelSizeTier("gpt-5-nano"), 0);
  assert.equal(mod.modelSizeTier("gemini-2.5-flash"), 0);
  assert.equal(mod.modelSizeTier("gemini-3-flash-lite"), 0);
  assert.equal(mod.modelSizeTier("raptor-mini"), 0);
  assert.equal(mod.modelSizeTier("claude-sonnet-5-5"), 1);
  assert.equal(mod.modelSizeTier("gpt-6-terra"), 1);
  assert.equal(mod.modelSizeTier("gemini-4-neon"), 1);
  assert.equal(mod.modelSizeTier("gemini-4-argon"), 1);
  assert.equal(mod.modelSizeTier("future-unknown-model"), 1);
  assert.equal(mod.modelSizeTier("claude-opus-5-5"), 2);
  assert.equal(mod.modelSizeTier("claude-fable-5-2"), 2);
  assert.equal(mod.modelSizeTier("claude-mythos-1"), 2);
  assert.equal(mod.modelSizeTier("gpt-6.1-sol"), 2);
  assert.equal(mod.modelSizeTier("gpt-6.2-astra"), 2);
  assert.equal(mod.modelSizeTier("gemini-4-carbon"), 2);

  // Full 3x3 matrix: size (0/1/2) + effort (-1/0/+1) => <=0 guided, 1 standard, >=2 minimal.
  assert.equal(mod.classifyModel("gpt-6-luna", { effort: "low" }), "guided");
  assert.equal(mod.classifyModel("gpt-6-luna", { effort: "medium" }), "guided");
  assert.equal(mod.classifyModel("gpt-6-luna", { effort: "high" }), "standard");
  assert.equal(mod.classifyModel("claude-haiku-5-5"), "guided");
  assert.equal(mod.classifyModel("gemini-4-hydrogen"), "guided");

  assert.equal(mod.classifyModel("gemini-4-neon", { effort: "low" }), "guided");
  assert.equal(mod.classifyModel("gemini-4-neon", { effort: "medium" }), "standard");
  assert.equal(mod.classifyModel("gemini-4-neon", { effort: "high" }), "minimal");
  assert.equal(mod.classifyModel("gemini-4-argon", { effort: "medium" }), "standard");
  assert.equal(mod.classifyModel("gpt-6-terra", { effort: "medium" }), "standard");
  assert.equal(mod.classifyModel("claude-sonnet-5-5", { hasThinking: false }), "guided");
  assert.equal(mod.classifyModel("claude-sonnet-5-5", { hasThinking: true }), "standard");
  assert.equal(mod.classifyModel(null), "standard");
  assert.equal(mod.classifyModel("future-unknown-model", { effort: "high" }), "minimal");
  assert.equal(mod.classifyModel("future-unknown-model", { effort: "low" }), "guided");

  assert.equal(mod.classifyModel("claude-opus-5-5", { effort: "low" }), "standard");
  assert.equal(mod.classifyModel("claude-opus-5-5", { hasThinking: false }), "standard");
  assert.equal(mod.classifyModel("claude-opus-5-5", { hasThinking: true }), "minimal");
  assert.equal(mod.classifyModel("gpt-6.1-sol", { effort: "low" }), "standard");
  assert.equal(mod.classifyModel("gpt-6.1-sol", { effort: "medium" }), "minimal");
  assert.equal(mod.classifyModel("gpt-6.1-sol", { effort: "high" }), "minimal");
  assert.equal(mod.classifyModel("gpt-6.2-astra", { effort: "high" }), "minimal");
  assert.equal(mod.classifyModel("claude-fable-5-2", { effort: "high" }), "minimal");
  assert.equal(mod.classifyModel("gemini-4-carbon", { effort: "high" }), "minimal");

  assert.equal(mod.detectProfile({}, null, { env: { INTENT_FIRST_PROFILE: "off" }, readSettings: false }), "off");
  assert.equal(mod.detectProfile({}, null, { env: { INTENT_FIRST_PROFILE: "guided" }, readSettings: false }), "guided");
  assert.equal(mod.detectProfile({}, null, { env: { INTENT_FIRST_PROFILE: "minimal" }, readSettings: false }), "minimal");
});

test("analyzePrompt stays silent on clear, routine, anchored, or follow-up prompts (EN & FR)", () => {
  const silentPrompts = [
    "",
    "/compact",
    "ok",
    "yes, go ahead",
    "Oui, supprime-les",
    "Oui, corrige",
    "Oui, l'audit",
    "Remove them all",
    "<artifact-view-context artifact=\"abc\">payload</artifact-view-context>",
    "ça me va",
    "vas-y",
    "looks good, ship it",
    "run tests",
    "lance les tests",
    "git status",
    "fais un commit",
    "how does session cleanup work?",
    "explain the auth architecture",
    "comment fonctionne le cache ?",
    "fix typo in src/orders.js:14",
    "Error: Cannot read properties of undefined\n    at render (src/view.js:12:4)",
    "Please implement:\n- Step one\n- Step two\n- Step three",
  ];
  for (const prompt of silentPrompts) {
    assert.equal(mod.analyzePrompt(prompt), null, `expected silence for: ${JSON.stringify(prompt)}`);
  }
  assert.equal(mod.analyzePrompt("improve the checkout flow", { lastAssistantAskedQuestion: true }), null);
});

test("analyzePrompt triggers on ambiguous goals, structural changes, and vague bugs (EN & FR)", () => {
  assert.equal(mod.analyzePrompt("improve the checkout flow")?.reason, "ambiguous_goal");
  assert.equal(mod.analyzePrompt("améliore la gestion du cache")?.reason, "ambiguous_goal");
  assert.equal(mod.analyzePrompt("replace cookie sessions with JWT in src/auth/session.js")?.reason, "structural_change");
  assert.equal(mod.analyzePrompt("refactorise le module de paiement")?.reason, "structural_change");
  assert.equal(mod.analyzePrompt("the login screen is broken")?.reason, "inherited_or_review");
  assert.equal(mod.analyzePrompt("reprends le travail de l'autre agent sur cette branche")?.reason, "inherited_or_review");
  assert.equal(mod.analyzePrompt("explain how auth works and then refactor it")?.reason, "structural_change");

  // AI-reworded multi-bullet tickets with sweeping or symptom traps must NOT be silenced by bullet count alone.
  assert.equal(
    mod.analyzePrompt("Contexte:\n- Plantage sur valeur 5235235098\n- Régler le problème sur tous les champs du processus\n- Tester en recette")?.reason,
    "structural_change",
  );
  assert.equal(
    mod.analyzePrompt("Ticket:\n- Mise à jour en temps réel dans les onglets\n- Après appel maintenance\n- Vérifier le statut")?.reason,
    "structural_change",
  );
  assert.equal(
    mod.analyzePrompt("Bug:\n- Le lecteur 3 est absent des graphiques\n- Aucun historique disponible\n- Doit afficher l'onglet")?.reason,
    "inherited_or_review",
  );
});

for (const [tool, hook] of Object.entries(HOOKS)) {
  test(`${tool}: UserPromptSubmit stays silent on clear prompts and replies to questions`, () => {
    const dir = tempDir(`ifw-prompt-silent-${tool}-`);
    const transcript = join(dir, "session.jsonl");
    writeFileSync(
      transcript,
      claudeAssistant("claude-sonnet-5-5", [{ type: "text", text: "Do you want option A or option B?" }]) + "\n",
    );
    const data = join(dir, "data");

    // Silent on routine command even without question.
    assert.equal(
      runHook(
        hook,
        { hook_event_name: "UserPromptSubmit", session_id: "s-clear", prompt: "run tests", cwd: ROOT },
        { PLUGIN_DATA: data },
      ),
      null,
    );

    // Silent when user is answering the assistant's question.
    assert.equal(
      runHook(
        hook,
        {
          hook_event_name: "UserPromptSubmit",
          session_id: "s-answer",
          transcript_path: transcript,
          prompt: "improve option A and add caching",
          cwd: ROOT,
        },
        { PLUGIN_DATA: data },
      ),
      null,
    );
  });

  test(`${tool}: UserPromptSubmit adapts to model profile and applies 1-turn cooldown`, () => {
    const dir = tempDir(`ifw-prompt-profile-${tool}-`);
    const data = join(dir, "data");

    const haikuTranscript = join(dir, "haiku.jsonl");
    writeFileSync(haikuTranscript, claudeAssistant("claude-haiku-5-5", [{ type: "text", text: "Ready." }]) + "\n");
    const haikuOut = runHook(
      hook,
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "s-haiku",
        transcript_path: haikuTranscript,
        prompt: "improve error handling across the app",
        cwd: ROOT,
      },
      { PLUGIN_DATA: data },
    );
    assert.equal(haikuOut.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.match(haikuOut.hookSpecificOutput.additionalContext, /Do not load the full skill/);
    assert.ok(haikuOut.hookSpecificOutput.additionalContext.length < 2500 * 4);

    // Consecutive turn is cooled down (no nagging).
    const secondTurn = runHook(
      hook,
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "s-haiku",
        transcript_path: haikuTranscript,
        prompt: "also redesign the sidebar",
        cwd: ROOT,
      },
      { PLUGIN_DATA: data },
    );
    assert.equal(secondTurn, null);

    // Opus with thinking gets minimal nudge, silent on inherited_or_review.
    const opusTranscript = join(dir, "opus.jsonl");
    writeFileSync(
      opusTranscript,
      claudeAssistant("claude-opus-5-5", [
        { type: "thinking", thinking: "analyzing" },
        { type: "text", text: "Done." },
      ]) + "\n",
    );
    const opusOut = runHook(
      hook,
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "s-opus",
        transcript_path: opusTranscript,
        prompt: "replace the queue implementation",
        cwd: ROOT,
      },
      { PLUGIN_DATA: data },
    );
    assert.match(opusOut.hookSpecificOutput.additionalContext, /proposed means works against the real goal/);
    assert.ok(opusOut.hookSpecificOutput.additionalContext.length < 250);

    const opusBugOut = runHook(
      hook,
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "s-opus-bug",
        transcript_path: opusTranscript,
        prompt: "the modal is broken",
        cwd: ROOT,
      },
      { PLUGIN_DATA: data },
    );
    assert.equal(opusBugOut, null);

    // Explicit off disables everything.
    assert.equal(
      runHook(
        hook,
        { hook_event_name: "UserPromptSubmit", session_id: "s-off", prompt: "rewrite everything", cwd: ROOT },
        { PLUGIN_DATA: data, INTENT_FIRST_PROFILE: "off" },
      ),
      null,
    );
  });

  test(`${tool}: PreToolUse pushes unread decisions, readers, tests & git history, filters read files, and deduplicates`, () => {
    const repo = makeRepo(
      {
        "CLAUDE.md": "# Root instructions\nAlways keep revokeRefreshToken clean.\n",
        ".agents/rules/instructions.md": "# Auto-loaded rule\nMention src/auth/ everywhere.\n",
        "docs/decisions/0004-session.md": "# Session\nAlways call revokeRefreshToken on logout.\n",
        "src/auth/AGENTS.md": "# Auth folder\nKeep auth flows stateless and revoke cookies on logout.\n",
        "src/auth/session.js": "export function revokeRefreshToken(userId) { return userId; }\n",
        "src/guard.js": "import { revokeRefreshToken } from './auth/session.js';\nexport const onLogout = (id) => revokeRefreshToken(id);\n",
        "src/isolated.js": "export const standaloneThing = 42;\n",
        "tests/session.test.js": "import { revokeRefreshToken } from '../src/auth/session.js';\nrevokeRefreshToken('u1');\n",
      },
      "keep refresh token revocation on silent logout",
    );
    const data = tempDir(`ifw-pretool-data-${tool}-`);
    const transcript = join(data, "session.jsonl");
    writeFileSync(transcript, codexMeta("gpt-6-terra", "medium") + "\n");

    // 1. Editing an isolated file with no external readers or decisions -> silent (0 tokens).
    assert.equal(
      runHook(
        hook,
        {
          hook_event_name: "PreToolUse",
          session_id: "s-pre-1",
          transcript_path: transcript,
          cwd: repo,
          tool_name: "Edit",
          tool_input: {
            file_path: join(repo, "src/isolated.js"),
            old_string: "export const standaloneThing = 42;",
            new_string: "export const standaloneThing = 43;",
          },
        },
        { PLUGIN_DATA: data },
      ),
      null,
    );

    // 2. Editing src/auth/session.js -> pushes unread decision, scoped AGENTS.md, reader, test, and history.
    const first = runHook(
      hook,
      {
        hook_event_name: "PreToolUse",
        session_id: "s-pre-1",
        transcript_path: transcript,
        cwd: repo,
        tool_name: "Edit",
        tool_input: {
          file_path: join(repo, "src/auth/session.js"),
          old_string: "export function revokeRefreshToken(userId) { return userId; }",
          new_string: "export function revokeRefreshToken(userId) { return null; }",
        },
      },
      { PLUGIN_DATA: data },
    );
    assert.equal(first.hookSpecificOutput.hookEventName, "PreToolUse");
    const ctx = first.hookSpecificOutput.additionalContext;
    assert.match(ctx, /src\/auth\/AGENTS\.md/);
    assert.match(ctx, /docs\/decisions\/0004-session\.md/);
    assert.doesNotMatch(ctx, /\bCLAUDE\.md\b/);
    assert.doesNotMatch(ctx, /\.agents\/rules\/instructions\.md/);
    assert.match(ctx, /src\/guard\.js/);
    assert.match(ctx, /tests\/session\.test\.js/);
    assert.match(ctx, /history.*keep refresh token revocation on silent logout/);
    assert.match(ctx, /coherent with existing decisions and callers/);

    // Editing a markdown doc file stays silent.
    assert.equal(
      runHook(
        hook,
        {
          hook_event_name: "PreToolUse",
          session_id: "s-pre-1",
          transcript_path: transcript,
          cwd: repo,
          tool_name: "Edit",
          tool_input: {
            file_path: join(repo, "docs/decisions/0004-session.md"),
            old_string: "revokeRefreshToken",
            new_string: "revokeRefreshToken",
          },
        },
        { PLUGIN_DATA: data },
      ),
      null,
    );

    // 3. Second edit to the same file in the same session -> deduplicated (silent).
    assert.equal(
      runHook(
        hook,
        {
          hook_event_name: "PreToolUse",
          session_id: "s-pre-1",
          transcript_path: transcript,
          cwd: repo,
          tool_name: "Edit",
          tool_input: {
            file_path: join(repo, "src/auth/session.js"),
            old_string: "revokeRefreshToken",
            new_string: "revokeRefreshToken",
          },
        },
        { PLUGIN_DATA: data },
      ),
      null,
    );

    // 4. Transcript-aware filter: when all relevant files were already read, stay completely silent.
    const readTranscript = join(data, "already-read.jsonl");
    writeFileSync(
      readTranscript,
      [
        claudeAssistant("claude-opus-5-5", [
          { type: "thinking", thinking: "checking" },
          { type: "tool_use", name: "Read", input: { file_path: join(repo, "docs/decisions/0004-session.md") } },
          { type: "tool_use", name: "Read", input: { file_path: join(repo, "src/auth/AGENTS.md") } },
          { type: "tool_use", name: "Read", input: { file_path: join(repo, "src/guard.js") } },
          { type: "tool_use", name: "Read", input: { file_path: join(repo, "tests/session.test.js") } },
        ]),
      ].join("\n") + "\n",
    );
    assert.equal(
      runHook(
        hook,
        {
          hook_event_name: "PreToolUse",
          session_id: "s-pre-read",
          transcript_path: readTranscript,
          cwd: repo,
          tool_name: "Edit",
          tool_input: {
            file_path: join(repo, "src/auth/session.js"),
            old_string: "export function revokeRefreshToken(userId) { return userId; }",
            new_string: "export function revokeRefreshToken(userId) { return null; }",
          },
        },
        { PLUGIN_DATA: data },
      ),
      null,
    );

    // 5. After a compaction boundary, previously read files resurface; minimal profile sends facts only (no footer).
    appendFileSync(readTranscript, JSON.stringify({ type: "system", subtype: "compact_boundary" }) + "\n");
    const afterCompact = runHook(
      hook,
      {
        hook_event_name: "PreToolUse",
        session_id: "s-pre-compact",
        transcript_path: readTranscript,
        cwd: repo,
        tool_name: "Edit",
        tool_input: {
          file_path: join(repo, "src/auth/session.js"),
          old_string: "export function revokeRefreshToken(userId) { return userId; }",
          new_string: "export function revokeRefreshToken(userId) { return null; }",
        },
      },
      { PLUGIN_DATA: data },
    );
    assert.match(afterCompact.hookSpecificOutput.additionalContext, /docs\/decisions\/0004-session\.md/);
    assert.doesNotMatch(afterCompact.hookSpecificOutput.additionalContext, /Check these unread references/);
    assert.doesNotMatch(afterCompact.hookSpecificOutput.additionalContext, /Keep these decisions/);

    // 6. Codex apply_patch support.
    const patchOut = runHook(
      hook,
      {
        hook_event_name: "PreToolUse",
        session_id: "s-codex-patch",
        cwd: repo,
        tool_name: "apply_patch",
        tool_input: {
          input: [
            "*** Begin Patch",
            "*** Update File: src/auth/session.js",
            "@@",
            "-export function revokeRefreshToken(userId) { return userId; }",
            "+export function revokeRefreshToken(userId) { return null; }",
            "*** End Patch",
          ].join("\n"),
        },
      },
      { PLUGIN_DATA: data, INTENT_FIRST_PROFILE: "guided" },
    );
    assert.match(patchOut.hookSpecificOutput.additionalContext, /docs\/decisions\/0004-session\.md/);
    assert.match(patchOut.hookSpecificOutput.additionalContext, /Keep these decisions and contracts intact/);
  });

  test(`${tool}: never fails on bad, empty, or unsupported inputs`, () => {
    assert.equal(runHook(hook, ""), null);
    assert.equal(runHook(hook, "not json"), null);
    assert.equal(runHook(hook, { hook_event_name: "SessionStart" }), null);
    assert.equal(runHook(hook, { hook_event_name: "PreToolUse", tool_name: "Edit", cwd: "/no/such/path" }), null);
  });

  test(`${tool}: INTENT_FIRST_LOG=1 writes metadata-only telemetry (off by default)`, () => {
    const data = tempDir(`ifw-log-${tool}-`);
    const logPath = join(data, "telemetry.jsonl");

    // Off by default -> no telemetry file created.
    runHook(
      hook,
      { hook_event_name: "UserPromptSubmit", session_id: "s-nolog", prompt: "improve secret checkout flow", cwd: ROOT },
      { PLUGIN_DATA: data },
    );
    assert.equal(readFileSyncOrNull(logPath), null);

    // Enabled -> appends metadata only, never prompt text or paths.
    runHook(
      hook,
      { hook_event_name: "UserPromptSubmit", session_id: "s-log", prompt: "improve super_secret_prompt_123", cwd: ROOT },
      { PLUGIN_DATA: data, INTENT_FIRST_LOG: "1" },
    );
    runHook(
      hook,
      { hook_event_name: "UserPromptSubmit", session_id: "s-log-2", prompt: "run tests", cwd: ROOT },
      { PLUGIN_DATA: data, INTENT_FIRST_LOG: "1" },
    );

    const raw = readFileSync(logPath, "utf8");
    assert.doesNotMatch(raw, /super_secret_prompt_123/);
    const rows = raw.trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(rows.length, 2);
    assert.equal(rows[0].event, "UserPromptSubmit");
    assert.equal(rows[0].triggered, true);
    assert.equal(rows[0].reason, "ambiguous_goal");
    assert.ok(rows[0].chars > 0);
    assert.equal(typeof rows[0].latencyMs, "number");
    assert.equal(rows[1].triggered, false);
    assert.equal(rows[1].reason, "clear_prompt");
    assert.equal(rows[1].chars, 0);
  });
}

test("PreToolUse flags shared blast radius (shared component, domain symbol, global CSS) and recognizes spec deviation docs", () => {
  const files = {
    ".github/copilot-instructions.md": "# Auto-loaded\nMentions AppInputComponent everywhere.\n",
    ".github/instructions/ui.instructions.md": "# Auto-loaded\nMentions DO_VALEUR_RELEVE.\n",
    "lot-project/ECARTS-SFD-0.5.0.md": "# Spec deviations\nKeep 6 decimals on DO_VALEUR_RELEVE.\n",
    "src/shared/app-input.component.ts": "export class AppInputComponent {}\n",
    "src/model/domains.sql": "CREATE DOMAIN DO_VALEUR_RELEVE NUMERIC(12,6);\n",
    "src/tabs/detail.component.scss": ".box { padding: 4px; }\n",
  };
  // Create 8 consumers across 4 distinct areas so both app-input.component and DO_VALEUR_RELEVE exceed the frequency cap.
  for (const area of ["modA", "modB", "modC", "modD"]) {
    files[`src/${area}/screen1.ts`] = "import { AppInputComponent } from '../shared/app-input.component';\nexport const field1 = 'DO_VALEUR_RELEVE';\n";
    files[`src/${area}/screen2.ts`] = "import { AppInputComponent } from '../shared/app-input.component';\nexport const field2 = 'DO_VALEUR_RELEVE';\n";
  }
  const repo = makeRepo(files, "setup shared surfaces");
  const data = tempDir("ifw-blast-radius-");

  // 1. Editing highly referenced shared component -> surfaces shared blast-radius warning instead of dropping silently.
  const sharedComp = runHook(
    HOOKS.claude,
    {
      hook_event_name: "PreToolUse",
      session_id: "s-blast-1",
      cwd: repo,
      tool_name: "Edit",
      tool_input: {
        file_path: join(repo, "src/shared/app-input.component.ts"),
        old_string: "export class AppInputComponent {}",
        new_string: "export class AppInputComponent { maxLen = 30; }",
      },
    },
    { PLUGIN_DATA: data, INTENT_FIRST_PROFILE: "guided" },
  );
  assert.ok(sharedComp, "expected shared blast-radius warning for app-input.component.ts");
  assert.match(sharedComp.hookSpecificOutput.additionalContext, /shared.*used in 8 files across|used in 8 files \(4 areas/);
  assert.doesNotMatch(sharedComp.hookSpecificOutput.additionalContext, /copilot-instructions\.md/);

  // 2. Editing shared SQL domain -> surfaces both shared blast radius AND ECARTS-SFD decision doc, skipping auto-loaded .github/instructions.
  const sharedDomain = runHook(
    HOOKS.claude,
    {
      hook_event_name: "PreToolUse",
      session_id: "s-blast-2",
      cwd: repo,
      tool_name: "Edit",
      tool_input: {
        file_path: join(repo, "src/model/domains.sql"),
        old_string: "CREATE DOMAIN DO_VALEUR_RELEVE NUMERIC(12,6);",
        new_string: "CREATE DOMAIN DO_VALEUR_RELEVE NUMERIC(30,10);",
      },
    },
    { PLUGIN_DATA: data, INTENT_FIRST_PROFILE: "guided" },
  );
  assert.ok(sharedDomain, "expected warning for DO_VALEUR_RELEVE");
  assert.match(sharedDomain.hookSpecificOutput.additionalContext, /shared.*DO_VALEUR_RELEVE.*8 files/);
  assert.match(sharedDomain.hookSpecificOutput.additionalContext, /decision.*ECARTS-SFD-0\.5\.0\.md/);
  assert.doesNotMatch(sharedDomain.hookSpecificOutput.additionalContext, /ui\.instructions\.md/);

  // 3. Editing unscoped global CSS selector -> surfaces global CSS warning.
  const globalCss = runHook(
    HOOKS.claude,
    {
      hook_event_name: "PreToolUse",
      session_id: "s-blast-3",
      cwd: repo,
      tool_name: "Edit",
      tool_input: {
        file_path: join(repo, "src/tabs/detail.component.scss"),
        old_string: ".box { padding: 4px; }",
        new_string: "::ng-deep mat-tab-body { display: flex; }",
      },
    },
    { PLUGIN_DATA: data, INTENT_FIRST_PROFILE: "guided" },
  );
  assert.ok(globalCss, "expected global CSS warning");
  assert.match(globalCss.hookSpecificOutput.additionalContext, /shared.*global or unscoped CSS selector/);
});

test("GitHub Copilot CLI (camelCase) and VS Code Copilot edit tools work seamlessly", () => {
  const repo = makeRepo(
    {
      "docs/decisions/0001-billing.md": "# Billing\nNever round invoice IDs.\n",
      "src/billing/format.ts": "export function formatInvoiceValue(v: number) { return String(v); }\n",
      "src/billing/view.ts": "import { formatInvoiceValue } from './format.ts';\nexport const out = formatInvoiceValue(10);\n",
    },
    "keep invoice IDs integer",
  );
  const data = tempDir("ifw-copilot-");

  // 1. Copilot CLI camelCase userPromptSubmitted (no hook_event_name field).
  const cliPrompt = runHook(
    HOOKS.copilot,
    {
      sessionId: "cop-cli-1",
      timestamp: Date.now(),
      cwd: repo,
      prompt: "improve billing formatting across all fields",
    },
    { PLUGIN_DATA: data, INTENT_FIRST_PROFILE: "guided" },
  );
  assert.ok(cliPrompt);
  assert.equal(cliPrompt.hookSpecificOutput, undefined);
  assert.match(cliPrompt.additionalContext, /Intent first:/);

  // 2. Copilot CLI camelCase preToolUse on non-edit tool ('view') -> fast silent null.
  assert.equal(
    runHook(
      HOOKS.copilot,
      {
        sessionId: "cop-cli-1",
        cwd: repo,
        toolName: "view",
        toolArgs: JSON.stringify({ path: "src/billing/format.ts" }),
      },
      { PLUGIN_DATA: data },
    ),
    null,
  );

  // 3. Copilot CLI camelCase preToolUse with stringified toolArgs -> returns { permissionDecision: "allow", additionalContext }.
  const cliEdit = runHook(
    HOOKS.copilot,
    {
      sessionId: "cop-cli-1",
      cwd: repo,
      toolName: "edit_file",
      toolArgs: JSON.stringify({
        path: "src/billing/format.ts",
        old_str: "export function formatInvoiceValue(v: number) { return String(v); }",
        new_str: "export function formatInvoiceValue(v: number) { return v.toFixed(2); }",
      }),
    },
    { PLUGIN_DATA: data, INTENT_FIRST_PROFILE: "guided" },
  );
  assert.ok(cliEdit);
  assert.equal(cliEdit.permissionDecision, "allow");
  assert.match(cliEdit.additionalContext, /src\/billing\/view\.ts/);
  assert.match(cliEdit.additionalContext, /Keep these decisions and contracts intact/);

  // 4. VS Code Copilot PascalCase PreToolUse with replace_string_in_file & multi_replace_string_in_file.
  const vscodeEdit = runHook(
    HOOKS.copilot,
    {
      hook_event_name: "PreToolUse",
      session_id: "cop-vscode-1",
      cwd: repo,
      tool_name: "replace_string_in_file",
      tool_input: {
        filePath: join(repo, "src/billing/format.ts"),
        oldString: "export function formatInvoiceValue(v: number) { return String(v); }",
        newString: "export function formatInvoiceValue(v: number) { return v.toFixed(2); }",
      },
    },
    { PLUGIN_DATA: data },
  );
  assert.equal(vscodeEdit.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.match(vscodeEdit.hookSpecificOutput.additionalContext, /src\/billing\/view\.ts/);

  const vscodeMulti = runHook(
    HOOKS.copilot,
    {
      hook_event_name: "PreToolUse",
      session_id: "cop-vscode-2",
      cwd: repo,
      tool_name: "multi_replace_string_in_file",
      tool_input: {
        replacements: [
          {
            filePath: join(repo, "src/billing/format.ts"),
            oldString: "formatInvoiceValue",
            newString: "formatInvoiceValue",
          },
        ],
      },
    },
    { PLUGIN_DATA: data },
  );
  assert.match(vscodeMulti.hookSpecificOutput.additionalContext, /src\/billing\/view\.ts/);
});
