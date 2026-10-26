# Design

## Context

See [proposal](./proposal.md) and [workflow delta](./specs/agent-workflow/spec.md). This is a planning artifact, not an implementation or certification claim.

### Measured baseline

The immutable batch is `.eval-cache/evals-env-20261025-jnr1YF/`: `matrix.json`, `manifest.json`, `credential-provenance.json`, `candidate-integrity.json`, and `failure-recommendations-final.json`. It used `externcash/gpt-6.1-sol`, completed 26 public plus 14 native invocations, recorded no provider-402 response in scored transcripts, and reported unchanged candidate assets. Public results: 17 passed, nine failed. Native results: seven authoring/evidence pairs passed, seven failed; ten native validators and twelve lifecycle aspects remained unverified. None of the 14 native invocations was fully certified. Do not call the 24 non-failing invocations 24 certified passes.

Failure classification, grounded in saved commands rather than diagnostic interviews alone:

| Mechanism | Invocations | Evidence / interpretation |
| --- | --- | --- |
| Missing native enrollment | Revision: openspec, spec-kit, kiro, gsd, agent-os, gherkin; creation: spec-kit | Native prose was authored/revised, but no usable identity/evidence enrollment existed. Missing registry and dependent unverified execution are consequences, not independent product failures. |
| Chained workflow acquisition | files-source-bootstrap, vacuous-evidence, openspec-apply, inline-lifecycle, openspec-propose-apply, full-skill-routing, inline-propose-apply | Saved calls combine executable checks or version output with `instructions`; the last case also shows a valid proposal acquisition followed by a chained apply acquisition. Full artifact recovery cannot make those calls standalone. |
| Missing first-composition topic | executable-authoring-sdk | The agent installs the missing SDK but never requests `integration`; provisioning starts this authoring case with core only. The independent suite and regression checks are not disproved by this acquisition failure. |
| Evaluator search-environment mismatch | openspec-brownfield | A standalone bare command and completed linked-artifact recovery were present. The driver prepends project `.bin` in `evals/omp-agent.ts`; `guidanceCommand` in `evals/judge.ts` searches only supervisor PATH. |

Interviews recommending edits to particular host skills are hypotheses, not the plan. The portable product must not acquire per-host branches or modify official skill bodies to rescue a score.

### Reproduced evaluator defect

`node --experimental-strip-types .eval-cache/evals-env-20261025-jnr1YF/probe-acquisition.mjs` exited 0. It replayed the original successful command and matching artifact events from `evals/results/openspec-brownfield-1792939557497-3a1589c2-d3b4-4d5c-b284-132d7bf4833a.json` against a disposable reconstruction of that serving package's identity/guidance. With supervisor-only search it failed; with the driver's project-bin prefix it passed; omitting artifact recovery still failed. The observed result is retained as `.eval-cache/evals-env-20261025-jnr1YF/acquisition-replay-result.json`.

This isolates resolution from artifact parsing; it does not replay the removed original filesystem or establish later behavior/publication. The saved score remains unchanged. The fixture already has a separate working checkpoint and subsequent publication turn in `evals/cases.ts`/`evals/harness.ts`; the interview's suggestion that publication lacked a subsequent authorization stage is not a demonstrated fixture bug. Do not rewrite that lifecycle to accommodate the interview.

## Goals / Non-Goals

**Goals:** keep decisions at the smallest owning boundary; make the first request obey a rule the agent currently learns only after that request; distinguish actual permissions from assumptions; share executable search semantics rather than loosening provenance.

**Non-Goals:** no framework-specific portable procedures, changed official host skill bodies, hidden selectors in prompts, new production completion commands, compatibility aliases, package releases, or relaxation of integrity/sensitivity/approval checks. Previously recorded improvement blocks are not cancelled or narrowed by these design boundaries; this proposal is the evidence-grounded correction slice, not their replacement.

## Decisions

### 1. Fix the initial acquisition at the loader, keep the router authoritative

In `skills/focused-spec/SKILL.md`, make executable/version discovery and workflow acquisition explicitly separate tool calls. Keep the existing selection order and support for explicit, local/workspace, and PATH/global installations. The loader may state the invocation boundary because it owns invocation; do not copy response validation, artifact recovery, plugin syntax or verification into it.

Keep `guidance/workflow.md` the router and later-topic/recovery owner. Consolidate its existing standalone warning rather than adding repeated versions across every topic. Do not accept a chained response in the evaluator: concatenated output and an uncertain serving executable are not the required one-response contract.

