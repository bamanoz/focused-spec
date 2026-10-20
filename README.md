# focused-spec

[![npm](https://img.shields.io/npm/v/focused-spec?label=npm)](https://www.npmjs.com/package/focused-spec) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Write behavioral specifications as code, or connect native requirements to the exact tests that prove them.**

`focused-spec` supports two paths: write executable behavioral specifications as code and run them against the real application with a language SDK, or bind native checkable items in an existing specification format to exact tests. Use the SDK without an SDD framework or CLI, add optional CLI plugins to discover and execute those same scenarios, or keep your existing specification workflow and bind its items without duplicating behavior.

## Executable specifications

Executable specifications keep the Given/When/Expect scenario in code and verify the application's actual result. The maintained [TypeScript bank demo](examples/scenarios/typescript/) and [Go bank demo](examples/scenarios/go/) exercise their real account implementations through ordinary tests and readable demos; optional focused-spec plugins run the same suites. The SDK APIs can also be used without focused-spec or an SDD framework.

## Bind native requirements to tests

When behavior is already specified in OpenSpec, Spec Kit, BMad, Gherkin, or another compatible native format, keep it there. Bind selected items to stable IDs and exact existing tests. focused-spec resolves and executes the evidence without copying behavior into a second specification or taking over the host's approvals and lifecycle.

For standalone Markdown specifications, the optional inline adapter keeps evidence beside a scenario:

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth-login`
- **EVIDENCE**: `go::./go/auth::TestBlockedAccount`
- **EVIDENCE**: `pytest::tests/functional/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

Each reference must resolve to exactly one real test; multiple references form an AND contract. `validate --strict` checks resolution and `run` executes the evidence. Passing evidence proves those tests passed, not that arbitrary prose is correct or every requirement is covered. Core is format- and language-neutral; selected [format adapters](docs/guides/configuration.md#public-format-contracts) and [runner plugins](docs/guides/runners.md) provide optional CLI integrations.

## Install with your agent

Paste this into your coding agent's chat:

```text
Install focused-spec in this project by following:
https://raw.githubusercontent.com/bamanoz/focused-spec/main/docs/guides/agent-install.md
Use this project's package manager, initialize only the agent integration I use,
and report what you verified and what still needs configuration.
```

### For AI agents

Read the [agent installation guide](docs/guides/agent-install.md). It covers project inspection, local package installation, explicit target selection, safe initialization, and verification before handing off to the installed skill. Installing the CLI or loader alone is not evidence that a specification passes.

## Optional CLI integration

Requires **Node.js 22.16.0+**. Run in the consuming project, not a clone of this repository:

```sh
npm install --save-dev focused-spec
npx focused-spec init --tools claude
```

Replace `claude` with your [agent target ID](docs/reference/cli.md#agent-initialization), such as `codex` or `oh-my-pi`; use comma-separated IDs for multiple agents. Preview with `--dry-run`. The CLI also works without an agent integration.

Install only the formats and runners you need. For **standalone inline Markdown with existing Vitest tests**:

```sh
npm install --save-dev @focused-spec/format-inline @focused-spec/runner-vitest
```

For existing native Markdown or Gherkin, choose the registry adapter plus its native parser instead. Go and pytest runners are available separately; test frameworks remain project prerequisites. See [installation options](docs/guides/install.md).

In your agent's chat, load focused-spec alongside your host specification workflow: `/focused-spec <task>` on native command hosts, `$focused-spec` in Codex, or the host's skill selector. Ask it to integrate one native outcome with real evidence. **Initialization does not create configuration or evidence.** The installed loader obtains current workflow guidance; first integration uses its on-demand integration topic to choose only necessary packages before reading their installed contracts.

For manual setup, follow the [configuration guide](docs/guides/configuration.md). Once configuration and evidence are in place:

```sh
npx focused-spec validate --strict
npx focused-spec run
```

SDK-only consumers do not need CLI installation or configuration. See the [TypeScript SDK](packages/sdk/typescript/README.md) and [Go SDK](packages/sdk/go/README.md). For planned evidence and scope selection, see [concepts](docs/concepts/README.md) and the [CLI reference](docs/reference/cli.md).

## Shipped examples

| Path | Runnable example | Source of behavior |
| --- | --- | --- |
| OpenSpec | [Go + pytest](examples/openspec/) | Existing OpenSpec Scenario |
| Spec Kit | [Spec Kit-style feature](examples/spec-kit/) | Existing numbered acceptance item |
| BMad | [BMad-style spec](examples/bmad/) | Generated `SPEC.md` native ID `CAP-1` |
| Plain Markdown | [Standalone worktree consumer](examples/worktree-consumer/) | Native scenario heading |
| Executable TypeScript | [TypeScript SDK bank demo](examples/scenarios/typescript/) | Native Given/When/Expect suite |
| Executable Go | [Go SDK bank demo](examples/scenarios/go/) | Native typed suite |

The framework examples use explicitly installed format and runner packages to bind native items to real tests. The bank demos use independent language SDKs and keep six event-sourced account outcomes in native code, without Markdown copies or registries. Ordinary test wrappers, readable demos, and optional focused-spec plugins exercise those same suites. [Run the examples](docs/guides/configuration.md#runnable-framework-examples) from this repository's checkout.

## Learn more

- [Concepts and evidence semantics](docs/concepts/README.md)
- [Installation options](docs/guides/install.md) · [Agent installation guide](docs/guides/agent-install.md) · [Configuration and migration](docs/guides/configuration.md)
- [Runner packages and custom plugins](docs/guides/runners.md) · [Plugin API reference](docs/reference/runner-api.md) · [CLI reference](docs/reference/cli.md)
- [Documentation map](docs/README.md) · [Development workflow](docs/development/README.md)

MIT licensed — see [LICENSE](LICENSE).
