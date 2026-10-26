# Candidate improvements

Improvement register and ordered implementation sequence. Block 1 is implemented and archived; block 3's selected guidance consolidation is implemented and verified locally. Block 4's competing-skill evaluation and initial experiment are implemented; no activation gap was observed in the measured sample, so context-file installation remains deferred. Block 2 remains deferred for its policy decision; block 5 is explicitly deferred pending a demonstrated current need for host hooks, not cancelled. Block 6 is partially complete: product-path documentation and the historical Agent OS rerun are complete, public-harness measurements are implemented, and remaining host-verification/reporting work is retained below. Candidate ideas outside those blocks still need a decision and, where noted, measurement.

## Ordered implementation blocks

These blocks are the working sequence for future implementation. They are recorded first; implementation starts only when the corresponding block is selected. Each block must preserve the existing native source, plugin boundaries, and two-command human setup.

### Block 1 — Guidance delivery hardening

Status: implemented in [harden-guidance-delivery](../../openspec/changes/archive/2026-10-25-harden-guidance-delivery/tasks.md). This is a source-checkout change, not an npm release or a refresh of already installed consumer skills.

- Move protocol, package-identity, and guidance-availability checks into the CLI; accept a selected project-local, global, or explicitly located installation without a project-ownership requirement.
- Split the large workflow response into a short router plus focused topics.
- Reduce `SKILL.md` to a genuine loader and keep the CLI-owned package guidance authoritative.
- Acceptance: existing workflow behavior remains intact; guidance acquisition no longer depends on avoidable agent-side checks or oversized responses.
The [portable completion correction](../../openspec/changes/repair-portable-evidence-completion/tasks.md) is implemented locally and unreleased: driver-equivalent acquisition, authorization-grounded enrollment/first SDK composition, and prerequisite-aware native diagnostics. Its deterministic checks and working-scope execution passed; those checks are not model-compliance evidence. The immutable baseline at `.eval-cache/evals-env-20261025-jnr1YF/matrix.json` has 17 exit-0, seven exit-2 (unverified native aspects), and 16 exit-1 results. The next full batch, `.eval-cache/evals-portable-20261025-VreU3P/matrix.json`, retained all 40 invocations but encountered 38 provider `402 Insufficient balance` interruptions; its successful subset does not certify guidance quality.

The subsequent complete batch, `.eval-cache/evals-corrected-20261025-LMYllk/summary.json`, used `externcash/gpt-6.1-sol` with environment-matching credential provenance and unchanged scored assets. Public results: 21 passed, one contract-acquisition false negative after linked-output recovery, and four turns interrupted by provider `429` rate limits. Native authoring/evidence passed together in 12 of 14 invocations; OpenSpec creation deferred enrollment without a subsequent approval handoff, and Agent OS revision accepted a narrower wording-only scope. Four native validations and two lifecycle checks passed; ten validators and twelve lifecycle checks remain independently unverified. Contract recovery and test-user outcome preservation were corrected afterward, without rewriting those scores.

Earlier deterministic verification passed all 405 tests in 21 files, all 106 tests in the four evaluator/consent suites, and all 15 working-scope items. The new contract-recovery regression accepts complete installed documentation recovered before configuration and rejects premature, failed, unrelated, incomplete and stale recovery. A disposable evaluator regression gives PASS → selected failure → restored PASS with original bytes unchanged. Real tool-free responder replays retain deferred work and choose scope adjustment without approving writes; these are not fresh native-case scores.

The complete serialized batch at `.eval-cache/evals-serial-20261025-e26yOc/summary.json` retained 40/40 invocations with unchanged candidate assets after a successful same-supervisor smoke. Both first-integration public cases passed. OpenSpec revision and creation passed authoring, evidence and native validation; creation now completed its concrete approval handoff and independent execution/sensitivity checks. Their lifecycle remains unverified. Provider `402 Insufficient balance` then interrupted the remaining 36 invocations; `transport-audit.json` confirms an observed 402 in every exit-1 result. A full green model matrix, including current Agent OS behavior, still requires restored capacity for the selected provider. No sync, archive, release or full native certification is claimed.

Final local evidence verification passes all 348 enrolled occurrences and 372 unique targets with the ordinary project configuration; strict all-scope validation has no planned references. The first full run correctly timed out at the old 120-second runner-host budget. A 300-second disposable control passed with about 145 seconds of execution; the checkout registration now uses that batch budget, and the default full run passed in about 130 seconds. Individual test timeouts and plugin/consumer defaults are unchanged. `.eval-cache/evals-serial-20261025-e26yOc/full-scope-final-result.json` retains the final result; this local proof does not remove the provider block on the model matrix.

The next complete unchanged-candidate batch, `.eval-cache/evals-resumed-20261025-LaqkeZ/summary.json`, retained 40/40 invocations after a fresh same-supervisor `OK`. Public results: 23 passed, one failed planning-marker check, two provisioning timeouts before any result artifact. Native results: eleven authoring/evidence pairs passed, two failed authoring, and one provisioning timeout; four native validations and two lifecycle checks passed, with unsupported aspects still unverified. The concrete failures are stale npm metadata revalidation, an additional unrequested active-account enrollment in Spec Kit creation, a described companion-file list rejected by ACP consent, and an inline proposal using a space-containing ID in the stricter structural marker representation. The parser correctly rejects that marker; its valid-ID control passes. These observations supersede the earlier provider-only block, not the historical results.

