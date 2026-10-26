# Design

## Context

See [proposal.md](./proposal.md) for motivation and [the delta](./specs/agent-workflow/spec.md) for behavior. The selected work is the remaining block-6 verification/reporting scope, not a restart of the completed product-path documentation or Agent OS rerun.

Observed owners and conventions:

- `evals/activation.ts::measureAgentTurns` measures completed assistant `message_end` usage and summed agent duration; public results already save these measurements. Missing/invalid usage remains incomplete rather than zero.
- `evals/dialogue.ts::runAuthoringDialogue` retains individual agent turns and a combined agent result. Measuring both would double-count. Tool-free test-user replies have separate transcripts.
- `evals/acp-agent.ts::runPlanningDialogue` returns the actual ACP agent result and converts persisted journal messages to the existing event contract. Its duration currently covers the whole interaction, including awaited test-user responses; native agent timing must not silently reuse that as exclusive agent time.
- `evals/native-pilot.ts` saves authoring/planning/dialogue and BMad regeneration transcripts, but no common native measurement field. Native certification requires independently passing authoring, evidence, validation and lifecycle aspects. Non-BMad lifecycle is currently unverified. `nativeGate` runs OpenSpec validation and the official Gherkin syntax parser; other fixtures report unavailable native validation.
- `saveEvalResult` uses exclusive, unique writes. Existing campaign summaries retain attempts, invocation exit codes, result paths and observed provider statuses; some provisioning failures have no result artifact. Public artifacts do not consistently retain model/candidate identity internally.
- `docs/development/candidate-improvements.md` owns block status and a partly unverified extension/context-file survey. `docs/development/agent-evals.md` owns invocation, verdict and measurement semantics. Installer destinations are not proof of always-loaded context-file behavior.

## Goals / Non-Goals

**Goals:** one measurement meaning across harnesses; a reusable report that cannot turn missing data into success; primary-source-qualified host claims; real applicable native checks and final-scope evidence continuity.

**Non-Goals:** changing the approved sensitivity policy, adding `probe`/`status --changed`, implementing deferred hooks or context-file pointers, changing installer destinations, modifying the portable skill/guidance or creating a new completion-state store. These remain separate retained decisions, not cancelled work. This proposal does not authorize apply, publication of this change, release, or a consumer refresh.

## Decisions

### 1. Reuse measurements, retain phase boundaries

Use `measureAgentTurns` rather than a second usage parser. Save native measurements per scored phase and overall, with the same five usage fields, `usageComplete` and explicit missing coverage as public measurements. Preserve the existing transcripts and verdicts.

- Ordinary authoring: measure each `dialogue.turns[].agent` once, never the combined dialogue result as well. Account for only newly completed messages in resumed execution; if the runtime returns cumulative history, identify/exclude pre-existing frames from the retained session boundary rather than deduplicating equal token values or message text.
- ACP: measure completed evaluated-agent journal messages, not protocol snapshots or test-user transcripts. Retain the existing elapsed interaction duration for diagnostics, but derive scored agent duration excluding measured responder waits; expose the timing boundary. If exclusive timing cannot be observed, mark that timing unavailable rather than compare interaction wall time with exclusive public agent time.
- Lifecycle: retain each actual lifecycle `AgentResult`, including failed attempts with captured output. Do not count diagnostic interviews. Failed or unattempted phases retain their real coverage.
- Keep test-user and research accounting separate if retained; do not fold it into scored-agent token/time totals or call token totals monetary cost.

Alternative rejected: re-parsing the final concatenated transcript and applying a single enclosing stopwatch. It loses phase coverage, risks resumed-history duplication and includes responder/judge work.

### 2. A read-only repository report, not a product command

Add `evals/report.ts` with a small repository invocation: `node --experimental-strip-types evals/report.ts --result <path> [--result <path> ...] [--manifest <path> ...] [--json]`. Accept at least one explicit result or manifest; no implicit scan of all historical results. `--manifest` accepts the recorded campaign `entries[].attempts[]` shape with result paths, exit codes and provider-status metadata. Resolve root-relative historical paths against the repository root and absolute paths as recorded; print the chosen sources. No new runtime dependency is needed.

The report reads, validates and hashes its inputs without rewriting results, replaying gates or launching agents. Malformed JSON or unsupported shape is an error; a manifest-recorded invocation with no result is a counted unavailable result, not a parser error or a pass. Retain missing referenced artifacts as missing-result invocations with their invocation metadata.

Report JSON and readable output contain:

- Source paths/hashes and invocation/attempt identities; duplicate references to one canonical result are identified and counted once. Distinct attempts/results remain distinct even when case IDs match.
- Per-case/mode and per-model/candidate groups, separate unique-case and attempt coverage, and expected/pending coverage only when supplied by a selected manifest. Unknown model/candidate identity stays unknown; an `assetsUnchanged` boolean is not a candidate hash. Do not pool differing/unknown candidates into a certified comparison.
- Original public verdicts and all four native aspects, plus failed gates, blocked gates with causes, unverified native capabilities, provider interruptions and provisioning/no-result attempts as independent dimensions. A run can be provider-interrupted and have a saved failed gate; neither fact erases the other. Native exit 2 is not itself a failure or certification.
- Loader, workflow and applicable host-guidance observations with passed/failed/unobserved/blocked counts. Show eligible, observed and interrupted denominators. Failure rates use actually observed eligible judgments; zero observed judgments produces no rate, not zero failures. Preserve public per-turn versus native combined granularity.
- Non-gating integration acquisition separately from task gates. A false observation cannot overturn saved success. Historical loader protocols and absent fields remain labeled historical/unavailable, not rejudged under current rules.
- Measurement coverage, summed valid fields and incomplete usage separately from complete-case aggregates. Do not fabricate native historical measurements by assigning duration from campaign wall clocks. Timing excludes provisioning, judges and research; report host timing differences explicitly.

Record requested model in new public results when available, using the existing request rather than guessing from output. Use explicit recorded campaign provenance for historical data. Candidate provenance can remain unknown when absent; this reporting work does not require a new artifact-distribution system.

Alternative rejected: extending one disposable campaign `summarize.mjs`. It would retain ad-hoc assumptions about a single model, result availability and which native aspects count as success.

### 3. Audit claims before choosing additional host checks

Update the existing survey and owning install/eval documentation, not another procedural guide. For every claimed context-file mapping or extension mechanism, retain a primary URL or pinned source path/revision, host version, inspection date, claimed scope and actual limit. Cover the context-file examples (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Copilot instructions) and all surveyed hosts: Spec Kit, Kiro, GSD Core, OpenSpec, BMad and Agent OS. Cross-check shipped skill/wrapper destination claims where relevant; a valid skill destination does not prove context-file autoloading.

Separate five questions: documented capability, installed fixture version, applicability to the task, availability in this runtime, and actual observed execution. Published host documentation may describe a newer capability than the pinned fixture; do not silently certify that fixture. An inaccessible source leaves a precise unresolved claim, not a negative claim that the host has no capability.

Planning research already observed:

- `openspec archive --help` exposes real archive/spec-update behavior. Existing installed sync/archive skills retain host-owned lifecycle procedures; version provenance must be captured from the executable actually used in the disposable fixture.
- Native GSD provisioning uses official `@opengsd/gsd-core@1.16.0` Pi installation. The old upstream README redirects to [GSD Core](https://github.com/open-gsd/gsd-core); the [current primary README](https://raw.githubusercontent.com/open-gsd/gsd-core/main/README.md) describes a verify/ship loop, not proof that the pinned fixture exposes an applicable standalone validator.
- [Kiro hooks documentation](https://kiro.dev/docs/hooks/) was fetched but reader extraction supplied metadata only. That is not sufficient evidence for event names, command execution or retry semantics.
- Codex skills documentation at `https://developers.openai.com/codex/skills/` timed out and its alternate path returned HTTP 403. The context-file mapping remains unverified from those attempts; use another official source or browser during apply, not an inferred mapping.

Do not implement hooks or context pointers as the outcome of this audit. Correct misleading positive/negative survey assertions and keep genuine unavailable capabilities visible.

### 4. Native checks must execute the host operation

Retain OpenSpec native validation, Gherkin syntax-only validation and BMad regeneration. Add another validator/lifecycle path only when the audit identifies a genuine, applicable operation executable in the fixture. Record command/operation, installed version, result and source provenance. An executed failure is failed; missing runtime or unsupported applicable command is unverified with its exact cause. Installation, Markdown parsing, a grep, focused-spec validation and BMad retention are not substitutes for native format validity.

For Spec Kit, Kiro, GSD, Agent OS and non-regeneration BMad checks, audit the exact installed workflow/source before deciding availability. Do not create synthetic validators or empty passing lifecycle functions to fill the matrix. If a real applicable operation is available, exercise and integrate it within this change; otherwise document the limitation and leave that aspect unverified. No IDE installation or unrequested global host mutation is implied.

### 5. OpenSpec lifecycle extends the native pilot

Use the existing public working/final checkpoint conventions where compatible instead of duplicating lifecycle semantics. Extend the native OpenSpec pilot after successful authoring/evidence and integrity checks:

1. Resolve the actual configured working selection for `link-blocked-account`; freeze its opaque identity, native blocked-valid-credentials outcome and all exact references. Independently validate and execute them before any transition.
2. Run a fresh host-owned lifecycle turn with official sync/archive skills and the focused loader available. The request authorizes publication/archive of the completed change, not new product behavior. Complete any real host approval handoff through the existing test-user boundary; do not disguise pending tasks as completed.
3. Let the host publish and archive. Agent-owned approved integration reconciles the explicit surviving main-scope binding/evidence and removes obsolete working metadata. Never copy an ephemeral working proof into a fake final certificate.
4. Independently resolve final configured discovery, confirm the working document is out of selection, and compare identity/outcome/AND references with the checkpoint. Validate final host state using the installed host's applicable command and run exact surviving evidence plus the final configured selection.
5. Independently introduce the existing controlled Go/Python product regressions against final selected evidence, require behavioral assertion failure and exact restored success. Preserve unrelated native history, product/tests and installed package/skill bytes.

A failed checkpoint blocks the lifecycle before the next agent call. A failed transition or post-transition check fails lifecycle; it cannot be reported as unsupported. Keep authoring/evidence and native lifecycle verdicts independent. BMad regeneration remains its existing separately judged operation.

Alternative rejected: counting a successful native authoring run or public inline-lifecycle case as native OpenSpec pilot lifecycle success.

### 6. Evidence and verification plan

The table records intended exact evidence, not executable enrollment. Create/reuse behavior tests at apply, then register in `.focused-spec/evidence/agent-workflow.yaml` for this working scope and subsequently the surviving current scope. New selectors are explicitly planned; they are not existing passing tests.

| Focused ID | Planned exact evidence selector after `vitest::` |
| --- | --- |
| `agent.eval.native-measurements` | `test/native-pilot.spec.ts::native pilot evaluation boundaries > measures scored native phases once without responder or diagnostic usage` |
| `agent.eval.native-partial-usage` | `test/native-pilot.spec.ts::native pilot evaluation boundaries > retains incomplete native measurements after an interrupted phase` |
| `agent.eval.report-verdicts` | `test/eval-report.spec.ts::evaluation reports > preserves mixed verdicts and measurement coverage without changing results` |
| `agent.eval.report-invocations` | `test/eval-report.spec.ts::evaluation reports > retains missing-result invocations and attempts without duplicate result counts` |
| `agent.eval.report-guidance` | `test/eval-report.spec.ts::evaluation reports > separates guidance failures from unobserved and interrupted judgments` |
| `agent.eval.report-observations` | `test/eval-report.spec.ts::evaluation reports > keeps acquisition observations separate from saved task success` |
| `agent.eval.host-capability-limits` | `test/native-pilot.spec.ts::native pilot evaluation boundaries > leaves unavailable host operations unverified without certification` |
| `agent.eval.host-executed-check` | `test/native-pilot.spec.ts::native pilot evaluation boundaries > distinguishes an executed host failure from an unavailable capability` |
| `agent.eval.native-publication-stop` | `test/native-pilot.spec.ts::native pilot evaluation boundaries > blocks OpenSpec publication when working evidence fails` |
| `agent.eval.native-publication-survival` | `test/native-pilot.spec.ts::native pilot evaluation boundaries > rejects lost or redirected final evidence after OpenSpec archive` |

Measurement tests must exercise result production through ordinary dialogue and ACP journal paths, not assert field forwarding. Report tests invoke the real report entrypoint on isolated artifacts and check observable counts/verdicts and unchanged input hashes. Native tests use real disposable evidence/host boundaries where possible; test doubles only select an unavailable operation or produce a controlled failure, never certify a host workflow.

Permanent tests defend uncertain aggregation, phase and failure boundaries. Run a throwaway CLI report smoke against selected immutable historical results and invocation records, retain source/output hashes, and verify input bytes unchanged. Execute affected real host operations in isolated fixtures and capture installed versions, commands, output and limitations. New/changed evidence must detect a reversible regression in its actual evaluator/report behavior and pass after restoration; a parse/setup error does not prove sensitivity.

Fresh model verification follows isolated-first ordering: ordinary native dialogue, Agent OS ACP, BMad regeneration and OpenSpec publication/archive in creation and revision modes as affected. Stop on a real failure, fix it, and retain old attempts. Do not claim a new full matrix unless every rediscovered invocation actually executes. Historical scores and unrelated completed blocks stay immutable.

## Risks / Trade-offs

- Resumed output or ACP protocol snapshots may repeat messages → use real execution/journal boundaries; do not deduplicate by token values or text.
- ACP responder waits inflate wall duration → separate measured waits and state timing coverage; never compare incompatible clocks silently.
- Older artifacts lack native metrics or model/candidate identity → label missing provenance; no backfilled scores or fabricated zeroes.
- Native host commands differ by installed version → inspect/pin the actual executable contract, run real applicable checks, retain unsupported/unavailable aspects.
- Additional lifecycle turns can expose genuine failures → preserve all attempts and block certification; do not weaken approval, integrity or evidence gates.
- Documentation audit may find incorrect claims without a replacement runtime → correcting the claim and recording the specific limitation completes the audit, not the unavailable runtime verification.

## Migration Plan

Apply changes only to new result production and read-only derived reports. Do not rewrite existing artifacts or rerun historical gates to normalize schemas. Update existing callers for any changed internal result contracts; no deprecated measurement parser or compatibility execution path. Reports may explicitly read historical artifact shapes because those are immutable data, not supported old product APIs.

After local regression/smoke checks, update the owning docs and block-6 status with exact measured scope and remaining external limitations. Verify root README accuracy; change it only if shipped user-facing behavior or status actually changes. Validate documentation links/reachability, run `npm test`, strict working-scope focused validation/execution, then host-owned sync/archive and final all-scope checks when apply is authorized and complete. Rollback affects new code and newly derived output only; historical evidence remains untouched.
