# Candidate improvements

Improvement register and ordered implementation sequence. Block 1 is implemented and archived; later blocks remain unimplemented and require their own selected OpenSpec work. Candidate ideas outside those blocks still need a decision and, where noted, measurement.

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

- Add `focused-spec probe` for disposable product-regression sensitivity checks and exact restoration.
- Add `focused-spec status --changed` for machine-readable completion state: affected unenrolled items, planned evidence, unresolved references, and missing sensitivity receipts.
- Acceptance: host hooks and agents can consume stable exit codes/JSON instead of interpreting the prose completion gate.

### Block 3 — One standalone/host workflow contract

- Model standalone SDK execution, CLI-integrated scenarios, and SDD-hosted evidence as adapters over one phase and approval contract.
- Reduce prose branching while preserving SDK-only independence and host-owned lifecycle boundaries.
- Acceptance: each adapter retains its native source and exact evidence semantics; no framework or CLI becomes mandatory for SDK-only work.

### Block 4 — Measure activation before changing installation

- Add a realistic blind activation eval: full competing skill set, ordinary host command, no mention of focused-spec or evidence.
- Establish baseline skill/workflow acquisition, token cost, wall time, and failure categories.
- Only if the baseline shows a material activation gap, evaluate an opt-in marker block in the host context file (`AGENTS.md`, `CLAUDE.md`, or target-specific equivalent).
- Acceptance: the decision to add context-file installation is based on paired measured results, not assumption.

### Block 5 — Native in-loop host hooks

- Implement only for hosts with documented command/event hooks, beginning with the highest-value host.
- Consider spec-path reminders and `Stop`/post-task CLI verification that returns failures to the agent for another turn.
- Keep host-specific adapters optional; do not add hooks where the host only supports prompt injection.
- Acceptance: a hook executes the selected CLI check, returns an actionable failure to the agent, and does not replace CI or git-hook integration.

### Block 6 — Documentation, host coverage, and eval quality

- Clarify the two product paths in first-run documentation without duplicating installed workflow guidance.
- Verify host context-file mappings and extension claims against primary sources before shipping integrations.
- Repeat `native revise agent-os` and improve native lifecycle/validation coverage where certification remains unverified.
- Add per-case token and wall-time reporting plus guidance-loading failure rates to eval summaries.
- Acceptance: documentation matches shipped behavior, host claims have evidence, and eval reports distinguish failed from unverified.

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

Current agent evals cannot show whether the loader activates on its own: cases pass `--skills focused-spec`, use a small skill set, and the prompt names evidence work. Add an eval variant with a realistic prompt (only a host command such as `/opsx:apply`, no mention of evidence or focused-spec) and the full installed skill set, then measure how often `focused-skill-loaded` passes.

This measurement gates every other activation item below: if activation is already reliable, they add cost without benefit.

### Context-file pointer written by `init`

Status: deferred; no demonstrated benefit yet.

`init` would add a marker-delimited block to the target's always-loaded context file, keeping the skill as the only owner of the procedure:

```md
<!-- focused-spec:begin -->
## Behavioral specifications
Before any step that creates, revises, reviews, or verifies requirements, acceptance criteria, or scenarios — including inside OpenSpec, Spec Kit, Kiro, BMad, or GSD workflows — load the `focused-spec` skill and follow it.
<!-- focused-spec:end -->
```

- Value only if the block carries project knowledge the skill description cannot: the detected host commands (for example `openspec-apply-change`) and spec paths (`openspec/specs/**`, `.specify/**`, `.kiro/specs/**`). A generic pointer duplicates the description.
- Per-target destination in the init catalog (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`); which file each host actually loads is unverified.
- Explicit consent: interactive prompt; an explicit flag in JSON/noninteractive/CI mode, mirroring `--tools`. Markers let `init --replace` update or remove only the block.
- Do not inline the loader procedure: it would cost tokens in every session and create a second procedure owner.
- Ship only if the activation eval shows a measurable gain.

### Event-scoped host hooks

Where the host supports it, inject a short reminder only when the agent touches specification files, instead of loading guidance into every system prompt: `PreToolUse`/`PostToolUse` matchers on spec paths, or Kiro `PostFileSave`. Costs per-host implementations and hook trust approval (for example Codex `/hooks`).

## Completion enforcement

### `Stop` hook that runs the CLI

Hosts that run a command at turn end and feed failure back to the agent can enforce evidence inside the agent loop, which git hooks and CI cannot: the agent gets another turn with the failure output.

- Kiro: `Stop` / `PostTaskExecution` hook with `type: command`; exit 1 on `Stop` gives the agent another turn.
- Claude Code: `Stop` hook returning `decision: block`.
- Spec Kit: runtime events (`stop`, `post_tool_use`) run `scripts` directly; a workflow overlay step `type: shell` after `implement` runs only under `specify workflow run`.

This addresses failures that a context pointer cannot: in the `0.10.1` baseline, `native revise agent-os` loaded the skill and workflow guidance, then stopped after plan approval without applying the native marker or `.focused-spec/evidence.yaml`.

## SDD host extension points

Survey of host-native integration points, from documentation (Kiro and GSD were not verified against source):

| Host | Mechanism | Host runs a command itself |
| --- | --- | --- |
| Spec Kit | runtime events with `scripts`; workflow overlay `insert_after: implement` with `type: shell`; `after_implement` hooks with `optional: false` | events and workflow steps yes; hooks are executed by the agent via `EXECUTE_COMMAND` |
| Kiro | `.kiro/hooks/*.json`, `PostTaskExecution` / `Stop` triggers, `type: command` action | yes |
| GSD Core | `agent_skills.gsd-verifier` / `gsd-executor` in `.planning/config.json` inject `SKILL.md` into the spawned agent prompt | no; guarantees the skill is in context |
| OpenSpec | `config.yaml` `context` and `operations.apply.guidance`, surfaced by `openspec instructions`; `apply.instruction` in a schema copy | no; agent-facing text |
| BMad | `_bmad/custom/<skill>.toml`: `activation_steps_*`, `persistent_facts`, `on_complete` | no; agent-facing text |
| Agent OS | standards via `/inject-standards`; no hooks | no |

Two integration levels follow: hosts that execute a check and return its result to the agent (Kiro, Spec Kit), and hosts that only guarantee the instruction reaches the agent (GSD, OpenSpec, BMad). Git hooks and CI already work with any host and need no product change.

## Eval follow-ups from the `0.10.1` baseline

- Rerun `native revise agent-os` to tell a stable regression from a one-off model miss.
- Native pilots stay uncertified because host phases are not independently checked: `nativeValidation` is unverified for Spec Kit, Kiro, BMad, GSD, and Agent OS; `nativeLifecycle` is unverified for every host except BMad.
- Add per-case token and wall-time cost, and the guidance-loading failure rate, to eval reports. Target zero loading failures by removing loader gates, not by polishing their wording.
