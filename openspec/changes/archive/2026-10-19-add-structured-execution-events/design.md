# Design

## Context

See [proposal.md](./proposal.md) for motivation and the relationship to the earlier SDK-only change. Current observations:

- The independent SDKs return the actual observation or an error; they have no diagnostic observer. TypeScript already clones driver inputs; Go also snapshots mismatch values and preserves cleanup context values.
- TypeScript's direct runner invokes the SDK in `src/worker.ts`, sending one result per target through `src/process.ts`. The Go runner generates its bridge and reads a private JSON report in `src/index.ts`; application stdout is separate. Neither currently transports execution events.
- `TargetResult`, core `EvidenceResult` and `ScenarioResult` currently contain status/diagnostic rather than events. The planner discards native name/source before execution. The executor already deduplicates runner/target pairs and fans results out to citing evidence.
- Both standalone bank demos currently print Given/When/Expect manually. Their six static suites remain canonical and their formats discover scenarios without loading drivers. Neither bank currently has a message codec.

## Goals / Non-Goals

**Goals:** One final optional SDK channel, one portable target-event contract, evidence-local core reporting and demonstrable standalone/CLI behavior. Keep exact verification and all seven earlier explanation/codec outcomes.

**Non-Goals:** SDK dependencies on core, core interpretation of scenario data, a tracing/logging framework, another scenario grammar, streaming incomplete worker reports, or claims of historical wire compatibility. Previously agreed workflow strengthening and TypeScript cancellation-cleanup alignment remain separate outstanding work, not cancelled by this change.

## Decisions

### 1. Use a small shared wire shape, not SDK fields in core

Export an `ExecutionEvent` union from `focused-spec/runner` and the root public API:

```ts
type ObservationEvent =
  | { readonly kind: 'observation'; readonly name: string; readonly value: JsonValue; readonly text?: never }
  | { readonly kind: 'observation'; readonly name: string; readonly text: string; readonly value?: never }

type ExecutionEvent =
  | ObservationEvent
  | { readonly kind: 'explanation'; readonly message: string; readonly data?: JsonValue }
  | { readonly kind: 'truncated'; readonly message: string }
```

Names and messages are nonblank. Exactly one of `value` and `text` is present on an observation, including a present JSON `null`. Unknown kinds, illegal field combinations, nonfinite values and invalid supplied arrays are malformed reports, not absent diagnostics. A truncation record is terminal and unique. Do not add a generic arbitrary-object escape hatch.

Add `events?: readonly ExecutionEvent[]` to `TargetResult` and `EvidenceResult`. Missing means the runner did not provide events; do not synthesize an empty stream for a legacy runner. Keep status, diagnostic and Runner API 1. No SDK type import or Given/When/Expect fields enter core. Both SDKs expose structurally equivalent public event types independently: the TypeScript SDK stays dependency-free and the Go SDK stays standard-library-only. Direct runners type-check/adapt their SDK records at their existing boundary.

Alternative rejected: putting `given`, `when`, `expect` and `actual` directly in `ScenarioResult` prevents non-SDK runners from using the report and loses attribution when a scenario has multiple evidence targets.

### 2. Emit SDK observations and domain explanations through one observer

TypeScript extends existing verification options with `onEvent?: (event: ExecutionEvent) => void`; `DriverContext` gains `explain(message: string, data?: JsonValue): void`. Do not add the earlier unimplemented `onExplain` API or an alias. Go keeps `VerifySpecification` unchanged and adds `WithEvents(ctx context.Context, sink func(ExecutionEvent)) context.Context` and `Explain(ctx context.Context, message string, data any)`, where nil omits structured data. Use an unexported context key. Nil sink disables capture.

After declaration/driver/cancellation preconditions pass, emit snapshots named `Given`, `When`, `Expect` before calling preparation. These are declared inputs, not a claim that the action ran. Emit `Actual` only after the action returned successfully and its value passed the SDK's existing data validation, before equality comparison and cleanup. Preserve real explanation ordering through preparation, action and cleanup. On a mismatch, Actual remains visible. An action error, aborted action, invalid actual value or crash must not acquire an invented zero/default Actual. Existing lifecycle, returned actual, error aggregation and typed equality remain authoritative.

