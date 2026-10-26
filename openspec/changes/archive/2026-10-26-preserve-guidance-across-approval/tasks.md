# Tasks

Implementation begins at the separate OpenSpec apply boundary. This planning checklist does not claim any source changes, new behavioral tests, model runs, executable evidence enrollment, sync, archive, or release.

## 1. Acquisition state and regression boundaries

- [x] 1.1 Add `reuses unchanged guidance across a resumed approval dialogue` in `test/evals.spec.ts`; demonstrate the current per-turn gate rejects the valid continuation before changing its implementation. Use temporary installed-package fixtures and completed command/artifact events, not instruction-source assertions.
- [x] 1.2 Inspect references for changed exported evaluator symbols and reuse the existing provenance/response/artifact validators in `evals/judge.ts` to implement the design's session-scoped acquisition state. Record each executed turn against its then-current installation and preserve mandatory failures; do not accept a concatenated late read as initial activation.
- [x] 1.3 Add `invalidates retained guidance without retroactively rejecting an acquired version`, covering changed version, exact content, canonical installation/selection and missing installation, plus a correctly refreshed response. Replace the unconditional-reread test while preserving the existing `agent.guidance.session-refresh` changed-package obligation and every affected selector.
- [x] 1.4 Add `does not repair missing initial acquisition with a later read` and `requires independent acquisition for a fresh execution context`. Retain failed/malformed/truncated/wrong-artifact/provenance negative checks and show fresh publication/regeneration contexts cannot borrow prior activation.

## 2. Native dialogue integration and observations

- [x] 2.1 Apply the shared state at native authoring and OpenSpec publication execution boundaries in `evals/native-pilot.ts`, wrapping only scored authoring executions, never test-user or research calls. Use the existing session/resume contract in `evals/dialogue.ts`; keep authorization, lifecycle, measurements and raw transcripts unchanged.
- [x] 2.2 Persist authoring and lifecycle repeat-read records under native `observations`, thread publication observations back to the result and print them with an `OBSERVATION` prefix. Keep mandatory activation gates and invalidations separate from observations, native aspect judgments, certification, exit status and failure interviews; reuse report observation handling.
- [x] 2.3 Add `keeps missing repeat acquisition outside publication success gates` in `test/native-pilot.spec.ts`, exercising the real evaluator/dialogue path with initial valid acquisition and resumed approval without rereading. Verify the independently judged final binding, execution, restoration/sensitivity and host completion remain successful; retain a real failed-outcome control that still fails despite valid acquisition.
- [x] 2.4 Update `docs/development/agent-evals.md` to document session continuity, actual invalidation, observation granularity and immutable history. Check root README accuracy and source-only/unreleased status; update only behavior/status claims affected by this correction. If the report terminal label changes to include workflow observations, verify that consumer-visible label without source-text assertions or historical rescoring.

## 3. Exact evidence and behavioral proof

- [x] 3.1 Acquire the installed workflow/authoring/verification and selected registry/composed-Markdown/Vitest public contracts; bind all five delta IDs to the exact tests listed in `design.md` under `preserve-guidance-across-approval` in `.focused-spec/evidence/agent-workflow.yaml`. Reconcile renamed existing test selectors in every affected scope without changing unrelated registrations or adding a second evidence owner.
- [x] 3.2 Run the narrow acquisition/native tests, then `node_modules/.bin/vitest run test/evals.spec.ts test/native-pilot.spec.ts test/dialogue.spec.ts test/eval-report.spec.ts` and `npm test` without overlapping builds. Record actual results, including failures and any unavailable prerequisite.
- [x] 3.3 Run `node_modules/.bin/focused-spec validate --root . --scope preserve-guidance-across-approval --strict` and `node_modules/.bin/focused-spec run --root . --scope preserve-guidance-across-approval`. For each new/changed reference, prove selected PASS, intended behavioral assertion FAIL under an isolated implementation regression, exact restoration and selected PASS; do not mutate tests or claim runner/setup errors as sensitivity.
- [x] 3.4 Replay the original `native-openspec-1793017479165-47780b82-8f8e-4714-88ce-102db8929e76.json` lifecycle through the corrected session rule. Save the replay separately, hash the historical result before/after, and demonstrate unchanged approval reuse without changing any saved model score or claiming a new evaluation.
- [x] 3.5 Run one fresh `node --experimental-strip-types evals/native-pilot.ts openspec externcash/gpt-6.1-sol --keep-workspace` with unchanged blind prompts. Retain model/argv/exit/result, actual approval turns, acquisition gates and observations, all native/evidence/lifecycle verdicts and measurements. Retain any failure without behavioral retries; do not claim full-matrix certification from this targeted run.
- [x] 3.6 Execute `npm run smoke` and validate affected documentation links/index reachability. Reconcile measured status with exact evidence; distinguish replay, deterministic regression checks and the fresh model run.

## Workflow follow-up

- After implementation and working evidence pass, load the host-owned sync workflow and publish the delta; independently bind every surviving `current` ID to its exact evidence in the established capability shard. Do not inherit execution from the working scope.
- Run `openspec validate --specs --strict --no-interactive`, strict focused validation and surviving-scope execution, then archive through the host's workflow after its prerequisites pass.
- Validate and execute all discovered scopes after archive, check README/documentation status against observed verification, and report changed files, exact commands, results and limitations. Preserve every prior result and unrelated user change. No release or consumer refresh is authorized.
