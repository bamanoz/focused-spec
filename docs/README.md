# focused-spec documentation

`focused-spec` binds native checkable items to exact executable evidence. Read this map top-down; each layer assumes the previous one.

## Progressive disclosure

| Level | Read this | Purpose |
| --- | --- | --- |
| 1. Orientation | [Concepts](concepts/README.md) | Mental model, boundaries, and invariants |
| 2. Common tasks | [Guides](guides/README.md) | Install, initialize agent integration, configure, and bind native items |
| 3. Exact contracts | [Reference](reference/README.md) | CLI, YAML, runner API, and result semantics |
| 4. Implementation | [Development](development/README.md) | Repository workflow, testing, and black-box agent evals |

## Topic ownership

- Product model and evidence semantics: [Concepts](concepts/README.md)
- Installation and skill setup: [Installation guide](guides/install.md)
- Explicit bundled initialization for all 50 agent targets, native wrappers and global-only MiniMax: [installation guide](guides/install.md#bundled-agent-integration), [CLI catalog and safety contract](reference/cli.md#agent-initialization), and [agent initialization behavioral contract](../openspec/specs/agent-init/spec.md).
- Configuration, native bindings, registry, and migration: [Configuration guide](guides/configuration.md)
- Runner implementation: [Runner guide](guides/runners.md)
- Agent bootstrap: [installed loader skill](../skills/focused-spec/SKILL.md); authoritative portable procedures: package-owned [workflow](../guidance/workflow.md) and [runner guidance](../guidance/runners.md), served by the project's installed CLI
- CLI commands, results, and package-owned guidance: [CLI reference](reference/cli.md)
- Repository checks: [Development guide](development/README.md)
- npm package release: [Release process](development/releasing.md)
- Agent evals: [Agent evals](development/agent-evals.md)
- Repository application and host lifecycle checks: [Repository workflow](development/workflow.md)
- Behavioral contract: [scenario authoring](../openspec/specs/scenario-authoring/spec.md), [configuration](../openspec/specs/project-configuration/spec.md), [validation](../openspec/specs/validation/spec.md), [CLI help](../openspec/specs/cli-help/spec.md), [runner protocol](../openspec/specs/runner-protocol/spec.md), [execution](../openspec/specs/scenario-execution/spec.md), [distribution](../openspec/specs/distribution/spec.md), [agent workflow](../openspec/specs/agent-workflow/spec.md), and [agent guidance](../openspec/specs/agent-guidance/spec.md).
- Sharded registry behavioral contract: [evidence registry sharding](../openspec/specs/evidence-registry-sharding/spec.md); [configuration](guides/configuration.md#required-evidence-registry) owns its YAML source and selection rules.

Root `README.md` is the short project entrypoint. Human-facing documentation lives here; the installed loader obtains portable procedures from the CLI-owned guidance, while `AGENTS.md` contains repository-only coding-agent rules and pointers to the owners.
