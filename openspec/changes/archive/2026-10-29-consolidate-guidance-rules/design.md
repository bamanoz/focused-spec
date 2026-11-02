# Design

## Context

See [proposal](./proposal.md). The installed CLI reads one existing `guidance/<topic>.md` asset and returns it unchanged; `scripts/stage-assets.mjs` copies those assets into core. Neither mechanism needs modification. The workflow is always acquired before its focused topic, and focused topics may explicitly route to another existing topic.

Observed duplication includes the identical document-selection paragraph in `formats:18` and `runners:13`, near-identical acquisition procedures in author/review/upgrade/integration, driver constraints in author/review/verify, and sensitivity requirements or delegations in all eight topics. This is evidence of maintenance overlap, not of observed model failure or measured execution overhead.

Current UTF-8 Markdown baseline, measured while preparing this proposal:

| Topic | Bytes |
| --- | ---: |
| workflow | 5,993 |
| review | 7,127 |
| author-revise | 13,031 |
| upgrade | 8,902 |
| verify | 8,762 |
| integration | 11,695 |
| formats | 8,975 |
| runners | 10,455 |
| Total | 74,940 |

`test/package.spec.ts` already checks the 6,000-byte router and 14,000-byte focused-topic bounds. The router has almost no spare capacity: consolidation cannot mean appending all repeated prose to it.

## Goals / Non-Goals

**Goals:** make one existing topic own each full procedure, retain short safety reminders at the point of action, and keep the installed route usable without repository documents. Reduce the total authored guidance bytes while preserving each existing outcome and the compact router.

**Non-Goals:** no phase model, host adapters, new topic, fragment/template compiler, runtime composition, CLI/loader/protocol change, or requirement to mutate every scenario beyond the current policy. The current policy itself remains unchanged; its reconsideration stays in block 2. Other improvement blocks remain outstanding. No new permanent test solely to assert wording, paragraph counts, file placement or ownership labels.

## Decisions

### 1. Consolidate within existing Markdown, with explicit owners

| Rule family | Full procedure owner | What other topics retain |
| --- | --- | --- |
| Actual host phase, universal permissions, selected executable/root and topic acquisition | `workflow` | Local stop conditions; author/review/upgrade-specific actions, not another universal phase taxonomy |
| Shared plugin-document acquisition, response provenance and explicit composed-package follow-up | `workflow` | Which format/runner/package is needed and when, plus reference to the router's acquired procedure |
| Authoring, exact identity/evidence reconciliation, full approval contents and deferred-work handoff | `author-revise` | Review defect checklist, upgrade inventory, format normalization rules and unchanged local AND/identity safety checks |
| Application observation, independent expectation and proof limitations | `verify` | A short real-application/independent-expectation invariant and the questions needed for authoring or read-only review |
| Sensitivity applicability, baseline/failure/restoration procedure and verification report | `verify` | An explicit authorized-verification handoff, not another independent definition of when mutation is required |
| Host transition verification: working checkpoint and final surviving occurrence | `verify` | Host ownership and reconciliation reminders; authoring keeps binding repair, upgrade keeps migration inventory |

An owner is an editing responsibility, not a new product abstraction. Existing format/runner API-specific obligations remain in `formats`/`runners`; integration selection and .NET installation remain in `integration`; upgrades remain in `upgrade`.

The shared plugin section in the router must retain the three existing request selections (`--format`, `--runner`, `--package`), explicit consuming root, registration-only `--config`, exact returned selection/package-or-module/root/document validation, dependency-text trust boundary, missing-contract stop, prohibition on implementation/fallback discovery, and explicit sequential composed-package requests. Do not force runner-only users to acquire `formats`, or format-only users to acquire `runners`, merely to obtain this common procedure. Detailed lookup reference material already owned by `docs/reference/cli.md` need not be copied into every topic; installed guidance must still contain all checks an agent needs before relying on a returned contract.

Make room by replacing the router's full sensitivity paragraph with a concise invariant and `verify` dispatch and by tightening repeated routing/boundary prose. Do not exceed its existing bound or move procedure into the loader to hide the size increase. New or changed evidence must still reach the complete verification procedure before completion.

Rejected alternatives: a ninth common topic adds acquisition overhead; shared fragments/build-time expansion add machinery and can re-expand delivered duplication; retaining full parallel copies keeps the drift problem.

### 2. Keep useful repetition and phase-correct handoffs

A short prohibition where a mistake can happen is intentional repetition. Review remains read-only and can assess a driver without executing or acquiring the full mutation procedure. Authoring retains application-grounding questions and complete approval contents before writes. Upgrade retains migration-loss checks. They must not become vague instructions to read every other topic.

