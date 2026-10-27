# Design

## Context

See [proposal.md](./proposal.md) for motivation. Existing `python-executable-scenarios` and `dotnet-executable-scenarios` own SDK behavior and six bank outcomes each. Their current bank requirements promise framework tests and demos without focused configuration; the deltas make configuration optional rather than mandatory and add direct execution.

The reference architecture is the Go pair: a format-owned public `/catalog` parser shared by the runner, direct Format API 2 enrollment, exact JSON-tuple selectors, and Runner API 1 results. The Python suite currently calls `define_suite(*Scenario(...))`; its driver is duplicated in the pytest wrapper and demo. C# declares `AccountScenarios.Suite` and a typed `Driver` property in the same class. Core already carries generic events and needs no language dispatch.

This is planning only. No configuration, registry, application source, tests, SDKs, or published packages change until apply.

## Goals / Non-Goals

**Goals:** Preserve one native declaration and native comparison; keep discovery inert; make both languages usable from installed packages; keep independent native usage intact.

**Non-Goals:** General pytest/xUnit/NUnit/MSTest discovery, arbitrary computed scenario catalogs, a sandbox for trusted application code, parallel runner partitioning, release publication, or changing core/plugin protocol versions. These exclusions do not remove either language's format, direct runner, bank integration, or distribution work.

## Decisions

### 1. Four optional packages, no language branch in core

Create `@focused-spec/format-scenarios-python`, `@focused-spec/runner-scenarios-python`, `@focused-spec/format-scenarios-dotnet`, and `@focused-spec/runner-scenarios-dotnet`. Formats implement API 2; runners implement API 1 and depend on their format's exact workspace version. Each format exports `/catalog`: `readCatalog`, `readDriver`, `encodeSelector`, `decodeSelector`, `CatalogError`, and catalog types. The runner reuses that parser instead of introducing a second grammar.

The catalog contains suite export identity, driver binding, scenario IDs/names/source lines, and language-specific type/namespace metadata as strings. It does not transport live functions or convert Given/When/Expect into a cross-language equality model. Core and native SDKs do not depend on these plugins. Default serial execution omits `partition`.

A generic framework runner was rejected: wrapping each scenario in pytest or xUnit does not provide direct native discovery, duplicates routing, and makes test frameworks mandatory for this path.

### 2. Add only optional inert driver metadata to the existing SDKs

Python adds `DriverBinding(path, export)` and optional `driver: DriverBinding | None` on `Suite`; `define_suite(*scenarios, driver=None)` accepts a keyword-only binding. Existing positional scenario calls and explicit-driver verification remain valid. `path` is relative to the suite source, `export` names one top-level driver value. Neither the constructor nor verification imports/resolves that metadata.

C# adds `ScenarioDriverBinding(string Path, string Export)` and an optional driver binding constructor argument/property on `ScenarioSuite<TGiven,TWhen,TExpect>`. Existing construction remains valid. `Export` identifies a fully qualified public static field or parameterless property returning `ScenarioDriver<...>`; `Path` names its source relative to the suite. Existing generic execution stays unchanged. Binding validation is structural; project containment belongs to the optional CLI.

The bank's Python driver moves to `specifications/account_driver.py` as `DRIVER`; pytest and demo import it. Its suite uses `driver=DriverBinding("account_driver.py", "DRIVER")`. The .NET suite binds `AccountScenarios.cs` / `ScenarioBank.Bank.AccountScenarios.Driver`, preserving its existing typed driver and wrapper callers. Same-source bindings are allowed; reading a declaration is not executing its getter.

Sidecar registries or config copies of suite-to-driver relationships were rejected: bindings belong with the native suite and should be reusable across consumers and layouts.

### 3. Python discovery uses the standard-library AST, never imports

The distributed `dist/python/catalog.py` helper runs under Python 3.11+ with isolation enabled, from a temporary directory. It consumes the supplied source via bounded JSON stdin and uses `ast.parse`; it does not import the SDK, suite, driver, site hooks, or application. Python bytecode writing is disabled. Consumer command prefixes are not used for this static helper: the configured command must directly invoke Python, so inspection cannot run an arbitrary environment manager's setup hooks.

Document one top-level suite assignment with imports from `focused_spec_scenarios` (including aliases), positional or named `Scenario(id, name, given, when, expect)` calls, and explicit literal `DriverBinding`. Supported data: None, booleans, strings, finite numbers, unary negative numbers, literal lists/tuples and dictionaries with string keys. Reject duplicate fields/keys/IDs, absent fields, unsupported imports/declarations, calls other than these declarative forms, comprehensions, splats, references to computed values, decorators, or dynamically assembled catalogs. Imports are parsed but never executed. Driver AST lookup checks one top-level named value declaration without evaluating its initializer; arbitrary application code in the driver module remains allowed at run time.