Without an observer, do not allocate an event list or normalize/copy diagnostic values. The disabled explanation function performs no diagnostic work. Observers are synchronous and execution-local. A throwing TypeScript observer or panicking Go observer follows the existing exception/panic and cleanup contract; do not swallow it or claim observer-failure transparency. A deliberately shared observer owns its synchronization.

Snapshot each enabled observation and explanation payload independently. Never give an observer references to a declaration, driver input, verification expectation or another event. Driver/cleanup mutation cannot revise an earlier snapshot; an observer can mutate its own payload but not the actual comparison or other records. Do not freeze caller-owned declarations or introduce a general immutable-data abstraction.

### 3. Preserve the Go data contract rather than using lossy JSON coercion

TypeScript already validates JSON-compatible scenario data; snapshot without calling user getters or serialization hooks. Go supports a wider data-only graph, including complex numbers, non-string-keyed maps and integers beyond JavaScript's exact integer range. Event serialization must not narrow that contract.

For Go observations and explanation data, use a small reflection-based diagnostic representation over already validated data: emit a normalized portable JSON value only when it is faithfully representable. Respect applicable exported field JSON names without running user methods. Unsafe integers, complex values, byte slices whose default JSON encoding would obscure the actual sequence, maps that cannot retain their keys, and other nonfaithful representations use explicit `text` for observations. For explanation `data`, carry that fallback as a JSON string. Render fallback deterministically without invoking `Stringer`, `GoStringer` or marshal hooks; do not serialize arbitrary values by `json.Marshal` and decode numbers through `float64`.

This is diagnostic representation, not a consumer wire codec. The separate bank codecs described below must still be exercised independently. Add one boundary assertion proving Go exact verification still works with a large integer/complex value and produces a transportable textual observation.

### 4. Bound target retention before worker transport and validate in core

Each direct runner owns an execution-local collector that retains at most 256 records and 65,536 UTF-8 bytes of the JSON-encoded event array, including delimiters and any truncation marker. Reserve space for one marker; once another complete event would exceed count or bytes, retain the longest permitted prefix and append `{kind:'truncated', message:...}`. Never cut a value or string into malformed JSON. Do not attach misleading total counts when omitted events are not counted.

Apply the same retention policy at the public runner response boundary so custom runners cannot bypass retained-result bounds. Validate every supplied record before accepting a report; malformed records must not become acceptable merely because they occur beyond the retained prefix. Existing IPC/process/report size limits remain independent hard transport limits: truncation is not a claim that arbitrary oversized or malformed process output can be recovered.

A correct valid result that exceeds only the event-retention budget keeps its real status and a truncation marker. An invalid runner response follows the existing invocation ERROR path. SDK observers themselves remain caller-owned streams rather than hidden retained logs. Standalone demos use a bounded local collector as well.

### 5. Carry reports through the actual workers, not application stdout

The TypeScript worker allocates a collector per selected target outside its verification try/catch and supplies `onEvent`. Both pass and fail messages include the retained events. Its process receiver must validate/preserve them rather than rebuilding only status/diagnostic.

The Go bridge generated in `packages/runners/scenarios-go/src/index.ts` derives one `WithEvents` context per selected scenario, collects bounded records and adds them to that scenario's private report entry. `reportResults` validates/preserves events while retaining exact selected ID/cardinality checks. No stdout parsing or change to the bridge's private protocol number is needed for this additive entry field. The runner still rejects a missing final report or nonzero bridge exit; partial pre-crash callbacks are not recoverable by this buffered design.

Both runners preserve already collected events on ordinary SDK mismatch/action error. Do not promote a failed target because it contains an explanation, infer Actual from an expectation or weaken cancellation, driver-safety and final-report checks. The Go generated report is currently bounded as a whole; that hard cap still applies even if each target is individually bounded.

### 6. Retain native provenance and evidence-local event attribution

Extend `PlannedScenario` and `ScenarioResult` with native `name` and `source: {path, line}` from the already parsed native scenario. `ScenarioResult.source` is not the runner target location or evidence source. Populate it in the planner and preserve it in the executor; core callers constructing plans migrate together. Export the changed public types from their existing owners, following symbol references during apply.

Keep the executor's existing target-key map. Store validated events alongside target status/diagnostic, then attach that data inside every citing evidence result. A target shared by scenarios runs once; each reference remains attributable. Do not merge streams from separate evidence, order them by worker completion, or rerun a target to obtain display data. Existing selection, AND status aggregation, skip policy, timing and resource scheduling are unchanged.

