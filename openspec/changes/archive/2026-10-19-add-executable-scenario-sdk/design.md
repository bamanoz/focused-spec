# Design

## Context

See proposal.md for motivation. The independent bank demo already separates application code, literal scenario objects, a driver, a comparison helper and node:test registration. Its helper has no cleanup contract or stable scenario IDs. Its test framework has no existing official focused-spec runner.

Current Format API 2 accepts normalized items with `name`, positive `line`, `markerId` and direct `evidence`; no registry is required. Runner API 1 already provides exact resolution, selected execution, cancellation and bounded plugin hosts. No core API change is necessary. Existing package builds run from each workspace directory through `scripts/build-package.mjs`; asset staging and consumer tests have explicit package inventories that must be extended.

This design is required because the change crosses workspace organization, independent SDK packaging, static code parsing, driver execution and the repository-owned bank consumer in `examples/scenarios/`.

## Goals / Non-Goals

**Goals:** Keep the SDK useful with ordinary tests and without focused-spec; preserve one native behavioral source; make focused-spec integration explicit; separate language SDK source trees from integration plugins; make discovery non-executing and execution exact.

**Non-Goals:** Interpret arbitrary test code or natural-language requirements; replace existing test frameworks; implement other languages now; add retries, database/browser clients, a generalized matcher language, a new CLI, or a required registry. The existing bank example is not being converted into a production banking service.

## Decisions

### 1. Role-based workspaces and three independently installed JS/TS packages

All publishable packages live under `packages/`, grouped by role. SDK independence is a dependency boundary, not a separate top-level directory. Use singular `sdk` for the shared SDK home and language directories below it:

```text
packages/
  core/
  sdk/
    typescript/
  formats/
    markdown/
    gherkin/
    inline/
    registry/
    scenarios-typescript/
  runners/
    vitest/
    pytest/
    go/
    scenarios-typescript/
examples/
  scenarios/
```

The new independently installed packages are:

- `packages/sdk/typescript/`: `@focused-spec/scenarios-typescript`, compiled ESM and declarations, no runtime dependencies or focused-spec peer dependency.
- `packages/formats/scenarios-typescript/`: `@focused-spec/format-scenarios-typescript`, Format API 2, public `./catalog` subpath for static suite reading shared with the runner.
- `packages/runners/scenarios-typescript/`: `@focused-spec/runner-scenarios-typescript`, Runner API 1, depends on the SDK and the format's public catalog rather than another package's private source.

These packages implement JavaScript/TypeScript support only. A future language has its own `packages/sdk/<language>/`, `packages/formats/scenarios-<language>/` and `packages/runners/scenarios-<language>/` implementations; shared scenario principles and focused-spec plugin APIs do not imply a cross-language parser or execution runtime. Create no empty future-language directories.

Move existing packages in one clean cutover:

| Existing source | Final source | npm name (unchanged) |
| --- | --- | --- |
| `packages/core/` | `packages/core/` | `focused-spec` |
| `packages/format-markdown/` | `packages/formats/markdown/` | `@focused-spec/format-markdown` |
| `packages/format-gherkin/` | `packages/formats/gherkin/` | `@focused-spec/format-gherkin` |
| `packages/format-inline/` | `packages/formats/inline/` | `@focused-spec/format-inline` |
| `packages/format-registry/` | `packages/formats/registry/` | `@focused-spec/format-registry` |
| `packages/runner-vitest/` | `packages/runners/vitest/` | `@focused-spec/runner-vitest` |
| `packages/runner-pytest/` | `packages/runners/pytest/` | `@focused-spec/runner-pytest` |
| `packages/runner-go/` | `packages/runners/go/` | `@focused-spec/runner-go` |

Root workspaces explicitly include `packages/core`, `packages/sdk/*`, `packages/formats/*` and `packages/runners/*`; do not retain `packages/*`, which would select grouping directories rather than their child packages. Preserve existing npm names, exports, peer contracts, runner IDs and opaque selectors. Update package manifests (`repository.directory` and build commands), package TypeScript config ancestry, root workspace/lockfile links, shared build/staging inventories, source/test/eval imports and packing paths, and authored documentation/example references to their final paths. Remove obsolete source directories and stale links; do not add aliases, re-exports or compatibility copies. Historical archived artifacts and immutable eval results are records, not active callers to rewrite.