The helper reports declaration lines and metadata only. It does not JSON-roundtrip Python tuple/list values into runtime declarations. Run imports the actual suite, validates it again with the SDK, selects exact IDs, and calls `verify_specification_async`, which also supports synchronous operations.

### 4. C# discovery uses a shipped Roslyn syntax helper, not MSBuild

Build a framework-dependent .NET 9 parser helper with a pinned `Microsoft.CodeAnalysis.CSharp` dependency. Package the helper, `.deps.json`, `.runtimeconfig.json`, parser assemblies and required license notices under the format's `dist/dotnet/`. It runs with the consumer-installed .NET host; runtime roll-forward supports newer installed .NET runtimes. No helper restore, compilation, NuGet access, project evaluation, source generator, or assembly loading occurs during inspection. Build-time helper restore is a maintainer prerequisite, not a hidden consumer inspection step.

Use syntax trees only. The supported C# file has one public static suite field inside a named non-generic public static class and namespace, with a literal `ScenarioSuite<...>` initializer, inline scenarios, and literal driver binding. Accept target-typed or explicit `new`, collection/array initializers, typed data-object construction and object initializers with recursively supported literals, null, booleans and negative numbers. Types may be qualified/generic; imports and aliases remain inert syntax. Other members, including the existing driver property, are not evaluated. Reject computed IDs/names, method-call data, collection factories, spreads, dynamic catalogs, duplicate identities/fields, and conditional directives in suite or driver binding sources. An object constructor is syntax during discovery and trusted application code only during execution.

Replace the bank's `Array.Empty<AccountEvent>()` with `[]`, preserving its empty typed collection. Driver resolution parses its declared source and verifies a unique public static field/property and expected fully qualified owner, without invoking the getter. Syntactic resolution is not a promise that a consumer project will compile; build failures at run time remain failures.

A regex parser and runtime reflection for discovery were rejected: the former misses C# syntax boundaries; the latter executes initializers. Invoking `dotnet build` to obtain a catalog would execute MSBuild logic even before assertions and is therefore excluded.

### 5. Explicit configuration and exact opaque selectors

Final Python bank configuration at `examples/scenarios/python/.focused-spec/config.yaml`:

```yaml
version: 5
specifications:
  formats:
    scenarios-python:
      package: '@focused-spec/format-scenarios-python'
      options: { runner: scenarios-python, command: python3 }
  documents:
    - { match: 'specifications/*_scenarios.py', scope: current, format: scenarios-python }
runners:
  scenarios-python:
    package: '@focused-spec/runner-scenarios-python'
    timeoutMs: 120000
    options: { command: python3 }
```

Use a project virtualenv with the native SDK installed for this example; its `bin` directory is on PATH for both standalone and focused commands. Python format options are closed `{ runner, command? }`, with `command` defaulting to `python3`; runner options are closed `{ command? }` with the same default. `command` is one Python executable or absolute executable path, not a shell string. The helper's isolated parse does not need the SDK installed; the runtime worker uses the selected interpreter's installed SDK. This deliberately avoids a second environment-management API: uv/pip/venv acquisition happens before execution, using the documented project dependency workflow.

Final .NET bank configuration at `examples/scenarios/dotnet/.focused-spec/config.yaml`:

```yaml
version: 5
specifications:
  formats:
    scenarios-dotnet:
      package: '@focused-spec/format-scenarios-dotnet'
      options: { runner: scenarios-dotnet }
  documents:
    - { match: 'Bank/AccountScenarios.cs', scope: current, format: scenarios-dotnet }
runners:
  scenarios-dotnet:
    package: '@focused-spec/runner-scenarios-dotnet'
    timeoutMs: 300000
    options: { project: 'Bank/ScenarioBank.Bank.csproj', framework: net9.0 }
```

.NET format options are closed `{ runner, command? }`; runner options are closed `{ project, framework, command? }`. `command` defaults to `dotnet`; `project` is one contained project path and `framework` is an explicit supported .NET 9+ target framework, avoiding ambiguous project/target selection and discovery-time MSBuild evaluation. Custom command values directly invoke the corresponding host, not an argument string. Unknown fields and invalid values fail.

Selectors are JSON.stringify of `[projectRelativeSuitePath, exactScenarioId]`, for example:

- `scenarios-python::["specifications/account_scenarios.py","account.withdraw.entire-balance"]`
- `scenarios-dotnet::["Bank/AccountScenarios.cs","account.withdraw.entire-balance"]`

