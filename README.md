# focused-spec

[![npm](https://img.shields.io/npm/v/focused-spec?label=npm)](https://www.npmjs.com/package/focused-spec) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Make each behavioral promise answerable by a test result.**

SDD workflows produce requirements and plans; projects run tests. A green suite alone does not say which test checks a particular outcome, or whether a newly written scenario has any executable check at all. `focused-spec` keeps that link explicit: a small scenario names exact test targets, and `run` executes them before reporting the scenario as passed.

Keep your existing specification workflow and tests. The agent skill asks for scenarios while authoring a spec, allows `planned:` targets until implementation, and requires real evidence before completion. The CLI finds those scenarios in configured Markdown; project-local runners execute the selected tests. It does not replace OpenSpec, Spec Kit, BMad, or their native validation.

## See the contract

A scenario names one behavior and the exact tests that prove it. This one lives in the [runnable OpenSpec example (Go + pytest)](examples/openspec/openspec/specs/auth/spec.md):

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **EVIDENCE**: `go-unit::./go/auth::TestBlockedAccount`
- **EVIDENCE**: `pytest-functional::tests/functional/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

From a checkout of this repository, `npm run smoke` executes both targets rather than treating the scenario text as proof. Its CLI output:

```text
validation scope: all discovered scopes
execution selection: all discovered scopes
PASS auth.login.blocked-account
  PASS go-unit::./go/auth::TestBlockedAccount
  PASS pytest-functional::tests/functional/test_auth.py::test_blocked_account
summary: 1 PASS, 0 FAIL, 0 SKIP, 0 ERROR; 2 unique targets
```

## Where it fits

```text
Your SDD framework or Markdown files
             ↓
Focused scenario (ID · WHEN · THEN · EVIDENCE)
             ↓
Project-local runner → exact test → observed result
```

Your SDD tool owns proposals, requirements, and native document rules. `focused-spec` owns the checkable link from one outcome to one or more independent tests, even across languages. Its core is language- and framework-neutral; project-local runners select and execute the tests. If a Gherkin scenario already runs through Cucumber/Godog, that scenario is itself an executable specification—you do not need a second focused scenario merely to run it again.

## Get started

Requires **Node.js 22.16.0+**. In the project you want to verify:

```sh
npm install --save-dev focused-spec@latest
```

Optionally install the [agent skill](skills/focused-spec/SKILL.md) separately to guide scenario authoring:

```sh
npx --yes skills add bamanoz/focused-spec --skill focused-spec
```

1. [Configure your scenario-bearing Markdown files](docs/guides/configuration.md) in `.focused-spec/config.yaml` and [implement a project-local runner](docs/guides/runners.md) for each evidence type you use. Installing the CLI alone does not provide runners or tests.
2. Write a scenario with a stable `ID`, one `WHEN`, one `THEN`, and one or more exact `EVIDENCE` selectors. Multiple evidence rows must **all** pass.
3. Validate and run the completed project. Validation resolves evidence but never executes tests; `run` performs strict validation and then executes the same selected scopes:

   ```sh
   npx focused-spec validate --strict
   npx focused-spec run
   ```

For any in-progress scope, use `validate --scope <name>` without `--strict` while evidence is `planned:`, then `validate --scope <name> --strict` and `run --scope <name>` once it is executable. Without `--scope`, both commands select every discovered scope. [Scope and CLI details](docs/reference/cli.md).

## Adopt in an existing project

You do **not** need to rewrite your codebase or backfill every historical spec. Keep your current SDD workflow and tests; start with the next behavior you change. Enroll just its scenario with an `ID` and exact `EVIDENCE`, configure the existing Markdown location and a project-local runner, then run that evidence. Native scenarios without focused metadata stay untouched and are reported as **unenrolled**, not passed. Add coverage outcome by outcome as you work. See [incremental adoption](docs/guides/configuration.md#adopt-existing-specifications-incrementally) and [OpenSpec's brownfield guide](https://github.com/Fission-AI/OpenSpec/blob/main/docs/existing-projects.md).

## Bring your own SDD layout

Document discovery is explicit, not tied to a framework or inferred from its folders:

Every layout assigns exactly one ordinary, path-safe scope, either explicitly with `scope: <name>` or by capturing one `{scope}` fragment. There is no default or privileged scope; even the name `baseline` is ordinary. Reusing a scenario ID across scopes requires `REVISES: <source-scope>`.

| Workflow | Runnable example | Focused scenario location |
| --- | --- | --- |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | [Go + pytest](examples/openspec/) | `openspec/specs/**/spec.md` |
| [Spec Kit](https://github.com/github/spec-kit) | [Spec Kit-style feature](examples/spec-kit/) | `specs/{scope}/spec.md` |
| [BMad](https://github.com/bmad-code-org/BMAD-METHOD) | [BMad-style spec](examples/bmad/) | `_bmad-output/specs/spec-{scope}/scenarios.md` companion |

Each example includes its own configuration, real tests, and project-local runner. [Run the examples](docs/guides/configuration.md#runnable-framework-examples) from this repository's checkout; plain Markdown works with the same configured document patterns.

A document pattern selects a location; it does not translate a framework's prose into focused scenarios. Framework-native validation remains the framework's job. [Configuration guide](docs/guides/configuration.md).

## What a result means

- Each evidence selector must resolve to exactly one target or an actionable error.
- `PASS` means the selected test ran and passed. A scenario passes only when **all** its evidence passes.
- `planned:` is temporary evidence allowed in any scope during non-strict validation, not a passing test. `SKIP` and `ERROR` are not success by default; `run` validates strictly before execution.

## Learn more

- [Concepts and evidence semantics](docs/concepts/README.md)
- [Installation and agent skill](docs/guides/install.md) · [Configuration and scenario authoring](docs/guides/configuration.md)
- [Project-local runners](docs/guides/runners.md) · [CLI reference](docs/reference/cli.md)
- [Documentation map](docs/README.md) · [Development workflow](docs/development/README.md)

MIT licensed — see [LICENSE](LICENSE).
