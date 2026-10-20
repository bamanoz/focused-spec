# Design

## Context

See [proposal.md](./proposal.md) for motivation. The existing SDKs already own the execution context and exact comparison. TypeScript returns the actual value or throws; Go returns `(actual, error)`. Neither SDK currently collects explanations. Drivers bridge real in-memory bank applications, and both demos already render Given/When/Expect/Actual. No bank codec currently exists.

The existing six literal suites remain canonical. Their formats derive evidence without importing application code. Changing their fields to hold explanations or codec instructions would unnecessarily change both static grammars. Canonical SDK requirements currently live in completed, unarchived changes, so this change adds two capabilities instead of modifying nonexistent main SDK specs.

## Goals / Non-Goals

**Goals:** Keep diagnostics optional and run-local; reuse the actual application decision and the same scenario messages; retain SDK independence, exact equality and ordinary test execution.

**Non-Goals:** A core report schema change, global logger, general message extractor, serialization framework, new scenario fields, automatic historical compatibility certification, or a second bank fixture set. This boundary does not retire the separate previously discussed workflow, run metadata or cancellation-cleanup work.

## Decisions

### 1. Pass explanations through explicit SDK context, not globals

TypeScript adds `onExplain?: (message: string) => void` to the existing verification options and `explain(message: string): void` to `DriverContext`. Existing `scenarioId` and `signal` remain. The execution context exposes a disabled explanation function when no sink is configured; no array or log buffer is allocated by the SDK. The verifier continues returning the actual observation, not a new report object.

Go adds `WithExplanation(ctx context.Context, sink func(string)) context.Context` and `Explain(ctx context.Context, message string)`. An unexported context key keeps the sink local to the derived context. A nil sink disables collection. `VerifySpecification` keeps its signature and passes the derived caller context through the existing lifecycle; existing cleanup context-value preservation also preserves the sink.

Callers create one sink per execution. Demos accumulate their own messages and display them even if verification fails. Separate sinks do not mix, including under concurrent execution; a caller deliberately sharing one sink owns its synchronization. Sinks are synchronous. A throwing TypeScript sink is an ordinary driver failure; a panicking Go sink follows existing panic unwinding. Neither is silently swallowed; existing cleanup/error preservation remains authoritative. An asynchronous sink is not awaited and is outside the callback contract.

Alternatives rejected: a global collector mixes runs; adding explanation fields to scenarios confuses runtime observations with requirements; returning a new report would unnecessarily break consumers; intercepting console output cannot reliably associate decisions with execution.

### 2. Domain code accepts a callback, not an SDK dependency

The bank's command handler accepts an optional text callback. The real allowed/declined withdrawal branches emit the requested amount, available balance and decision before applying the new event. The driver forwards the SDK explanation function: TypeScript through `context.explain`, Go through a closure calling `scenarios.Explain(ctx, message)`.

All account handler callers are migrated together; no legacy alias or duplicate decision logic is introduced. Bank modules do not import the scenario SDK. Tests assert decision/amount semantics and separation, not a frozen English sentence. Preparation and cleanup may also use the SDK context, but the bank example does not invent resource lifecycle work it does not have.

The optional focused runners continue invoking the same verifier without a sink. They still execute the real application and exact assertions. Exposing explanations through runner IPC or core `run` output is not needed for this standalone experiment and is not claimed by it.

### 3. Keep codecs and traversal in the consumer

Add a small bank-owned JSON codec at `examples/scenarios/typescript/src/messages.mjs` and `examples/scenarios/go/bank/messages.go`:

- TypeScript exports `encodeMessage` and `decodeMessage` using the application's JSON representation.
- Go exports typed `EncodeCommand`/`DecodeCommand` and `EncodeEvent`/`DecodeEvent` using the standard library, preserving integer cents without an `any` JSON conversion.

These are new, explicitly illustrative application codecs. No existing production transport or persistence compatibility is implied.

Add `examples/scenarios/typescript/serialization.mjs` and `examples/scenarios/go/specifications/serialization.go` to walk the existing suite directly: each Given event, one When command, each Expect event. Compare each decoded message exactly and annotate errors with scenario ID, Given/When/Expect section and index. Never serialize the suite, metadata, driver, or unrelated SDK values. Protect original message data from codec mutation; the bank's Go message structs are copied by value, and TypeScript passes a cloned message while comparing with the original.

The helper is reused by ordinary serialization checks and demo output, so it is not a test-only replacement serializer. Business verification still uses original in-memory messages. The demos display a distinct roundtrip result and fail overall on either a business or serialization failure; an in-memory PASS is never relabelled because a codec failed.

A codec regression that loses `reason` must fail these checks while the separately selected original business tests still pass. Roundtrip success concerns the current codec pair and authored messages only: historical compatibility needs saved old payloads; symmetrical wire mistakes can also escape a roundtrip.

Alternatives rejected: a generic SDK visitor cannot infer arbitrary Given/When/Expect shapes; a hardcoded list of message samples drifts from the canonical scenarios; checking only whole-suite JSON would validate metadata instead of the application's messages.

### 4. Keep exact native identity and evidence in the established owner

The two deltas use the existing registry plus Markdown format and seven new opaque IDs. Planning writes native ID markers only. Apply creates the following complete final evidence files, after the corresponding assertions exist. Both references on each ID are an AND contract proving both language implementations. Existing evidence files and six bank scenario identities remain unchanged.

`.focused-spec/evidence/scenario-explanations.yaml`:

