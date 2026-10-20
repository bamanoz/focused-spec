# Design

## Context

See [proposal.md](./proposal.md) for motivation and scope. Observed implementation and governing contracts:

- `packages/core/src/instructions.ts` serves complete package-relative Markdown for `workflow`, `formats` and `runners`; it validates protocol 1 without loading configuration. `scripts/stage-assets.mjs` already copies the entire authored `guidance/` tree into the packed core.
- `skills/focused-spec/SKILL.md` is a workflow-first local-installation loader. `guidance/workflow.md` already owns phase, identity, approval, evidence reconciliation and sensitivity rules; `formats` and `runners` deliberately omit plugin catalogs. The completed [plugin-documentation delta](../expose-installed-plugin-docs/specs/agent-guidance/spec.md) preserves that boundary.
- `docs/guides/agent-install.md` currently embeds a partial format-selection table. That external page cannot be the portable runtime authority and does not cover the independent SDK paths.
- TypeScript `verifySpecification` already checks abort before execution and before/after action, awaits cleanup after successful preparation, and aggregates primary and cleanup errors. Its defect is passing the original abort-bearing `DriverContext` to cleanup. Go already uses `context.WithoutCancel(ctx)` while preserving values and explanations.
- The TypeScript direct runner already sends cooperative abort to its worker, allows a 500 ms grace period, and then force-kills it. A successful cleanup does not make a cancelled run pass; hard termination remains outside SDK release guarantees.
- Existing black-box public evals preinstall all their Markdown/inline/registry and Go/pytest packages. Their polyglot authentication assumptions cannot demonstrate choosing a previously absent SDK or leaving recommendation-only work unconfigured without case-specific provisioning and judgment.
- The earlier changes retain the workflow-strengthening obligation by name, without a more detailed acceptance list. This proposal explicitly defines that work in [agent-workflow](./specs/agent-workflow/spec.md): single canonical source, real application boundary, independent expectation and honest proof. It does not claim to recover missing historical wording.

The current master guidance spec predates completed `formats` and plugin-documentation deltas; this change's modified blocks retain their shipped behavior. `executable-scenarios` exists in the completed SDK delta but not yet in master specs. Preserve that capability identity and publish its baseline before this delta when lifecycle work is separately authorized; do not sync or archive earlier changes as a side effect of proposing or applying this one.

## Goals / Non-Goals

**Goals:** Core-only, offline composition selection; a thin universal execution workflow; explicit authorization boundaries; application-grounded evidence across existing text and executable paths; TypeScript resource release with Go-equivalent cancellation independence.

**Non-Goals:** An automatic architecture detector, package enumerator/installer in `instructions`, a required project decision-manifest, a host-to-plugin compatibility matrix, automatic format migration, a new scenario grammar, SDK dependencies on core, retries, or a new cancellation/event/runner protocol. These exclusions do not exclude any of the three requested workstreams.

## Decisions

### 1. Add one on-demand `integration` topic without changing the loader protocol

Author `guidance/integration.md`; extend the topic validation and help in `packages/core/src/instructions.ts`, plus any general CLI help that enumerates topics. Use the same package identity, complete Markdown response and fail-closed behavior as existing topics. Keep `workflow` as default and protocol 1 unchanged; do not add an alias or make the loader retrieve all topics eagerly.

The installed loader still resolves the local CLI and loads workflow first. Workflow requests `integration` only for first integration or an explicitly requested composition change, with a standalone command:

```text
<project-local-focused-spec> instructions --protocol 1 --topic integration --json
```

The response must match the same installation's package/version, protocol 1, topic `integration`, and nonempty complete content. Missing or empty topic assets stop that work; another topic or repository page is not a fallback. An existing supported configuration remains authoritative for ordinary tasks. An incompatible existing configuration follows the existing upgrade procedure rather than being mistaken for a greenfield project.

**Rejected:** Putting selection in the loader would duplicate portable procedure; putting it in every workflow response would burden already-configured work; keeping it only on GitHub would break offline and installed-version authority.

### 2. Break the bootstrap cycle with orientation, not copied plugin manuals

The integration topic gives the agent a decision procedure before optional packages exist:

