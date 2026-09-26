## Why

An existing SDD project may contain years of native scenarios with no focused-spec metadata. Today selecting any such document fails validation, so the agent either backfills the whole history, excludes a file that may contain new evidence, or runs only a temporary change and loses coverage when that change disappears. The brownfield agent eval reproduced both the validation failure and an orphan `REVISES` after the change was removed from discovery.

## What Changes

- **BREAKING:** Interpret a native `#### Scenario:` without focused-spec identity, evidence, or revision metadata as not enrolled, rather than an invalid focused scenario. Once any focused metadata appears, require the complete shape and exact evidence; malformed or missing fields cannot silently downgrade an enrolled scenario.
- Allow configured documents to mix enrolled and unenrolled native scenarios, including legacy-only documents in an all-scope run. Report the unenrolled count separately from executed scenario results; a selected scope with no enrolled scenarios remains an actionable error, and zero executed tests never counts as proof.
- Update the agent workflow to enroll only new or changed outcomes, preserve untouched native scenarios, and check that enrolled IDs, evidence meaning, and ownership survive any framework-owned document update, publication, replacement, or removal. No OpenSpec-specific lifecycle command becomes part of core semantics.
- Extend the black-box brownfield eval to catch temporary-owner references, false coverage claims, and loss of evidence when an intermediate document is no longer discovered. Update the owning docs and skill.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `scenario-authoring`: Distinguish unenrolled native scenarios from incomplete enrolled focused scenarios.
- `project-configuration`: Permit mixed and legacy-only documents under explicit layouts without requiring per-file exclusions.
- `validation`: Validate only enrolled scenario bodies while reporting unenrolled native scenarios and retaining the empty selected-scope guard.
- `agent-workflow`: Require incremental enrollment and preservation of evidence and ownership across framework-neutral document lifecycle transitions.

## Impact

`src/parser.ts`, `src/validate.ts`, CLI result formatting, parser/CLI behavioral tests, `skills/focused-spec/SKILL.md`, `docs/concepts/README.md`, `docs/guides/configuration.md`, `docs/reference/cli.md`, `docs/development/agent-evals.md`, and the existing `openspec-brownfield` eval fixture and gates. No new runner protocol, framework adapter, configuration exclude list, or required bulk migration.