Corrections use the existing `--prefer-offline` provisioning convention without disabling network fallback, recognize explicitly described creation-list operands without inferring consent from references, keep native enrollment within requested outcome scope, and require the structural format's installed contract before selecting an inline planning marker. Fresh full model measurement remains required; no native certification, publication, archive, or release is claimed.

Current correction checks passed 406 tests in 21 files, the four evaluator/consent suites passed 107 tests, and default-config execution passed all 348 enrolled occurrences and 373 targets with no planned evidence. `.eval-cache/evals-final-corrections-20261025-EzQxZG/full-scope-result.json` retains the complete CLI result. Both formerly failing public fixtures install their packed candidates successfully with the offline-preferred convention. The exact saved creation-consent decision is accepted, rejected by the old parser in isolation, and accepted after restoration; the permanent regression has the same sensitivity. These local results do not replace the fresh full model matrix.

The subsequent broad batch was stopped at 21/40 invocations before further candidate edits, following the isolated-first verification requirement; `.eval-cache/evals-final-corrections-20261025-EzQxZG/interrupted.json` records that it is incomplete. Comparing failed OpenSpec creation against the prior pass found identical delivered router and host skill bytes: both initially deferred enrollment, but only the prior test user requested completion. That pass did not demonstrate reliable agent-owned handoff. Authoring guidance now distinguishes current-phase completion from original-task completion and explicitly requests any necessary transition/approval. The first isolated attempt passed its scored gates but still relied on user recovery, so it was not credited as the handoff fix. The second isolated `externcash/gpt-6.1-sol` run asked for approval itself and passed authoring, evidence and native validation; lifecycle remains unverified. Separately, the Go SDK failure was a routing-gate mismatch against its already established composition, not a demonstrated application failure. Its corrected isolated run passed every gate without acquiring unnecessary first-selection guidance; missing-capability and reconsideration negatives remain enforced. Exact artifacts, candidate hashes and sensitivity controls are retained under `.eval-cache/evals-isolated-regressions-20261026-SqPhXV/`; no historical score was rewritten.

The three specifically requested isolated follow-ups also passed on `externcash/gpt-6.1-sol` with unchanged candidate assets and no intervening corrections: GSD creation, Agent OS creation, and public `inline-propose-apply`. Both native cases passed authoring, exact Go/Python evidence execution, regression sensitivity, and protected-state integrity; their native validators and lifecycle remain unverified. GSD installation succeeded on this attempt without an installer change, so its prior network timeout is not a demonstrated permanent repair. Inline proposal/apply passed every gate, including deferred planning integration, OpenSpec validation and task completion, both selected tests, and selected behavioral failure/restored pass in both languages. Immutable artifacts are `evals/results/native-create-gsd-1792964065564-7a853bc6-3f34-46cf-82dc-e09b9745a99b.json`, `evals/results/native-create-agent-os-1792964040712-1f1b8d9f-997a-4fc0-96e6-bf6608587a2d.json`, and `evals/results/inline-propose-apply-1792964132971-6fc0e42e-f1da-4004-8c50-9984f354d943.json`; invocation manifests and asset hashes are under `.eval-cache/evals-isolated-regressions-20261026-SqPhXV/`. The latest `npm test` passed 407 tests in 21 files. These isolated results are not a full-matrix pass.

The subsequent immutable batch `.eval-cache/evals-parallel-20261026-VyeD4k/summary.json` covered all 40 invocations (36 new plus four unchanged-candidate isolated results): 39 passed and `executable-authoring-sdk` failed only its integration-topic acquisition gate. Outcome-based scoring now retains that acquisition as an observation instead of a task-success gate. The fresh isolated SDK repair passed on the same model without reading `integration`, with correct composition, independent expectations, real execution and application-regression sensitivity; its false acquisition observation remains visible. The original FAIL is unchanged. `.eval-cache/evals-outcome-20261026-TRlTy5/sensitivity.json` retains the exact regression failing under prior scoring and passing after restoration.

Latest local verification: `npm test` passed 408 tests in 21 files; strict all-scope validation resolved 349 occurrences, no planned evidence and 375 targets; ordinary all-scope execution passed all 349 occurrences. The complete execution result and the 213-link check across 17 documentation pages are retained in `.eval-cache/evals-outcome-20261026-TRlTy5/`.

The two preceding current-evaluator matrices were not green: `.eval-cache/evals-green-20261026-P7304E/summary.json` completed 40 invocations at concurrency ten, all interrupted by provider HTTP 429; `.eval-cache/evals-ratebounded-20261026-zrRzf8/summary.json` completed another 40 at concurrency three, with 39 provider-429 interruptions and one BMad upstream archive-download timeout before scoring. Those unchanged-candidate results and transport audits remain immutable.

The user-authorized transport retry campaign `.eval-cache/evals-retry429-20261026-kluDMv/` retained five passing cases and a real OpenSpec creation failure: the tool-free test user silently accepted disclosed deferred evidence work despite its continuation contract. Scoring stopped before the candidate changed. The responder now resolves that explicit handoff before completion phrasing or absence of a question, without inferring hidden omissions or approving unproposed paths. A same-model replay requests the concrete remaining proposal while planning-only and completed controls terminate; the fresh isolated OpenSpec creation passes authoring, evidence and validation. Its lifecycle remains unverified.