1. Establish project/workspace dependency ownership, task phase and permission, current host/authoring process, canonical native source, existing enrollments and real application/test runtime. Use repository facts before asking; ask only for genuinely unresolved choices with materially different ownership or authoring consequences.
2. Preserve supported existing choices. An OpenSpec or Spec Kit label alone never selects a format. The inline dialect is an option only where its native authoring contract fits; do not rewrite native acceptance items to make that option fit.
3. Recommend the smallest compatible composition, explaining the retained source, evidence owner, execution path, needed packages/prerequisites, and what is deliberately not being installed. Multiple real domains may retain different explicitly configured paths; never claim two adapters own the same item.
4. Read selected public package documentation when available before installation; absence of that package locally does not prevent preliminary orientation. Install only within authorization, then obtain the exact installed package contract through separate `plugin-docs` requests before writing plugin configuration. Follow composed dependencies only as that package documents. A mismatch causes reconsideration or a precise blocker, not guessed syntax.
5. Under authorized integration, bind and exercise the first in-scope native outcome, then the completed configured scope. Installation-only and recommendation-only work stop at their actual boundary, with missing configuration/evidence explicit.

Keep the capability map small and explicitly illustrative:

| Need | Candidate capabilities, not mandatory combinations |
| --- | --- |
| Existing native Markdown or Gherkin, separate evidence ownership | Registry plus a compatible native parser; official examples are `@focused-spec/format-registry` with `@focused-spec/format-markdown` or `@focused-spec/format-gherkin` |
| Standalone text scenarios | `@focused-spec/format-inline` and the runner matching existing evidence |
| Existing test framework | Compatible installed/project runner first; official examples include `@focused-spec/runner-vitest`, `@focused-spec/runner-pytest`, `@focused-spec/runner-go` |
| Native JS/TS executable scenarios | Independent `@focused-spec/scenarios-typescript`; optional `@focused-spec/format-scenarios-typescript` and `@focused-spec/runner-scenarios-typescript` when CLI integration is requested |
| Native Go executable scenarios | Independent Go module `github.com/bamanoz/focused-spec/packages/sdk/go`; optional npm Go scenario format/runner for CLI integration |

The Go module is not an npm package. Respect its documented publication/distribution prerequisites; do not invent a successful remote module installation. Core contains no dialect, selector grammar or copied configuration schema for these packages. The map is not an allowlist and cannot certify compatibility of a candidate; custom and third-party plugins remain governed by their public contracts.

Human installation pages should bootstrap core, initialize the selected agent integration, activate the loader and point to this topic when integration is requested. Replace their competing selection procedure with a concise handoff. A short illustrative install example may remain, clearly conditional rather than another authoritative decision tree. No extra human-facing integration guide is needed.

### 3. Strengthen the universal workflow without selecting a representation for the user

Add a short integration entry gate and an application-grounded authoring section to `guidance/workflow.md`; retain existing phase, identity, AND, approval, sensitivity and publication obligations rather than writing a second workflow.

For every changed outcome, require the agent to identify the canonical native claim, real application entry point, actual observation, independently authored expectation, exact execution path and reversible product regression that should break it. These are reasoning/checking obligations, not new persisted metadata fields or mandatory project artifacts.

For code scenarios, Given/When/Expect are the native item. The driver prepares and calls the real application and exposes the claimed result; it must not implement the domain decision itself, read Expect as Actual, or generate both sides from one application invocation. A deterministic projection is legitimate only if it retains the observable distinctions the scenario claims. Ordinary test wrappers and CLI plugins execute the same suite; neither demands a Markdown copy or registry.

For native textual items, retain their canonical source and assert the claimed behavior through selected real tests. Existing suitable tests need not be rewritten into SDK scenarios. Explanations describe decisions but are not assertions, an Actual event is not itself an equality check, and codec roundtrips protect a different boundary. Neither logs nor green serialization can override failed application comparison or establish historical wire compatibility.

SDK-only execution remains legitimate: run its native suite and sensitivity proof without requiring focused configuration. If CLI integration is requested, also validate/execute the selected occurrence and final configured scope. Keep exact PASS → selected behavioral FAIL under product regression → restored PASS, with explicit limits when no safe probe exists. Never count missing targets, setup/runner errors, skips, changed tests or unrelated failures as sensitivity.

### 4. Give TypeScript cleanup a cancellation-free context

In `packages/sdk/typescript/src/index.ts`, keep passing the original context/signal to preparation and action. For an existing cleanup callback, pass a context preserving `scenarioId` and the same `explain` closure but omitting `signal`. If no signal was supplied, the original context may be reused; do not allocate a new `AbortController`, attach listeners or allocate release state when cleanup is absent.

Removing the property, rather than replacing it with an always-live signal, respects the existing optional `DriverContext.signal` type and directly expresses the cancellation-free release phase. A cleanup operation needing its own bound creates that bound itself. Do not add an SDK timeout or race release against cancellation.

Preserve the existing lifecycle:

| Transition | Observable result |
| --- | --- |
| Already aborted before preparation | Reject original abort reason; no preparation/action/cleanup |
| Preparation fails | Reject preparation failure; driver owns partial resources; no SDK cleanup |
| Preparation succeeds but signal is aborted | Skip action; await cleanup; reject cancellation |
| Action fails, returns invalid data, comparison fails, or observer throws after preparation | Await cleanup exactly once; preserve primary failure |
| Action returns matching data after caller aborts | Reject cancellation before Actual/comparison; await cleanup |
| Cleanup succeeds after primary failure | Reject unchanged primary failure |
| Cleanup fails after primary failure | `AggregateError.errors` retains primary first, cleanup second |
| Cleanup fails after otherwise successful verification | Reject cleanup failure |
| Caller aborts after cleanup starts | Cleanup's context stays cancellation-free; await release; do not introduce a new post-cleanup cancellation checkpoint |

Keep the current event contract and snapshot behavior unchanged. Cleanup can still explain the real release through the same execution-local channel; it must not manufacture Actual for a cancelled action. Go's behavior remains the reference, not a target for a parallel rewrite.

Exercise cancellation through the real direct runner as well as the independent SDK. Cooperative release within the existing 500 ms grace must free the resource before the owned worker exits; noncooperative work remains subject to forced termination and may not clean up. Do not change the runner timeout protocol just to make this check green.

### 5. Verify decisions and behavior, not instruction wording

Extend the existing CLI/package checks for offline core-only integration delivery, same-installation provenance, text/JSON agreement, unchanged project tree, unknown topics and missing/empty assets. Reuse existing staging and clean-consumer helpers. Do not add tests pinning sentences or checking that source contains a handoff.

Extend existing eval infrastructure instead of creating another agent transport or result store. Add focused case provisioning and judgment in `evals/integration.ts`, wired through `evals/types.ts`, `evals/cases.ts`, `evals/provision.ts`, `evals/harness.ts` and `evals/judge.ts` as needed. Case fixtures live under `evals/cases/`. Make initial package inventories case-specific: the current blanket preinstallation cannot prove discovery of an absent package. Use the existing isolated candidate-serving/package-manager pattern for unpublished packed plugins; never have agents inspect repository implementation.

The case contracts are:

- `integration-native`: unconfigured native acceptance items and existing tests; verify retained native source, selected parser/binder/runner, installed documentation acquisition and real evidence, without prescribing a host-to-package rule in the prompt.
- `integration-standalone`: separate task variants request inline text, JS/TS code or Go code. Judge the requested canonical source, runtime/prerequisites and minimal installed composition; SDK-only variants require no focused configuration or CLI plugin packages.
- `integration-boundaries`: separate recommendation-only and core/agent-installation-only variants; compare filesystem/dependency changes against authorization and reject fabricated evidence readiness. Existing-config variants verify no representation conversion during an ordinary revision.
- `executable-authoring`: real application plus editable suite/driver, protected expected-boundary checks and a controlled product mutation. Reject fake driver logic, Expect-to-Actual echo, an oracle derived from the same execution and projections hiding the wrong outcome. Require a single code source; diagnostic/codec success cannot mask a comparison failure.

Prompts express user goals, not topic names, package choices, IDs, selectors or hidden gates. Reuse independent transcript activation, installed-package integrity, exact execution, controlled-regression and immutable-result conventions. Add deterministic judge boundary checks in `test/evals.spec.ts` so plausible false passes are rejected; those tests do not substitute for fresh model runs. Case variants must remain separately reported rather than collapsed into one green result.

### 6. Exact apply-time evidence plan

This turn adds only planning artifacts and native markers. During apply, extend existing capability-owned `.focused-spec/evidence/agent-guidance.yaml`, `agent-workflow.yaml` and `executable-scenarios.yaml` under scope `guide-integration-and-align-scenario-lifecycle`. Do not create an extra registry or alter unrelated scopes. The following are intended exact references, not current executable enrollments or claims that new tests exist.

Guidance references use `vitest::test/cli.spec.ts::focused-spec CLI > <name>` unless stated otherwise:

| Native ID | Exact test name or full reference |
| --- | --- |
| `guidance.delivery.offline` | `serves workflow guidance without project setup` |
| `guidance.delivery.runners` | `vitest::test/package.spec.ts::package distribution > serves complete runner guidance from the installed package` |
| `guidance.delivery.formats` | `serves format guidance without loading project configuration or plugins` |
| `guidance.delivery.command-name` | `rejects invalid invocations without treating them as successful help` |
| `guidance.delivery.integration` | `vitest::test/package.spec.ts::package distribution > serves integration guidance from core alone offline` |
| `guidance.delivery.compatible-update` | `vitest::test/package.spec.ts::package distribution > refreshes guidance after a compatible package replacement` |
| `guidance.delivery.incomplete-package` | `vitest::test/package.spec.ts::package distribution > rejects missing authoritative guidance without fallback` |
| `guidance.delivery.formats-incomplete` | `rejects missing format guidance without falling back to other topics` |
| `guidance.delivery.integration-incomplete` | `rejects missing or empty integration guidance without fallback` |

