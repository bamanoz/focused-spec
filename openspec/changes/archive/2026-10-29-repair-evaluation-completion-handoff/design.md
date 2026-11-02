# Design

## Context

See [proposal.md](./proposal.md). Retained Kiro revision failures and a fresh unchanged blind run show a configured native document with no binding or evidence source. The workflow's reconciliation scope says "touched enrolled native item", despite its broader completion requirement. The Agent OS failure interview contains substantive recommendations followed by a todo continuation; selecting only the final response loses recommendations. ACP currently records a responder only after successful process execution and JSON decoding.

## Goals / Non-Goals

**Goals:** Repair the configured-but-unenrolled completion handoff and preserve evidence needed to diagnose failed runs.

**Non-Goals:** Change official host workflows or blind tasks, supply hidden selectors, relax scoring, retry model turns, change SDK-only independence, or certify unavailable host validators/lifecycles. Existing historical results remain immutable.

## Decisions

1. Widen the existing reconciliation entry condition to a touched item selected by existing configuration, including incomplete enrollment. Keep read-only/planning boundaries and request required authorization. Do not enroll unrelated items or add host-specific rules to portable guidance.
2. Reuse completed assistant-message parsing, retaining all research replies in order while machine-readable test-user decisions continue to select the last response.
3. Record an ACP question before invoking its responder; retain available output before checking success/decoding. An undecoded decision is `null`. Reuse existing failed-turn normalization for thrown process output. No consent or success is inferred from retained diagnostics.
4. Extend existing native binding and research isolation regressions. Exercise failed exit, malformed JSON and thrown transport at the real planning-dialogue boundary using an isolated ACP subprocess fixture. Live model evaluation, not a source-text assertion, establishes instruction effectiveness.

## Exact evidence

| Native ID | Required Vitest reference(s) |
| --- | --- |
| `agent.review.missing-enrollment` | `vitest::test/native-pilot.spec.ts::native pilot evaluation boundaries > judges an external Kiro native-ID binding without requiring a second marker`; `vitest::test/dialogue.spec.ts::authoring dialogue consent > permits the confirmed revision without authorizing a different metadata file` |
| `agent.eval.research-replies` | `vitest::test/evals.spec.ts::agent eval harness > keeps post-failure recommendations outside scored agent turns` |
| `agent.eval.responder-failure` | `vitest::test/acp-agent.spec.ts::genuine planning consent > retains the unanswered host question and responder failure (exit)`; `vitest::test/acp-agent.spec.ts::genuine planning consent > retains the unanswered host question and responder failure (malformed)`; `vitest::test/acp-agent.spec.ts::genuine planning consent > retains the unanswered host question and responder failure (throw)` |

Enroll these references only during apply in the existing capability-owned registry. Fresh Kiro revision and all rediscovered public cases plus every native host in revise/create modes establish model-specific outcomes separately from deterministic gate tests. Preserve every failed result and expected unverified native-validator/lifecycle limitation. A throwaway matrix driver records actual invocations and immutable result paths, without changing prompts or gates.

## Risks / Trade-offs

- Existing configuration is not blanket authorization: the handoff must still obey explicit user scope and host approval.
- Research answers may include runtime continuations: retaining them is preferable to discarding substantive earlier evidence; no semantic classifier or extra model call is introduced.
- Live compliance remains model-dependent: report all failures and unverified aspects, not a universal green certification.
- Build/staging must finish before model matrix provisioning; installed package bytes stay protected during each evaluation.