Only the first `::` belongs to core. No title filters, regex selectors, or line-based identities. Paths have forward slashes and reject absolute paths, empty components, traversal, backslashes and controls; canonical containment additionally rejects symlink escapes. Driver-relative paths may use `..` only if canonical resolution stays inside the project. IDs retain case, Unicode, punctuation, quotes and separators exactly. Re-resolve source and binding before run; compare the runtime inventory against the static catalog and fail on divergence rather than execute a guessed replacement.

### 6. Run the actual native values; serialize only evidence

Python workers import the selected native suite and driver in a runner-owned process, then verify only selected IDs through the SDK. The consumer root is available for its documented imports; module and package initializers may execute at run time. No unselected driver preparation/action is called.

.NET execution generates a temporary bridge project referencing the explicitly configured consumer project and framework, builds it through the installed SDK, and loads the actual exported suite and driver. At run time only, a narrow reflection bridge closes a generic invocation over their SDK types and calls `ScenarioExecutor.VerifyAsync`. All Given/When/Expect/Actual values retain their CLR types through comparison; neither JSON nor a Node implementation decides equality. Build/restore and initializers are trusted consumer execution and may have their normal side effects. Do not reuse stale build success as a selected result. Private bridge outputs are temporary; normal consumer build outputs may remain.

Both paths recheck exact identity and runtime suite validity. SDK cleanup, combined failures, cancellation and optional event observation remain authoritative. Independent native tests/demos still call the same SDK API and same driver, without loading CLI integration.

Transport results over a dedicated worker-owned report channel/file, never parse application stdout as results. Use exact request/response target identity and cardinality; reject extra, duplicate, malformed or missing results. An exited worker or successful build is not evidence. The worker report is not a sandbox against malicious trusted consumer code.

Map SDK Given/When/Expect/Actual/explanation observations to portable events with producer-specific JSON-compatible data. Preserve explicit type labels for Python tuples, large integers or CLR projections where JSON loses meaning; values unsupported by the documented event projector produce an explicit bounded diagnostic, not a fake observation or fabricated pass. The comparison has already happened natively and never reads this display projection. Apply existing retention limits: 256 records and 65,536 UTF-8 bytes with a terminal truncation marker; diagnostics are limited to 8,000 characters. Bound helper/worker inputs, stdout/stderr and result transport to 4,000,000 bytes each.

On abort request cooperative cancellation (Python cancellation callback/task cancellation, .NET cancellation token), await ordinary cleanup after successful preparation, and terminate the owned process tree after a documented 500 ms grace if still running. Enforce configured host timeouts for build and execution, clean temporary reports/bridges in finally paths, and explicitly disclaim cleanup guarantees after forced termination. Validate platform process-tree handling rather than assuming POSIX signals work on Windows.

### 7. Packaged distribution and documentation are part of the cutover

Add the four npm workspaces and root dev dependencies/lockfile; keep native SDK installation separate. Build core and native helper assets before formats and each format before its runner. Extend `scripts/stage-assets.mjs` for LICENSE and generated runner guides. No release version bump or publication is authorized here; new manifests use the repository's coordinated source version and a future release chooses an unused version for the entire suite.

Update the explicit inventories and commands from thirteen to seventeen npm packages in `docs/development/releasing.md` and `docs/development/workflow.md`. The .NET format's prepared tarball must contain the parser assemblies, not rely on the author's NuGet cache. Include helper package license notices and prove parser startup offline. Keep clean-output build and `npm pack --ignore-scripts` conventions.

Update `README.md`, `docs/README.md`, `docs/guides/README.md`, `docs/guides/configuration.md`, `docs/guides/runners.md`, both SDK READMEs and both format READMEs. Extend `guidance/integration.md` to advertise both real optional pairs and remove the obsolete absence warning only once the implementation exists. `guidance/formats.md` and `guidance/runners.md` retain generic API ownership; `guidance/workflow.md` remains a thin router. Do not copy parser grammar into generic guidance.

### 8. Exact evidence and verification planned for apply

No executable registry entries or inline EVIDENCE are created during proposal. Native markers in the deltas identify planned outcomes, not claims of passing evidence. During apply, add independent scope occurrences under `add-python-dotnet-native-plugins` in the existing capability-owned files `.focused-spec/evidence/python-executable-scenarios.yaml` and `.focused-spec/evidence/dotnet-executable-scenarios.yaml`. Preserve every existing `current` reference and AND member; add the new bank evidence as an additional occurrence/reference without weakening the existing bank proof.

Use two new consumer-level suites: `test/python-native-plugins.spec.ts` with describe `python native plugins`, and `test/dotnet-native-plugins.spec.ts` with describe `dotnet native plugins`. For each language prefix `L` (`python` or `dotnet`), the final reference for a title below is `vitest::test/L-native-plugins.spec.ts::L native plugins > <title>`:

