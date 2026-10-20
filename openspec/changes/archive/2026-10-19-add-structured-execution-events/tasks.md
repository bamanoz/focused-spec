# Tasks

Implement the [design](./design.md) and its exact final evidence plan. Preserve all seven outcomes in the earlier [SDK explanation/codec change](../add-scenario-explanations-and-codec-checks/tasks.md); use the final event API rather than shipping an intermediate `onExplain` API. No implementation is marked complete by this proposal.

## 1. Shared runner report contract

- [x] 1.1 Add the public observation/explanation/truncation event union and optional target/evidence events in `packages/core/src/runner-api.ts`, `packages/core/src/model.ts` and `packages/core/src/index.ts`; migrate typed consumers found through symbol references and verify the existing build/typechecks and legacy target reports still work without an SDK dependency.
- [x] 1.2 Validate event shapes and enforce the 256-record/65,536-byte retained array policy in `packages/core/src/runner-client.ts`, preserving prefix order, a terminal truncation marker and real status; implement the exact `runner.events.optional`, `runner.events.invalid` and `runner.events.bounded` assertions from the design in `test/integration.spec.ts` and observe valid/legacy coexistence, malformed-report ERROR and bounded valid PASS.
- [x] 1.3 Document the schema, omission semantics, malformed-response behavior and retention/transport distinction in `docs/reference/runner-api.md`; verify its examples against the accepted public report and keep the existing reference index links valid.

## 2. Independent SDK execution observers

- [x] 2.1 Add TypeScript `onEvent` and context `explain`, emitting isolated Given/When/Expect and valid Actual snapshots in `packages/sdk/typescript/src/index.ts` without changing return/error/equality contracts or allocating diagnostic snapshots when disabled; implement the exact TypeScript `execution-events.sdk-capture` and `execution-events.snapshots` assertions in `test/executable-scenarios.spec.ts` and observe mismatch Actual plus mutation isolation.
- [x] 2.2 Add Go `WithEvents`/`Explain`, typed public events and faithful portable/text diagnostic representation in `packages/sdk/go/scenarios.go`; implement the exact Go capture/snapshot/portable-value assertions in `test/go-executable-scenarios.spec.ts`, verify large-integer/complex-value execution without precision loss or method hooks, and run `go -C packages/sdk/go test ./...`.
- [x] 2.3 Implement all four earlier explanation outcomes through the new channel using their unchanged IDs and exact two-language references from the earlier design: actual application decisions, concurrent isolation, failure retention and SDK-only execution with capture disabled; verify both packed independent consumers work without core, without unsolicited output and with existing cleanup/error behavior.
- [x] 2.4 Document the final observer API, event ordering, payload ownership, disabled behavior, synchronous observer failures and Go representation limits in `packages/sdk/typescript/README.md` and `packages/sdk/go/README.md`; verify examples against the standalone SDK consumers and ensure no interim alias or core dependency is introduced.

## 3. Direct runner transport

- [x] 3.1 Collect bounded events per target in `packages/runners/scenarios-typescript/src/worker.ts` and preserve them through `packages/runners/scenarios-typescript/src/process.ts` on both pass and fail; implement the exact TypeScript `runner.events.failed-target` assertion and observe a genuinely wrong bank result fail with its explanation and actual observation retained.
- [x] 3.2 Add per-scenario collection and event-bearing private report entries to the generated Go bridge and report decoder in `packages/runners/scenarios-go/src/index.ts`; implement the exact Go failure-retention assertion, verify retained events on mismatch/action error, and keep missing-report, cancellation and escaped-driver checks passing.
- [x] 3.3 Document event support and buffered-report/crash limitations for both direct runners in `docs/guides/runners.md`; verify a real event-bearing report from each installed runner without parsing application stdout or weakening existing output limits.

## 4. Core attribution and CLI presentation

- [x] 4.1 Preserve native name/source through `PlannedScenario`, the planner and executor into `ScenarioResult`, and retain each target's events under each exact citing evidence; implement the design's exact attribution assertion in `test/integration.spec.ts` and native-context assertion in `test/cli.spec.ts`, observing one shared execution, independent streams and native rather than target provenance.
- [x] 4.2 Add run-only `--details` and safe human event rendering in `packages/core/src/cli.ts`, keeping compact failure detail and full JSON events independent of the flag; implement the exact presentation and preflight assertions in `test/cli.spec.ts` and observe equivalent status/selection, passing JSON detail, escaped terminal controls and no execution on unresolved evidence.
- [x] 4.3 Update `docs/reference/cli.md` with native run metadata, evidence-local JSON, compact/detailed semantics and combined `--details --json`; verify the documented commands on a real event-capable consumer and ensure help/validate/list/show remain non-executing.

