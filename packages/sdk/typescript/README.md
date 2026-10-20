# @focused-spec/scenarios-typescript

Dependency-free JavaScript/TypeScript executable scenarios for Node.js 22.16.0+. No focused-spec, OpenSpec, parser or test framework is required. Optional focused-spec integrations are separate language-specific packages.

## Install and execute

```sh
npm install --save-dev @focused-spec/scenarios-typescript
```

```js
import { defineSuite, verifySpecification } from '@focused-spec/scenarios-typescript'

const suite = defineSuite({
  driver: './account.driver.mjs',
  scenarios: [{
    id: 'account.withdraw.entire-balance',
    name: 'Withdrawing the entire balance is allowed',
    given: { balance: 5000 },
    when: { cents: 5000 },
    expect: { balance: 0 },
  }],
})
const driver = {
  given: value => value,
  when: (account, command) => ({ balance: account.balance - command.cents }),
}
await verifySpecification(driver, suite.scenarios[0])
```

Register each scenario with an ordinary test runner if desired. `defineSuite` does not import the driver; standalone callers pass their actual driver to `verifySpecification`.

## Definitions and types

Public exports: `defineSuite`, `verifySpecification`, `validateScenario`, `validateJson`; types `Scenario<Given, When, Expect>`, `Suite<Given, When, Expect>`, `Driver<Subject, Given, When, Expect>`, `DriverContext`, `VerifyOptions`, `ExecutionEvent`, `ObservationEvent`, `JsonValue`. Generic driver operations and scenario values must agree. `defineSuite` preserves inferred literal types.

A suite has exactly `driver` and `scenarios`. Each scenario has exactly `id`, `name`, `given`, `when`, `expect`. IDs contain non-whitespace and no control characters; exact case, Unicode, spaces and separators are preserved. Names are nonblank. Suite IDs are unique. Values must be JSON-compatible: null, booleans, strings, finite numbers, dense arrays and plain string-keyed data objects. Missing/extra fields, cycles, array holes/extra keys, accessors, symbols, nonenumerable data and non-plain objects fail. Validation never invokes property getters.

Standalone declarations may be programmatically constructed. Static discovery by the optional format accepts only its documented literal grammar; not every valid runtime suite is statically discoverable.

## Driver execution and cleanup

`verifySpecification(driver, scenario, { signal?, onEvent? })` returns the actual result after exact Node strict deep comparison with Expect, or throws. Mismatches identify the scenario and retain expected/actual differences. Invalid actual data fails rather than being silently serialized. Given and When are cloned together once before driver preparation; driver mutation cannot change the reusable declaration or expectation.

Driver operations may be synchronous or asynchronous:

- `given(given, context)` prepares a subject.
- `when(subject, when, context)` returns the actual JSON-compatible observation.
- Optional `cleanup(subject, context)` releases resources after successful preparation, whether execution/comparison passes or fails.

Preparation/action context contains `scenarioId`, optional caller `signal`, and `explain(message, data?)`. Cleanup is awaited exactly once after successful preparation with the same identity/explanation channel but **without the caller's signal**, including cancellation after cleanup starts. This deliberately changes cleanup cancellation behavior; release must tolerate the already-optional signal. A cleanup needing a deadline owns its own bound; the SDK does not race or time out release. A cleanup failure fails execution; simultaneous primary/cleanup failures remain in `AggregateError.errors`, primary first. Failed preparation owns partial-resource cleanup. Pre-abort prevents preparation; cancellation is checked before/after action, so even a matching result after abort cannot pass or emit Actual. No new post-cleanup cancellation checkpoint is added. Hard termination cannot guarantee cleanup.

The driver determines which real application boundary to exercise and which deterministic observation to return. The SDK adds no database/browser abstraction, retries, wildcard matchers or process isolation.

## Optional execution events

Pass `onEvent` to observe one execution without changing its return value or exact comparison:

```js
const events = []
await verifySpecification(driver, scenario, { onEvent: event => events.push(event) })
```

The observer receives independent snapshots in execution order:

- `observation` events named `Given`, `When`, and `Expect` before preparation starts.
- `explanation` events wherever the driver calls `context.explain(message, data?)` during preparation, action, or cleanup.
- An `observation` named `Actual` only after the action returns valid JSON-compatible data, before comparison and cleanup. A mismatch therefore retains Actual; an action error or invalid result does not invent one.

An observation contains either `value: JsonValue` or `text: string`; TypeScript scenario observations use `value`. An explanation has a nonblank `message` and optional JSON-compatible `data`. `truncated` is reserved for bounded collectors outside the SDK. Each observation and explanation payload is cloned separately before delivery. Driver and cleanup mutation cannot rewrite an earlier event, and observer mutation cannot rewrite a declaration, comparison value, or another event.

Collection is disabled when `onEvent` is absent: `context.explain` is a no-op, the SDK allocates no event snapshots or retained event list, and it writes nothing to stdout or stderr. Observers are synchronous and execution-local. A throwing observer follows the ordinary execution and cleanup failure path; it is not swallowed. Separate executions need separate observers, while callers deliberately sharing an observer own its synchronization and retention policy. The SDK does not depend on `focused-spec` or its runner types.

## Optional focused-spec integration

Install `focused-spec`, `@focused-spec/format-scenarios-typescript` and `@focused-spec/runner-scenarios-typescript` only when discovery/evidence execution is wanted. Acquire each plugin's public contract with the project-local CLI's `plugin-docs` command. The SDK never depends on them. The bank example and commands are documented in the [configuration guide](https://github.com/bamanoz/focused-spec/blob/main/docs/guides/configuration.md#standalone-executable-bank-specifications).
