# focused-spec

[![npm](https://img.shields.io/npm/v/focused-spec?label=npm)](https://www.npmjs.com/package/focused-spec) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Behavioral scenarios backed by exact executable evidence.**

Keep the specification workflow you already use. `focused-spec` finds focused scenarios in the Markdown files you configure, resolves their evidence through project-local runners, and reports what the selected tests actually did. It works alongside OpenSpec, Spec Kit, Kiro, BMad, or plain Markdown; it does not replace their planning or validation tools.

## See the contract

A scenario names one behavior and the exact tests that prove it. This one lives in the [runnable Go + pytest example](examples/polyglot/openspec/specs/auth/spec.md):

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
validation scope: baseline specifications and all named scopes
execution selection: baseline specifications
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
3. Once its targets exist, validate and run the completed project:

   ```sh
   npx focused-spec validate --strict
   npx focused-spec run
   ```

For a named in-progress scope, use `validate --scope <name>` without `--strict` while evidence is `planned:`, then `validate --scope <name> --strict` and `run --scope <name>` once it is executable. [Scope and CLI details](docs/reference/cli.md).

## Bring your own SDD layout

Document discovery is explicit, not tied to a framework or inferred from its folders:

| Existing workflow | What you configure |
| --- | --- |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | Baseline `openspec/specs/**/spec.md` and named `openspec/changes/{scope}/specs/**/spec.md`, as in this repository's [config](.focused-spec/config.yaml). |
| [Spec Kit](https://github.com/github/spec-kit), [Kiro](https://github.com/kirodotdev/Kiro), [BMad](https://github.com/bmad-code-org/BMAD-METHOD), or another layout | Paths to Markdown documents that actually contain focused scenarios, or an explicit companion Markdown document if native files cannot host them. |
| Plain Markdown | A baseline glob and, if needed, a named-scope glob. |

A document pattern selects a location; it does not translate a framework's prose into focused scenarios. Framework-native validation remains the framework's job. [Configuration guide](docs/guides/configuration.md).

## What a result means

- Each evidence selector must resolve to exactly one target or an actionable error.
- `PASS` means the selected test ran and passed. A scenario passes only when **all** its evidence passes.
- `planned:` is for unfinished named scopes, not a passing test. `SKIP` and `ERROR` are not success by default; `run` validates strictly before execution.

## Learn more

- [Concepts and evidence semantics](docs/concepts/README.md)
- [Installation and agent skill](docs/guides/install.md) · [Configuration and scenario authoring](docs/guides/configuration.md)
- [Project-local runners](docs/guides/runners.md) · [CLI reference](docs/reference/cli.md)
- [Documentation map](docs/README.md) · [Development workflow](docs/development/README.md)

MIT licensed — see [LICENSE](LICENSE).
