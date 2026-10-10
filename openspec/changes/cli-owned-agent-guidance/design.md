## Context

The [proposal](/openspec/changes/cli-owned-agent-guidance/proposal.md) changes instruction ownership, not native binding or evidence semantics. The current npm package ships `skills/`, but consumers independently install a full-text skill from GitHub. CLI help currently exposes only `validate` and `run`. The shipped skill uses configuration version 3; the runtime-installed skill encountered during this planning session still described version 2, illustrating that installed instruction copies can drift.

The governing changes are [guidance delivery](/openspec/changes/cli-owned-agent-guidance/specs/agent-guidance/spec.md), [distribution](/openspec/changes/cli-owned-agent-guidance/specs/distribution/spec.md), [help](/openspec/changes/cli-owned-agent-guidance/specs/cli-help/spec.md), and [agent workflow](/openspec/changes/cli-owned-agent-guidance/specs/agent-workflow/spec.md). The existing proposal phase forbids product, configuration, runner, and evidence-registry changes; this artifact records intended selectors without creating executable registrations.

## Goals / Non-Goals

**Goals:**

- Make the invoked installed CLI package the single authority for executable focused-spec instructions.
- Keep a separately discoverable, portable loader with a small stable compatibility contract.
- Work offline and before project configuration exists; preserve on-demand runner guidance.
- Fail closed on an absent, legacy, incompatible, or incomplete installation.
- Exercise the consumer CLI, actual skill installer, and real model workflow rather than infer compatibility from metadata.

**Non-Goals:**

- A release, package-version bump, new configuration format, or runner API change.
- A custom skill installer, automatic agent-file rewriting, a sync daemon, or a remote documentation service.
- Legacy full-text skill support, obsolete format readers, compatibility aliases/shims, automatic or product-owned project migration, retracting old session context, or guaranteeing an agent obeys unread instructions. Consumers migrate their projects through separately requested agent work.
- Framework-specific workflow rules, relaxed approval/evidence/integrity gates, or rewritten historical eval scores.

## Decisions

### 1. One package-owned guide, two independently requested topics

Move the full portable workflow into `guidance/workflow.md` and the complete runner reference into `guidance/runners.md`. Add `guidance` to package contents. `skills/focused-spec/SKILL.md` becomes the loader; remove the obsolete skill-local full runner reference rather than maintaining a compatibility copy. Preserve discovery name and cross-framework description.

Update the authoritative workflow to request runner guidance through the same installed CLI instead of linking to a skill-local file. Rewrite runner guidance's ownership and return-to-workflow pointer accordingly. Preserve phase boundaries, native-ID binding, evidence sensitivity, and real-runner semantics verbatim except where instruction delivery changes. Documentation points to these owners; it does not repeat their agent procedure.

A small `src/agent-guide.ts` reader resolves package metadata and topic assets relative to its emitted module, never `cwd`. Read only the requested asset. Route `agent-guide` before project configuration loading in `src/cli.ts`; keep validate/run options and results unchanged. No new dependency or public TypeScript export is necessary for this CLI-only contract.

Alternative: regenerating full skills through an update command still leaves a forgotten refresh step. Alternative: installing matching versions reduces risk but does not remove frozen instruction copies or stale sessions.

### 2. Stable protocol 1, not package-version equality

Proposed public command:

```text
focused-spec agent-guide [--protocol <version>] [--topic workflow|runners] [--json]
```

Defaults are protocol 1 and topic `workflow`. Protocol is a positive decimal integer; only explicitly supported versions succeed. The loader always requests its version explicitly. Protocol 1 JSON is:

```json
{
  "protocolVersion": 1,
  "package": { "name": "focused-spec", "version": "0.6.0" },
  "topic": "workflow",
  "content": "<complete Markdown guidance>"
}
```

The version shown is illustrative; runtime reads the owning package's real metadata, not a constant. Text output has a provenance header followed by the Markdown. Future package releases can change the workflow while keeping this delivery contract. Protocol changes require explicit compatibility decisions; configuration `version: 3` and runner `apiVersion: 1` remain unrelated.

Unsupported protocol, malformed arguments, unknown topic, unreadable/empty requested asset, or invalid package metadata exits nonzero, puts diagnostics on stderr, and emits no usable guidance on stdout. Do not return partial content, silently negotiate another protocol, or fall back to an old installed skill. Explicit help remains successful without loading assets or configuration, including `help agent-guide` and help combined with `--json`.

### 3. Explicit consumer-local invocation

The loader identifies the consuming project root from repository/package context and invokes that root's installed CLI explicitly, normally `<project-root>/node_modules/.bin/focused-spec`. A declared workspace's hoisted install root is acceptable when project context establishes it. Use the platform's executable form; an explicit `node <installation>/node_modules/focused-spec/dist/cli.js` invocation is also local and suitable for Node consumers.