Follow the existing coordinated source version without bumping or publishing anything. Build core and SDK before the new format, then the runner; preserve existing build dependencies and extend staging to include the SDK license and public contracts. SDK is not a core dependency. Validate the cutover through existing typechecks, tests, tarball consumers and CLI examples, not assertions that merely pin source-directory spelling.

The TypeScript AST parser dependency belongs only to the optional format package. Using the existing TypeScript compiler package as a parser avoids inventing a JS/TS parser; it does make optional integration heavier than the dependency-free SDK. Do not hide that distinction in installation documentation.

Alternatives rejected: a separate top-level `sdk/`, the plural `packages/sdks/`, a special nested scenario-plugin hierarchy beside flat legacy packages, and language-neutral package names that imply an unimplemented universal integration. The approved organization uses `packages/sdk/`, `packages/formats/` and `packages/runners/` consistently.

### 2. An explicit suite declaration, not arbitrary source interpretation

A supported native source is `.js`, `.mjs`, `.ts` or `.mts` ESM with this shape:

```ts
import { defineSuite } from '@focused-spec/scenarios-typescript'

export default defineSuite({
  driver: './account.driver.mjs',
  scenarios: [{
    id: 'account.withdraw.entire-balance',
    name: 'Withdrawing the entire balance is allowed',
    given: [
      { type: 'AccountOpened' },
      { type: 'MoneyDeposited', cents: 5000 },
    ],
    when: { type: 'WithdrawMoney', cents: 5000 },
    expect: [{ type: 'MoneyWithdrawn', cents: 5000 }],
  }],
})
```

Suite keys are exactly `driver` and `scenarios`; scenario keys are exactly `id`, `name`, `given`, `when`, `expect`. IDs retain exact case and value, permit Unicode/spaces/separators, and have no control characters. Names must be nonblank. Given/When/Expect support null, booleans, strings, finite numbers, arrays and plain string-keyed data objects. Duplicate properties and duplicate suite IDs fail. Reject prototype-setting `__proto__` properties in the native object-literal grammar, rather than interpreting them differently from JavaScript; SDK runtime validation must reject non-plain objects and inspect own data properties without invoking getters.

For native discovery, accept only the SDK import (including an imported alias), type-only imports, and one default `defineSuite` call with a literal object. Permit type arguments and erasable `as const`/`satisfies` wrappers. Permit quoted/property-name keys and negative numeric literals. Reject spreads, shorthand/computed properties, holes, functions, imported data, runtime expressions, extra executable statements, dynamic suite generation and unsupported imports with real source diagnostics. Keep those restrictions explicit in the format's public contract. SDK standalone usage may build values programmatically, but those values are not statically discoverable native files.

Use TypeScript AST locations for each scenario object's actual start line. Never guess a line or use the suite's export line for every scenario. The catalog parses the supplied source text and validates the same data contract as the SDK, without importing the source module.

### 3. A small framework-independent SDK

Public API: `defineSuite`, `verifySpecification`, `Scenario`, `Suite`, `Driver`, and the SDK-owned JSON-compatible value type. Generic types preserve the relationship between Given/When/Expect and driver inputs/output; importing SDK types never imports focused-spec.

`defineSuite` validates and returns the explicit suite. `verifySpecification(driver, scenario, { signal? })` returns the actual result or throws. A driver exports:

- `given(given, context)` -> subject, synchronously or asynchronously;
- `when(subject, when, context)` -> JSON-compatible actual result;
- optional `cleanup(subject, context)` -> completion.

Context contains the scenario ID and optional AbortSignal, not framework internals. Before passing inputs to a driver, validate the declaration and clone its JSON data once so driver mutation cannot corrupt the shared declaration or expected result. Compare actual with the original expectation using Node strict deep comparison; report expected/actual differences with scenario identity. Reject invalid actual data, not silently serialize it into something else.

Run cleanup once after preparation succeeds, including action and comparison failures. Await cleanup; when both primary execution and cleanup fail, preserve both in an AggregateError. If preparation fails, the driver is responsible for its partially acquired resources. Cooperative cancellation is passed to the driver; abort before execution prevents starting it. Hard process termination cannot guarantee driver cleanup and must never be documented as doing so.