Proposed result shape, not output observed during planning:

```json
{
  "scope": "current",
  "id": "account.withdraw.insufficient-funds",
  "name": "A withdrawal exceeding the remaining balance is declined",
  "source": {"path": "specifications/account.scenarios.mjs", "line": 45},
  "status": "PASS",
  "evidence": [{
    "reference": "<existing exact evidence reference>",
    "status": "PASS",
    "events": [
      {"kind": "observation", "name": "Given", "value": [{"type":"AccountOpened"},{"type":"MoneyDeposited","cents":5000},{"type":"MoneyWithdrawn","cents":2000}]},
      {"kind": "observation", "name": "When", "value": {"type":"WithdrawMoney","cents":4000}},
      {"kind": "observation", "name": "Expect", "value": [{"type":"WithdrawalDeclined","cents":4000,"reason":"insufficient-funds"}]},
      {"kind": "explanation", "message": "Withdrawal declined", "data": {"requestedCents":4000,"availableCents":3000}},
      {"kind": "observation", "name": "Actual", "value": [{"type":"WithdrawalDeclined","cents":4000,"reason":"insufficient-funds"}]}
    ]
  }]
}
```

### 7. Make detail a rendering choice, with readable failure output

Add run-only `--details` to the existing argument/help machinery. It never changes collection or execution and is accepted together with `--json`. Keep the default passing output compact. Default human output renders events for non-PASS evidence; detailed output renders events for all evidence in their original order. Show native name/source with the scenario identity and indent records beneath their exact evidence reference. Preserve diagnostics and existing summaries.

JSON includes the complete retained event arrays whenever present, irrespective of `--details`. Do not add a second report envelope or hide passing events from agents. Existing validation failures retain `executionStarted:false`; validate/list/show/help do not execute a driver or invent event data. Escape terminal controls in human-rendered event names, strings and structured payloads rather than replaying application control sequences. JSON remains real JSON, not text-rendered details.

### 8. Finish both bank consumers, including the earlier codec obligation

Migrate each bank handler's real withdrawal branches to accept an optional domain callback `(message, data)` and emit requested/available amounts and the actual allow/decline choice before applying the event. Applications must not import either SDK. Drivers forward through their SDK explanation context; update every bank-handler caller without a legacy alias. Tests check decision/amount meaning rather than freezing English wording.

Both standalone demos consume their own SDK event stream to render Given/When/Expect/Actual and explanations. Remove manual reconstruction of those sections and make failure paths show whatever was actually observed. Keep the original six canonical declarations and native IDs unchanged; do not add Markdown or registry companions to code scenarios.

Preserve and implement the earlier consumer-owned codecs/traversal:

- `examples/scenarios/typescript/src/messages.mjs`: `encodeMessage`/`decodeMessage`.
- `examples/scenarios/go/bank/messages.go`: typed command/event encode/decode functions preserving integer cents.
- `examples/scenarios/typescript/serialization.mjs` and `examples/scenarios/go/specifications/serialization.go`: traverse every Given event, one When command and every Expect event in the same canonical suite; compare each roundtrip exactly, protect inputs from mutation and identify scenario/section/index on error.

Reuse those helpers from ordinary serialization checks and demos. Demos show a distinct roundtrip result and exit nonzero for either business or codec failure, without relabelling in-memory business verification. A codec that loses a decline reason must fail serialization and the demo while separately selected business checks still pass. This certifies only the current authored messages/current codec pair, not historic payloads or symmetric wire mistakes.

Alternative rejected: a second SDK-only demonstration would leave the actual user/agent focused execution surfaces unexplained. Moving consumer codecs into SDK/core would confuse diagnostic representation with application wire compatibility.

## Native identity and final evidence plan

These three delta files add 12 native outcomes to scope `add-structured-execution-events`; planning writes ID markers only. During apply, create the following final evidence file and merge the two new scope blocks into their existing capability-owned files. Preserve every existing scope/entry; do not create a second registry owner or use `planned:` for tests that exist. Each two-language list is an AND obligation.

`.focused-spec/evidence/execution-events.yaml`:

