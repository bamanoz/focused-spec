# focused-spec documentation

`focused-spec` lets projects author executable behavioral specifications in code or bind native checkable items to exact executable evidence. Read this map top-down; each layer assumes the previous one.

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
- .NET SDK download, local NuGet feed, pinned dependency, and CI restore: [GitHub Release installation](guides/install.md#net-sdk-from-github-releases).
- Offline agent .NET installation procedure: the installed CLI's `integration` topic, authored in [integration guidance](../guidance/integration.md#install-the-net-sdk-from-a-github-release), includes the versioned artifact, checksum, local feed, and CI restore obligations.
- Agent-led consumer setup and installation verification: [Agent installation guide](guides/agent-install.md); hands off to the installed loader rather than defining another specification workflow.
- Explicit bundled initialization for all 50 agent targets, native wrappers and global-only MiniMax: [installation guide](guides/install.md#bundled-agent-integration), [CLI catalog and safety contract](reference/cli.md#agent-initialization), and [agent initialization behavioral contract](../openspec/specs/agent-init/spec.md).
- Version-5 configuration, explicit inline/registry formats, opaque identities, and historical migration: [Configuration guide](guides/configuration.md)
- Public format-package authoring contracts: [inline](../packages/formats/inline/README.md), [registry](../packages/formats/registry/README.md), [Markdown](../packages/formats/markdown/README.md), [Gherkin](../packages/formats/gherkin/README.md), [JS/TS code scenarios](../packages/formats/scenarios-typescript/README.md), and [Go code scenarios](../packages/formats/scenarios-go/README.md); the [configuration guide](guides/configuration.md#public-format-contracts) maps these independently selected plugins.
- Installed runner packages and custom implementation: [Runner guide](guides/runners.md); exact Format API 2 and Runner API 1 interfaces: [Plugin API reference](reference/runner-api.md)
- Portable target execution events, bounds and malformed reports: [Plugin API reference](reference/runner-api.md#execution-events); native result provenance and compact/detailed/JSON rendering: [CLI reference](reference/cli.md#execution-and-result-context). SDK capture and real bank surfaces: [execution events contract](../openspec/specs/execution-events/spec.md), [runner protocol contract](../openspec/specs/runner-protocol/spec.md) and [execution contract](../openspec/specs/scenario-execution/spec.md).
- Execution-local application explanations and consumer-owned message codecs: [bank guide](guides/configuration.md#standalone-executable-bank-specifications), [explanation contract](../openspec/specs/scenario-explanations/spec.md) and [message roundtrip contract](../openspec/specs/scenario-message-roundtrip/spec.md).
- Agent-owned BDD/SDD loading, independent SDK runtime versus local guidance tooling, and host discovery limitations: [installation guide](guides/install.md#agent-skill) and [troubleshooting](guides/install.md#skill-discovery-and-troubleshooting). The [loader](../skills/focused-spec/SKILL.md) declares activation without user invocation; [workflow guidance](../guidance/workflow.md) owns portable procedure and routes first/reconsidered composition to [integration guidance](../guidance/integration.md). On-demand [format](../guidance/formats.md) and [runner](../guidance/runners.md) guidance retain shared API obligations; selected installed contracts and provenance come from separate [`plugin-docs`](reference/cli.md#installed-plugin-documentation) requests.
- Offline CLI identity, structured error transport, validation/inspection selection, installed plugin documentation, results, and package-owned guidance: [CLI reference](reference/cli.md)
- Repository checks: [Development guide](development/README.md)
- Thirteen-package npm suite and separate Go, Python, and .NET SDK packing/release: [Release process](development/releasing.md)
- Agent evals: [Agent evals](development/agent-evals.md)
- Independent executable scenarios: [JS/TS SDK](../packages/sdk/typescript/README.md), [Go SDK](../packages/sdk/go/README.md), [Python SDK](../packages/sdk/python/README.md), and [.NET SDK](../packages/sdk/dotnet/FocusedSpec.Scenarios/README.md); native formats ([JS/TS](../packages/formats/scenarios-typescript/README.md), [Go](../packages/formats/scenarios-go/README.md)); direct runners ([JS/TS](guides/runners.md#direct-jsts-scenarios), [Go](guides/runners.md#direct-go-scenarios)); [bank consumers](guides/configuration.md#standalone-executable-bank-specifications); behavioral contracts ([JS/TS](../openspec/specs/executable-scenarios/spec.md), [Go](../openspec/specs/go-executable-scenarios/spec.md), [Python](../openspec/specs/python-executable-scenarios/spec.md), [.NET](../openspec/specs/dotnet-executable-scenarios/spec.md)).
- Repository application and host lifecycle checks: [Repository workflow](development/workflow.md)
- Behavioral contract: [scenario authoring](../openspec/specs/scenario-authoring/spec.md), [inline format contract](../openspec/specs/inline-format/spec.md), [configuration](../openspec/specs/project-configuration/spec.md), [validation](../openspec/specs/validation/spec.md), [CLI help](../openspec/specs/cli-help/spec.md), [runner protocol](../openspec/specs/runner-protocol/spec.md), [execution](../openspec/specs/scenario-execution/spec.md), [distribution](../openspec/specs/distribution/spec.md), [agent workflow](../openspec/specs/agent-workflow/spec.md), [agent guidance](../openspec/specs/agent-guidance/spec.md), and [installed plugin documentation contract](../openspec/specs/plugin-documentation/spec.md).
- Registry-adapter behavioral contract: [evidence registry sharding](../openspec/specs/evidence-registry-sharding/spec.md); [configuration](guides/configuration.md#external-registry-evidence) owns its human-facing composition and source rules.

Root `README.md` is the short project entrypoint. Human-facing documentation lives here; the installed loader obtains portable procedures from the CLI-owned guidance, while `AGENTS.md` contains repository-only coding-agent rules and pointers to the owners.
