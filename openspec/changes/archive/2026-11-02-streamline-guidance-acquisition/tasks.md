# Tasks

## 1. Combined guidance response and compatibility

- [x] 1.1 Update `packages/core/src/instructions.ts` so operation requests return clearly separated workflow-router and operation-topic content with the original requested topic in the protocol-1 envelope; leave workflow-only and integration/formats/runners requests distinct. Extend `test/cli.spec.ts` to prove both sections and the exact package/version/topic are returned offline without project reads or writes, and that workflow-only output remains router-only.
- [x] 1.2 Preserve fail-closed behavior for unsupported protocol, invalid topic/options, incomplete package assets, malformed response content, and installed package identity/version. Extend CLI tests for combined requests and verify invalid requests still return nonzero, empty stdout, and actionable diagnostics; retain the public `version` command behavior.
- [x] 1.3 Update `skills/focused-spec/SKILL.md` to derive version and identity from the selected operation response and avoid separate version and workflow-only calls for that operation. Preserve same-executable selection, standalone invocation, complete linked-output recovery, exact protocol/topic/package/version validation, and distinct shared/plugin-document requests; verify authored loader examples and initialization-owned source are consistent without hand-editing generated mirrors.

## 2. Trigger scope and concise authored guidance

- [x] 2.1 Narrow the skill description only for meaning-preserving spelling, punctuation, or formatting edits that leave behavioral meaning, scope, conditions, outcomes, identities, selectors, and evidence unchanged. Preserve mandatory loading for behavioral SDD/BDD and all standalone BDD/SDK scenarios and associated application-driver work; review the resulting trigger against the approved `broaden-bdd-skill-activation` scenarios and verify there is no host-, framework-, or keyword-only restriction.
- [x] 2.2 Reduce redundant text in authored loader and guidance while preserving explicit safety, approval, provenance, SDK-only, validation, and failure boundaries. Record before/after bytes per authored loader/topic, keep workflow within its current observed size limit, build/stage package assets normally, and verify packed assets contain the complete router and operation guidance.
- [x] 2.3 Update guidance acquisition and trigger documentation to describe the combined operation response, retained protocol/version validation, editorial-only exception, continued BDD activation, and live eval requirements. Verify commands and relative documentation links against the built local CLI and authored sources.

## 3. Isolated agent evaluations

- [x] 3.1 Add isolated public-harness case `guidance-combined-operation` that prompts an agent to perform an operation needing focused-spec guidance without prescribing the command sequence. Independently judge one requested operation response with complete router and operation sections, same selected installation, exact package/version/topic validation, and preserved host workflow boundary; reject multiple redundant router/version acquisition calls and malformed or incomplete guidance.
- [x] 3.2 Add isolated public-harness case `guidance-skill-trigger-boundaries` with separate inert editorial-only, behavioral SDD, standalone BDD/SDK scenario, and application-driver tasks. Judge actual activation and work outcomes rather than skill-description text; retain the existing SDK composition, driver sensitivity, and full-skill-routing protections.
- [x] 3.3 Rediscover eval case IDs, then run `guidance-combined-operation` and `guidance-skill-trigger-boundaries` individually with the same explicit model before starting any model matrix. Retain immutable per-case outputs and report model, commands, activation/acquisition evidence, failures, and timeouts; do not replace a failed or unavailable live run with mocked transcripts.

## 4. Focused evidence and completion

- [x] 4.1 Enroll the exact `guidance.delivery.combined-operation`, `guidance.delivery.combined-router-only`, `guidance.delivery.combined-invalid-preserves-validation`, `guidance.plugins.operation-with-router`, `agent.activation.editorial-only`, `agent.activation.bdd-sdk`, `agent.activation.bdd-driver`, and `agent.activation.sdd` occurrences under this change in the existing `.focused-spec/evidence/agent-guidance.yaml`, using every selector and AND member listed in `design.md`; verify all selectors resolve and no unrelated registration changes.
- [x] 4.2 Run the exact focused CLI/eval selectors from `design.md`, validate `openspec validate streamline-guidance-acquisition --strict`, then run non-strict `./node_modules/.bin/focused-spec validate --root . --scope streamline-guidance-acquisition`; verify the complete scope with `./node_modules/.bin/focused-spec run --root . --scope streamline-guidance-acquisition` and report CLI test results separately from same-model live eval results.

## Workflow follow-up

- Sync the reviewed delta to the main capabilities and validate the final specifications after authorized implementation and evidence completion.
- Archive the change only after host review and required final-scope evidence; publishing and refreshing consuming installations remain separate operations.
