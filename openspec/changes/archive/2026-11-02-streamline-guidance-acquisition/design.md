# Design

## Context

See [proposal.md](./proposal.md) for the motivation and [specs/agent-guidance/spec.md](./specs/agent-guidance/spec.md) and [specs/agent-workflow/spec.md](./specs/agent-workflow/spec.md) for the changed contracts. Today `instructions` serves exactly one topic. The authored loader performs `version --json`, then a standalone `workflow` request, then a separate standalone operation-topic request. Several operation topics already direct back to workflow-owned acquisition steps, so the current exchange duplicates both calls and router content. The black-box harness accepts current workflow guidance and separately verifies loader skill activation; existing BDD activation scenarios are covered by `broaden-bdd-skill-activation` and must not be undone.

## Goals / Non-Goals

**Goals:** Deliver the router and requested operation guidance from the same installed package in one protocol-1 response; retain package/version/protocol/topic validation and offline behavior; narrowly exempt only meaning-preserving editorial cleanup; assess acquisition and trigger behavior using isolated public eval cases.

**Non-Goals:** Change the protocol number or topic names; merge shared format/runner/plugin contract requests into operation guidance; weaken fail-closed handling of malformed, incomplete, truncated, or wrong-installation responses; make the focused-spec CLI a runtime dependency for SDK execution; or add OpenSpec/Spec Kit integrations.

## Decisions

### Return router context within operation responses

For a request of `review`, `author-revise`, `upgrade`, or `verify`, retain the protocol-1 response envelope and exact requested `topic`, and compose `content` from the package-owned workflow router plus the selected topic under clear headings. Keep `workflow` as router-only. Keep shared `integration`, `formats`, and `runners` requests distinct: they are separately routed capabilities and do not implicitly append workflow or other topic text. Preserve each topic's own asset and provenance; do not copy router procedure into every authored topic.

A combined response is preferable to adding a new protocol/topic because existing callers continue to ask for the same topic and validate the same envelope. The loader can get version and package identity from that completed response, removing the separate `version --json` call while leaving the version command intact for its current public use. It must still verify the exact selected installation, package name, nonempty version/content, protocol, and requested topic before treating output as guidance. The version field is identity data from the package serving the topic, not a claim of compatibility with an arbitrary API.

### Keep acquisition recovery and security checks

The standalone acquisition boundary remains: each `instructions` call is its own command, never chained with checks, installation, help, or another request. The router-plus-operation content is one response, so host truncation recovery must retrieve the complete output for that same successful call and validate the whole envelope and both distinguishable sections. No partial operation text, extracted content field, other call's artifact, or fallback guidance may count. Plugin documentation remains a separate request for each exact selected installed contract and continues resolving from the consuming project root; operation bundling does not authorize or silently acquire any package.

### Preserve broad activation; exempt only inert copy edits

Update the loader description to name the positive scope: behavioral BDD/SDD outcomes, executable Given/When/Expect scenarios, and associated application drivers. Describe the narrow exception only in terms of spelling, punctuation, or formatting whose final change leaves every related behavioral meaning, scope, condition, outcome, identity, selector, and evidence association unchanged. If the proposed edit has uncertain behavioral effect, touches evidence, or revises an outcome, mandatory activation remains. This addresses activation overhead without reverting the approved host-independent BDD expansion. Do not replace it with a keyword-based trigger or narrow it to OpenSpec, Spec Kit, named frameworks, or requirements only.


### Keep the authored guidance concise

The review measured approximately 88 KB across the loader and eight shipped topics and found the router at about 5,996 characters against the observed 6,000-character limit. Treat those as review-time measurements to recheck during apply, not compatibility constants. Remove repeated procedure and verbose nominalized phrasing where a single clear statement is sufficient; keep safety, provenance, approval, SDK-only, validation, and failure boundaries explicit. Do not shrink the loader/router by moving critical procedure into an uncited topic or relying on implied behavior. Record before/after byte counts per authored file and verify all required contract sections remain in the delivered package assets.
### Use isolated, same-model live evaluation cases

Add focused cases for (1) selecting the installed CLI and acquiring a requested operation through one router-plus-topic call while checking package/version/topic and preserving the host workflow boundary, and (2) distinguishing inert editorial cleanup from behavioral SDD and standalone BDD/driver requests. Use existing fixture/harness protections and immutable results; do not create a separate evaluation mechanism or judge source wording. Run these two cases individually with the same explicit model before any broader model matrix. Deterministic CLI tests establish response shape, invalid protocol/topic rejection, offline operation, and router-only behavior; live runs assess whether an agent uses the combined path and respects the trigger distinction. Neither alone establishes universal model compliance.

### Exact evidence

Apply will enroll the following intended selectors in the capability-owned `.focused-spec/evidence/agent-guidance.yaml` under this change's scope. The new live case selectors remain planned until implemented. Lists are AND contracts; retain all members and the native-evidence ownership convention.