```yaml
scopes:
  add-structured-execution-events:
    execution-events.sdk-capture:
      evidence:
        - vitest::test/executable-scenarios.spec.ts::executable scenarios > observes actual verification through one event channel
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > observes actual Go verification through one event channel
    execution-events.snapshots:
      evidence:
        - vitest::test/executable-scenarios.spec.ts::executable scenarios > isolates observation snapshots from driver observer and cleanup mutation
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > isolates Go observation snapshots from driver observer and cleanup mutation
    execution-events.portable-go:
      evidence:
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > preserves exact Go verification outside portable JSON values
    execution-events.bank-end-to-end:
      evidence:
        - vitest::test/executable-scenarios.spec.ts::executable scenarios > exposes the real bank execution across standalone detailed and JSON output
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > exposes the real Go bank execution across standalone detailed and JSON output
```

Merge into `.focused-spec/evidence/runner-protocol.yaml`:

```yaml
scopes:
  add-structured-execution-events:
    runner.events.optional:
      evidence:
        - vitest::test/integration.spec.ts::project-local TypeScript runners > preserves event-capable and legacy runner results together
    runner.events.invalid:
      evidence:
        - vitest::test/integration.spec.ts::project-local TypeScript runners > rejects malformed execution events without claiming pass
    runner.events.bounded:
      evidence:
        - vitest::test/integration.spec.ts::project-local TypeScript runners > bounds valid target events with an explicit truncation marker
    runner.events.failed-target:
      evidence:
        - vitest::test/executable-scenarios.spec.ts::executable scenarios > retains direct runner events when bank verification fails
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > retains direct Go runner events when bank verification fails
```

Merge into `.focused-spec/evidence/scenario-execution.yaml`:

```yaml
scopes:
  add-structured-execution-events:
    execution.events.attribution:
      evidence:
        - vitest::test/integration.spec.ts::project-local TypeScript runners > attributes shared and independent target events without rerunning evidence
    execution.result.native-context:
      evidence:
        - vitest::test/cli.spec.ts::focused-spec CLI > preserves native run context independently of target provenance
    execution.events.presentation:
      evidence:
        - vitest::test/cli.spec.ts::focused-spec CLI > renders compact detailed and JSON events from the same execution contract
    execution.events.preflight:
      evidence:
        - vitest::test/cli.spec.ts::focused-spec CLI > does not execute unresolved evidence when details are requested
```

