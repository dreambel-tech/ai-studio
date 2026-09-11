---
name: dreambel-deliver-with-evidence
description: Deliver complex product changes through evidence-first diagnosis, controlled experiments, invariant-preserving implementation, performance ownership, independent review, and honest real-path validation. Use for ambiguous defects, regressions, provider or multi-service integrations, orchestration and lifecycle changes, performance investigations, AI/model behavior, or any change where compilation alone cannot prove the user outcome.
---

# Dreambel Deliver With Evidence

Deliver behavior that is causally understood, bounded by product invariants, measured where
performance matters, and verified at the highest reachable user-path level.

## 1. Respect the requested mode

- For analysis, diagnosis, review, or status requests, inspect and report without implementing.
- For change or build requests, implement after the root-cause or design gate is satisfied.
- Wait for an explicit `go` when the user asks to decide before implementation.
- Do not expand authority from diagnosis into deployment, commit, push, or external messaging.

## 2. Preserve state and assign owners

Inspect the worktree, branch, relevant services, connected devices, and active processes first.
Preserve unrelated user changes. Assign one implementation owner per mutable surface. Parallel
agents may research or review independently, but must not concurrently edit the same files, drive
the same device, or run conflicting builds.

## 3. Keep an evidence ledger

Label conclusions explicitly:

- **Observed fact**: supported directly by code, logs, system state, provider output, or replay.
- **Inference**: likely interpretation of observed facts.
- **Hypothesis**: causal explanation requiring a discriminating test.
- **Confirmed cause**: mechanism proven by a controlled variable, complete causal chain, or focused
  regression test.

When evidence contradicts the explanation, retract the explanation and return to confirmed facts.

## 4. Map the real boundary path

Trace the actual sequence from user action to rendered outcome. Name each owner and state
transition: UI, orchestration, capability, transport, provider, normalization, model, validator,
storage, and renderer as applicable. Identify the first failing transition rather than treating the
last log line as the cause.

For multi-repository systems, exercise boundaries independently with production-shaped but bounded
inputs. Never combine evidence fields that the contract keeps separate merely to make a test pass.

## 5. Satisfy the correction gate

Before changing behavior, state:

1. exact user-visible symptom;
2. owning component and state transition;
3. triggering conditions;
4. failing mechanism;
5. direct causal evidence;
6. excluded and unresolved alternatives;
7. existing responsibility and invariants of the behavior being changed.

If the mechanism is not confirmed, add the smallest privacy-safe instrumentation or controlled
reproduction needed to distinguish the hypotheses. Treat arbitrary timeouts, retries, resets,
fallbacks, bypasses, and special cases as containment unless evidence proves otherwise.

## 6. Implement the structural correction

Write the focused regression test first when practical and confirm the expected failure. Repair the
demonstrated mechanism with the smallest readable change. Preserve security, privacy, provenance,
authorization, validation, lifecycle, cancellation, fail-closed behavior, and analogous consumers.
Prefer a reusable product rule over subject-, site-, customer-, or example-specific branches.

## Iteration circuit breaker

- Record the last known-good commit, artifact, and real-path outcome before the first correction.
- Before each correction, name one causal variable and the exact trace or outcome expected to change.
- Accept a regression fixture only when it fails before the correction and passes after it.
- If a post-fix real-path replay still fails, do not immediately patch the same family again. Return
  to the known-good baseline, compare the complete path, and seek an independent review.
- After two contradicted or ineffective corrections, freeze further mutations and produce a
  divergence report: confirmed facts, accumulated changes, baseline differences, and the next
  single discriminating experiment.
- Run expensive full-suite, deployment, and device validation only after the focused causal gate is
  satisfied.

## 7. Own performance by stage

Measure elapsed time at owned boundaries, including cold and warm paths. Separate transport,
provider, parsing, model availability, generation, validation, persistence, and rendering as
applicable. Do not infer a bottleneck from total duration alone.

Protect optimizations with equivalence tests for outputs, scores, gates, and failure behavior.
Treat progress-message thresholds and cancellation responsiveness as user-visible product behavior.

## 8. Climb the verification ladder

Report each achieved level separately:

1. implementation complete;
2. focused regression green;
3. relevant suite/typecheck/build green;
4. controlled integration green;
5. backend deployed;
6. client artifact installed or delivered;
7. exact real user path replayed;
8. residual limitations recorded.

Never imply a higher level from a lower one.

## 9. Run replays as experiments

Run one replay at a time. On failure or stall, stop replaying, preserve bounded evidence, report the
last confirmed stage, analyze, and agree on the next discriminating action. Do not run unattended
replay loops. A successful replay proves only the path and evidence it actually exercised.

## 10. Use independent agents deliberately

Give reviewers raw artifacts and the minimum necessary context. Do not leak the intended answer
when testing whether an interpretation generalizes. Use independent readings to challenge
assumptions; keep implementation authority singular and reconcile disagreements against evidence.

## 11. Close honestly

Remove temporary diagnostics and artifacts. Keep only durable, privacy-safe observability with an
explicit owner. Report:

- confirmed causes and remaining hypotheses;
- behavior that works now;
- exact verification levels reached;
- performance observations and unresolved risks;
- deployment, device, commit, and push status separately;
- the next risk-reducing step.