| Native ID | Intended Vitest evidence | Live behavior proof |
| --- | --- | --- |
| `guidance.delivery.combined-operation` | `vitest::test/guidance-acquisition.spec.ts::combined guidance acquisition > serves the exact installed operation identity and both complete sections offline without project changes` | `guidance-combined-operation` |
| `guidance.delivery.combined-router-only` | `vitest::test/guidance-acquisition.spec.ts::combined guidance acquisition > keeps a workflow request router-only and leaves shared topics distinct` | `guidance-combined-operation` |
| `guidance.delivery.combined-invalid-preserves-validation` | `vitest::test/guidance-acquisition.spec.ts::combined guidance acquisition > rejects unsupported protocol and invalid topic without emitting guidance`; `vitest::test/guidance-acquisition.spec.ts::combined guidance acquisition > fails closed when either installed combined asset is absent or empty` | `guidance-combined-operation` |
| `guidance.plugins.operation-with-router` | `vitest::test/guidance-acquisition.spec.ts::combined guidance acquisition > serves the exact installed operation identity and both complete sections offline without project changes` | `guidance-combined-operation` |
| `agent.activation.editorial-only` | `vitest::test/evals-activation.spec.ts::agent eval harness > exempts only editorial cleanup from per-turn skill and guidance activation` | `guidance-skill-trigger-boundaries` |
| `agent.activation.bdd-sdk` | `vitest::test/evals-activation.spec.ts::agent eval harness > rejects SDK-only BDD turns without skill and local workflow activation`; `vitest::test/evals-integration.spec.ts::agent eval harness > judges standalone compositions against the requested canonical source` | `guidance-skill-trigger-boundaries` |
| `agent.activation.bdd-driver` | `vitest::test/evals-activation.spec.ts::agent eval harness > rejects SDK-only BDD turns without skill and local workflow activation`; `vitest::test/evals-integration.spec.ts::agent eval harness > rejects duplicate behavioral sources beside executable scenarios`; `vitest::test/evals-integration.spec.ts::agent eval harness > rejects executable evidence disconnected from the mutated application` | `guidance-skill-trigger-boundaries` |
| `agent.activation.sdd` | `vitest::test/evals-activation.spec.ts::agent eval harness > stops an OpenSpec turn before judging artifacts if the agent skipped the skill`; `vitest::test/evals.spec.ts::agent eval harness > rejects a proposal that creates configuration or a planned evidence registry` | `guidance-skill-trigger-boundaries` |

The cases are intentionally narrow additions. Existing standalone SDK, driver-sensitivity, and `full-skill-routing` checks remain independent controls; do not rewrite or remove them to make these new cases pass.

## Risks / Trade-offs

- [Combined output is longer and may still be clipped by a host] → Remove a complete redundant acquisition, but retain recovery of the exact complete response and reject incomplete content; keep the shared router concise.
- [Appending router text could make operation topics ambiguous] → Use clear router/operation headings in deterministic composition and verify both full sections are delivered.
- [Editorial exception could be misread to exempt semantic changes] → Define it by the resulting preserved semantics and enumerate identity/evidence boundaries; uncertain changes remain in scope.
- [A live model may take an alternate path or misclassify a task] → Keep model results separate and immutable, test both requested cases with the same explicit model, and report failure or timeout rather than infer compliance.

## Migration Plan

1. Update protocol-1 instruction composition and command tests; keep the requested topic and existing version and error contracts.
2. Update the authored loader to validate identity/version from the operation response and remove only the redundant version and workflow-only requests for an operation step. Preserve router-only requests when no operation guidance is needed. Rebuild/stage assets through the normal package path rather than editing generated mirrors.
3. Revise trigger wording and owning guidance/evaluation documentation without changing the approved broad BDD trigger.
4. Add the isolated eval cases and run each separately with the same explicit model before any matrix; retain immutable results and report actual failures/timeouts.
5. In apply, enroll exact intended evidence, run focused checks, then validate and execute the complete changed scope. Publication and consumer installation refresh remain separate operations.

Rollback restores the prior authored loader and instruction composition and rebuilds package assets; protocol-1 clients and package installs do not require a configuration migration. Existing loaders can continue acquiring workflow plus topic separately until their normal refresh.

## Apply verification

Byte baseline is the pre-change committed authored source; sizes are UTF-8 bytes, not protocol-version limits. The loader is 3923 bytes (under 4,000); the router is 5,983 bytes (under 6,000). Combined acquisition removes separate version and router requests; total source bytes are not a latency measurement.

| Authored asset | Before bytes | After bytes |
| --- | ---: | ---: |
| `skills/focused-spec/SKILL.md` | 3200 | 3923 |
| `guidance/workflow.md` | 5996 | 5983 |
| `guidance/review.md` | 5757 | 5757 |
| `guidance/author-revise.md` | 11147 | 11147 |
| `guidance/upgrade.md` | 8252 | 8423 |
| `guidance/verify.md` | 8823 | 8823 |
| `guidance/integration.md` | 11930 | 11930 |
| `guidance/formats.md` | 7037 | 7037 |
| `guidance/runners.md` | 8892 | 8892 |

The unchanged broad BDD/SDK-driver/SDD requirement is retained explicitly in this delta so task 4.1 can enroll all eight requested IDs without orphan registry rows or changing their semantics.

Both isolated live cases passed with `externcash/gpt-6.1-sol`: combined operation at `focused-spec-eval-guidance-combined-operation-LQ0k7D`, trigger boundaries at `focused-spec-eval-guidance-skill-trigger-boundaries-nPc63v` (independently owned temporary workspaces). Editorial turn loaded no skill; SDD, SDK and driver turns loaded it. SDK and driver assertions independently observed PASS → real product assertion FAIL → exact restoration PASS. Earlier provisioning failures and earlier judge failures remain historical failures; replay is not substituted for these fresh runs. The configured change scope separately passed all 11 occurrences / 13 unique deterministic targets.

