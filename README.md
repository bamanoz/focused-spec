# focused-spec

[![npm](https://img.shields.io/npm/v/focused-spec?label=npm)](https://www.npmjs.com/package/focused-spec) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Make each behavioral promise answerable by a test result.**

`focused-spec` connects the behavior in your specs to the exact tests that prove it. Keep your existing specification workflow and test frameworks; add stable IDs, explicit evidence references, and a CLI that resolves and runs those tests.

## See what gets verified

One small scenario can require evidence from more than one test framework. With the optional inline format:

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth-login`
- **EVIDENCE**: `go::./go/auth::TestBlockedAccount`
- **EVIDENCE**: `pytest::tests/functional/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

Every reference must resolve to exactly one real test. This scenario passes only when **both tests execute and pass**. `validate --strict` checks resolution; `run` executes the evidence. A test result proves the selected evidence passed, not that arbitrary prose is correct or every requirement is covered.

## Where it fits

OpenSpec, Spec Kit, BMad, and other authoring systems organize what to build. focused-spec adds an executable evidence contract to their native checkable items, without copying the behavior into a second specification or taking over approvals, validation, or lifecycle operations.

```text
Native scenario or acceptance item → stable ID → exact tests → observed results
```

- **Already use a specification framework?** Bind its native items through an explicitly selected parser and external evidence registry. See the [runnable examples](#shipped-examples).
- **Starting with plain Markdown?** Use the inline format shown above; no registry is needed.
- **Different language or test framework?** Core is format- and language-neutral; independently installed [format adapters](docs/guides/configuration.md#public-format-contracts) and [runner plugins](docs/guides/runners.md) supply the integrations.

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

## Manual quick start

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

In your agent's chat, load focused-spec alongside your host specification workflow: `/focused-spec <task>` on native command hosts, `$focused-spec` in Codex, or the host's skill selector. Ask it to configure the selected plugins and bind one native outcome to real evidence. **Initialization does not create that configuration or evidence.** The installed loader obtains current workflow guidance from the project-local CLI.

For manual setup, follow the [configuration guide](docs/guides/configuration.md). Once configuration and evidence are in place:

```sh
npx focused-spec validate --strict
npx focused-spec run
```

Need planned evidence before tests exist? See [evidence semantics](docs/concepts/README.md#identity-and-evidence-semantics). For identity, scopes, and selection, see [concepts](docs/concepts/README.md) and the [CLI reference](docs/reference/cli.md).

## Shipped examples

| Workflow | Runnable example | Native binding |
| --- | --- | --- |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | [Go + pytest](examples/openspec/) | Marker on the existing Scenario |
| [Spec Kit](https://github.com/github/spec-kit) | [Spec Kit-style feature](examples/spec-kit/) | Marker on the existing numbered acceptance item |
| [BMad](https://github.com/bmad-code-org/BMAD-METHOD) | [BMad-style spec](examples/bmad/) | External binding to generated `SPEC.md` ID `CAP-1` |
| Plain Markdown | [Standalone worktree consumer](examples/worktree-consumer/) | Marker on its native scenario heading |

Each example retains real tests and explicitly installed format and runner packages. [Run the examples](docs/guides/configuration.md#runnable-framework-examples) from this repository's checkout.

## Learn more

- [Concepts and evidence semantics](docs/concepts/README.md)
- [Installation options](docs/guides/install.md) · [Agent installation guide](docs/guides/agent-install.md) · [Configuration and migration](docs/guides/configuration.md)
- [Runner packages and custom plugins](docs/guides/runners.md) · [Plugin API reference](docs/reference/runner-api.md) · [CLI reference](docs/reference/cli.md)
- [Documentation map](docs/README.md) · [Development workflow](docs/development/README.md)

MIT licensed — see [LICENSE](LICENSE).
