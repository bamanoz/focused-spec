# Proposal

## Why

The executable bank scenarios prove what happened but do not expose why the real application chose a branch. Their existing Given, When and Expect messages can also detect serialization loss without maintaining another set of example data.

## What Changes

- Add optional execution-local explanation sinks to the independent TypeScript and Go SDKs. Drivers can connect real application decisions to those sinks without a global logger, changing scenario declarations or replacing exact assertions.
- Update both bank applications and demos to emit and display real withdrawal decisions alongside Given, When, Expect and Actual, including when verification fails.
- Add consumer-owned JSON message codecs and separate roundtrip checks over the existing bank scenario messages. The bank currently has no codec: these are explicit example codecs, not claims about an existing production transport.
- Demonstrate that losing `WithdrawalDeclined.reason` fails the roundtrip check even when the ordinary in-memory business scenarios still pass.
- Preserve SDK return values, standalone execution, static format grammars, runner contracts and the six canonical bank scenarios. Update owning SDK documentation and the configuration guide.

## Capabilities

### New Capabilities

- `scenario-explanations`: Optional execution-local explanations originating in application decisions, observable by standalone callers without weakening verification.
- `scenario-message-roundtrip`: Reuse canonical bank scenario messages to check the consumer's codec independently of business execution.

### Modified Capabilities

None. Canonical `scenario-execution` governs core evidence scheduling/results, not SDK callbacks or application codecs. The existing executable SDK contracts remain in the completed, unarchived `add-executable-scenario-sdk` and `add-go-executable-scenarios` changes; this proposal extends rather than rewrites them.

## Impact

- SDK implementation and public documentation: `packages/sdk/typescript/` and `packages/sdk/go/`.
- Applications, drivers, demos and ordinary tests: `examples/scenarios/typescript/` and `examples/scenarios/go/`.
- Behavioral evidence: `test/executable-scenarios.spec.ts`, `test/go-executable-scenarios.spec.ts` and capability-owned files under `.focused-spec/evidence/`, integrated only during apply.
- Documentation ownership: `docs/guides/configuration.md` and `docs/README.md`.
- No new runtime dependencies, core changes, format changes, runner changes, global logging or generalized serializer framework. Roundtrip checks do not establish historical wire compatibility.
- Previously discussed workflow strengthening, `run` name/source enrichment and TypeScript cancellation cleanup remain separate outstanding work; this proposal does not cancel or mark them complete.