| Native IDs (replace L with the language) | Exact proposed test title |
| --- | --- |
| `L-sdk.driver-binding` | preserves standalone suites and optional driver bindings |
| `L-format.binding-required`, `L-format.dynamic-rejected` | rejects unsupported or unbound declarations |
| `L-format.static-discovery` | inspects suites without executing consumer code |
| `L-format.direct-enrollment`, `L-distribution.plugins` | runs distributed plugins without checkout access |
| `L-runner.exact-selection` | executes only the exact selected native scenario |
| `L-runner.native-comparison` | preserves native comparison across transport |
| `L-runner.stale-target` | rejects a selected identity changed after resolution |
| `L-runner.containment` | rejects source and binding escapes |
| `L-runner.transport` | rejects missing malformed and forged reports |
| `L-runner.cancellation` | bounds cancellation and terminates owned workers |
| `L-runner.events` | retains application explanations and mismatch observations |
| `L-example.cli-bank` | runs canonical bank through CLI and detects restored regression |

The modified `python-example.bank` retains `vitest::test/python-scenarios.spec.ts::python executable scenarios > runs the maintained pytest bank consumer and demo`; the modified `dotnet-example.bank` retains `vitest::test/dotnet-scenarios.spec.ts::dotnet executable scenarios > runs the maintained xUnit bank consumer`. Add each language's `runs canonical bank through CLI and detects restored regression` reference as an AND member for its modified bank occurrence, because its requirement now also promises optional CLI execution. On sync, reconcile the same explicit bindings into `current` without dropping the old native verification.

These tests defend plausible failures, not source text or package plumbing. Native metadata tests execute a real trivial driver; discovery checks sentinel nonexecution and exact public catalog results; selection proves an unrelated failing action is untouched; transport proves a zero exit cannot pass without evidence. Packed consumers install wheel/nupkg and npm tarballs without checkout references, request installed plugin-docs, then use installed CLI list/show/validate/run. .NET parser discovery is repeated with external networking unavailable after installation; runtime dependencies are restored explicitly beforehand.

For bank sensitivity, copy the real consumers into disposable roots and preserve originals byte-for-byte. Change only `elif cents > self._balance:` to `elif cents >= self._balance:` in `examples/scenarios/python/src/account.py`, and `command.Cents > _balance` to `command.Cents >= _balance` in `examples/scenarios/dotnet/Bank/Account.cs`. Assert `account.withdraw.entire-balance` fails under pytest/xUnit and CLI against unchanged scenarios, restore exact source in finally, then repeat both paths and all six outcomes. Demos and explanations must still exercise the same driver, not generate Expect from Actual.

Run narrow new suites, then `npm test`, both native SDK suites, both demos, and the real bank CLI list/show/syntax-only/strict/selected/all/details/JSON paths. Extend `scripts/release-specs.mjs` with both CLI bank invocations; arrange the Python venv containing the native SDK as an explicit disposable prerequisite rather than assume global installation. Run `npm run release:check` once integration is complete; unavailable runtimes or dependencies block certification rather than skip a language. Validate/run this change's exact scope, synchronize through OpenSpec, then validate/run final surviving scopes per repository workflow during authorized completion. Proposal validation alone is not runtime proof.

## Risks / Trade-offs

- Roslyn helper increases the optional .NET tarball size and needs a maintainer build restore → pin the dependency, ship complete runtime assemblies/notices, and prove offline inspection. Core and native SDK remain unaffected.
- Static syntax support is intentionally narrower than standalone SDK expressiveness → document accepted declarations, report unsupported syntax at source, and never evaluate it to improve discovery.
- C# syntax does not prove project inclusion or type compatibility → strict validation promises static identity/binding only; run builds the explicitly selected project and rejects missing runtime exports or inventory drift.
- Importing/constructing trusted consumer suites may execute unselected initializers → make the run-time trust boundary explicit; the guarantee is no unselected scenario preparation/action, not a source sandbox.
- Python interpreter environments differ → command selects one real interpreter; installation instructions establish its SDK environment before invoking the CLI. No implicit package downloads.
- Cancellation cannot guarantee resource cleanup after hard termination → cooperate first, force termination within the bound, report nonpass and document the limit.

## Migration Plan

1. Introduce optional metadata without breaking existing SDK calls; retain existing native-only checks.
2. Implement and distribute each format/runner pair against the declared contracts; prove clean consumer operation before updating capability guidance.
3. Share the Python bank driver, annotate both native suites, add optional bank configurations, and update release/spec evidence and user docs together. Do not rename any of the six bank scenario IDs.
4. Validate complete behavior and the regression/restoration cycle. Synchronize and archive only through the authorized OpenSpec lifecycle after execution passes.
5. Rollback before publication removes optional registrations/packages and metadata from CLI consumers; ordinary SDK calls remain valid. Publishing or changing immutable release tags requires separate authorization.
