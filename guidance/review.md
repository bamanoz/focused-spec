# Review a Focused Specification

Use this topic for a read-only review of an existing native requirement, executable scenario, application driver, or configured enrollment. Keep the native checkable item as the only behavioral source. A review may conclude that the source is correct, but it must not mistake green tests, prose plausibility, or valid metadata for evidence that the claimed application outcome is protected.

## Respect the review boundary

Read the host authoring workflow when one owns the native artifact. Review does not authorize edits, package installation, configuration, generated-file changes, or lifecycle operations. Report concrete defects and the exact changes needed in their owning locations. If the requested work becomes authoring, upgrading, or execution, return to the workflow router and acquire that topic before acting.

SDK-only scenarios use their native Given/When/Expect suite, application driver, and ordinary test wrapper. Do not require focused configuration or CLI plugins merely to review them. CLI-integrated items additionally require review of their configured identity and evidence.

## Establish the real claim

For each in-scope native item, identify:

- the canonical editable or generated source and any host-owned native ID;
- one independently failing outcome, its preconditions, and the observation the wording protects;
- the real application entry point and the thin driver or exact existing test that reaches it;
- an expectation authored independently of the application's actual result;
- the reversible product regression that should make the selected assertion fail;
- for configured items, the selected project root, scope, format, evidence owner, exact opaque focused ID, every evidence reference and AND member, and the relevant runner registrations.

A driver must invoke the real application, expose its result, and compare it with an independently authored expectation. It must not reimplement the domain decision, return Expect as Actual, or derive both sides from the same invocation.

## Acquire selected plugin contracts

Identify the configured format and runner that own the reviewed item's authoring syntax, binding, evidence storage, and opaque selectors. Acquire each selected contract through the workflow topic's shared plugin-document procedure, using the same selected CLI and explicit consuming-project root as this review. Follow every composing document's named package option with the required separate package-contract request. Missing, unsafe, mismatched, or unavailable documentation is a review finding; do not infer a contract from file names, headings, examples, another plugin, or implementation source.

Acquire the shared `formats` or `runners` topic through the same-selected-CLI workflow procedure only when the review needs those plugin-independent obligations. Preserve an existing compatible composition; an incompatible setup belongs to the `upgrade` topic rather than greenfield replacement.

## Review native identity and enrollment

For CLI-integrated items, compare the configured scope, native item, format-owned identity, evidence owner, and selected assertions in both directions.

- Treat `(scope, ID)` as identity. The ID is an exact opaque value: preserve case, Unicode, spaces, numeric values, and path-looking values byte-for-byte. Another scope with the same ID is an independent occurrence and lends no behavior or evidence.
- Every occurrence needs exactly one native binding and its own nonempty evidence. Missing, detached, duplicate, competing, conflicting, or ambiguous enrollment is a defect even when an old test remains green.
- Multiple references are an AND contract. Review every member and the assertion it selects, not only a test name. A correct new reference does not repair a stale member that exercises superseded preconditions.
- Evidence is owned by the selected format. Core has no evidence file, storage default, inheritance, or precedence rule. Preserve source ownership and per-reference provenance; do not recommend a conversion merely for uniformity.
- Generated or metadata-hostile sources require the selected format's documented binding to an explicit stable native ID. Headings, wording, paths, and line numbers are not substitute identity.
- `planned:` is appropriate only when the exact test does not yet exist. It cannot pass strict validation or execution. Existing runnable evidence must not be relabeled planned.
- Unrelated native content may remain unenrolled. Do not widen one outcome with adjacent cases or attach their tests to its ID.

For revisions, splits, additions, moves, format conversions, publication, archive, and removal, verify that every surviving outcome retains one canonical native source and explicit final enrollment. Evidence never inherits from a disappearing scope, matching ID, owner, revision edge, or file placement. `REVISES` creates no transfer. Generated artifacts remain under their host owner.

## Report review findings

Distinguish observed defects from checks not performed. For each defect, name the native item, owning path, exact scope/ID when present, stale or missing reference, assertion mismatch, and the smallest complete repair. Include host approval or phase boundaries that would govern the repair.

Do not report an item synchronized or verified merely because its source parses, its old assertion passes, or its runner exits successfully. If execution and controlled-regression sensitivity were requested, acquire the `verify` topic through the workflow's same-selected-CLI procedure and perform it only when the current phase permits execution. If tests, permissions, plugin contracts, or a safe regression are unavailable, state the precise limitation.