The final fresh frozen matrix `.eval-cache/evals-handoff-retries-20261026-nqMppZ/summary.json` passes all 40 discovered invocations on `externcash/gpt-6.1-sol`: 26 public workflows and 14 native revision/creation cases, at concurrency four, with no provider errors, retries, duplicate coverage or candidate changes. All 14 native authoring/evidence pairs pass; OpenSpec and Gherkin validation pass in both modes, and BMad regeneration passes in both modes. Other native validators and non-BMad lifecycle aspects remain unverified, not certified. Latest `npm test` passes 408 tests; all-scope focused execution passes 349 occurrences and 375 targets. An overlapping test/evidence run hit two five-second test deadlines; the non-overlapping full suite passes without source or timeout changes. Complete focused output is retained in the final batch. No sync, archive or release is claimed.


### Block 2 — Machine-verifiable completion

- **Status: implementation deferred pending verification-policy review, not cancelled.** `focused-spec probe` and `focused-spec status --changed` remain candidates, not approved implementation requirements. The command ideas below are conditional on this review.
- **Observed evidence:** the latest complete matrix passed 40/40 cases. `vacuous-evidence` passed both independent sensitivity verification and `agent-sensitivity-probe`, which checks the agent's own observed PASS → assertion FAIL → PASS sequence. Other sensitivity gates independently mutate the resulting application; their success does not establish that the agent performed the experiment itself.
- **Unproven benefit:** these results do not demonstrate a defect requiring either new command. No analysis has established excessive manual actions, time, or restoration failures, and no paired comparison with an implemented `probe` exists. Do not present reduced workflow complexity or cost as a measured benefit, or propose rerunning the recent matrix merely to rediscover this baseline.
- **Next decision:** agree on when sensitivity checks are necessary before automating them. Reconsider blanket per-scenario mutation requirements, especially for native executable specifications whose engine owns the assertion. A driver can still disconnect Actual from the real application; native execution does not eliminate that risk. Existing guidance remains unchanged until a separate authorized change.
- **Conditional `probe`:** justify it as optional automation of a concrete necessary experiment, not a mandatory ritual for every scenario. Do not introduce another project directory or persistent receipt store. Temporary execution copies and terminal/JSON results do not by themselves justify a new completion-state subsystem.
- **Independent `status --changed` decision:** identify concrete missing checks beyond existing inspection, validation, and execution before committing to this command. Do not make every scenario incomplete solely because it lacks a sensitivity receipt.
- **Acceptance before implementation:** establish the agreed verification policy and a specific unmet need for each command; only then define its scope and evidence of benefit. Stable exit codes/JSON for agents or future host hooks are a possible interface benefit, not proof that the commands are needed.

### Block 3 — One standalone/host workflow contract

- **Selected scope:** [consolidate-guidance-rules](../../openspec/changes/consolidate-guidance-rules/tasks.md) consolidates existing procedure in the eight authored topics. No phase model, host adapters, ninth topic, loader/runtime/build change, or verification-policy change is introduced. This is source-checkout work, not a published release or consumer refresh.
- **Owners:** `workflow` owns universal permissions, selected executable/root and shared plugin-document acquisition/provenance; `author-revise` owns authoring, identity/evidence reconciliation and complete approval/deferred-work handoff; `verify` owns application observations, sensitivity/restoration and executed lifecycle verification. Other topics retain local safety checks, integration selection and format/runner API obligations.
- **Measured payload:** all eight topics total **74,940 → 67,477 UTF-8 bytes** (7,463 fewer; 10.0%). Router **5,993 → 5,996**, below the existing 6,000-byte bound; each focused topic remains below 14,000 bytes. These are Markdown bytes, not measured token/time savings or improved model compliance.

| Topic | Before bytes | After bytes |
| --- | ---: | ---: |
| workflow | 5,993 | 5,996 |
| review | 7,127 | 5,757 |
| author-revise | 13,031 | 11,147 |
| upgrade | 8,902 | 8,252 |
| verify | 8,762 | 8,823 |
| integration | 11,695 | 11,573 |
| formats | 8,975 | 7,037 |
| runners | 10,455 | 8,892 |

| Route (one acquisition per named topic) | Before bytes | After bytes |
| --- | ---: | ---: |
| workflow + review | 13,120 | 11,753 |
| workflow + author-revise + verify | 27,786 | 25,966 |
| workflow + integration + formats + verify | 35,425 | 33,429 |
| workflow + integration + runners + verify | 36,905 | 35,284 |
| workflow + upgrade + formats + runners + verify | 43,087 | 39,000 |

- **Acquisition trade-off:** no new topic or unconditional read is added. Authorized format/runner/integration verification now explicitly acquires `verify` rather than relying on the router's former sensitivity paragraph. Review remains read-only; missing requested guidance remains blocking. Route totals compare the same named topics, exclude plugin documents and do not prove fewer actual requests. Fresh agent acquisitions are recorded separately with their results.
- **Verification:** `npm test` passed **408 tests in 21 files**; `openspec validate consolidate-guidance-rules --strict` passed with the deliberate no-delta declaration. Focused CLI/packed-topic/composed-document and evaluator-oracle checks passed 8 selected tests. A real packed CLI served all eight text/JSON topics in an offline unconfigured consumer (16 successful deliveries); a removed requested topic failed without fallback. All 223 local links across 16 documentation pages resolve, and every page is index-reachable. Measurements and immutable smoke/eval artifacts are retained under `.eval-cache/consolidate-guidance-20261026-cCYf6B/`.
- **Retained boundaries:** SDK-only work keeps its native suite without focused configuration/plugins; host approval/lifecycle, exact identity, every AND member, controlled regression and exact restoration remain unchanged. Block 2's policy review and other outstanding blocks are neither implemented nor cancelled here.