The seven older IDs and their exact final references remain those in the earlier [design evidence plan](../add-scenario-explanations-and-codec-checks/design.md#4-keep-exact-native-identity-and-evidence-in-the-established-owner). Apply creates its two planned evidence files, exercises all references in scope `add-scenario-explanations-and-codec-checks` and completes its existing checklist alongside this one. The only implementation-design cutover is replacing its unshipped text-only callback design with this common channel; no earlier outcome or language AND member is removed. Reuse the prior SDK-only and isolation checks where they already own the observable contract rather than adding duplicate tests.

## Affected paths

Existing product files:

- `packages/core/src/runner-api.ts`, `packages/core/src/index.ts`, `packages/core/src/model.ts`, `packages/core/src/runner-client.ts`, `packages/core/src/planner.ts`, `packages/core/src/executor.ts`, `packages/core/src/cli.ts`.
- `packages/sdk/typescript/src/index.ts`, `packages/sdk/go/scenarios.go`.
- `packages/runners/scenarios-typescript/src/worker.ts`, `packages/runners/scenarios-typescript/src/process.ts`, `packages/runners/scenarios-go/src/index.ts`.
- `examples/scenarios/typescript/src/account.mjs`, `examples/scenarios/typescript/specifications/account.driver.mjs`, `examples/scenarios/typescript/demo.mjs`, `examples/scenarios/typescript/test/account.node.mjs`.
- `examples/scenarios/go/bank/account.go`, `examples/scenarios/go/specifications/account.driver.go`, `examples/scenarios/go/cmd/demo/main.go`, `examples/scenarios/go/specifications/account_test.go`.
- `test/integration.spec.ts`, `test/cli.spec.ts`, `test/executable-scenarios.spec.ts`, `test/go-executable-scenarios.spec.ts`; existing typed plan/result consumers identified through references migrate in the same cutover.
- `.focused-spec/evidence/runner-protocol.yaml`, `.focused-spec/evidence/scenario-execution.yaml`, `openspec/changes/add-scenario-explanations-and-codec-checks/tasks.md`, and this change's `tasks.md` during completion.

New implementation files are the four bank codec/traversal files and `.focused-spec/evidence/execution-events.yaml`, `.focused-spec/evidence/scenario-explanations.yaml`, `.focused-spec/evidence/scenario-message-roundtrip.yaml`. A small package-local representation/collection helper is permissible only if needed by the listed owner; no new package or cross-package private import is introduced.

Owning public pages to update during apply: `docs/reference/runner-api.md`, `docs/reference/cli.md`, `docs/guides/runners.md`, `docs/guides/configuration.md`, `docs/development/workflow.md`, `docs/README.md`, `packages/sdk/typescript/README.md`, `packages/sdk/go/README.md`. Reference existing indexes and link the new behavioral delta without moving pages. Generated runner READMEs and package assets come from the normal build, not hand edits. No dependencies, lockfiles, format implementations, canonical bank declarations or configuration migration are required.

## Verification

Planning: `openspec validate add-structured-execution-events --strict`; check all artifact/link paths, 12 unique native IDs and complete planned evidence coverage. Do not claim that planning executes nonexistent evidence or that unenrolled native markers certify behavior.

Apply:

1. Execute the four affected Vitest files narrowly, both SDK-only consumers, and standalone bank tests/demos. Verify SDK event isolation/snapshots, Go nonportable data, malformed records, retention count and byte boundaries, shared-target attribution, native provenance, display modes and failed preflight.
2. Resolve and execute both completed change scopes with the project-local CLI, using `validate --scope <scope> --strict` and `run --scope <scope>`. Keep all seven earlier outcomes and every language AND member concrete.
3. Exercise both actual bank consumers with compact output, `run --details`, `run --json`, and `run --details --json`. Select `account.withdraw.insufficient-funds` and observe requested 4000/available 3000, actual decline reason and native source. Run the complete six-scenario suites afterward. Confirm a deliberate wrong application observation fails while retaining its events.
4. In disposable consumers, prove each new/changed evidence assertion is sensitive: suppress an SDK event or explanation, alias a snapshot, remove event transport on failure, accept an invalid record, disable a retention boundary, cross-route target events, substitute target provenance, or hide passing JSON detail. Each relevant selected assertion must execute and fail; restore and observe PASS. A missing selector, timeout or runner ERROR is not evidence sensitivity.
5. Preserve the earlier codec probes: omit a canonical traversal leg, mutate a message input, then drop `reason` in the application codec. The relevant serialization check/demo fails while separately selected business verification still passes. Restore all probes.
6. Run `npm test`, `go -C packages/sdk/go test ./...`, `npm --prefix examples/scenarios/typescript test`, `npm --prefix examples/scenarios/typescript start`, `go -C examples/scenarios/go test ./...`, `go -C examples/scenarios/go run ./cmd/demo`, and both focused bank roots. Validate documentation links/reachability and record actual runtime/tool versions and limitations. Do not rerun unrelated agent evals or claim unsupported runtime certification.

## Risks / Trade-offs

- Application observations may contain secrets → capture has an explicit standalone observer and documented focused-run semantics; no automatic redaction or safe-to-publish claim. Human output escapes terminal control sequences; JSON stays lossless within the portable representation and retention bounds.
- Independent SDK/core declarations can drift → runner boundary type checking and packed external-consumer checks protect actual decoded events; no runtime dependency couples the SDKs to core.
- Go diagnostic formatting can accidentally invoke methods or lose precision → use validated reflection and explicit textual fallback; keep typed equality and application codecs separate.
- Per-target caps do not bound a multi-target report to less than its existing transport limit → preserve the hard transport failure rather than pretending truncation recovers arbitrary reports.
- Buffered events are unavailable after a process dies before reporting → keep existing ERROR behavior and state that limitation instead of inventing partial evidence or adding a streaming protocol.

## Migration Plan

Implement the additive shared types and SDK observer, then both worker transports, native metadata and renderer, then migrate both bank consumers directly to the final channel and implement the retained codec work. Reconcile all selected typed callers and final evidence before running complete scopes. Refresh owning documentation and generated assets via the normal build. Do not ship an interim `onExplain` API, add compatibility aliases or archive either change before its behaviors/evidence pass. Roll back only this change's coordinated edits, preserving unrelated user work. OpenSpec sync/archive is a later authorized host operation.
