# @focused-spec/format-gherkin

Structural Gherkin parser for focused-spec Format API 2, using the Cucumber Gherkin parser. Requires Node.js 22.16.0+ and an installed `focused-spec` CLI. It exposes Scenario/Scenario Outline items and identities; it does not read evidence, implement a catalog binder, or execute Cucumber steps. No parser-specific options are required.

## Registry composition

Install the selected parser, evidence adapter, and runner explicitly:

```sh
npm install --save-dev focused-spec @focused-spec/format-gherkin @focused-spec/format-registry @focused-spec/runner-go
```

`.focused-spec/config.yaml`:

```yaml
version: 5
specifications:
  formats:
    gherkin:
      package: '@focused-spec/format-registry'
      options:
        parser: { package: '@focused-spec/format-gherkin' }
  documents:
    - { match: 'features/**/*.feature', scope: current, format: gherkin }
runners:
  go: { package: '@focused-spec/runner-go' }
```

`features/auth.feature`:

```gherkin
Feature: Account authentication
  @focused.auth-login
  Scenario: Blocked account submits valid credentials
    When a blocked account submits valid credentials
    Then authentication is rejected
```

`.focused-spec/evidence.yaml`:

```yaml
scopes:
  current:
    auth-login:
      evidence:
        - planned:go::./auth::TestBlockedAccount
```

The registry adapter owns that evidence file and its default location. Read its installed `README.md` for explicit source lists, sharding, source safety, and external bindings. Read the selected runner's installed `README.md` for selectors. The planned reference above permits non-strict validation while the exact test is absent; it cannot execute. Once the real test exists, remove `planned:`, validate strictly, and run the evidence.

## Focused tags

Attach exactly one `@focused.<id>` tag to one `Scenario` or `Scenario Outline`, including scenarios nested under a `Rule`. Focused tags do not bind a `Feature`, `Rule`, `Background`, or `Examples`; invalid placement, multiple focused tags, and malformed Gherkin fail validation.

The suffix is an exact opaque focused ID containing non-whitespace and no control characters, subject to Gherkin's tag syntax. Preserve case and spelling; do not normalize it to a dotted/lowercase convention. An outline is one native item, not an automatic evidence enrollment for each examples row. A marked item must receive exactly one evidence enrollment from a configured binder.

## Native IDs for external binding

A scenario's own non-focused tags expose native IDs without the leading `@`: for example, `@RULE-7` exposes `RULE-7`. These are local declarations, not inherited feature/rule tags or generated names. To bind an unmarked generated item, configure registry `source.path` and `source.nativeId` against one such stable native ID. It must resolve uniquely in the selected document and scope. Without an explicit stable tag, do not guess from the scenario name or line.

Core preserves native source locations and owns scope-local uniqueness and execution. Valid Gherkin or a successfully parsed tag does not prove that its outcome has executable evidence.

## Verification

Use the same selected installed CLI that served the workflow, passing the consuming project with `--root <path>` when needed. The examples below assume an installed project-local CLI:

```sh
npx focused-spec validate --syntax-only
npx focused-spec validate
```

After replacing every selected planned reference with an existing exact test:

```sh
npx focused-spec validate --strict
npx focused-spec run --scenario auth-login
```