Fresh black-box consolidation verification passed **6/6** cases on `externcash/gpt-6.1-sol`, concurrency three, with exit 0 for every invocation, unchanged frozen candidate assets and no observed provider interruption or retry. Independent behavior, exact evidence, sensitivity, phase, lifecycle and protected-state gates passed where applicable. That historical SDK result contains a false `focused-integration-acquired` observation; it remains immutable. Subsequent evaluator correction recognizes the existing executable suite as SDK dependency selection, so repairing the missing package does not generate a missing-integration warning. This changes no prompt, application-sensitivity gate or installed guidance. These six cases are not a new complete 40-case matrix or universal native-host certification.

The dependency-selection correction passed **409 repository tests in 21 files**, including a regression that previously reproduced the false warning while still rejecting the expectation-echo driver. A fresh isolated `executable-authoring-sdk` run on `externcash/gpt-6.1-sol` passed every scored gate with unchanged candidate assets and without reading `integration`; routing now reports `established compatible composition retained: @focused-spec/scenarios-typescript`. Evidence is retained under `.eval-cache/sdk-dependency-repair-20261026-1Cm8U8/`. Historical model results and installed guidance are unchanged.

| Fresh case | Result | Historical → fresh topic requests | Historical → fresh plugin-document requests |
| --- | --- | ---: | ---: |
| executable-authoring-sdk | PASS | 4 → 3 | 2 → 2 |
| executable-authoring-cli | PASS | 6 → 4 | 3 → 3 |
| spec-evidence-revision | PASS | 3 → 3 | 4 → 4 |
| inline-propose-apply | PASS | 7 → 7 | 5 → 5 |
| inline-lifecycle | PASS | 9 → 6 | 6 → 6 |
| project-upgrade | PASS | 4 → 5 | 1 → 1 |

Counts include repeated focused topic requests, excluding help and OpenSpec's own `instructions`. Fresh requests all delivered complete recovered JSON. The historical upgrade used two text requests, counted separately from its two JSON responses; the fresh upgrade additionally requested workflow twice. These are observed unpaired runs, not proof that consolidation causes fewer requests or improves token cost, latency or reliability. Full transcripts, gates, commands, hashes and immutable result paths are indexed by `eval-summary.json`; `fresh-acquisitions.json` records request/recovery details and the unchanged historical comparison.

### Block 4 — Measure activation before changing installation

- Add a realistic blind activation eval: full competing skill set, ordinary host command, no mention of focused-spec or evidence.
- Establish baseline skill/workflow acquisition, token cost, wall time, and failure categories.
- Only if the baseline shows a material activation gap, evaluate an opt-in marker block in the host context file (`AGENTS.md`, `CLAUDE.md`, or target-specific equivalent).
- Acceptance: the decision to add context-file installation is based on paired measured results, not assumption.

**Status: evaluation implemented; initial experiment complete on 2026-10-26.** `blind-skill-activation` is a public-harness case with an explicit `--competing-skills` source. Three fresh workflows per arm used the same `externcash/gpt-6.1-sol` model, ordinary proposal/apply prompts, fixture, tools and independent gates. The baseline exposed seven skills (focused-spec plus all six OpenSpec skills); the competing arm exposed all 22 skills from the supplied installed catalogs, including 15 additional real skills and their assets. Each workflow had two fresh sessions. The first competing run was exercised in isolation, followed by the remaining alternating comparison runs with concurrency one. Instructions, loader, installer and context-file markers were not changed.

| Measurement | Baseline: 7 skills | Competing: 22 skills |
| --- | ---: | ---: |
| Complete workflows passed | 3/3 | 3/3 |
| Skill activation / executed fresh sessions | 6/6 | 6/6 |
| Installed workflow acquisition / executed fresh sessions | 6/6 | 6/6 |
| Median summed agent wall seconds | 398.863 | 373.437 |
| Agent wall seconds range | 364.058–452.932 | 373.394–393.199 |
| Median reported uncached input tokens | 178,078 | 246,462 |
| Median reported cached-read tokens | 1,695,232 | 2,015,360 |
| Median reported output tokens | 10,532 | 10,247 |
| Median reported total tokens | 1,869,538 | 2,233,810 |

All six invocations exited 0; every scored planning, activation, exact-evidence, application-sensitivity and integrity gate passed. Usage was complete in all six results; reported cache-write tokens were zero. No provider error messages were recorded and the experiment made no retries. Candidate/host/competing-skill source hashes stayed unchanged. Each median is calculated independently, so the median token columns need not add up. Wall time excludes provisioning, independent judges and interviews; total tokens include cached context and are not monetary costs. These three workflows per arm do not establish universal activation reliability, native slash-command behavior, a complete matrix result or a causal speed/cost improvement.

**Decision:** no missed activation was observed, so this sample supplies no evidence for adding an always-loaded context-file pointer or changing installation. Retain the new eval for future model/catalog comparisons; context-file intervention remains conditional rather than cancelled. Immutable invocation logs, raw result paths, candidate/catalog hashes and measurements are indexed by `.eval-cache/blind-activation-20261026-N4Xr1q/manifest.json` and `summary.json`.

Repository verification passed **415 tests in 22 files** with `npm test` (build and test/eval typechecks included); the two affected evaluator test modules separately passed **68 tests**. The real CLI lists the new case and rejects its missing catalog prerequisite. All **223 relative documentation links across 16 pages** resolve, every documentation page is index-reachable, and the new section anchor exists. Root README remains accurate without an evaluator-only addition.

