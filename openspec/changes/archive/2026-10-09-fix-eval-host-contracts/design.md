## Context

The captured real proposal used `account.authentication.blocked`, but a blind prompt was judged against `auth.login.blocked-account`. Spec Kit installed real commands but exposed no host skill through the driver's filtered discovery. BMad agents marked a kernel despite existing generated-source guidance. OMP advertises read-only `--plan-yolo`, but it automatically approves the plan; that alone cannot satisfy Agent OS user confirmation.

## Goals / Non-Goals

**Goals:** task-grounded identity judgment, identity continuity, discoverable genuine host guidance, root-cause verification with fresh model results, and accurate capability limitations.

**Non-Goals:** production CLI changes, answer-bearing prompts, weaker mutation/integrity/approval gates, unsupported native-validator claims, historical-result edits, package releases, or sampling repeatedly until green.

## Decisions

1. Model prescribed identity separately from a run's selected identity. Inspect task/source contracts before removing a fixed expectation. Select exactly one native identity only where unspecified, then freeze it before later checkpoints; preserve selected scope and evidence checks.
2. Expose installed Spec Kit command/template guidance through a local authoring skill with provenance, following existing Kiro/GSD provisioning rather than modifying the portable skill or blind request.
3. Keep BMad official guidance unchanged. Put generic generated-kernel/native-ID integration facts beside host guidance where agents discover them; memlog and regeneration remain host-owned. Do not include the task's exact focused ID or selectors.
4. Use actual OMP ACP `session/set_mode` with `plan` and form-mode elicitation, verified against installed OMP 18.2.5. A separate tool-free, skill-free test-user answers actual questions and explicitly approves the presented plan; no PlanYolo or auto-approval substitutes for consent. Preserve mode updates and per-turn filesystem snapshots. Native validators and unexercised lifecycles remain separately unverified.
5. Keep saved model results immutable. Regression checks and transcript replay prove gate changes; only fresh model runs certify changed fixtures and workflow.
6. Explicit planning-only tasks authorize native planning artifacts and identity planning, not executable registry/configuration/runner setup, even when evidence is labelled planned. Selected assertion repairs require the same sensitivity check as new references; an unchanged selector does not make changed evidence unchanged. Propose final metadata so partial approval does not silently authorize later revisions.
7. Recognize equivalent denial wording in native outcome gates while retaining the blocked-account, valid-credentials, rejection, single-binding and generated-source constraints. Runtime integration must expose actual host questions during plan mode, without replacing mandatory interactions with assumptions.
8. A change name is not a focused execution-scope label. Discover the unique scope containing that named change's native documents, reject missing/ambiguous selections, and pass that selection to scenario, CLI and mutation checks. Accept equivalent exact Go selector forms; the runner's resolution/execution and independent mutation remain mandatory.
9. Kiro may stop to review a concretely proposed metadata revision. Reuse the existing bounded authoring dialogue and independent tool-free test-user instead of weakening its workflow or pretending an unanswered question completes evidence integration.

## Risks / Trade-offs

- Dynamic identity could accept the wrong behavior: retain exactly-one selection, evidence contracts, controlled behavioral mutations, and scope isolation.
- Host integration guidance could leak answers: expose only generic generated-artifact/native-ID conventions, never task-specific binding values or selectors.
- Official workflow installation and remote resources may change: record provenance and fail preparation on missing resources rather than invent fallbacks.
- Some hosts have no runnable native validator or exercised transition in this fixture: retain separate unverified verdicts and report them explicitly.