Do not guess a globally available `focused-spec`, use bare downloading `npx`, or install `latest` when local resolution fails. Report that the user needs a compatible local installation; installing/upgrading remains a separately authorized operation. All subsequent focused-spec commands for that step use the same installation. The guidance command has no project selection flags because its authority is the invoked package, not a root's config.

The loader checks command completion and the response's protocol, package name/version, requested topic, and nonempty Markdown. Only then does it apply the workflow. Requests use `--protocol 1 --topic workflow --json` and, on demand, `--protocol 1 --topic runners --json`. Do not embed scenario syntax, config examples, runner implementation, or evidence rules in the loader.

### 4. Reload at workflow boundaries; no false enforcement claim

Every focused-spec workflow step obtains fresh workflow guidance, even in a continuing session; runner work obtains fresh runner guidance. This avoids relying solely on text read before a CLI upgrade. It is an agent procedure, not a hard sandbox: no CLI flag proves what arbitrary agents have read. A CLI update in the middle of a step requires reloading before continuing; opening a fresh session is the safest migration from legacy full-text instructions.

New black-box eval runs require both a successful loader read and a completed local guidance response before accepting activation. Match tool starts to completions and validate response provenance/content; failed calls, command starts, help, the runner topic alone, and unrelated global responses are insufficient. Preserve existing native execution, mutation, identity, approval, and integrity gates. Historical saved full-text-skill results remain immutable and retain their original contract.

### 5. Clean cutover without legacy support

Support only the new loader and CLI-owned guidance format. Remove obsolete full-text skill copies and reference paths; do not implement legacy readers, format conversion, aliases, shims, or fallback execution. An absent or pre-command CLI remains a negative compatibility check: refusal is the expected result, not an obligation to support it. Stable loader protocol compatibility between new-format package releases is retained; it is not legacy-format support.

The user will ask agents to migrate existing consumer projects separately. This change does not add migration tooling or preserve old integration formats for them. Document only the current installation contract and reload/fresh-session requirement. Verify the existing installer can discover and copy the new loader into an isolated consumer; do not overwrite unrelated custom instructions. Historical saved evals remain immutable records, not a supported legacy runtime mode.

## Executable evidence plan

All selectors below are intended apply-stage evidence, not executed planning checks. Existing tests are reused or updated only when their observable contract changes. New tests defend actual consumer responses or gate decisions, not internal field forwarding, source layout, or literal documentation wording.

| Native ID | Intended exact evidence |
| --- | --- |
| `guidance.delivery.offline` | `planned:vitest::test/cli.spec.ts::focused-spec CLI > serves workflow guidance without project setup` |
| `guidance.delivery.runners` | `planned:vitest::test/package.spec.ts::package distribution > serves complete runner guidance from the installed package` |
| `guidance.delivery.compatible-update` | `planned:vitest::test/package.spec.ts::package distribution > refreshes guidance after a compatible package replacement` |
| `guidance.delivery.incompatible-protocol` | `planned:vitest::test/cli.spec.ts::focused-spec CLI > rejects unsupported guide protocols without returning instructions` |
| `guidance.delivery.invalid-request` | `planned:vitest::test/cli.spec.ts::focused-spec CLI > rejects invalid guide requests with actionable help` |
| `guidance.delivery.incomplete-package` | `planned:vitest::test/package.spec.ts::package distribution > rejects missing authoritative guidance without fallback` |
| `distribution.package.agent-guidance` | `planned:vitest::test/package.spec.ts::package distribution > serves guidance from a source-independent packed installation` |
| `cli.help.overview` | `vitest::test/cli.spec.ts::focused-spec CLI > discovers commands and native options without reading project state` |
| `cli.help.validate` | `vitest::test/cli.spec.ts::focused-spec CLI > discovers commands and native options without reading project state` |
| `cli.help.run` | `vitest::test/cli.spec.ts::focused-spec CLI > discovers commands and native options without reading project state` |
| `cli.help.agent-guide` | `planned:vitest::test/cli.spec.ts::focused-spec CLI > explains guide compatibility without loading package guidance` |
| `agent.guidance.project-local` | `planned:vitest::test/evals.spec.ts::agent eval harness > rejects global guidance in place of the project installation` |
| `agent.guidance.unavailable` | `planned:vitest::test/evals.spec.ts::agent eval harness > rejects absent or legacy local guidance activation` |
| `agent.guidance.invalid-response` | `planned:vitest::test/evals.spec.ts::agent eval harness > rejects completed but unusable guidance responses` |
| `agent.guidance.session-refresh` | `planned:vitest::test/evals.spec.ts::agent eval harness > requires fresh guidance for a subsequent workflow step` |
| `agent.eval.failed-turn` | `vitest::test/evals.spec.ts::agent eval harness > records a failed agent turn without running downstream judges` |
| `agent.eval.protected-files` | `vitest::test/evals.spec.ts::agent eval harness > rejects protected test and package changes in an evaluated workspace` |
| `agent.eval.skill-activation` | `vitest::test/evals.spec.ts::agent eval harness > rejects agent turns that never load the focused-spec skill` |
| `agent.eval.native-cli-evidence` | `vitest::test/native-pilot.spec.ts::native pilot evaluation boundaries > recognizes completed selected CLI evidence without crediting validation or failed commands` |
| `agent.eval.guidance-activation` | `planned:vitest::test/evals.spec.ts::agent eval harness > requires completed local workflow guidance after loader activation` |