### 2. Put a short authorization/enrollment decision before authoring

Restructure the opening of `guidance/author-revise.md`, using the existing phase and approval sections rather than appending a second procedure. Before a write or approval question, resolve:

1. What native outcome is requested, and is the path SDK-only or CLI-integrated?
2. What phase and permission boundary is actually established by the user and applicable host workflow?
3. What established composition and native binding exist; which exact required pieces are missing?
4. Can this phase perform them, or must a concrete proposal carry them into the next authorized phase?

Required branches are generic:

| Established boundary | Action |
| --- | --- |
| Review/recommend/install only | Respect that deliverable; report the exact unperformed integration without claiming proof. |
| Genuine proposal/planning restriction | Record final identity, intended evidence, full owning paths and later verification in permitted artifacts; do not configure or execute unauthorized integration. |
| Authorized native authoring/revision | Enroll or reconcile the canonical item using the acquired contracts, including suitable existing tests, then verify. Existing code/tests and small wording changes are not new restrictions. |
| Approval required | Propose the complete discovered change together before approval. Do not recommend a reduced wording-only result as equivalent completion. |
| User expressly excludes a required part | Apply only authorized work, retain the outstanding obligation, and report incomplete synchronization. Do not override refusal. |

The existing enrollment and verification sections retain exact IDs, every AND member, format ownership, real application observation, disposable regression, exact restoration, and final scope execution. `guidance/verify.md` changes only if needed to make its completion report use the same boundary, not to create another enrollment protocol.

### 3. Classify missing dependencies from project facts

Clarify the existing composition paragraph in `guidance/author-revise.md` and router entry in `guidance/workflow.md`: inspect the manifest, lockfile, suite and configuration before selecting/installing a missing execution capability. A dependency already selected by those owners can require repair/reinstallation, not a new architecture choice. Establishing an SDK where no compatible selection is declared requires `integration` before selection/installation, even for SDK-only execution. Neither the absence of `.focused-spec` nor the presence of a driver alone decides the branch. Keep native SDK execution independent of Node/CLI plugins; do not force a text companion.

### 4. Share effective executable search, not mutable global environment

Expose a small internal environment-construction helper from the existing driver owner `evals/omp-agent.ts`, used by `OmpAgentDriver`, ACP launch in `evals/acp-agent.ts`, and acquisition resolution in `evals/judge.ts`. It derives the existing project-bin prefix plus inherited PATH without modifying `process.env`. Do not add a general environment abstraction or inject test-only installation fallback into the gate.

For a bare executable, search exactly the same ordered directories as the driver, resolve the first executable, and compare against that installed package's actual metadata and exact guidance asset. A shadowing non-focused executable must not be skipped to find a later matching package. Explicit paths and Node plus explicit CLI paths bypass PATH selection and retain external-installation support. Missing package/assets, mismatched identity/version/topic/content, failed commands, clipped output without matching recovery, and non-standalone commands remain rejected.

Before changing exported evaluator symbols during apply, use available LSP references to migrate every caller. Existing `accepts guidance from the selected installed CLI` tests currently construct PATH-only selection directly; update fixtures to represent the driver's actual local-prefix semantics, not to weaken the external-installation contract.

### 5. Fix the diagnostic claim without changing enrollment success

In `evals/native-pilot.ts`, retain unique parser-bound selection and existing fail conditions. `nativeSingleSourceGate` and `creationGate` must not describe an absent bound item as evaluated native text loss. Report the bound-outcome status as unjudged when no unique binding exists, and report an evaluated match/mismatch only after selection. Do not scan unrelated prose to award a pass or introduce fuzzy binding. `focusedCliGates`/selected execution remain blocked on normalized evidence as today. Correct native text with missing evidence still fails overall authoring/evidence completion.

### 6. Preserve the task in test-user answers, not in automatic consent

The generic user in `evals/dialogue.ts` already preserves the original outcome and rejects unexplained scope reduction. Apply that same generic intent-preservation constraint to `responderSystem` in `evals/acp-agent.ts`: a recommended wording-only option is not automatically the requested result. It may ask for the concrete complete proposal using only disclosed information. Do not expose gates, registry details, IDs, selectors, repository access or tools. Do not synthesize a fixed answer, bypass real plan mode, approve files in a clarification, or interpret partial approval as blanket authorization.