Workflow references use `vitest::test/evals.spec.ts::agent eval harness > <name>`. Tests exercise independently judged consumer artifacts, actual command outcomes and side-effect boundaries, not wording. Fresh black-box runs additionally prove the instruction's effect on agents.

| Native ID | Exact test name |
| --- | --- |
| `agent.integration.preserve-existing` | `rejects unauthorized conversion of an existing integration` |
| `agent.integration.route-selection` | `requires completed local integration guidance for composition selection` |
| `agent.integration.native-source` | `rejects replacement of native acceptance items during integration` |
| `agent.integration.standalone-choice` | `judges standalone compositions against the requested canonical source` |
| `agent.integration.phase-boundaries` | `rejects configuration writes during recommendation or installation only` |
| `agent.integration.selected-contracts` | `requires selected installed contracts before integration configuration` |
| `agent.workflow.single-source` | `rejects duplicate behavioral sources beside executable scenarios` |
| `agent.workflow.application-boundary` | `rejects executable evidence disconnected from the mutated application` |
| `agent.workflow.independent-oracle` | `rejects observations that conceal the claimed application regression` |
| `agent.workflow.proof-not-diagnostics` | `rejects diagnostic success when selected behavioral comparison fails` |

SDK references use `vitest::test/executable-scenarios.spec.ts::executable scenarios > <name>`:

| Native ID | Exact test name |
| --- | --- |
| `executable-sdk.cleanup` | `cleans up failures and preserves both errors` |
| `executable-sdk.cleanup-cancellation` | `releases prepared resources after cancellation without losing failures or explanations` |
| `executable-sdk.cleanup-awaited` | `awaits cancellation independent asynchronous cleanup` |
| `executable-sdk.preparation-ownership` | `does not clean an unprepared subject after preparation fails` |
| `executable-sdk.cancel-before-preparation` | `does not acquire resources for pre aborted execution` |
| `executable-sdk.cancel-after-preparation` | `skips the action and releases resources after preparation cancellation` |
| `executable-sdk.cancel-after-action` | `rejects a matching action result after cancellation` |

Use synchronized barriers, explicit abort reasons, real temporary resources and observed settlement to avoid timing-only assertions. Extend the existing cleanup test rather than duplicating it. Add a real packed SDK consumer check and a selected direct-runner cancellation smoke using these same resource semantics; assert no PASS and released resources, not internal forwarding calls. Do not weaken existing observer-error, mismatch or input-isolation checks.

## Risks / Trade-offs

- A core-owned orientation map can drift from packages → keep only names/capabilities, verify packing/publication prerequisites, and require the exact installed document before configuration. No copied dialect or selector examples in the topic.
- Selecting a new source changes project ownership → preserve supported current choices, present material alternatives only when facts do not decide, and require authorization for conversion. Configuration is the runtime record; no new mandatory decision file.
- Cancellation-independent release can hang → retain driver-owned release bounds and existing runner grace/forced kill; do not claim forced cleanup. Removing `cleanup`'s caller signal is a deliberate behavioral change despite unchanged types.
- A deterministic judge test cannot certify agent understanding → retain fresh case/model transcripts and independent application mutations. Missing model/runtime or an unrun case is unverified, not PASS.
- Completed unarchived deltas overlap this work → preserve their full modified blocks and explicit baseline dependencies. Do not overwrite their evidence or silently publish them.

## Migration Plan

1. Implement the new package-owned topic and workflow handoff without changing protocol 1, loader defaults or supported plugin APIs. Update existing installation/docs owners to point to the local topic; refresh generated assets through the normal build.
2. Change only TypeScript cleanup's context contract; document the signal omission and verify cancellation/error/event boundaries. Existing cleanup implementations must tolerate the already-optional signal; advise callers needing a release deadline to create their own.
3. Implement case-specific black-box verification and enroll all 26 occurrences in their existing capability owners only after their exact tests exist. Remove every planned reference before strict validation and execution.
4. Run narrow checks, actual packed/offline and cancellation paths, `npm test`, exact scoped evidence and the fresh evaluation matrix required by the existing [agent eval contract](../../../docs/development/agent-evals.md). Record model/runtime, invocation, immutable result and any unverified host lifecycle separately. Do not certify a partial matrix.
5. Keep sync/archive as separately authorized OpenSpec lifecycle operations. When authorized, publish the pending executable SDK baseline and preserve all surviving scope-local evidence before applying this delta to master specs. Rollback uses a coherent package/guidance revision, not a fallback to stale instructions or mixed topic assets.
