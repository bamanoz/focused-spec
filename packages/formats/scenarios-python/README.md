# @focused-spec/format-scenarios-python

Optional native Python scenario discovery for focused-spec Format API 2. The plugin requires Node.js 22.16.0+ and Python 3.11+. Discovery uses Python's standard-library AST and never imports the consumer suite, driver, SDK, application, or site hooks.

## Installation and registration

Install the npm core, format, and runner packages. Install `focused-spec-scenarios` separately into the Python environment used for execution.

```sh
npm install --save-dev focused-spec @focused-spec/format-scenarios-python @focused-spec/runner-scenarios-python
python -m pip install focused-spec-scenarios
```

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

Format options are exactly `{ runner, command? }`. `runner` is a registered runner ID. `command` defaults to `python3` and names one Python executable or absolute executable path, never a shell command or argument string. Each discovered scenario supplies one exact reference for the configured runner; no registry or Markdown companion is required.

## Supported native grammar

A scenario source imports `Scenario`, `define_suite`, and `DriverBinding` from `focused_spec_scenarios`, optionally with aliases or through a module alias, and assigns one public top-level suite value:

```python
from focused_spec_scenarios import DriverBinding, Scenario, define_suite

ACCOUNT_SCENARIOS = define_suite(
    Scenario(
        id="account.withdraw.entire-balance",
        name="Withdrawing the entire balance is allowed",
        given=[{"type": "AccountOpened"}, {"type": "MoneyDeposited", "cents": 5000}],
        when={"type": "WithdrawMoney", "cents": 5000},
        expect=[{"type": "MoneyWithdrawn", "cents": 5000}],
    ),
    driver=DriverBinding(path="account_driver.py", export="DRIVER"),
)
```

`Scenario` accepts the five fields `id`, `name`, `given`, `when`, and `expect` positionally, by name, or in a nonduplicated mixture. `define_suite` accepts inline scenario calls and exactly one named `driver`. `DriverBinding` accepts literal `path` and `export` values. IDs are exact, nonblank, control-free, and unique; names are nonblank. Scenario lines are the real `Scenario` call lines.

Supported data consists of `None`, booleans, strings, integers, finite floats, unary negative numbers, literal lists, tuples, and dictionaries with unique string keys. Nested values use the same grammar. Discovery rejects missing or duplicate fields, duplicate IDs or keys, splats, unpacking, comprehensions, calls inside data, computed references, dynamically assembled catalogs, functions, decorators, and extra top-level declarations. Such suites remain usable through the standalone SDK but are not statically discoverable.

The driver source may contain ordinary application code. Static lookup only checks that `export` names exactly one top-level assigned value in the parsed driver source. It never evaluates the initializer. Driver paths are relative to the suite source; the runner later verifies canonical project containment.

## Static helper and limits

The distributed `dist/python/catalog.py` helper runs as `<command> -I -B` from a fresh temporary directory. It receives the supplied source over bounded JSON stdin and uses only the Python standard library. Isolated mode excludes user site packages and environment path injection, and bytecode writing is disabled. The helper never rereads or imports consumer modules.

Input, stdout, and stderr are each limited to 4,000,000 bytes. Abort signals terminate the helper process tree after a 500 ms grace. A missing interpreter, unsupported syntax, parse failure, malformed response, process failure, cancellation, or overflow is an explicit diagnostic.

## Selectors and public catalog

References use `<runner>::<JSON tuple>`, where the tuple is `JSON.stringify([projectRelativeSuitePath, exactScenarioId])`:

```text
scenarios-python::["specifications/account_scenarios.py","account.withdraw.entire-balance"]
```

Only core's first `::` separates the runner ID. Suite paths use forward slashes and reject absolute paths, traversal, empty components, backslashes, and control characters. IDs preserve Unicode, punctuation, quotes, slashes, and `::` exactly.

`@focused-spec/format-scenarios-python/catalog` exports `Catalog`, `CatalogSuite`, `CatalogScenario`, `CatalogDriverBinding`, `DriverCatalog`, `CatalogError`, `readCatalog`, `readDriver`, `encodeSelector`, `decodeSelector`, and `validPythonCommand`. Readers accept supplied source plus an optional interpreter command and abort signal; `CatalogError` carries a positive source line. The official runner imports this public API and does not maintain a second grammar.

```ts
readCatalog(path, source, signal?, command?): Promise<Catalog>
readDriver(path, source, exportName, signal?, command?): Promise<DriverCatalog>
encodeSelector(path, exactScenarioId): string
decodeSelector(selector): readonly [string, string]
```

List, show, syntax-only validation, and strict resolution parse inert syntax. Running evidence imports trusted consumer code; read the installed runner contract for runtime containment, result transport, cancellation, and cleanup limits.
