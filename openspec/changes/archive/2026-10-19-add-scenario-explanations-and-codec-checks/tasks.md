# Tasks

Completed through the [structured execution events design](../add-structured-execution-events/design.md): its final `onEvent` / `WithEvents` channel replaces the unshipped `onExplain` / `WithExplanation` names below. All seven outcomes and both-language evidence remain intact; no intermediate aliases were added.

## 1. Optional explanations in the independent SDKs

- [x] 1.1 Add the TypeScript execution-local `onExplain` option and `DriverContext.explain` in `packages/sdk/typescript/src/index.ts`, preserving actual return values and existing error/cleanup behavior; verify the concurrent-isolation and failed-comparison assertions named in design.md through `test/executable-scenarios.spec.ts`.
- [x] 1.2 Add Go `WithExplanation` and `Explain` in `packages/sdk/go/scenarios.go` without changing `VerifySpecification` or driver signatures; verify independent concurrent contexts, retained explanations on mismatch and existing cleanup semantics through `test/go-executable-scenarios.spec.ts` and `go -C packages/sdk/go test ./...`.
- [x] 1.3 Extend the existing packed SDK-only assertions in both consumer test files with explanation-emitting drivers and no sink; verify real results, expected errors and no unsolicited output without core or plugin dependencies.
- [x] 1.4 Update `packages/sdk/typescript/README.md` and `packages/sdk/go/README.md` with the optional synchronous sink API, run-local usage and callback failure/concurrency boundaries; execute the documented standalone snippets against the built or copied SDKs.

## 2. Real bank decisions and reused message codecs

- [x] 2.1 Add optional application callbacks in both bank account handlers and migrate their drivers to forward the SDK explanation context, without importing the SDK into domain code; verify the application-decision assertions named in design.md and both real demos show the decline decision and its actual amounts, including retained explanations on failure.
- [x] 2.2 Create `examples/scenarios/typescript/src/messages.mjs` and `examples/scenarios/go/bank/messages.go` as consumer-owned JSON codecs; add the two serialization traversal helpers specified in design.md and verify the canonical-message assertions check every Given event, When command and Expect event with exact comparisons and contextual errors.
- [x] 2.3 Integrate the serialization helpers into `examples/scenarios/typescript/test/account.node.mjs`, `examples/scenarios/go/specifications/account_test.go` and both demos without changing either scenario suite; verify serialization does not invoke account actions or mutate declarations, demos report business and codec outcomes separately, and either failure exits nonzero.
- [x] 2.4 Add the exact codec-loss assertions named in design.md to the existing two consumer test files; in disposable copies remove `reason` in each application codec and observe serialization and demo failure while separately selected original business verification still passes, then restore and rerun.
- [x] 2.5 Update `docs/guides/configuration.md` with standalone explanation and roundtrip commands, the new illustrative codecs and historical-compatibility limitations; update `docs/README.md` links to both behavioral deltas and verify links and the documented commands.

## 3. Evidence and end-to-end verification

- [x] 3.1 Create `.focused-spec/evidence/scenario-explanations.yaml` and `.focused-spec/evidence/scenario-message-roundtrip.yaml` with exactly the concrete two-language AND mappings recorded in design.md, preserving existing owners and scopes; verify all seven native IDs with `./node_modules/.bin/focused-spec validate --scope add-scenario-explanations-and-codec-checks --strict` and execute that scope with the same local CLI.
- [x] 3.2 Prove changed evidence sensitivity in disposable workspaces as specified in design.md: callback delivery and routing, mismatch explanation retention, message traversal, input mutation and codec field loss; observe selected behavioral failures, restore product state and rerun the same evidence successfully.
- [x] 3.3 Run `npm test`, `go -C packages/sdk/go test ./...`, `npm --prefix examples/scenarios/typescript test`, `npm --prefix examples/scenarios/typescript start`, `go -C examples/scenarios/go test ./...` and `go -C examples/scenarios/go run ./cmd/demo`; run strict validation and actual focused execution for both bank consumers and the completed change scope, and report observed output and any limitations without claiming explanation output from unchanged focused runners.

## Workflow follow-up

- After implementation and evidence pass, follow the repository's authorized sync/archive workflow, preserve all seven IDs and both-language evidence in their surviving scope, and validate and execute the final enrollment.
- Workflow strengthening and TypeScript cancellation-cleanup alignment remain outstanding. The later [structured execution events change](../add-structured-execution-events/design.md#6-retain-native-provenance-and-evidence-local-event-attribution) completes `run` name/source enrichment; these completed explanation/codec tasks do not cancel the other obligations.
