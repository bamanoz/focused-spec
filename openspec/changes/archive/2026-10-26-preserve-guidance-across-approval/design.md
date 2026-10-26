# Design

## Context

See [proposal](./proposal.md) for the demonstrated false failure and [delta](./specs/agent-workflow/spec.md) for the required outcomes. This document records implementation decisions, not completed source changes.

Observed owners and conventions:

- `evals/judge.ts` validates standalone installed guidance requests, identity/version/content, successful completions and full linked-artifact recovery. Its `guidanceActivationGate` currently treats every supplied string as an independent step and resolves all identities from the filesystem at judgment time.
- `evals/dialogue.ts` uses one persisted session, then resumes that exact journal after an independent test-user response. Dialogue transcripts and scored-message contributions are different representations; guidance must use raw completed tool events, never the usage-only `scoredAgent.output`.
- `evals/native-pilot.ts` currently aggregates native authoring into one acquisition check but passes every OpenSpec publication dialogue turn as a separate step. A wrapper around its real authoring driver can judge each returned execution before the dialogue proceeds, capturing the installation state then rather than afterward.
- Native results currently have no `observations` field, but `evals/report.ts` already accepts optional native observations and keeps them out of success/certification. Public results already use `observations`.
- Public `evals/harness.ts` starts a fresh session for each workflow turn; BMad regeneration starts its own fresh session. Neither is an approval continuation.

## Goals / Non-Goals

**Goals:** implement acquisition reuse at the actual session boundary, keep mandatory activation and real invalidation, and preserve independent outcome checks and immutable history.

**Non-Goals:** change distributed skills/router text, model prompts, host skills, authorization, product evidence semantics, package versions or releases. This is an evaluator correction, not a measured claim about model-quality gains or token savings. It does not cancel any earlier approved task.

## Decisions

### Capture acquisition at each executed turn

Keep the existing stateless gate for independent fresh contexts and integration-topic checks. Add a small session-scoped acquisition tracker beside its existing provenance/parser implementation in `evals/judge.ts`, reusing those validators rather than introducing another permissive parser.

The tracker records the serving executable selection/canonical package root, package identity/version, exact topic content, and accepted acquisition for one explicit execution context. Record raw agent output immediately after each successful execution and before dispatching its continuation. Verify the initial turn against the installation present at that boundary. A later acquisition cannot erase a prior failed boundary; retain that failure in the session's mandatory verdict.

For a resumed turn, a valid fresh response updates acquisition. Without one, compare the previously accepted selection and identity against the current installation: same selected/canonical path, version and exact topic bytes permits reuse; changed/disappeared/shadowed installation or changed content requires current valid acquisition. Do not replay old valid responses against a newer installation and reject the earlier boundary retroactively. Session state must not be shared across fresh authoring/publication/regeneration requests or unrelated workspaces.

Avoid merely concatenating every turn and accepting any read: that would let late acquisition repair a missing first acquisition and conceal stale guidance across an upgrade. Avoid keeping the current per-string AND check: it mistakes dialogue boundaries for acquisition invalidation and compares old reads with final package bytes.

### Integrate once at native dialogue boundaries

Wrap only authoring executions, not the test-user or diagnostic driver calls. Apply the same tracker to native authoring and OpenSpec publication. Keep the dialogue's own resume/approval behavior, raw transcripts, scoring contributions and process ownership unchanged. Persist one mandatory acquisition verdict for each native phase using its existing gate name, alongside separate repeat-read observations for continuations. Fresh public workflows and BMad regeneration continue their independent mandatory checks.

Expose tracker state to callers without exporting a new public package API. Inspect references for any changed exported evaluator symbols; TypeScript currently has no configured language server, so use scoped repository searches when LSP is unavailable.

### Separate observation from task failure

Use native `observations` with `focused-workflow-reacquired` for authoring continuations and `lifecycle-focused-workflow-reacquired` for publication continuations. Include the continuation index and whether reuse was allowed or invalidated in detail. A missing redundant read is `passed: false` only in observations; it must not enter `gates`, native aspect judgments, certification, exit status or failure-interview selection. Mandatory acquisition invalidation remains a real gate failure.

