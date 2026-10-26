# Focused Spec Workflow

This router covers executable scenarios, drivers and native SDD items. Keep one behavioral source: code-native Given/When/Expect or the host's requirement/acceptance item, never a focused-spec copy.

## Preserve the governing boundary

Establish the requested outcome, canonical source, actual permissions, existing composition and operation before acting. Select the host workflow by artifact and operation; existing code/tests or wording-only edits do not create a planning restriction. Preserve host approval, read-only, planning, generated-source and lifecycle boundaries.

Planning records intended identity, exact evidence/selectors, full owning paths and later work; it cannot configure or execute integration or edit tests, runners or product code. Approval must cover the complete native revision and auxiliary integration, not a wording-only substitute. Recommendation-only and installation-only requests stop at that deliverable. Respect explicit exclusions, retain deferred obligations and report incomplete synchronization. SDK-only scenarios need no host framework, focused configuration, CLI plugins or text companion.

## Keep executable and project root distinct

Use the loader's selected installed CLI (local, global or explicit path) throughout this step. If it is upgraded, start again with its fresh workflow. Commands reading project configuration, documents or plugins require `--root <project-root>`: dependencies resolve from that consuming root, never the CLI directory or a global/downloaded fallback. `instructions` reads only package assets and has no `--root` option.

Guidance acquisition neither installs, writes, validates nor executes evidence, and grants no permissions.

## Acquire one focused topic

Route before acting:

- `review`: read-only inspection of native items, application paths and enrollment.
- `author-revise`: native items, drivers, identity/evidence, complete approvals and deferred-work handoff.
- `upgrade`: installation/integration updates and configuration migration preserving outcomes/evidence.
- `verify`: application observations, exact execution, sensitivity/restoration and lifecycle verification.
- `integration`: first composition or an explicitly requested composition change, including SDK-only selection.
- `formats`: shared adapter selection, configuration, authoring and implementation obligations.
- `runners`: shared runner selection, configuration, implementation, repair and parallelism obligations.

Inspect manifest, lockfile, native suite and configuration. Preserve compatible established choices: repairing a selected dependency is not first composition. Without an established compatible choice, acquire `integration` before selecting/installing the first SDK or runner, even SDK-only. Missing focused configuration or an existing driver decides neither branch. Incompatible setups route to `upgrade`.

Request each topic from that same CLI as a standalone command:

```text
<focused-spec-cli> instructions --protocol 1 --topic <topic> --json
```

Do not chain it with executable checks, installation, `init`, help, another topic or any command; repeat a combined request by itself. Accept only successful protocol-1 JSON for package `focused-spec`, the selected installed version, the requested topic and nonempty Markdown.

Host truncation leaves acquisition unfinished. Recover complete stdout from that successful call's linked full-output artifact before proceeding. A clipped preview, extracted `content`, hidden metadata, unrelated artifact, stale guidance, repository file, README or different installation is not a substitute. Stop if the complete matching response is unrecoverable. Focused topics retain their operation-specific obligations and explicitly route to shared topics/contracts when needed. Change topic when the operation changes; refresh workflow before a later step.

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