Alternative rejected: require an assertion callback for every scenario. Exact comparison of observed data to Expect is the useful common behavior, not merely renamed arrange/act/assert plumbing.

### 4. Static format enrollment, no behavioral duplicate

The format requires the closed option `{ runner: '<registered runner ID>' }`. It emits each scenario's native ID, name, line, marker ID and one derived execution reference. The reference's suffix is `JSON.stringify([projectRelativeSuitePath, exactScenarioId])`; this tuple encoding avoids ambiguous splitting when an opaque ID or path contains `::`, quotes or Unicode. The prefix is the explicitly configured runner ID.

The format's public catalog supplies parsing, diagnostics and selector encode/decode helpers. The runner uses that public catalog rather than maintaining a second grammar. Source claims and registry composition are unnecessary for this direct-enrollment format.

Example consumer configuration (planning example only):

```yaml
version: 5
specifications:
  formats:
    scenarios:
      package: '@focused-spec/format-scenarios-typescript'
      options: { runner: scenarios }
  documents:
    - { match: 'specifications/**/*.scenarios.mjs', scope: current, format: scenarios }
runners:
  scenarios:
    package: '@focused-spec/runner-scenarios-typescript'
```

The generated reference for the sample is `scenarios::["specifications/account.scenarios.mjs","account.withdraw.entire-balance"]`. Core still owns selected scope and uniqueness. Do not add framework inference or plugin catalogs to portable agent guidance.

### 5. Direct runner execution through the same SDK

The runner has no configurable retries, concurrency policy, cwd reinterpretation or selector fallback. Options are null or an empty object. Resolve validates each JSON tuple, safe suite path, static catalog, unique scenario ID, and driver existence/canonical project containment. It does not import either suite or driver and does not execute application assertions. Resolution returns the exact selector, deterministic target ID and real suite source location.

Run rereads the requested suites and verifies each selected identity still exists. It executes the parsed literal scenario values through `verifySpecification` and the suite's default-exported driver. It does not import a scenario module, nor run ordinary node:test registration. A renamed or removed selected scenario is a nonpassing error, never a replacement match by name or line. Selected scenarios run sequentially; no `partition` is needed and the default exclusive grouping applies. No unselected scenario is prepared or executed.

Because a package runner host starts compiled JS and Node 22.16.0 needs an explicit flag for TS imports, execute drivers in a runner-owned child with the required type-stripping startup flag on runtimes that need it. Keep that worker inside the runner package, send only selected validated JSON inputs, and return per-target outcomes over IPC so application stdout cannot forge results. Forward cancellation, bound transport, terminate the owned child on abort/timeout, preserve real failures and do not report unresolved or unexecuted work as pass. Reuse repository subprocess/error conventions without importing private core modules. No consumer flag is required. Arbitrary non-erasable TS is unsupported, consistent with existing plugin contracts.

Driver modules are trusted project code, not sandboxed code. Check canonical project containment before import, including symlink escape. A driver receives fresh per-scenario preparation; module globals are not promised process isolation between scenarios. Describe this limit rather than implying a database transaction or process sandbox.

### 6. Consumer examples and public documentation

The standalone bank demo already lives in `examples/scenarios/`; its former `/Users/mak/src/scenario-bank-demo` directory was relocated, not retained as a second consumer. Migrate its existing package metadata, real account, driver, suite, ordinary node:test registration in `test/account.node.mjs` and readable `demo.mjs` to the SDK and optional plugins. Use a default-exported driver and one default-exported suite. Preserve the six bank outcomes, standalone entrypoints and intervening user edits. Remove `examples/scenarios/lib/specification.mjs` only after all callers use the SDK. Do not create a second demo location or introduce OpenSpec or a Markdown behavioral companion.

Package contracts live in `packages/sdk/typescript/README.md`, `packages/formats/scenarios-typescript/README.md` and the runner's staged public guide. Update existing documentation owners: `docs/concepts/README.md`, `docs/guides/install.md`, `docs/guides/configuration.md`, `docs/guides/runners.md`, `docs/guides/README.md`, `docs/development/workflow.md`, `docs/development/releasing.md`, `docs/README.md` and root README's examples entry as needed. Migrate active package-path links to the role-based layout without duplicating their owning pages. Avoid copying plugin syntax into workflow guidance; the existing `plugin-docs` mechanism exposes the authoritative package documents.