Consumer checks run the real installed CLI, observe complete returned guidance and failures, and audit project side effects. Compatible snapshots are independently owned disposable packages, not claimed published releases; keep the loader unchanged while replacing the installed package. Never rebuild shared `dist` during concurrent provisioning. Missing assets are removed only from the owned disposable installation.

Transcript/gate tests alone do not prove an agent follows the loader. After implementation, run the complete fresh real-model matrix below with the installed loader and unchanged blind prompts; a subset of affected cases is not completion evidence. Re-discover the available cases before running and include any subsequently added cases as well. Report authoring/evidence separately from native validation and lifecycle certification; an unavailable checker or unexercised lifecycle remains unverified, never a pass. Record the model, each command, result artifact, gates, exit status, and limitations. Do not retry unchanged failures until green or relabel historical runs.

### Mandatory full model-evaluation matrix

- All six current public cases: `files-source-bootstrap`, `vacuous-evidence`, `openspec-apply`, `openspec-brownfield`, `openspec-propose-apply`, and `full-skill-routing`.
- All seven native hosts: `openspec`, `spec-kit`, `kiro`, `bmad`, `gsd`, `agent-os`, and `gherkin`, each in default revision mode and `--create` mode. That is 14 native runs, not only the nine combinations exercised previously.
- At least 20 fresh model runs for the current matrix; new cases discovered during apply also belong to the complete run. No skipped case can be hidden behind a green aggregate.

Build once before the model runs. Discover public cases with `node --experimental-strip-types evals/run.ts --list`; invoke each via `node --experimental-strip-types evals/run.ts --case <case> --model <model> --timeout 1200`, adding `--openspec-skills .omp/skills` for OpenSpec cases. Invoke each native host via `node --experimental-strip-types evals/native-pilot.ts <host> <model>` and again with `--create`. Native exit 2 means unverified-only certification, not complete certification; report it explicitly. A model failure requires a substantive fix and a new observed run, never a weakened gate or retry-until-green.

In addition to this full matrix, run the bounded disposable model experiment for a competing global installation, an absent/pre-command local installation, an invalid response, and a compatible update between persisted-session steps. Verify actual local guidance acquisition and focused selected evidence, or explicit refusal for negative cases. These probes do not replace any standard eval.

For each independently changed executable outcome, prove its selected evidence observes a controlled product regression, restores cleanly, and passes again. A wrong request, missing test, runner error, or fake transcript is not a behavioral mutation of the claimed product outcome. Use disposable copies for package-reader/gate regressions; preserve user work. Register exact evidence only during authorized apply and replace every `planned:` reference before strict execution.

## Risks / Trade-offs

- **An old project still has obsolete instructions** → unsupported until its agent performs a separately requested cutover; no retained format or automatic detection claim.
- **LLM skips the loader or misunderstands JSON** → real-model eval plus completed-response activation judgment; no universal compliance claim.
- **Global CLI or source checkout leaks into execution** → explicit local invocation and independently packed, protected consumer fixtures.
- **Loader protocol becomes another rapidly changing API** → keep it limited to two guidance topics and provenance; avoid tying it to config/package versions.
- **Guide relocation breaks discoverability or links** → preserve skill metadata, exercise actual installer, update owning indexes and on-demand pointers.
- **Saved eval replay is mistaken for new verification** → keep saved results immutable and report fresh model runs separately.

## Migration Plan

1. During apply, move authoritative guidance, implement command/help, and replace the skill with the protocol-1 loader as one coherent cutover.
2. Integrate exact tests, working-scope registrations, updated gate/provisioning behavior, and owning docs. Do not bump the package version.
3. Exercise installed CLI and installer, protocol compatibility/refusal probes, the full public/native model-evaluation matrix, and controlled sensitivity checks; then run `npm test` and the working scope's focused evidence. Do not complete or archive after only a subset of evals.
4. Only after completed behavior/evidence, sync deltas, validate surviving specs, archive through the host workflow, and execute surviving evidence.
5. Consumer-project migration remains separately requested agent work. Do not ship a legacy runtime mode, automatic conversion, or a rollback shim; any operational package rollback is explicit and outside this implementation.

## Open Questions

None blocks implementation. The command name, two topics, default protocol, JSON schema, local-install policy, failure behavior, no-legacy cutover, and mandatory full evaluation matrix are specified above. Any discovered need to widen installation support or protocol negotiation must revise this change before implementation rather than add an unplanned fallback.