```yaml
scopes:
  add-scenario-explanations-and-codec-checks:
    scenario-explanations.application-decision:
      evidence:
        - vitest::test/executable-scenarios.spec.ts::executable scenarios > explains the actual bank withdrawal decision
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > explains the actual Go bank withdrawal decision
    scenario-explanations.isolation:
      evidence:
        - vitest::test/executable-scenarios.spec.ts::executable scenarios > isolates explanations across concurrent executions
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > isolates Go explanations across concurrent executions
    scenario-explanations.failure:
      evidence:
        - vitest::test/executable-scenarios.spec.ts::executable scenarios > retains explanations when exact comparison fails
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > retains Go explanations when exact comparison fails
    scenario-explanations.optional:
      evidence:
        - vitest::test/executable-scenarios.spec.ts::executable scenarios > runs a packed SDK scenario without focused-spec
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > executes the Go SDK without Node dependencies
```

`.focused-spec/evidence/scenario-message-roundtrip.yaml`:

```yaml
scopes:
  add-scenario-explanations-and-codec-checks:
    scenario-message-roundtrip.canonical-messages:
      evidence:
        - vitest::test/executable-scenarios.spec.ts::executable scenarios > roundtrips canonical bank messages through the application codec
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > roundtrips canonical Go bank messages through the application codec
    scenario-message-roundtrip.independent:
      evidence:
        - vitest::test/executable-scenarios.spec.ts::executable scenarios > checks serialization without executing or rewriting bank scenarios
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > checks Go serialization without executing or rewriting bank scenarios
    scenario-message-roundtrip.loss-detected:
      evidence:
        - vitest::test/executable-scenarios.spec.ts::executable scenarios > detects a lost decline reason independently of bank behavior
        - vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > detects a lost Go decline reason independently of bank behavior
```

The two existing SDK-only tests gain an explanation-emitting driver without configuring a sink and still verify actual results, errors and no unsolicited output. Other new tests defend plausible diagnostic cross-talk, erased explanations on failure, incomplete message traversal, mutation and undetected field loss. Extend existing consumer fixtures rather than creating another test infrastructure.

## Affected paths

Apply may modify these existing files:

- `packages/sdk/typescript/src/index.ts`
- `packages/sdk/typescript/README.md`
- `packages/sdk/go/scenarios.go`
- `packages/sdk/go/README.md`
- `examples/scenarios/typescript/src/account.mjs`
- `examples/scenarios/typescript/specifications/account.driver.mjs`
- `examples/scenarios/typescript/demo.mjs`
- `examples/scenarios/typescript/test/account.node.mjs`
- `examples/scenarios/go/bank/account.go`
- `examples/scenarios/go/specifications/account.driver.go`
- `examples/scenarios/go/cmd/demo/main.go`
- `examples/scenarios/go/specifications/account_test.go`
- `test/executable-scenarios.spec.ts`
- `test/go-executable-scenarios.spec.ts`
- `docs/guides/configuration.md`
- `docs/README.md`
- `openspec/changes/add-scenario-explanations-and-codec-checks/tasks.md`

Apply may create the four consumer codec/traversal files listed above and the two final evidence files. No dependencies, lockfiles, core code, scenario declarations, format/runner implementations or configuration changes are needed. Existing public pages retain their locations; the documentation map gains links to both new behavioral deltas. Proposal artifacts remain planning-only until apply.

## Verification

1. Narrowly execute both existing consumer test files, then both standalone test commands and demos. Confirm real branch explanations, exact result comparison and independent roundtrip status, including nonzero demo exit on codec failure.
2. Strictly validate and execute the change scope using the project-local CLI. Resolve every evidence selector; do not equate OpenSpec structural validation with executed evidence.
3. In disposable consumers, suppress delivery of explanation callbacks, cross-route a sink, and return an incorrect observation after explaining it. Each corresponding selected assertion must detect the regression. For failure-retention evidence, suppress the explanation on the deliberately failing action and observe the missing-message assertion fail.
4. In disposable copies, omit a Given/When/Expect traversal leg and introduce mutation of a canonical input; the matching exact evidence must fail. Remove `reason` in the actual application codec; observe the ordinary serialization check and demo fail on that field while separately selected in-memory bank tests pass. Restore every probe and rerun exact evidence.
5. Run `npm test`, `go -C packages/sdk/go test ./...`, both standalone examples and focused execution of both bank consumers. Existing static inspection, distribution, identity and withdrawal-boundary checks remain active.
6. Verify links from `docs/README.md` to the owning public pages and new deltas. Do not claim unchanged runners display explanations or certify old message versions.

## Risks / Trade-offs

- Explanations can expose application data → collection is explicitly supplied by the caller; the SDK neither logs nor retains it globally.
- Callbacks can throw/panic or be used concurrently → preserve existing failure/cleanup behavior and document synchronous caller-owned sink discipline.
- Go domain types are broader than JSON → keep the codec check bank-specific; do not change SDK data validation or coerce arbitrary SDK values through JSON.
- The bank originally has no wire boundary → name its new JSON codec as an example and make its field-loss limitation explicit.
- Additional checks can become duplicated fixtures → always traverse the existing suites and share the same consumer helper between ordinary checks and demos.

## Migration Plan

This is an additive SDK API with an internal bank-handler cutover. Implement SDK support, migrate all bank handler callers, add consumer codec checks and behavioral evidence, then update the existing public documentation. No generated package assets are edited manually. Existing standalone signatures, scenario IDs, format grammar and focused selectors remain valid. Revert this change's affected files together if rollback is needed; never reset unrelated workspace changes. Sync/archive remains a subsequent host lifecycle operation after implementation and evidence pass.