## 5. Both real bank demonstrations and consumer codecs

- [x] 5.1 Migrate both real bank withdrawal handlers and every caller to an optional domain explanation callback, forwarding through the SDK contexts without an application-to-SDK dependency; verify actual requested/available amounts and branch choice using the earlier application-decision evidence rather than recomputed driver rules or fixed English wording.
- [x] 5.2 Replace manual Given/When/Expect/Actual printing in both existing demos with bounded SDK-event rendering, including available observations on failure; implement the exact two-language `execution-events.bank-end-to-end` evidence and observe standalone, detailed CLI and JSON output for `account.withdraw.insufficient-funds` with requested 4000, available 3000 and the real decline reason. Keep all six declarations/IDs unchanged.
- [x] 5.3 Implement the earlier TypeScript bank codec/traversal in `examples/scenarios/typescript/src/messages.mjs` and `examples/scenarios/typescript/serialization.mjs`, and typed Go equivalents in `examples/scenarios/go/bank/messages.go` and `examples/scenarios/go/specifications/serialization.go`; reuse the canonical suites and verify every Given, When and Expect message roundtrips exactly without mutation or business-driver execution.
- [x] 5.4 Integrate those helpers into both ordinary example checks and demos with a separate roundtrip result/nonzero failure policy; implement the earlier three codec outcomes and exact two-language evidence, then observe a disposable codec dropping `reason` fail serialization/demo while separately selected original business verification still passes.
- [x] 5.5 Update `docs/guides/configuration.md` and `docs/development/workflow.md` with both event-driven bank surfaces, independent serialization checks and actual example commands; verify the documented standalone/focused commands and state current-pair, not historical-codec, guarantees.

## 6. Final native/evidence integration

- [x] 6.1 After the exact assertions exist, create `.focused-spec/evidence/execution-events.yaml` and merge the design's final new scope blocks into `.focused-spec/evidence/runner-protocol.yaml` and `.focused-spec/evidence/scenario-execution.yaml`; verify all 12 new IDs have their exact concrete references with every language AND member and existing scopes unchanged.
- [x] 6.2 Create the earlier `.focused-spec/evidence/scenario-explanations.yaml` and `.focused-spec/evidence/scenario-message-roundtrip.yaml` with its unchanged seven IDs and final references; verify no previous outcome, exact selector, canonical scenario or evidence member disappeared in the event-API cutover.
- [x] 6.3 Update `docs/README.md` to link the owning public contracts and all three new deltas alongside the earlier explanation/roundtrip deltas; validate all touched Markdown links/anchors and index reachability without creating duplicate procedure pages or hand-editing generated package documentation.

## 7. End-to-end verification and completion

- [x] 7.1 Run the affected four Vitest files, `npm test`, `go -C packages/sdk/go test ./...` and both standalone bank test/demo commands; verify real observed event output, exact statuses, independent codec results and packed SDK/plugin execution, recording actual tool versions and any limitations.
- [x] 7.2 With the same project-local CLI that served accepted guidance, strictly validate and execute both `add-structured-execution-events` and `add-scenario-explanations-and-codec-checks` scopes; observe every concrete reference PASS rather than relying on structural OpenSpec validation or unrelated green assertions.
- [x] 7.3 In disposable copies, run each new/changed exact evidence PASS, regress its protected product behavior, observe that selected behavioral assertion fail, restore and observe PASS: cover snapshots/emission/isolation, event transport/failure retention, invalid/capped records, attribution/provenance/presentation/preflight and all retained codec probes. Do not count missing targets, skips, timeouts or unrelated runner errors as sensitivity.
- [x] 7.4 Exercise both real bank roots in compact, detailed, JSON and combined modes, first selecting the insufficient-funds scenario and then all six; verify no additional target execution for display, actual application events and correct failure detail after a controlled wrong observation.
- [x] 7.5 Complete the earlier change checklist only when its seven outcomes and evidence pass through this final API, then complete this checklist and report changed files, exact observed commands/results and remaining separate workflow/cancellation work. Preserve unrelated workspace changes and do not silently sync/archive either change.

## Workflow follow-up

- After implementation review and authorization, let OpenSpec own sync/archive and preserve explicit surviving scope-local evidence through that operation.
- Workflow-strengthening and TypeScript cancellation-cleanup obligations remain separate outstanding work; completing these event and codec outcomes does not mark them complete.
