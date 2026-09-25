# focused-spec documentation

`focused-spec` links small behavioral scenarios to exact executable evidence. Read this map top-down; each layer assumes the previous one.

## Progressive disclosure

| Level | Read this | Purpose |
| --- | --- | --- |
| 1. Orientation | [Concepts](concepts/README.md) | Mental model, boundaries, and invariants |
| 2. Common tasks | [Guides](guides/README.md) | Install, configure, author scenarios, install the agent skill |
| 3. Exact contracts | [Reference](reference/README.md) | CLI, YAML, runner API, and result semantics |
| 4. Implementation | [Development](development/README.md) | Repository workflow, testing, and black-box agent evals |

## Topic ownership

- Product model and evidence semantics: [Concepts](concepts/README.md)
- Installation and skill setup: [Installation guide](guides/install.md)
- Configuration and scenarios: [Configuration guide](guides/configuration.md)
- Runner implementation: [Runner guide](guides/runners.md)
- CLI contract: [CLI reference](reference/cli.md)
- Runner API contract: [Runner API reference](reference/runner-api.md)
- Repository checks: [Development guide](development/README.md)
- npm package release: [Release process](development/releasing.md)
- Agent evals: [Agent evals](development/agent-evals.md)
- Behavioral contract: [scenario authoring](../openspec/specs/scenario-authoring/spec.md), [configuration](../openspec/specs/project-configuration/spec.md), [validation](../openspec/specs/validation/spec.md), [CLI help](../openspec/specs/cli-help/spec.md), [runner protocol](../openspec/specs/runner-protocol/spec.md), [execution](../openspec/specs/scenario-execution/spec.md), [distribution](../openspec/specs/distribution/spec.md), [agent workflow](../openspec/specs/agent-workflow/spec.md)

Root `README.md` is the short project entrypoint. Detailed normative documentation lives here. `AGENTS.md` contains durable coding-agent rules, not product documentation.
