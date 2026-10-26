# Proposal

## Why

The native OpenSpec revision run `native-openspec-1793017479165-47780b82-8f8e-4714-88ce-102db8929e76.json` failed only because it did not repeat workflow acquisition after approval in the same persisted session; its other 31 gates passed. Deterministic replay changes that acquisition verdict from FAIL to PASS solely by joining the two dialogue turns, contradicting the evaluator's documented approval-boundary semantics.

## What Changes

- Judge guidance acquisition across a continuous native dialogue rather than treating each clarification or approval reply as a fresh workflow.
- Retain mandatory initial valid acquisition and invalidate retained acquisition when its serving installation, version, guidance bytes, or session context changes. Capture acquisition state at each executed turn instead of retrospectively comparing every historical response with the final package.
- Record a missing repeat read in an unchanged resumed dialogue as a non-gating observation. Do not let observations change native verdicts, exit status, certification, or trigger failure interviews.
- Apply the same session rule to native authoring and OpenSpec publication. Fresh public workflow sessions and BMad regeneration still require their own acquisition.
- Retain exact provenance, response validation, complete artifact recovery, authorization, integrity, native lifecycle, evidence execution, and regression-sensitivity checks. Never rewrite prior scores.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-workflow`: make evaluation distinguish a resumed approval conversation from a new acquisition context and report redundant-read compliance separately from task success.

## Impact

Evaluator owners: `evals/judge.ts`, `evals/native-pilot.ts`, and the existing dialogue/request metadata where needed to establish session continuity. Behavioral tests belong in `test/evals.spec.ts` and `test/native-pilot.spec.ts`; native observations use the existing report-compatible result field. Update `docs/development/agent-evals.md`, check README accuracy, and independently bind the working delta during apply.

This correction changes evaluator scoring, not the distributed loader, package-owned guidance, model prompts, host skills, public CLI/API, or package release. It does not claim that rereading has no causal benefit; the evidence establishes an inappropriate hard failure at an unchanged approval boundary. Implementation remains pending the OpenSpec apply boundary; this proposal creates no executable evidence integration or source changes.
