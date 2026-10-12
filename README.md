# focused-spec

[![npm](https://img.shields.io/npm/v/focused-spec?label=npm)](https://www.npmjs.com/package/focused-spec) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Make each behavioral promise answerable by a test result.**

`focused-spec` binds a stable ID on a framework's native checkable item to exact executable evidence. The native item remains the only copy of the behavior; an explicitly selected format adapter normalizes it, a configured YAML registry records identity and tests, and runner plugins execute those tests. The registry may be one file or explicit domain shards. OpenSpec, Spec Kit, BMad, Gherkin, and other authoring systems keep ownership of their document rules and validation.

## See the contract

An editable Markdown item carries an adjacent marker:

```markdown
<!-- focused-spec:id=auth.login.blocked-account -->
#### Scenario: Blocked account submits valid credentials
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

Its evidence lives in the required registry rather than in the specification:

```yaml
# .focused-spec/evidence.yaml
scopes:
  current:
    auth.login.blocked-account:
      evidence:
        - go::./go/auth::TestBlockedAccount
        - pytest::tests/functional/test_auth.py::test_blocked_account
```

Every evidence selector must resolve to one real target. Multiple entries form an AND contract: the scenario passes only when every selected target runs and passes.

## Where it fits

```text
Native checkable item + stable focused ID
                    ↓
Required evidence registry
                    ↓
Selected runner plugin → exact test → observed result
```

The core is language-, format-, and framework-neutral. It ships no Markdown/Gherkin parser or test-framework runner, does not infer an adapter from a filename, derive behavior from prose, impose a source framework, or create a second scenario merely to make evidence executable. Separately installed adapters and runners supply only the integrations a project selects.

## Get started

Requires **Node.js 22.16.0+**. In the project you want to verify:

```sh
npm install --save-dev focused-spec
npm install --save-dev @focused-spec/format-markdown @focused-spec/format-gherkin
npm install --save-dev @focused-spec/runner-vitest @focused-spec/runner-pytest @focused-spec/runner-go
```

For agent-led specification authoring, explicitly initialize the agent integration from the project's installed package. The CLI works without it; the bundled [loader skill](skills/focused-spec/SKILL.md) obtains workflow guidance from that same local CLI.

```sh
npx focused-spec init --tools oh-my-pi,claude
```

Choose only the agents you use; for Codex, use `--tools codex`. Init supports [50 targets](docs/reference/cli.md#agent-initialization), installs native wrappers where supported, and preserves customized files unless `--replace` is explicit. Use `--dry-run` to preview. It does not create format/runner registration, evidence configuration, or registries. See the [installation guide](docs/guides/install.md#bundled-agent-integration) for destinations, the explicit global-only MiniMax target, and the alternative external skills installer.

1. Create a [version-4 configuration](docs/guides/configuration.md) that registers the installed format adapters, selects a format for every document layout, and registers each selected runner package or project module.
2. Attach one focused ID to each in-scope native item and add the matching `(scope, ID)` entry to a configured registry file (default `.focused-spec/evidence.yaml`).
3. Validate and run the completed selection:

   ```sh
   npx focused-spec validate --strict
   npx focused-spec run
   ```

While a test is not yet available, prefix its registry reference with `planned:` and use non-strict validation. Strict validation and `run` reject planned evidence.

## Identity bindings

- **`@focused-spec/format-markdown`:** place `<!-- focused-spec:id=<lowercase.dotted.id> -->` immediately before a heading, paragraph, or list item, or inline after a paragraph or list item.
- **`@focused-spec/format-gherkin`:** place `@focused.<lowercase.dotted.id>` on a `Scenario` or `Scenario Outline`, never on `Feature`, `Rule`, `Background`, or `Examples`.
- **Generated or metadata-hostile documents:** do not edit generated output. Add `source: { path, nativeId }` to the registry entry; `nativeId` must be an explicit host-owned ID returned by the selected adapter and resolve uniquely in that document. Never guess from a heading, line number, or behavior wording.

A missing, detached, duplicate, ambiguous, or multiply bound ID is a validation error. Marked native content without a registry entry fails, as does a registry entry that does not bind one native item. Unmarked native content remains owned by its host framework; focused-spec neither counts it nor claims coverage for it.

## Scopes and selection

Every document layout assigns exactly one ordinary, path-safe scope, either explicitly with `scope: <name>` or by capturing one `{scope}` fragment. Identity is the pair `(scope, ID)`. The same ID may appear in different scopes, but every occurrence needs its own binding and evidence; evidence never inherits.

Without `--scope`, validation and execution select all discovered scopes. `run --scenario <id>` narrows binding, evidence resolution, and execution to matching entries in the selected scope or scopes, so unrelated registry or evidence failures do not block that selected run.

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
- [Installation and agent skill](docs/guides/install.md) · [Configuration, authoring, and migration](docs/guides/configuration.md)
- [Runner packages and custom plugins](docs/guides/runners.md) · [Plugin API reference](docs/reference/runner-api.md) · [CLI reference](docs/reference/cli.md)
- [Documentation map](docs/README.md) · [Development workflow](docs/development/README.md)

MIT licensed — see [LICENSE](LICENSE).
