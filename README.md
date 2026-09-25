# focused-spec

[![npm](https://img.shields.io/npm/v/focused-spec?label=npm)](https://www.npmjs.com/package/focused-spec) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Behavioral scenarios backed by exact executable evidence.**

Keep the specification workflow you already use. `focused-spec` finds focused scenarios in the Markdown files you configure, resolves their evidence through project-local runners, and reports what the selected tests actually did. It works alongside OpenSpec, Spec Kit, Kiro, BMad, or plain Markdown; it does not replace their planning or validation tools.

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

Your SDD tool owns proposals, requirements, and its native document rules. `focused-spec` owns the link between a focused scenario and executable evidence. Its core does not depend on a language or test framework: your project provides the runners for Go, pytest, Vitest, or whatever actually runs its tests.

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

## Bring your own SDD layout

Document discovery is explicit, not tied to a framework or inferred from its folders:

Every layout assigns exactly one ordinary, path-safe scope, either explicitly with `scope: <name>` or by capturing one `{scope}` fragment. There is no default or privileged scope; even the name `baseline` is ordinary. Reusing a scenario ID across scopes requires `REVISES: <source-scope>`.

| Workflow | Runnable example | Focused scenario location |
| --- | --- | --- |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | [Go + pytest](examples/openspec/) | `openspec/specs/**/spec.md` |
| [Spec Kit](https://github.com/github/spec-kit) | [Spec Kit-style feature](examples/spec-kit/) | `specs/{scope}/spec.md` |
| [Kiro](https://github.com/kirodotdev/Kiro) | [Kiro-style feature](examples/kiro/) | `.kiro/specs/{scope}/focused-spec.md` companion |
| [BMad](https://github.com/bmad-code-org/BMAD-METHOD) | [BMad-style spec](examples/bmad/) | `specs/spec-{scope}/focused-spec.md` companion |

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