### 7. Exact evidence and proof during apply

All new native outcomes remain in the capability delta. During apply, add their scope-local registrations to `.focused-spec/evidence/executable-scenarios.yaml`, retaining the domain-owned source pattern. Use runner `vitest` and `test/executable-scenarios.spec.ts` with suite `executable scenarios`. The ID-to-test mapping is:

| Native ID suffix (prefix as written below) | Exact test name under `executable scenarios` |
| --- | --- |
| `executable-sdk.independent` | `runs a packed SDK scenario without focused-spec` |
| `executable-sdk.invalid-declaration` | `rejects invalid declarations before execution` |
| `executable-sdk.actual-comparison` | `fails when real application events differ` |
| `executable-sdk.input-isolation` | `preserves expectations when a driver mutates inputs` |
| `executable-sdk.cleanup` | `cleans up failures and preserves both errors` |
| `executable-format.static-discovery` | `discovers source locations without importing drivers` |
| `executable-format.dynamic-rejected` | `rejects dynamic declarations without executing them` |
| `executable-format.direct-enrollment` | `runs native code scenarios without a registry` |
| `executable-runner.exact-selection` | `executes only the selected opaque identity` |
| `executable-runner.missing-target` | `rejects a target removed after resolution` |
| `executable-runner.driver-boundary` | `rejects driver escapes without importing them` |
| `executable-runner.typescript-driver` | `executes an erasable TypeScript driver without consumer flags` |
| `executable-distribution.consumer` | `runs packed plugins outside the source checkout` |
| `executable-example.bank` | `detects the bank withdrawal boundary regression` |

For each row, final evidence is `vitest::test/executable-scenarios.spec.ts::executable scenarios > <exact test name>` in scope `add-executable-scenario-sdk` (and later independently in `current` only through an authorized host sync). No registry is written during proposal. These tests defend uncertain boundary behavior rather than symbol forwarding or source-text spelling. Keep ordinary successful SDK execution as a consumer smoke path, and test negative cases where a plausible false pass matters.

Run `npm test`, the existing `npm run smoke`, the repository bank example's `npm test`/`npm start` and focused paths, plus packed clean-consumer checks. Run the new capability's strict focused validation and evidence during apply. Introduce a controlled `>` to `>=` withdrawal regression in a disposable bank copy; observe a behavioral assertion failure in both execution modes, restore it and observe PASS again. Verify actual Node 22.16.0 TypeScript-driver behavior, not just the current runtime. SDK-only installation must not acquire core or the parser. Existing package consumers must retain their public imports, configuration and selectors after source relocation. Validate documentation links and package docs from tarballs.

## Risks / Trade-offs

- Static discoverability restricts JS/TS authoring -> reject unsupported expressions explicitly; no interpretation fallback or dynamic evaluation. Ordinary SDK users remain free to generate scenarios for their own test runner.
- TypeScript AST parsing increases optional plugin installation size -> keep it out of SDK and core and report package dependencies honestly.
- Package relocation can leave stale build, import, workspace or tarball paths -> migrate all active callers in one cutover and exercise existing packed consumers, typechecks and CLI smoke paths without changing public package names.
- Exact equality is unsuitable for unbounded timestamps or random IDs -> the project driver must make inputs deterministic and expose the deliberately observed result; do not add wildcard matchers or silently omit fields in the SDK.
- Forced timeout can interrupt cleanup -> propagate cooperative cancellation and report termination honestly; never certify cleanup after forced kill.
- Existing master specs include older contracts superseded by completed unarchived changes -> do not rewrite them as incidental cleanup; use current public API and this additive capability.

## Migration Plan

First migrate existing workspace packages to the approved role-based layout while preserving consumer contracts. Then implement the SDK and language-specific plugins, install their tarballs into isolated consumers and migrate the existing `examples/scenarios/` bank demo. Preserve both standalone and optional focused paths. Existing consumers require no public package-name, configuration or selector migration. Publish nothing and do not refresh agent integrations. Any rollback must preserve unrelated user edits; do not recreate the former external demo or leave compatibility source copies. Host sync/archive is a separate explicitly authorized lifecycle action.