Prompt wording itself is not executable proof. Use fresh model conversations to measure its effect and retain their actual decisions; deterministic consent suites protect independent path, cancellation and runtime-mode boundaries without pinning prompt source text.

### 7. Score integration outcomes, observe optional procedural compliance separately

The completed frozen parallel batch `.eval-cache/evals-parallel-20261026-VyeD4k/summary.json` covers all 40 invocations (36 new plus four matching-candidate isolated results), with peak concurrency ten, unchanged assets, 39 passes and one acquisition-only failure. The failed `executable-authoring-sdk` agent repaired the false-green driver, installed the correct SDK, retained independent expectations, executed the suite and demonstrated product-regression failure followed by exact restored success. The user explicitly rejected failing a correctly completed task solely for not reading an instruction.

Keep the installed integration procedure as guidance, but move its acquisition result into a separate `EvalResult.observations` collection. Only `gates` determine `passed`, exit status and failure interviews. The acquisition observation must retain its actual false value and detail; do not fabricate a successful read, drop the observation, amend the blind prompt or rewrite historical results. Composition, phase/approval boundaries, single source, protected state, independent expectations, exact execution and regression sensitivity remain blocking. Other activation/provenance and selected-plugin contract gates are unchanged by this correction.

Regression evidence: `vitest::test/evals.spec.ts::agent eval harness > scores SDK repair by verified outcome rather than integration reading`. Exercise the real harness with a repaired and a false-green application driver while both omit integration acquisition; only the repaired outcome may pass. Retain the acquisition failure as an observation in both. After deterministic red/green and disposable sensitivity proof, run the original real model case alone, then a fresh parallel matrix. Prior acquisition-only FAIL remains immutable and is never relabelled as a new model pass.

## Exact planned evidence and verification

No evidence registry is written during proposal. During apply, use `.focused-spec/evidence/agent-workflow.yaml` to bind each working occurrence in scope `repair-portable-evidence-completion`, and later each surviving `current` occurrence independently. The registry adapter owns these contents; core gains no store. Acquire the installed registry, composed Markdown parser and Vitest public contracts before writing bindings.

The complete opaque selectors below are intended evidence, not claims that new tests exist or that model behavior has been proved:

| Native ID(s) | Planned exact deterministic evidence |
| --- | --- |
| `agent.guidance.project-local` | `vitest::test/evals.spec.ts::agent eval harness > accepts guidance from the selected installed CLI` |
| `agent.guidance.unavailable` | `vitest::test/evals.spec.ts::agent eval harness > rejects absent or legacy local guidance activation` |
| `agent.guidance.invalid-response` | `vitest::test/evals.spec.ts::agent eval harness > rejects completed but unusable guidance responses` |
| `agent.guidance.session-refresh` | `vitest::test/evals.spec.ts::agent eval harness > requires fresh guidance for a subsequent workflow step` |
| `agent.guidance.effective-path` | `planned:vitest::test/evals.spec.ts::agent eval harness > resolves guidance with the evaluated driver executable search path` |
| `agent.guidance.standalone-request` | `planned:vitest::test/evals.spec.ts::agent eval harness > rejects chained guidance until a standalone request completes` |
| `agent.guidance.artifact-recovery` | `vitest::test/evals.spec.ts::agent eval harness > requires completed local workflow guidance after loader activation` |
| `agent.integration.preserve-existing` | `vitest::test/evals.spec.ts::agent eval harness > rejects unauthorized conversion of an existing integration` |
| `agent.integration.route-selection`, `agent.integration.missing-dependency` | `vitest::test/evals.spec.ts::agent eval harness > requires completed local integration guidance for composition selection` (extend with first SDK installation and established-repair counterparts) |
| `agent.author.complete-proposal` | `vitest::test/dialogue.spec.ts::authoring dialogue consent > permits the confirmed revision without authorizing a different metadata file` (consent boundary only; actual proposal quality additionally requires fresh native conversations) |
| `agent.author.real-phase-boundary` | `vitest::test/evals.spec.ts::agent eval harness > rejects a proposal that creates configuration or a planned evidence registry`; `vitest::test/evals.spec.ts::agent eval harness > rejects planning-time inline evidence integration` |
| `agent.author.enroll-before-completion` | `vitest::test/evals.spec.ts::agent eval harness > rejects stale green evidence after native revision and accepts synchronized sensitive evidence` (execution/sensitivity boundary; fresh native conversations additionally prove initially unenrolled authoring) |
| `agent.eval.dialogue-outcome` | `vitest::test/acp-agent.spec.ts::genuine planning consent > keeps host questions independent from runtime plan approval` (consent boundary only; fresh tool-free planning conversations prove answer selection) |
| `agent.eval.bound-outcome-prerequisite` | `planned:vitest::test/native-pilot.spec.ts::native pilot evaluation boundaries > distinguishes an unjudged bound outcome from a behavioral mismatch` |

