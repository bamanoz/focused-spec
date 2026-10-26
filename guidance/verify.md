# Verify Focused Evidence

Use this topic to verify executable scenarios or configured evidence after the native behavior, identity, selectors, and application path are known. Validation, discovery, prose review, installation, and a successful framework exit do not substitute for observing the selected assertion against the real application.

Before a write, execution, or completion claim, establish the requested deliverable and native outcome plus the actual phase and permission boundary set by the user and host. Respect genuine read-only and planning-only phases by reporting the exact identity, evidence, execution, and sensitivity work still required without mutating product code. Recommendation-only and installation-only requests stop at their stated deliverable. Existing implementation, passing tests, a wording-only edit, or absent enrollment does not create a narrower completion boundary. If the user expressly excludes required work, preserve that decision and report incomplete synchronization. SDK-only work follows its independent native execution path and needs no focused configuration, CLI plugins, or text companion.

## Confirm what is being proved

For every affected native item, identify the canonical claim, real application entry point, actual observation, independently authored expectation, exact selected test or scenario, and reversible product regression that should break it. Compare each selected assertion with the item's current preconditions and outcome. Remove or replace stale references through authorized authoring; an additional correct test does not repair an AND member that proves different behavior.

Passing evidence means the selected tests executed and passed. It does not prove arbitrary prose, unenrolled requirements, another same-ID scope, or complete project coverage. An Actual event is not an equality assertion. Codec roundtrips protect serialization rather than application behavior or historical compatibility. Runner errors, missing targets, skips, unrelated failures, and green diagnostics are not behavioral proof.

Before relying on runner selectors or format-owned references, acquire the selected plugin documents exactly as required by the applicable author/review/upgrade topic. Project formats, runners, configuration, and documents resolve from the explicit consuming-project root, independently of where the selected CLI is installed.

## Verify SDK-only scenarios

Execute the native suite or its ordinary test wrapper against the real application. Do not create focused configuration, install CLI plugins, or add a Markdown companion merely to perform this path. The wrapper must execute the same native Given/When/Expect suite and must not become another behavioral source.

For every new or changed scenario, expectation, driver observation, or claimed product behavior, perform the controlled-regression sequence below against the exact native assertion. Report the actual commands and outcomes. The selected CLI is guidance tooling, not an SDK runtime dependency.

## Inspect configured occurrences

For CLI-integrated evidence, use the selected executable with an explicit project root. Consult its current help before choosing optional flags. `list` and `show` inspect enrollment and provenance but do not load runners, resolve targets, execute tests, or certify coverage:

```text
<focused-spec-cli> list --root <project-root> [--config <path>]
<focused-spec-cli> show <id> --root <project-root> [--config <path>] [--scope <scope>]
```

Use `show -- <id>` for a flag-looking opaque ID. Preserve the exact ID and select `--scope` when one occurrence is intended. Without a scope, every matching same-ID occurrence is independently selected.

## Validate and execute

While selected references are genuinely planned because their exact tests do not yet exist:

```text
<focused-spec-cli> validate --root <project-root> --scope <scope> --syntax-only
<focused-spec-cli> validate --root <project-root> --scope <scope>
```

Syntax-only checks format parsing, binding, normalized references, and source structure without loading runners. Non-strict validation records planned evidence but does not make it executable.

After every selected reference is concrete:

```text
<focused-spec-cli> validate --root <project-root> --scope <scope> --strict
<focused-spec-cli> run --root <project-root> --scope <scope>
```

`validate --scenario <id>` and `run --scenario <id>` use the same exact occurrence selection. A scenario-filtered command excludes unrelated semantic failures but does not certify the rest of the scope, so execute the completed scope afterward. Structural source failures remain blocking because the selected adapter could not reliably produce its normalized contract. `run` performs strict validation before tests. `ERROR` prevents success; `SKIP` does too unless the project explicitly permits it with `--allow-skip`.

A strict validation success establishes exact resolution, not execution. A runner must report that each selected target actually ran and passed; process exit zero alone is insufficient.

## Prove sensitivity to a real product failure

For every new or changed evidence reference, selected assertion, application observation, or claimed behavior—including a repaired assertion whose format-owned reference did not change:

1. Run the exact selected native test or focused occurrence and observe `PASS`. Identify every AND member whose sensitivity must be checked.
2. Introduce one controlled regression at the protected application boundary, never in the test, selector, runner, evidence, or assertion. Prefer an isolated disposable copy. If application and test files must remain unchanged, the disposable copy is required.
3. If an authorized in-place probe is necessary, retain the exact prior bytes and complete relevant state, including generated files and bytecode. Equivalent rewritten source is not exact restoration.
4. Confirm the intended product edit actually applied at the real boundary. A zero-match replacement or mutation of the wrong copy is not a probe.
5. Run the same exact evidence. Require each affected selected test to execute and fail on its behavioral assertion. Check every language and AND member separately. Missing targets, setup failures, runner errors, skips, timeouts, and unrelated failures do not count.
6. Restore exact state, compare protected bytes or hashes with the captured baseline, and rerun the same evidence to observe `PASS`. For an isolated probe, verify the original workspace remained unchanged and remove the disposable copy after retaining the results.

The required sequence is `PASS → selected behavioral FAIL under product regression → exact restoration → PASS`. If a safe controlled regression is unavailable, explain precisely what was not checked and why; do not claim mutation verification.

## Verify lifecycle continuity

Publication, movement, regeneration, archive, and removal are owned by the host workflow. Evidence never inherits from a disappearing scope, a matching ID, an owner, a revision edge, or file placement.

Before a working item leaves discovery, execute any host-required independent checkpoint while its native item and evidence are still present. After the host operation, confirm every surviving outcome is explicitly bound and enrolled in its final selected scope, then validate and execute that final occurrence. A prior checkpoint preserves only the historical observation; it does not re-enable expired discovery or replace final enrollment. Retire obsolete working enrollment only through the host's authorized lifecycle operation.

Production validation sees current enrollment and cannot prove that behavior and evidence were not lost together. Lifecycle continuity therefore depends on host review, explicit final enrollment, real execution, and an independent checkpoint where the host requires one—not on a transition command or claimed inheritance.

## Completion report

For each affected reference, report the exact native item and scope/ID when applicable, baseline command and result, controlled application change, expected behavioral failure, restoration check, and restored pass. Finish with the completed configured scope or independent native suite and report its result. State whether the requested deliverable was fully executed within the actual authorization boundary; if a required part was excluded or deferred, retain it as outstanding work rather than narrowing the completion claim.

State unavailable validators, unresolved `planned:` references, missing plugin contracts, unchecked AND members, unsafe sensitivity probes, and unrelated failures as limitations. Do not call work complete when any required observation is missing.