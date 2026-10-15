# focused-spec documentation

`focused-spec` binds native checkable items to exact executable evidence. Read this map top-down; each layer assumes the previous one.

## Progressive disclosure

| Level | Read this | Purpose |
| --- | --- | --- |
| 1. Orientation | [Concepts](concepts/README.md) | Mental model, boundaries, and invariants |
| 2. Common tasks | [Guides](guides/README.md) | Install, initialize agent integration, configure, and bind native items |
| 3. Exact contracts | [Reference](reference/README.md) | CLI, format API 2, runner API 1, and result semantics |
| 4. Implementation | [Development](development/README.md) | Repository workflow, testing, and black-box agent evals |

## Topic ownership

- Product model and evidence semantics: [Concepts](concepts/README.md)
- Installation and skill setup: [Installation guide](guides/install.md)
- Agent-led consumer setup and installation verification: [Agent installation guide](guides/agent-install.md); hands off to the installed loader rather than defining another specification workflow.
- Explicit bundled initialization for all 50 agent targets, native wrappers and global-only MiniMax: [installation guide](guides/install.md#bundled-agent-integration), [CLI catalog and safety contract](reference/cli.md#agent-initialization), and [agent initialization behavioral contract](../openspec/specs/agent-init/spec.md).
- Version-5 configuration, explicit inline/registry formats, opaque identities, and historical migration: [Configuration guide](guides/configuration.md)
- Public format-package authoring contracts: [inline](../packages/format-inline/README.md), [registry](../packages/format-registry/README.md), [Markdown](../packages/format-markdown/README.md), and [Gherkin](../packages/format-gherkin/README.md); the [configuration guide](guides/configuration.md#public-format-contracts) maps these independently selected plugins.
- Installed runner packages and custom implementation: [Runner guide](guides/runners.md); exact Format API 2 and Runner API 1 interfaces: [Plugin API reference](reference/runner-api.md)
- Agent bootstrap: [installed loader skill](../skills/focused-spec/SKILL.md); the package-owned [workflow](../guidance/workflow.md) owns plugin-independent procedure, while on-demand [format guidance](../guidance/formats.md) and [runner guidance](../guidance/runners.md) retain shared API obligations without plugin catalogs. Agents obtain each selected installed plugin's complete public document and provenance through a standalone [`plugin-docs`](reference/cli.md#installed-plugin-documentation) request.
- Offline CLI identity, structured error transport, validation/inspection selection, installed plugin documentation, results, and package-owned guidance: [CLI reference](reference/cli.md)
- Repository checks: [Development guide](development/README.md)
- Eight-package npm suite packing and release: [Release process](development/releasing.md)
- Agent evals: [Agent evals](development/agent-evals.md)
- Repository application and host lifecycle checks: [Repository workflow](development/workflow.md)
- Behavioral contract: [scenario authoring](../openspec/specs/scenario-authoring/spec.md), [inline format delta](../openspec/changes/make-format-evidence-storage-agnostic/specs/inline-format/spec.md), [configuration](../openspec/specs/project-configuration/spec.md), [validation](../openspec/specs/validation/spec.md), [CLI help](../openspec/specs/cli-help/spec.md), [runner protocol](../openspec/specs/runner-protocol/spec.md), [execution](../openspec/specs/scenario-execution/spec.md), [distribution](../openspec/specs/distribution/spec.md), [agent workflow](../openspec/specs/agent-workflow/spec.md), [agent guidance](../openspec/specs/agent-guidance/spec.md), [installed plugin documentation delta](../openspec/changes/expose-installed-plugin-docs/specs/plugin-documentation/spec.md), and [evidence inspection delta](../openspec/changes/improve-cli-discovery-and-inspection/specs/evidence-inspection/spec.md).
- Registry-adapter behavioral contract: [evidence registry sharding](../openspec/specs/evidence-registry-sharding/spec.md); [configuration](guides/configuration.md#external-registry-evidence) owns its human-facing composition and source rules.

Root `README.md` is the short project entrypoint. Human-facing documentation lives here; the installed loader obtains portable procedures from the CLI-owned guidance, while `AGENTS.md` contains repository-only coding-agent rules and pointers to the owners.