Do not claim a deterministic gate test proves that an LLM follows guidance. Guidance scenarios additionally require their fresh scored conversations and recorded proposals/decisions; use those artifacts in the completion report. No source-text or prompt-echo test is authorized by this mapping. New deterministic tests earn their place only for the reproduced PATH defect, chained acquisition safety, and missing-selection diagnostic ambiguity; reuse existing tests elsewhere.

Required checks after apply:

- Targeted `node_modules/.bin/vitest run test/evals.spec.ts test/native-pilot.spec.ts test/dialogue.spec.ts test/acp-agent.spec.ts`, then `npm test`.
- Reproduce PATH and native-diagnostic defects with red tests before fixing. In a disposable product/evaluator copy, revert the relevant decision to require the exact selected test to fail; restore exact state and require PASS. Test mutation, missing selectors and runner errors are not sensitivity.
- Exercise the packed CLI/loader outside the checkout: standalone `version`, standalone router request, complete response recovery if clipped, `author-revise`, and first-composition `integration`; verify selected installation provenance and unchanged consuming project after guidance only.
- Strict focused validation and execution of the working scope, with every changed reference concrete, then the completed scope. Reconcile the full native catalog and every AND member rather than only the new tests.
- Rediscover public cases with `node --experimental-strip-types evals/run.ts --list` and native hosts from exported `nativeCases`; run every public case and both native modes for `externcash/gpt-6.1-sol` into a new immutable batch. The observed baseline is 26 + 14, not a frozen future case count. Preserve every invocation, no selective retries or edits while scored work is running.
- Before that batch, verify the environment-supplied provider credential/endpoint and the actual selected provider credential agree without logging secrets; run a same-supervisor no-tool model smoke. Preserve the existing failure baseline and distinguish credential transport failure from product/instruction failure.

The existing environment-batch supervisor is a reproducible reference, not a reusable output destination: its exclusive writes prevent overwriting the baseline. Create a new batch directory and manifest for post-change runs. A zero failed-gate count with unsupported validators/lifecycle aspects is still not full native certification.

## Risks / Trade-offs

- More prose may reduce compliance → replace overlapping authoring paragraphs with the short decision boundary; no repeated checklist per host or plugin.
- Sharing PATH semantics can break old fixtures that selected an impossible bare external command → correct the fixture to match the real driver; retain explicit external-path and first-shadow negative checks.
- A conversational test user could still select a narrower option → record its real decision and classify authorization separately; do not coerce approval or hide a failed model run.
- A phase-correct proposal can legitimately leave enrollment pending → require a concrete handoff and a subsequent authorized apply conversation, never same-turn integration or a false completion claim.
- Diagnostic clarity could accidentally mask a missing item → retain failing authoring/binding gates and test both missing binding and uniquely bound wrong behavior.
- Model improvements are not guaranteed by a small wording change → report the full measured matrix, including unchanged failures and all unverified aspects; reconsider further enforcement from that evidence rather than patching official host skills.

## Migration Plan

1. Keep this proposal planning-only; begin source/evidence changes only after a subsequent apply request.
2. Implement isolated evaluator regressions and shared search semantics, then the generic loader/authoring/composition wording and test-user clarification.
3. Bind and verify the working delta, run package smoke and the full fresh model matrix, and update the owning development documentation and candidate status from observed results.
4. Review root `README.md` against the shipped source behavior. It currently makes no claim that this proposal is implemented; keep it unchanged unless implementation changes user-facing use/status. Do not add detailed agent procedure there.
5. After evidence passes, use host-owned sync to update `openspec/specs/agent-workflow/spec.md`, explicitly retain `current` evidence, validate main specs, archive the change, and run final surviving scopes. Do not infer bindings from the retired working scope.
6. Roll back only this change's source/guidance/evidence edits if verification fails; preserve user work and all immutable baseline/post-change results. No package release is implicit.
