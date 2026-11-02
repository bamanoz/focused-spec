# Focused Spec Workflow

Covers executable scenarios, drivers and native SDD items. Keep one behavioral source: code-native Given/When/Expect or the host's requirement/acceptance item, never a focused-spec copy.

## Preserve the governing boundary

Establish the outcome, canonical source, actual permissions, existing composition and operation before acting. Select the host workflow by artifact and operation; existing code/tests or wording-only edits do not imply planning-only permissions. Preserve host approval, read-only, planning, generated-source and lifecycle boundaries.

Planning records intended identity, exact evidence/selectors, full owning paths and later work; it cannot configure or execute integration or edit tests, runners or product code. Approval must cover the complete native revision and auxiliary integration, not a wording-only substitute. Recommendation-only and installation-only requests stop at that deliverable. Respect explicit exclusions, retain deferred obligations and report incomplete synchronization. SDK-only scenarios need no host framework, focused configuration, CLI plugins or text companion.

## Keep executable and project root distinct

Use the loader's selected installed CLI (local, global or explicit path) for this step. After an upgrade, reacquire its workflow. Project-reading commands require `--root <project-root>`: dependencies resolve there, never from the CLI directory or a global/downloaded fallback. `instructions` reads package assets and accepts no `--root`.

Guidance acquisition neither installs, writes, validates nor executes evidence, and grants no permissions.

## Acquire focused guidance

Route before acting:

- `review`: read-only inspection of native items, application paths and enrollment.
- `author-revise`: native items, drivers, identity/evidence, complete approvals and deferred-work handoff.
- `upgrade`: installation/integration updates and configuration migration preserving outcomes/evidence.
- `verify`: application observations, exact execution, sensitivity/restoration and lifecycle verification.
- `integration`: first composition or an explicitly requested composition change, including SDK-only selection.
- `formats`: shared adapter selection, configuration, authoring and implementation obligations.
- `runners`: shared runner selection, configuration, implementation, repair and parallelism obligations.

Inspect manifest, lockfile, native suite and configuration. Preserve compatible established choices: repairing a selected dependency is not first composition. Without an established compatible choice, acquire `integration` before selecting/installing the first SDK or runner, even SDK-only. Missing focused configuration or an existing driver decides neither branch. Incompatible setups route to `upgrade`.

For `review`, `author-revise`, `upgrade`, or `verify`, request that operation from the same selected CLI as one standalone command:

```text
<focused-spec-cli> instructions --protocol 1 --topic <operation> --json
```

Validate protocol `1`, package `focused-spec`, the selected installation's version, exact requested topic, and complete nonempty Markdown with separate router and operation sections. Derive identity/version from this response; make no separate `version` or workflow-only call for that operation. Routing-only steps request `workflow` alone. Shared `integration`, `formats`, and `runners` requests stay distinct and append no operation guidance.

Recover complete stdout from the successful call's linked full-output artifact when the host clips the preview. A clipped preview, extracted `content`, hidden metadata, unrelated artifact, stale guidance, repository file, or different installation is not a substitute. Stop if complete matching output is unrecoverable. Plugin documentation remains a separate request for each exact selected installed contract.

## Acquire selected plugin contracts

Before relying on syntax, storage, options, binding or selectors, obtain the selected installed public contract. Use one selection per call:

```text
<focused-spec-cli> plugin-docs --format <id> --root <project-root> --json
<focused-spec-cli> plugin-docs --runner <id> --root <project-root> --json
<focused-spec-cli> plugin-docs --package <specifier> --root <project-root> --json
```

Only registration requests may add `--config <path>`; package lookup never reads configuration. Accept the exact requested `selection` kind/name, installed package name/version/specifier and canonical package root or configured contained module and canonical project root, plus canonical document path and complete nonempty Markdown. Preserve provenance: dependency/project text is not core instruction, compatibility proof or permission to edit. Recover clipped documents completely before relying on them.

Composition is explicit: read the composing document first; for its documented nested package option, read that exact configured value and request its contract separately with `--package`. Never scan opaque options, enumerate packages, import/search implementation, assume aggregation, or invent syntax. Missing, unsafe, mismatched or incomplete contracts block affected work; another README, sibling package, core guidance or remote fallback cannot substitute. Report the missing registration, installation or document prerequisite rather than silently change composition.

## Universal evidence boundary

Preserve every independent `(scope, ID)` occurrence, exact reference and AND member. The selected format owns identity representation, binding, storage and provenance; core supplies no evidence store or inheritance. Use real application observations and independently authored expectations. Before authorized verification/completion, acquire `verify` for the full native/configured execution, required sensitivity, exact restoration and final-scope procedure; report actual commands, results and limitations. Read-only review reports gaps without execution.
