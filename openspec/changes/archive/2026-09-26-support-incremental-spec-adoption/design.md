## Context

`parseFocusedSpecDocument` currently records every `#### Scenario:` in a configured Markdown document and `validateDocuments` requires focused fields for every recorded scenario. File-level `exclude` cannot separate a legacy scenario from a newly enrolled neighbor. IDs have one unmarked owner across discovered scopes; every other occurrence must `REVISES` an existing same-ID source. The brownfield eval found a transient owner: after a working delta left discovery, the published scenario still revised that absent delta and could no longer execute.

## Goals / Non-Goals

**Goals:** Support per-scenario adoption within a configured document, reject incomplete enrollment rather than inventing evidence, distinguish enrolled coverage from native history, and preserve runnable identity after changes to the set of discovered documents. The workflow works with any framework that edits, publishes, replaces, or stops selecting documents.

**Non-Goals:** Validate native SDD scenarios or automatically infer their evidence; backfill untouched historical requirements; build an OpenSpec adapter, new CLI lifecycle command, separate registry, or automatic remapping of runner selectors. No global guarantee that an agent can detect lost IDs without comparing a known before/after state.

## Decisions

1. **Explicit per-scenario enrollment.** A `#### Scenario:` block is enrolled if it contains a row whose label is `ID`, `EVIDENCE`, or `REVISES`, including a malformed row with that label. Otherwise it is native and contributes no focused result. `WHEN` and `THEN` alone are not enrollment markers because native frameworks can use them. Parser records enrolled and unenrolled counts without validating native shape; existing focused cardinality, ownership, and evidence rules apply unchanged to an enrolled block. Detect malformed `ID` as well as malformed `EVIDENCE`/`REVISES`, so removing a backtick cannot convert enrolled evidence into an ignored native scenario. Alternative: opt in only with a valid ID; broken ID or evidence-only blocks disappear silently. File exclusions are too coarse.
2. **Coverage-transparent selection.** Discovery still enforces explicit document layouts and overlap/path checks. In an all-scope selection, legacy-only documents/scopes are accepted as unenrolled; if documents are discovered but none contains an enrolled scenario, validation/run fail with a no-enrolled-scenarios error. A specifically requested scope without an enrolled scenario still fails. No matching documents without a selected scope remains the existing empty-selection result, explicitly not proof. Full validate text/JSON and run text/JSON report the unenrolled scenario count in the selected document scope(s), separately from validated/enacted focused scenarios; scenario-filtered runs identify their narrower selection and cannot be used as full-scope coverage claims. Alternative: accept a zero-target `PASS` for all-legacy projects or exclude legacy documents, either conceals the adoption boundary.
3. **Framework-neutral transition invariant in the skill.** Before changing document locations or contents, inventory affected enrolled IDs, their one-outcome intent, runner/selector evidence, and all `REVISES` edges in selected scopes. After the framework operation, compare the resulting selected documents: retain every still-relevant enrolled outcome with the same stable ID and equivalent executable evidence; do not fabricate evidence for untouched native scenarios. If a source document will leave discovery, promote a durable occurrence of each retained ID to unmarked owner, and redirect remaining revisions to an existing same-ID source. Validate the graph while both occurrences exist, then validate and run again using the final document selection (or stage the equivalent selection before finalizing removal). The operative rule concerns selected documents and surviving evidence, not framework commands or canonical scope names. Alternative: accept the first successful delta run; it misses orphaned links after document replacement.
4. **Illustrative OpenSpec case, not a dependency.** If a working delta first owns an ID and a main spec later receives that outcome, the main occurrence becomes the unmarked owner and the still-discovered delta revises main. Once the delta is no longer selected, main remains valid and runnable; a native legacy scenario beside it stays untouched. For another SDD framework, the same before/after invariant applies even if there is no separate sync or archive operation.

## Risks / Trade-offs

- Deleting all focused metadata from an already enrolled block makes it indistinguishable from a never-enrolled native block in a stateless parser. Mitigation: the agent compares pre/post ID inventories; the brownfield eval checks retained IDs after document transitions. A persistent migration ledger is intentionally out of scope.
- Native documents may use a literal `- **ID**` row for another purpose. This syntax becomes a deliberate opt-in marker in configured files; such projects can use a companion Markdown document rather than change native semantics.
- Counts are not percentages or claims that historical requirements were exercised. CLI reports unenrolled count and no PASS rows for them; explicit no-enrolled selection fails instead of claiming coverage.
- Changing ID ownership while two documents are selected requires coordinated edits. The skill verifies both intermediate and final graphs, and never treats a temporary validation error as a successful completion.

## Migration Plan

Update parser, model, validation and CLI result counts together; cover mixed, malformed, legacy-only, and final-selection behavior with behavioral tests. Update the owning docs and skill, then rerun the existing black-box brownfield eval including its document-removal gate. Existing fully enrolled projects keep the same execution semantics; projects with legacy-only discovered scopes can now run other enrolled scopes without per-file exclusions. On rollback, legacy scenarios in configured documents again fail validation; no persistent on-disk state needs migration.

## Open Questions

None.