A reference names an existing topic and uses the selected executable's established acquisition/identity/recovery contract. A repository-relative Markdown link alone is not a usable installed handoff. Missing requested guidance remains blocking; other topics cannot substitute. Do not add unconditional new acquisitions to every route. Where format/runner verification previously referenced the workflow's short regression paragraph, explicitly acquire `verify` for the full procedure when that execution is authorized. Record any added request rather than claiming deduplication is free.

Keep SDK-only paths on their native suite without focused configuration/plugins or a text companion. No host approval is inferred from tests already existing, a wording-only request, or a topic read. Complete native approval/handoff and all outstanding user obligations remain explicit.

### 3. Preserve contracts instead of inventing delta requirements

`skip_specs: true` is deliberate: this change reorganizes procedure without changing `agent-guidance`, `agent-workflow` or `plugin-documentation` behavior. Do not add new native scenarios, IDs, registry entries, planned references or assertions just to enroll an editorial refactor. Existing exact evidence remains unchanged unless apply discovers a genuine contract conflict, which must be surfaced rather than silently changing the contract.

Intended evidence during apply, not executable integration in this proposal:

| Preserved outcome | Existing exact evidence / black-box case |
| --- | --- |
| Complete installed topics, compact responses and no source-checkout dependency | `vitest::test/package.spec.ts::package distribution > ships a compact loader and complete focused guidance topics`; `vitest::test/cli.spec.ts::focused-spec CLI > serves focused guidance topics without project setup` |
| Missing requested guidance cannot fall back | `vitest::test/cli.spec.ts::focused-spec CLI > rejects missing or empty focused guidance without fallback`; existing format/integration missing-guidance checks |
| Installed plugin contracts remain separate and provenance-bound | `vitest::test/package.spec.ts::package distribution > reads composed plugin documentation through separate packed-consumer requests`; `vitest::test/evals.spec.ts::agent eval harness > accepts complete selected contract artifact recovery before configuration writes` |
| Driver cannot echo Expect or conceal the application's result | `vitest::test/evals.spec.ts::agent eval harness > rejects executable evidence disconnected from the mutated application`; `vitest::test/evals.spec.ts::agent eval harness > rejects observations that conceal the claimed application regression`; fresh `executable-authoring-sdk` and `executable-authoring-cli` |
| Read/revise preserves exact identity, current assertions and AND evidence | Fresh `spec-evidence-revision` |
| Proposal remains planning-only and later apply completes its evidence | Fresh `inline-propose-apply` |
| Surviving final enrollment is explicit rather than inherited | Fresh `inline-lifecycle` |
| Upgrade preserves the selected composition, outcomes and every evidence member | Fresh `project-upgrade` |

Deterministic delivery/judge tests establish those tests' observed behavior, not agent compliance with edited prose. Fresh black-box cases assess the latter. Use the existing harness and protected files unchanged; retain every result and report unavailable validators or provider interruptions. The recent 40/40 matrix remains the historical baseline, not proof for new guidance and not a reason to rerun the full matrix merely to rediscover that baseline.

### 4. Measure the actual simplification

Before editing, refresh the byte baseline if source has changed. After editing, report bytes for all eight topics and total, enforce existing delivery bounds, and compare common routes: workflow + review; workflow + author-revise + verify; workflow + integration + the selected shared topic + verify; workflow + upgrade + formats/runners + verify. Report repeated topic acquisitions separately and keep plugin-document bytes separate from core guidance. A smaller source total must not hide an expanded mandatory route or a lost contract.

No fixed percentage, token saving, speedup or model-score improvement is promised. Acceptance is removal of full duplicated procedures, preserved route outcomes, a smaller total guidance payload and a still-compact router. Additional authorized verification acquisition is an explicit trade-off, not a new completion-state subsystem.

## Risks / Trade-offs

- Over-compression hides a safety rule before the relevant action → retain short local invariants and operation-specific checklists; verify both SDK and configured routes.
- The router grows past its current limit → rebalance existing prose rather than increasing the bound, extending the loader or introducing another topic.
- A reference makes read-only review execute checks or read unrelated topics → gate transitions on the actual operation and host permission; preserve review-only completion.
- Consolidation accidentally relaxes mutation, approval or lifecycle requirements → compare against the existing contracts and the six targeted black-box cases; block 2 remains a separate decision.
- Text shrinks but acquisition cost rises → report route payload and actual requests, not source-byte reduction as token/time evidence.

## Migration Plan

After a new explicit apply request, edit only the eight authored topics and necessary owning documentation. Keep build/staging/CLI/loader and existing requirement/evidence contracts unchanged. Run focused delivery checks, real packed/offline CLI smoke, `npm test` and the targeted fresh agent cases without overlapping shared-build validation. Update block 3 and relevant ownership pointers; review the README's source-checkout versus release claims. Verify documentation links.

This proposal changes no installed consumer. Any later distribution uses ordinary package build/release and guidance refresh; no release is authorized here. If verification finds lost behavior, repair or revert only this change's editorial edits and preserve unrelated work and immutable eval results.
