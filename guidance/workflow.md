# Focused Spec Workflow

This compact package-owned router applies to standalone executable scenarios, application drivers, and native SDD requirements. Keep one native behavioral source: code-native Given/When/Expect or the host's existing requirement or acceptance item. Do not create a second focused-spec copy.

## Preserve the governing boundary

Before writing, establish the requested deliverable and native outcome, canonical source, actual host phase and permissions, existing composition, and operation: review, author/revise, upgrade, or verify. Select the host workflow by artifact and operation. Existing code, tests, or wording-only edits do not create a planning restriction. Preserve host approval, read-only, planning, generated-source, publication, archive, and removal boundaries.

A genuine planning phase records intended identity, evidence, selectors, full owning paths, and later work but cannot configure or execute integration or edit tests, runners, or product code. Required approval covers the complete native revision and auxiliary integration together, not a narrowed wording-only substitute. Recommendation-only and installation-only work stops at its stated deliverable. Respect explicit user exclusions, retain outstanding obligations, and report incomplete synchronization. SDK-only scenarios need no SDD framework, focused configuration, CLI plugins, or text companion.

## Keep the selected executable and project root distinct

The loader selected one installed `focused-spec` executable. It may be project-local, global, or at an explicit path. Use that same executable throughout this workflow step so every topic and command has one package identity. If that installation is upgraded during the step, start again with its fresh workflow.

The executable's installation directory does not own the consuming project. For commands that read configuration, documents, or plugins, pass the explicit consuming-project root with `--root <project-root>`. Formats, runners, package registrations, and project modules resolve from that project root, never from the CLI location or a global/downloaded fallback. `instructions` reads package-owned assets only and has no `--root` option.

Guidance loading does not install dependencies, write files, validate a project, execute evidence, or grant permission forbidden by the host phase.

## Acquire one focused topic

Route the task before acting:

- `review`: inspect an existing native item, application path, and configured enrollment without writing.
- `author-revise`: create or revise a native item, application driver, identity, or evidence under its host workflow.
- `upgrade`: update the selected focused-spec installation/integration and migrate supported project configuration while preserving outcomes and evidence.
- `verify`: validate, execute selected evidence, prove controlled-regression sensitivity, restore exact state, and execute the completed scope.
- `integration`: choose a first composition or an explicitly requested composition change, including SDK-only selection.
- `formats`: apply shared format obligations when selecting, configuring, authoring with, implementing, or repairing an adapter.
- `runners`: apply shared runner obligations when selecting, configuring, implementing, repairing, or parallelizing a runner.

Preserve compatible established composition. Inspect manifest, lockfile, suite, and configuration: repairing an already selected compatible dependency is not first composition. Without an established compatible choice, selecting or installing the first execution SDK or runner requires `integration`, including SDK-only work. Missing focused configuration or an existing driver alone decides neither branch. Incompatible existing setups route to `upgrade`, not greenfield selection.

Request the chosen topic from the same executable as a standalone command:

```text
<focused-spec-cli> instructions --protocol 1 --topic <topic> --json
```

Do not chain the request with executable checks, installation, `init`, help, another topic, or another command. If a combined call ran, request the topic again by itself. Accept only a successful response for protocol 1, package `focused-spec` at the selected executable's installed version, the exact requested topic, and nonempty Markdown content.

Host truncation leaves this workflow or any later topic unacquired. Before continuing, recover the complete stdout from that successful call's linked full-output artifact. A clipped preview, extracted `content`, hidden metadata, another call's artifact, stale guidance, repository file, README, or different installation cannot substitute. If the complete matching response is unrecoverable, stop and report the delivery limitation.

The selected focused topic is complete for that operation and may route to a shared topic or selected plugin contract when needed. Return here and acquire a different topic when the operation changes; do not carry procedure from an earlier workflow step as authority.

## Universal evidence boundary

Keep every selected `(scope, ID)` occurrence independent, every evidence reference exact, and every AND member intact. Core owns no evidence store or inheritance rule; the selected format owns identity representation, binding, storage, and provenance. Plugin syntax and selectors come from separately acquired installed public contracts, including an explicit follow-up package request for every composed plugin named by its composing document.

During authorized implementation, compare the real application observation with an independently authored expectation. New or changed evidence must demonstrate `PASS → selected behavioral FAIL under a controlled product regression → exact restoration → PASS`. Test edits, selector errors, missing targets, skips, runner failures, and unrelated failures are not sensitivity. Finish with the completed native suite or configured scope and report actual commands, results, and limitations.
