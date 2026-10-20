# @focused-spec/format-scenarios-typescript

Optional JS/TS scenario discovery for focused-spec Format API 2, Node.js 22.16.0+. This package depends on `@focused-spec/scenarios-typescript` and the TypeScript compiler parser. The standalone SDK and core do not acquire this parser. Other languages require their own format and runtime integration.

## Installation and registration

```sh
npm install --save-dev focused-spec @focused-spec/scenarios-typescript @focused-spec/format-scenarios-typescript @focused-spec/runner-scenarios-typescript
```

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

Options are exactly `{ runner: '<registered runner ID>' }`. The runner ID is explicit; it is not inferred from a package or filename. This format directly enrolls each native code scenario with its exact ID and one execution reference, without a registry or Markdown companion. Core still owns scope-local uniqueness and execution.

## Supported native grammar

An ESM `.js`, `.mjs`, `.ts` or `.mts` source imports `defineSuite` from the SDK and default-exports one literal suite:

```js
import { defineSuite } from '@focused-spec/scenarios-typescript'

export default defineSuite({
  driver: './account.driver.mjs',
  scenarios: [{
    id: 'account.withdraw.entire-balance',
    name: 'Withdrawing the entire balance is allowed',
    given: [{ type: 'AccountOpened' }, { type: 'MoneyDeposited', cents: 5000 }],
    when: { type: 'WithdrawMoney', cents: 5000 },
    expect: [{ type: 'MoneyWithdrawn', cents: 5000 }],
  }],
})
```

Suite fields are exactly `driver`, `scenarios`; scenario fields exactly `id`, `name`, `given`, `when`, `expect`. IDs are nonblank, control-free and unique within a suite; exact Unicode, spaces, punctuation and separators are retained. Names are nonblank. JSON data includes null, booleans, strings, finite numbers, arrays and plain data objects.

Accepted: an imported alias for `defineSuite`, type-only imports, type arguments, parenthesized expressions, erasable `as const`/`satisfies` wrappers, explicit quoted/property-name keys and negative numeric literals. No source or driver is imported during discovery. Each scenario's real object-start line is reported, not a guessed heading/export location.

Rejected with source diagnostics: duplicate properties/IDs, prototype-setting `__proto__` properties, spreads, shorthand/computed properties, array holes, functions, imported data, runtime expressions, dynamic generation, additional executable statements and unsupported runtime imports. Do not convert a dynamic source into an empty passing inventory. Programmatic SDK-only suites are valid standalone but not statically discoverable.

## Selectors and public catalog

Derived references are `<configured-runner>::<JSON tuple>`, where the tuple is `JSON.stringify([projectRelativeSuitePath, exactScenarioId])`. Example:

```text
scenarios::["specifications/account.scenarios.mjs","account.withdraw.entire-balance"]
```

Only core's first `::` separates the runner ID; JSON encoding preserves separators/quotes inside IDs and paths. Paths are contained project-relative `.js`, `.mjs`, `.ts` or `.mts` files, with no absolute paths, traversal, empty components, backslashes or controls. The runner checks canonical containment and driver safety before execution.

Public `@focused-spec/format-scenarios-typescript/catalog` exports `readCatalog(path, source)`, `encodeSelector(path, id)`, `decodeSelector(selector)`, `CatalogError` and catalog types. `readCatalog` returns `{ suite, scenarios: [{ scenario, line }] }` or throws `CatalogError` with its actual source line. It shares SDK data validation and never evaluates source. The official runner uses this catalog rather than maintaining a second grammar.

## Verify through the local CLI

```sh
./node_modules/.bin/focused-spec list
./node_modules/.bin/focused-spec show account.withdraw.entire-balance
./node_modules/.bin/focused-spec validate --syntax-only
./node_modules/.bin/focused-spec validate --strict
./node_modules/.bin/focused-spec run --scenario account.withdraw.entire-balance
```

List/show/syntax-only never import the application driver. Strict validation resolves selectors and driver existence/containment without executing the driver. Only run executes selected scenarios through the independently usable SDK. Read the selected runner's installed public guide for execution, cleanup, cancellation and trust limits.