### Block 5 — Native in-loop host hooks

- **Status: deferred by user decision, not cancelled.** No current reproducible failure has been established here that requires host hooks. Their proposed benefit is returning a failed check to the agent before completion, not repairing a demonstrated current activation defect.
- **Revisit only with evidence:** identify a reproducible skipped mandatory check or premature completion, a documented hook in the affected host that detects it, and a paired comparison showing improvement without blocking authorized planning-only or read-only work. Block 4's successful activation sample does not establish completion reliability or the need for a hook.
- Implement only for hosts with documented command/event hooks, beginning with the highest-value host.
- Consider spec-path reminders and `Stop`/post-task CLI verification that returns failures to the agent for another turn.
- Keep host-specific adapters optional; do not add hooks where the host only supports prompt injection.
- Acceptance: a hook executes the selected CLI check, returns an actionable failure to the agent, and does not replace CI or git-hook integration.

### Block 6 — Documentation, host coverage, and eval quality

- **Status: verification/reporting implementation exercised; one observed model failure and external certification limits retained below.** This is not a new product feature, a universal reliability claim, or authorization to implement block 5.
- **Complete — product-path orientation:** root README already distinguishes independent executable SDK scenarios from binding native requirements to exact tests, without duplicating installed procedures. No additional rewrite is justified by this item alone.
- **Complete — historical Agent OS rerun:** the subsequent frozen 40-invocation matrix at `.eval-cache/evals-handoff-retries-20261026-nqMppZ/summary.json` passed all 14 native authoring/evidence pairs, including Agent OS revision and creation. Repeating the old revision failure solely to rediscover that outcome is unnecessary. This does not certify unsupported native validation or lifecycle.
- **Complete — measurement/report implementation:** new public and native results retain scored agent duration and completed assistant-message usage, with per-native-phase coverage, resumed-journal boundaries and explicit missing/incomplete usage. ACP excludes measured test-user waits while retaining interaction elapsed time. Fresh Gherkin and Agent OS revision runs on `externcash/gpt-6.1-sol` passed authoring/evidence with complete usage; ACP recorded 390,360 ms interaction, 25,989 ms responder waits and 364,371 ms scored duration. The [agent evaluation guide](agent-evals.md#native-measurements) owns these semantics.
- **Complete — immutable cross-case reports:** `evals/report.ts` accepts explicit results and campaign attempts; reports independent verdicts, interruptions, missing results, provenance, measurement coverage and loader/workflow/host-guidance denominators. A historical smoke selected five attempts, four immutable results and one missing-result invocation, retaining one provider and one provisioning interruption; every input hash stayed unchanged. No historical measurement was invented. `.eval-cache/complete-host-20261026/report-smoke-proof.json` records inputs/commands/hashes; all ten new exact evidence targets passed, and each detected its isolated behavioral regression before exact restored PASS (`sensitivity-proof.json`).
- **Complete — host claim audit:** the source-qualified [context-file survey](#context-file-pointer-written-by-init), [hooks](#event-scoped-host-hooks) and [SDD extension table](#sdd-host-extension-points) distinguish documented capability, pinned fixture/runtime limits and actual execution. This audit installs no context-file pointer or hook and does not alter installer destinations. Native check provenance and executed audit commands are recorded in the [capability table](agent-evals.md#native-capability-provenance).
- **Executed — applicable native operations:** the fresh five-invocation sample passed all authoring/evidence pairs, real BMad regeneration and OpenSpec creation publication/archive. OpenSpec revision completed native archive, final binding/AND evidence, strict host validation, final selected execution, sensitivity/restoration and protected-state checks, but correctly failed lifecycle certification because its second approval-separated step omitted fresh workflow acquisition. The failed result and interview are retained; no behavioral retry or gate relaxation was made.
- **External limits retained:** Spec Kit, Kiro, BMad, GSD and Agent OS have no applicable runnable standalone validator in these fixtures; Gherkin validation is syntax-only. Agent OS/Gherkin lifecycle remains unverified. Documented broader runtime capabilities do not certify these fixtures. Unsupported operations are explicit `unverified` results, not substitutes or cancelled obligations.
- **Acceptance:** documentation matches shipped behavior; host claims identify their primary-source evidence and limits; aggregate reports distinguish failed, blocked/unverified and provider-interrupted cases, with explicit measurement coverage. Native certification requires actually executed applicable checks. Completed items stay closed; remaining items require their own selected work.

Fresh isolated commands used `node --experimental-strip-types evals/native-pilot.ts <host> externcash/gpt-6.1-sol --keep-workspace`, adding `--create` only for OpenSpec creation. `.eval-cache/complete-host-20261026/manifest-1793015762093.json` and `manifest-1793016034552.json` retain all five attempts and exact immutable result paths. `fresh-report.json`/`.txt` and `fresh-report-proof.json` retain selected coverage, command arguments and unchanged input hashes; this is not a rerun of the historical 40-invocation matrix.

| Fresh case | Scored duration (ms) | Reported total tokens | Native lifecycle |
| --- | ---: | ---: | --- |
| Gherkin revision | 187,140 | 601,911 | Unverified |
| Agent OS revision | 364,371 | 879,498 | Unverified |
| BMad revision | 265,063 | 943,868 | Passed regeneration |
| OpenSpec creation | 354,368 | 2,166,764 | Passed publication/archive |
| OpenSpec revision | 324,391 | 1,492,039 | Failed workflow reacquisition |

Usage was complete in all five results; native phase coverage is five authoring and three lifecycle phases. No provider/provisioning interruption was recorded. Saved combined/phase judgments report loader 8/8 passed, workflow 7/8 passed (one failure), and host guidance 9/9 passed. Those denominators are judgments, not five independent per-turn observations. Token totals include cached context and are not monetary cost. OpenSpec creation alone is certified; unsupported aspects and the revision failure remain distinct.

Repository verification: `npm test` passed 426 tests in 23 files; `npm run smoke` executed both Go and pytest evidence successfully. After syncing five requirements/ten scenarios and archiving `complete-host-verification-and-eval-reporting`, all discovered scopes passed strict validation and execution: 359 items, zero planned references, 385 unique targets, no FAIL/SKIP/ERROR. The first all-scope validation exposed four stale selectors in older active changes; their existing behavioral tests were renamed, so those scope-local references were reconciled before the final passing run. All 21 main capability specs passed strict native validation. Documentation verification resolved 231 local links across 16 index-reachable pages; root README remains accurate and intentionally unchanged. No release or consumer refresh was performed.

## Agent guidance delivery

Development eval history (697 saved runs, not a product-quality measurement) shows failures concentrated in guidance loading (`focused-workflow-acquired` ~4%, `host-workflow-loaded`, `focused-skill-loaded`), while agents that obtained guidance passed `selected-test-sensitivity`. These items harden delivery rather than the rules themselves.

### Move loader checks from the agent into the CLI

The selected installed CLI owns protocol, package identity, requested-topic and nonempty-content checks. Project-local ownership enforcement and `instructions --root` were rejected: installation location is not compatibility. The loader selects the executable; project-reading commands still resolve configuration and plugins from the consuming project root.

### Smaller guidance topics

The original workflow was roughly 37 KB and routinely required host artifact recovery. Block 1 replaces it with a compact router and separate `review`, `author-revise`, `upgrade`, and `verify` topics. Full-output recovery remains necessary when a host clips any response; smaller topics reduce that exposure rather than guarantee host limits.

### Procedure-free `SKILL.md`

Block 1 reduces the authored loader to executable selection, activation, and routing. Package-owned topics retain upgrade, plugin-contract, response-handling, and verification procedure, so those rules can change without maintaining a second procedural copy in the loader.

### Replace costly instructions with commands

- `focused-spec probe`: the agent supplies only a product-code regression patch; the CLI creates a disposable copy, runs the evidence (PASS, then FAIL on an assertion rather than an error), verifies original hashes, and emits a receipt. This replaces the manual sensitivity-probe steps in the workflow.
- `focused-spec status --changed`: a machine-readable "is it done?" answer listing unbound affected items, `planned:` references, and missing sensitivity receipts. It replaces the prose completion gate and is what host hooks and CI would call.

### Standalone mode as one more host adapter

The workflow branches in prose between SDK-only, CLI-integrated, and SDD-hosted paths; prose branching is where agents err. If the built-in standalone flow declares phases and approvals through the same contract as the OpenSpec adapter, the workflow core becomes single and differences move into adapters.

## Product direction and evidence

### Clarify the two product paths

The project intentionally supports two modes: native requirement/evidence binding and code-native executable scenarios. Make the distinction explicit in the first-run documentation and package descriptions so users immediately choose the relevant path without reading internal terms such as enrollment, scope, or provenance. This is a communication improvement, not a proposal to split the products.

### Simplify progressive onboarding

Keep the two-command human setup (`npm install`, then `init`) and let the agent perform composition. Improve the first-run path with a short decision table and one minimal example per mode; move protocol and provenance detail behind reference pages. Do not duplicate the installed skill's workflow in repository docs.

### Measure actual adoption by package and source

If demand needs to be assessed, compare weekly downloads for the core, SDK, format, and runner packages and separate team/eval traffic from external use where possible. GitHub stars are not a product-quality metric; this is an optional measurement, not a release gate.

### Do not narrow supported stacks speculatively

Earlier advice to make one language/framework path primary is withdrawn. The supported TypeScript, Go, Python, and .NET stacks were selected for actual team/user needs; adding or removing languages should follow user demand and maintenance capacity, not a generic scope heuristic.

## Agent activation

### Measure realistic skill activation first

`full-skill-routing` already tests blind proposal/apply prompts with focused-spec and all six OpenSpec skills; it is not a realistic broad competing catalog. The added `blind-skill-activation` reuses that exact fixture, prompts and behavior gates while exposing every additional skill from an explicitly supplied installed catalog in both fresh sessions. It records immutable skill-file hashes, per-turn activation/workflow gates, agent wall duration and completed assistant-message token usage. Ordinary natural-language host tasks are exercised; native slash-command dispatch and every-host activation remain unverified. The [agent evaluation guide](agent-evals.md#competing-skill-activation-experiment) owns its repeatable commands and measurement boundaries.

This measurement gates every other activation item below: if activation is already reliable, they add cost without benefit.

### Context-file pointer written by `init`

Status: deferred; no demonstrated benefit yet. `init` does not write any of these files. The audit below records documented host behavior, not an installer contract or observed activation. Sources were inspected on 2026-10-26.

| File | Documented support | Boundary relevant to a future pointer |
| --- | --- | --- |
| `AGENTS.md` | The [open format](https://github.com/openai/agents.md) defines a conventional project instruction file. [Claude Code](https://code.claude.com/docs/en/memory#agents-md) now reads hierarchical `AGENTS.md` files by default only when no applicable `CLAUDE.md`/`CLAUDE.local.md` exists, unless its instruction mode is changed. [Copilot's support matrix](https://docs.github.com/en/copilot/reference/custom-instructions-support) lists agent instructions for Copilot CLI, cloud agent and selected review/IDE surfaces. | The format itself cannot prove that an arbitrary target loads it. Gemini loads `AGENTS.md` only when `context.fileName` is configured to include it; the [Gemini CLI v0.32.1 contract](https://github.com/google-gemini/gemini-cli/blob/v0.32.1/docs/cli/gemini-md.md) defaults to `GEMINI.md`. |
| `CLAUDE.md` | [Claude Code memory documentation](https://code.claude.com/docs/en/memory#claudemd-files) documents project `./CLAUDE.md` or `./.claude/CLAUDE.md`, hierarchy and lazy subdirectory loading; these are advisory context, not enforcement. Copilot documents a root `CLAUDE.md` as an alternative agent-instruction file on the surfaces named in its support matrix. | This is not a portable destination for other targets. The exact Claude version was not pinned by the pilot, and no Claude context-file activation was executed by this audit. |
| `GEMINI.md` | [Gemini CLI v0.32.1](https://github.com/google-gemini/gemini-cli/blob/v0.32.1/docs/cli/gemini-md.md) documents global, workspace/ancestor and just-in-time hierarchical loading, with configurable file names. Copilot documents a root `GEMINI.md` as an alternative agent-instruction file on selected surfaces. | Support is host- and surface-specific. A Gemini default does not establish behavior in Copilot, Claude or any target merely sharing a skill destination. |
| `.github/copilot-instructions.md` | GitHub documents it as repository-wide Copilot instructions and separately documents path-specific `.github/instructions/**/*.instructions.md` plus agent-instruction files. The [surface matrix](https://docs.github.com/en/copilot/reference/custom-instructions-support) differs across GitHub.com, IDEs, code review, cloud agent and CLI. | The shipped `github-copilot` integration writes `.github/skills/focused-spec/SKILL.md` and `.github/prompts/focused-spec.prompt.md`, not a context file; those IDE assets do not configure Copilot CLI or cloud-agent instructions. |

The earlier proposal to choose one context destination per installer target was therefore too broad. Any future marker needs explicit consent plus a named host surface and its documented precedence/loading rules; it must not infer autoloading from the 50-target skill/wrapper catalog. A generic pointer still duplicates the skill description, consumes every-session context and has no measured benefit in the current activation sample.

### Event-scoped host hooks

Documented hooks are surface- and version-specific; none is installed by focused-spec and none was executed in the native pilot:

- [Claude Code hooks](https://code.claude.com/docs/en/hooks) document `PreToolUse`, `PostToolUse` and `Stop`. A synchronous `Stop` hook can continue the conversation with exit code 2 or `{"decision":"block","reason":"..."}`; the current reference also documents an eight-consecutive-continuation cap. This is documented current behavior, not an observed pilot result.
- [Kiro Hook types](https://kiro.dev/docs/hooks/types.md) (page modified 2026-10-10) document standalone `.kiro/hooks/*.json` definitions for IDE and CLI, while Web stores but does not run file/task triggers. `Agent Stop` continues with exit 1 or an exit-0 `decision: "block"`; `Post Task Execution` runs after a spec task. The native fixture fetches only requirements guidance and installs no Kiro IDE/CLI runtime, so applicability and execution remain unavailable there.
- Spec Kit `specify-cli` 1.2.3 exposes `specify event run` and the official source defines `session_start`, `pre_tool_use`, `post_tool_use`, `session_end`, `user_prompt_submit` and `stop`. Its [workflow reference](https://github.com/github/spec-kit/blob/main/docs/reference/workflows.md) also documents `type: shell` overlay steps. The native fixture installs only generic authoring assets; it installs no focused-spec extension, event handler, workflow or overlay, so these mechanisms are not applicable checks for that fixture.

No hook or context pointer is implemented. Revisit only after a reproducible skipped check identifies a specific surface and a paired experiment demonstrates benefit without blocking read-only or planning-only work.

## Completion enforcement

### `Stop` hook that runs the CLI

Where a documented end-of-turn event can synchronously return failed verification to the same agent loop, it could provide earlier feedback than CI. The exact audited claims are:

- **Kiro IDE/CLI:** `Agent Stop` exit 1 or an exit-0 JSON `decision: "block"` starts another turn. Other nonzero exit codes leave the response finished. `PostTaskExecution` exists for completed spec tasks, but the docs do not say every such failure starts another turn. The previous unqualified “exit 1 on `Stop`” claim is valid only for the documented local IDE/CLI surfaces, not Web or this runtime.
- **Claude Code:** `Stop` with exit code 2 or `decision: "block"` prevents stopping and returns the reason to Claude, subject to its continuation guard/cap.
- **Spec Kit 1.2.3:** runtime events can dispatch a command template's declared `scripts`, and a workflow overlay can add a `type: shell` step. Extension `hooks` are command invocations handled through the extension/event mechanism; they are not proof that an agent itself runs a magic `EXECUTE_COMMAND`, and workflow shell steps run only inside `specify workflow run`.

These are candidates, not a completion guarantee. The project has not selected a hook, installed one, or observed one in the native fixtures. Historical Agent OS motivation remains non-current: the later frozen matrix passed Agent OS revision/creation authoring and evidence, while Agent OS's inspected source exposes plan-mode shaping and standards injection rather than a native command hook.

## SDD host extension points

Primary-source audit, inspected 2026-10-26. “Runs command” means the documented host mechanism can launch a process; it does not mean focused-spec configured or observed that path.

| Host / inspected fixture | Documented mechanism and primary source | Applicability, runtime and observed limit |
| --- | --- | --- |
| Spec Kit / `specify-cli` 1.2.3 observed by `specify version --json` | [`specify event run`](https://github.com/github/spec-kit/blob/main/src/specify_cli/events/command_run.py) dispatches scripts for six canonical events; [workflow overlays](https://github.com/github/spec-kit/blob/main/docs/reference/workflows.md#workflow-overlays) can insert a `type: shell` step. | Current CLI surfaces were observed with `event --help` and `workflow --help`. The pilot's generic init installs authoring command/template assets only; no applicable validator, event handler or workflow is installed or executed. `self check` checks CLI releases, not spec validity. |
| Kiro / current requirements page, no runtime version | [Hook types](https://kiro.dev/docs/hooks/types.md) and [actions](https://kiro.dev/docs/hooks/actions.md) document shell-command hooks in IDE/CLI, including stop, tool, file and task events; Web does not execute file/task triggers. | The pilot downloads requirements Markdown only. No Kiro executable/IDE, hook configuration or version is installed, so native validation, lifecycle and hook execution are unavailable rather than failed. |
| GSD Core / npm `@opengsd/gsd-core@1.16.0`, registry `gitHead` [`87e87d34`](https://github.com/open-gsd/gsd-core/tree/87e87d34b2d8519e30d1af7d910fc98f2af4bc8d) | The exact-revision [command reference](https://github.com/open-gsd/gsd-core/blob/87e87d34b2d8519e30d1af7d910fc98f2af4bc8d/docs/COMMANDS.md) defines agent-driven project/phase verify and ship workflows; `gsd-tools.cjs` is their orchestration utility. | The pilot installs Pi assets and supplies the new-project workflow plus requirements template. A lone authored `REQUIREMENTS.md` has no initialized phase/project state for verify/ship, and there is no standalone requirements validator. No applicable native validator or lifecycle command was executed. |
| OpenSpec / CLI 1.14.1 | [Customization](https://github.com/Fission-AI/OpenSpec/blob/v1.14.1/docs/customization.md) documents prompt-level `context`, artifact `rules` and `operations.apply/archive.guidance`; official sync/archive skills own publication. | Guidance is agent-facing, not an enforcement hook. `openspec validate <change> --strict` is an applicable native validator and was already executed in both historical fixture modes. Archive is a genuine lifecycle operation and remains for Main's selected pilot extension, not this survey. |
| BMad / commit [`48f0ce37`](https://github.com/bmad-code-org/BMAD-METHOD/tree/48f0ce37e1fc378d6255c90e1b155f2212a6fe33) | The pinned `bmad-spec` skill owns kernel update/validation and the pinned [`setup.py`](https://github.com/bmad-code-org/BMAD-METHOD/blob/48f0ce37e1fc378d6255c90e1b155f2212a6fe33/skills/bmad/scripts/setup.py) exposes read-only `--status` for installation state. | Existing pilot regeneration through the memlog-backed official workflow is the applicable lifecycle check and passed historically. `setup.py --status` validates installation state, not a SPEC's semantics; no separate non-model native SPEC validator was found. Earlier `_bmad/custom/*.toml` hook-like field claims were not found in this pinned source and are withdrawn. |
| Agent OS / unpinned `main`, inspected at [`e892e61d`](https://github.com/buildermethods/agent-os/tree/e892e61d322759165e7d9173e92c1010406c9f4d) | [`shape-spec.md`](https://github.com/buildermethods/agent-os/blob/e892e61d322759165e7d9173e92c1010406c9f4d/commands/agent-os/shape-spec.md) requires plan mode and approval; standards are selected from `agent-os/standards/index.yml` and copied into spec planning artifacts. | The pilot fetches `main` at runtime and adds an OMP question bridge; it does not install an Agent OS CLI or pin a version. No native validator, lifecycle command or hook is present in the inspected fixture. The absence is limited to that revision/fixture, not a claim about every external Agent OS host integration. |

The audit leaves only documented command-running extension points in Spec Kit and Kiro (plus Claude Code as a non-SDD host example). GSD, OpenSpec, BMad and Agent OS mechanisms inspected here are agent-facing workflow/context or host-owned lifecycle operations, not generic synchronous enforcement. Git hooks and CI remain host-independent alternatives but do not return failures inside every agent loop.

## Eval follow-ups from the `0.10.1` baseline

- **Closed:** the Agent OS revision rerun was completed in the later frozen 40-invocation matrix; all native authoring/evidence pairs passed. Historical failures remain immutable, not evidence that the same defect persists.
- **Open:** the observed OpenSpec revision workflow-reacquisition failure and unsupported native certification aspects remain visible in block 6. Authoring/evidence success and a successful final host operation cannot substitute for a missing mandatory guidance step. No new context pointer or hook has been justified by this unpaired observation.
- **Closed implementation:** public/native measurements and immutable aggregate reports are implemented and exercised with explicit denominators/provenance. Block 6 records actual selected results and limitations; block 4 retains the activation experiment, not a universal zero-failure claim.
