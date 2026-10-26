# Agent workflow delta

## ADDED Requirements

### Requirement: Native agent measurement coverage
Native evaluations SHALL retain scored agent duration and completed-message token usage for authoring, planning/dialogue continuations and executed lifecycle phases. Totals SHALL count each scored execution once, exclude test-user and research work, and distinguish unavailable or incomplete usage from measured zero.

<!-- focused-spec:id=agent.eval.native-measurements -->
#### Scenario: Native phases have one measured contribution each
- **WHEN** authoring continues after user approval and a lifecycle agent subsequently executes
- **THEN** the result reports per-phase and total scored agent measurements without counting the dialogue aggregate, resumed historical messages, test-user replies or research interview a second time

<!-- focused-spec:id=agent.eval.native-partial-usage -->
#### Scenario: Interrupted native execution retains partial measurement
- **WHEN** a native agent execution fails or its completed assistant messages omit valid usage fields
- **THEN** the result retains available duration and token fields with incomplete or unavailable usage explicitly identified, without claiming missing phases executed

### Requirement: Immutable cross-case evaluation reports
A reusable report SHALL summarize explicitly selected public/native result artifacts and invocation records without modifying them. It SHALL retain attempts, case/mode/model identity, independently recorded verdicts, interruptions and missing results. It SHALL expose coverage and grouping provenance rather than infer a certified matrix from successful subsets.

<!-- focused-spec:id=agent.eval.report-verdicts -->
#### Scenario: Mixed results retain independent outcome categories
- **WHEN** a report includes a public failure, native blocked evidence, unsupported native checks and a provider-interrupted attempt
- **THEN** their failed, blocked/unverified and interruption categories remain distinct, native authoring/evidence success does not imply native certification, and absent measurements are excluded from measured aggregates with explicit coverage

<!-- focused-spec:id=agent.eval.report-invocations -->
#### Scenario: Missing and repeated invocation results cannot disappear
- **WHEN** selected invocation records include a provisioning failure without a result and multiple attempts of one case
- **THEN** the report retains the missing-result invocation and every attempt, reports unique-case coverage separately from attempts, and does not present a later pass as erasing the earlier failure
- **AND** Repeated references to the same immutable result SHALL count once and be identified; results with different or unknown model/candidate provenance SHALL remain separately labeled. Malformed or unreadable inputs SHALL produce an actionable error rather than silently disappear.

### Requirement: Guidance-loading report denominators
Cross-case reports SHALL distinguish loader reads, installed workflow acquisition and applicable host-guidance loading. Every rate SHALL expose passed, failed and unobserved/blocked counts and its eligible denominator. Guidance observations SHALL remain separate from task-success gates; provider interruption SHALL NOT be relabeled as a demonstrated loading defect.

<!-- focused-spec:id=agent.eval.report-guidance -->
#### Scenario: Loader success does not conceal acquisition failure
- **WHEN** a selected turn loads the loader but fails workflow acquisition while another turn stops before any acquisition judgment
- **THEN** the report counts the loader and workflow outcomes separately, retains the stopped turn as unobserved or blocked, and displays the observed-rate denominator without treating absent judgments as passing
- **AND** Public per-turn judgments and native combined judgments SHALL remain labeled at their actual granularity rather than inventing per-turn observations.

<!-- focused-spec:id=agent.eval.report-observations -->
#### Scenario: Non-gating acquisition observations do not rewrite success
- **WHEN** a successful SDK dependency repair retains a false non-gating integration-acquisition observation in a historical artifact
- **THEN** the report preserves both the historical task success and observation, without retroactively changing the saved artifact or task verdict

### Requirement: Provenance-grounded native capability claims
Host validation, lifecycle and extension claims SHALL distinguish primary-source documented capability, installed version, fixture applicability, runtime availability and observed execution. Missing capability or inaccessible runtime SHALL remain explicitly unverified; documentation, prompt injection, installation and regeneration SHALL NOT certify an unexecuted validator or command hook.

<!-- focused-spec:id=agent.eval.host-capability-limits -->
#### Scenario: Unsupported native operations remain unverified
- **WHEN** a fixture has no applicable documented validator or its documented operation requires an unavailable runtime
- **THEN** native results identify the specific limitation and available source/version provenance, retain the aspect as unverified and withhold certification without fabricating a substitute check

<!-- focused-spec:id=agent.eval.host-executed-check -->
#### Scenario: A real applicable host check determines its own verdict
- **WHEN** an installed applicable native validator or lifecycle operation is independently executed
- **THEN** the result retains the actual operation and outcome, reports execution failure as failed rather than unsupported, and never substitutes focused evidence execution for native validity

### Requirement: Native publication preserves independently executed evidence
Native OpenSpec evaluation SHALL independently execute selected working evidence before publication/archive and surviving final-scope evidence afterward. It SHALL preserve the selected identity, native outcome and every exact evidence obligation, validate the final host state and require final application-regression sensitivity before lifecycle success.

<!-- focused-spec:id=agent.eval.native-publication-stop -->
#### Scenario: A failed working checkpoint prevents native publication
- **WHEN** native authoring finishes but its independently selected working evidence is missing, invalid or failing
- **THEN** publication/archive is not executed and the lifecycle reports its blocking prerequisite instead of claiming success

<!-- focused-spec:id=agent.eval.native-publication-survival -->
#### Scenario: Archived working discovery does not lend final evidence
- **WHEN** the real OpenSpec publication/archive operation removes working discovery
- **THEN** the surviving configured scope independently retains and executes the frozen identity and all evidence members, passes applicable host validation and detects a reversible regression in the claimed application behavior
- **AND** Lost or redirected final evidence, a renamed identity, failed restoration, missing final binding or protected-file changes SHALL prevent lifecycle success even when working evidence previously passed.
