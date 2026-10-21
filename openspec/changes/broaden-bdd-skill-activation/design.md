# Design

## Context

See [proposal.md](./proposal.md) for motivation and the [agent-workflow delta](./specs/agent-workflow/spec.md) for the changed contract.

The root README already presents independent SDK execution and native requirement binding, but its agent handoff and `skills/focused-spec/SKILL.md` description still say SDD-only. `docs/concepts/README.md` also introduces the product through an external specification framework. By contrast, `guidance/workflow.md` already defines one code-native Given/When/Expect source, real application observations, independent expectations, and SDK-only execution without focused configuration. `guidance/integration.md` already routes SDK selection separately from CLI integration.

The eval harness already requires completed loader and project-local workflow activation before judging every case (`evals/harness.ts`). Existing SDK-only integration and false-green-driver cases use the same harness. This is a trigger and presentation correction, not a new execution engine or evaluation framework.

## Goals / Non-Goals

**Goals:** Make agents recognize standalone BDD work from the task, preserve independent native execution and phase boundaries, and explain both product paths consistently.

**Non-Goals:** Change SDK APIs, add new language plugins, redesign the guidance protocol, change dependency ownership, or publish a release. Ordinary unrelated tests do not become focused-spec work merely because they contain assertions.

## Decisions

### 1. Widen the loader trigger, not the user's duties

Change the authored skill description to cover BDD/executable-scenario review, authoring, revision, verification, and associated application-driver work as well as SDD. Keep loading independent of a named framework or explicit invocation. Say "alongside the host workflow when present" rather than requiring a host in every project.

Keep the loader thin: authoritative portable procedure remains in `guidance/workflow.md`, composition selection in `guidance/integration.md`. Align their introductory routing and text-specific steps with the existing SDK-only branch; do not create a second BDD workflow, duplicate protocol checks, or apply registry/CLI completion steps to SDK-only work.

### 2. Separate agent guidance prerequisites from runtime dependencies

Independent TypeScript, Go, Python, and .NET suites still run through their native SDK/test wrapper without focused-spec CLI installation. An agent using the installed focused-spec loader continues to need its compatible project-local CLI for authoritative guidance. That tooling prerequisite does not authorize adding CLI plugins, configuration, Markdown companions, or registries to an SDK-only project. Missing local guidance remains an explicit limitation, not permission to use global, downloaded, or stale instructions.

Update existing owners: `README.md`, `docs/concepts/README.md`, `docs/guides/install.md`, `docs/guides/agent-install.md`, `docs/reference/cli.md`, and `docs/README.md`. Keep detailed agent procedure out of human-facing docs. Preserve host-discovery caveats: metadata cannot guarantee a host will select a skill.

### 3. Reuse blind cases and test the actual rejection boundary

Use fresh runs of `integration-standalone-typescript-sdk`, `integration-standalone-go-sdk`, and `executable-authoring-sdk`. Their prompts already describe native suites and application behavior without prescribing a skill read. Retain protected application/package files, one suite, no optional CLI integration, exact native execution, and product-regression sensitivity gates. Also run `full-skill-routing` to guard SDD proposal/apply behavior.

Add one deterministic harness regression for an SDK-only turn that exits successfully but omits loader or usable workflow activation. It must fail before downstream composition/behavior judgment. This protects a plausible bypass in hostless routing; do not add source-text or exact-description assertions. The existing composition and executable-authoring gate tests remain the evidence for rejecting unwanted configuration and expectation echoes. Fresh model runs, not mocked transcripts, assess autonomous selection from the changed description.

## Intended exact evidence

Apply will enroll these IDs in the existing capability-owned `.focused-spec/evidence/agent-workflow.yaml`, under this change's scope; proposal creates no executable enrollment. The new selector remains intended until its test exists. Every AND member below is required.

| Native ID | Intended Vitest evidence | Live behavior proof |
| --- | --- | --- |
| `agent.activation.bdd-sdk` | `vitest::test/evals.spec.ts::agent eval harness > rejects SDK-only BDD turns without skill and local workflow activation`; `vitest::test/evals.spec.ts::agent eval harness > judges standalone compositions against the requested canonical source` | Both standalone SDK cases |
| `agent.activation.bdd-driver` | `vitest::test/evals.spec.ts::agent eval harness > rejects SDK-only BDD turns without skill and local workflow activation`; `vitest::test/evals.spec.ts::agent eval harness > rejects duplicate behavioral sources beside executable scenarios`; `vitest::test/evals.spec.ts::agent eval harness > rejects executable evidence disconnected from the mutated application` | `executable-authoring-sdk`, including native PASS → selected behavioral FAIL → restored PASS |
| `agent.activation.sdd` | `vitest::test/evals.spec.ts::agent eval harness > stops an OpenSpec turn before judging artifacts if the agent skipped the skill`; `vitest::test/evals.spec.ts::agent eval harness > rejects a proposal that creates configuration or a planned evidence registry` | `full-skill-routing` |

Deterministic gate tests establish rejection and composition invariants, not universal model compliance. Retain immutable live-eval results and report each model/case verdict separately. Do not claim SDK-driver correctness from a successful loader read.

## Risks / Trade-offs

- Wider wording could over-trigger unrelated test maintenance → name executable scenarios and associated drivers, not every test or application change.
- A host may not discover the refreshed loader → preserve discovery/reload diagnostics and do not require routine user invocation or silently edit agent rules.
- SDK-only execution could be confused with guidance tooling → explicitly distinguish the native runtime from the agent's local CLI prerequisite.
- Existing agent installations retain the old description → distribute through the normal core asset staging/release and explicit integration refresh; changing this checkout does not update installed copies.
- Model-dependent results → record the actual model and all failed/timed-out runs; deterministic tests alone do not certify autonomous activation.

## Migration Plan

Apply changes authored assets and existing docs, builds through normal staging, executes the narrow gate checks and fresh eval cases, then runs repository verification and this change's exact focused evidence. Do not hand-edit generated `packages/core/skills`, `packages/core/guidance`, or packaged README mirrors. Sync/archive only after authorized implementation and proof; publishing and consumer installation refresh remain separate explicit operations. A rollback restores the authored description/guidance and rebuilds assets; it requires no SDK, configuration, or registry migration in consuming projects.