Thread publication observations back into `evaluateNativePilot`, save them with the immutable result, and render them with an explicit `OBSERVATION` prefix. Reuse existing report parsing/aggregation; update its terminal label to describe acquisition observations rather than only integration if needed, without inventing per-turn rates or rescoring historical files. Check `test/eval-report.spec.ts` only where this consumer-visible output changes.

### Exact planned evidence

During apply, bind these proposed IDs in the existing capability shard `.focused-spec/evidence/agent-workflow.yaml`, under the working change scope. These are intended selectors, not executable enrollments created by this proposal:

| Native ID | Intended exact evidence |
| --- | --- |
| `agent.eval.guidance-approval-reuse` | `vitest::test/evals.spec.ts::agent eval harness > reuses unchanged guidance across a resumed approval dialogue` |
| `agent.eval.guidance-invalidation` | `vitest::test/evals.spec.ts::agent eval harness > invalidates retained guidance without retroactively rejecting an acquired version` |
| `agent.eval.guidance-initial-boundary` | `vitest::test/evals.spec.ts::agent eval harness > does not repair missing initial acquisition with a later read` |
| `agent.eval.guidance-context-boundary` | `vitest::test/evals.spec.ts::agent eval harness > requires independent acquisition for a fresh execution context` |
| `agent.eval.guidance-repeat-observation` | `vitest::test/native-pilot.spec.ts::native pilot evaluation boundaries > keeps missing repeat acquisition outside publication success gates` |

Replace the existing overly broad `requires fresh guidance for a subsequent workflow step` test with observable session/invalidation coverage rather than retaining assertions that pin unconditional rereading. Reconcile all existing evidence references to that renamed test, including `agent.guidance.session-refresh` in current and active scopes; do not delete its meaningful changed-package protection.

### Verification and delivery

First reproduce the current approval failure with the exact new consumer-visible assertion. Exercise same-session reuse, absent initial acquisition, changed version/content/selection, failed or truncated responses, a fresh context, and current acquisition after an upgrade. For native publication, require an independently completed final binding, real selected execution and sensitivity to retain their verdicts even when repeat-read observation is false; preserve negative outcome controls.

Replay the original captured lifecycle against the corrected session tracker and retain the comparison separately, hashing the original artifact before/after. Run one fresh real native OpenSpec revision with the unchanged prompt/model to exercise the actual approval continuation; retain all outcomes, including failure, without behavioral retries or a full-matrix claim. This does not change instruction distribution, so the guide's complete distribution-change model matrix is not invoked by this evaluator-only correction.

Run targeted suites, `npm test`, `npm run smoke`, strict working-scope validation/execution, and exact selected FAIL/restored-PASS sensitivity in disposable copies. Then use host-owned sync/archive and independently bind and execute surviving current outcomes. Update `docs/development/agent-evals.md`, ensure root README's source-only/unreleased status remains accurate, and verify affected documentation links/index reachability. No release is authorized.

## Risks / Trade-offs

- Retrospective replay cannot recreate filesystem state at past turns → label original-run replay as an unchanged-installation check; prove upgrade behavior with isolated boundary snapshots.
- A resumed output may include repeated historical events → use the existing request/session continuity and delivered current output without counting old acquisitions as fresh observations. Keep guidance events separate from usage-only scoring.
- A package replacement between boundaries can invalidate a symlink without changing a version → compare the selected canonical installation and exact topic bytes, not version alone.
- Losing valid context cannot be inferred from prose → reset at explicit fresh-session/context boundaries; do not infer context continuity merely from equivalent final artifacts.
- A non-gating observation could accidentally enter aggregate success or failure diagnostics → assert native verdict, serialized observation and no failure-interview consequence through the real evaluator path; retain real failed-outcome controls.

## Migration Plan

Apply only after the host's separate apply authorization. No historical result migration is needed or allowed. Replace native acquisition call sites with the shared session rule, add observations, reconcile exact evidence and documentation, and complete the repository's sync/archive checks. If verification fails, correct or roll back only this change's in-scope edits; preserve unrelated user work and every original/replay/model artifact.
