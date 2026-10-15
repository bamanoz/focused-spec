# Focused Spec Workflow

This is the authoritative portable focused-spec workflow served by the installed `focused-spec` package for guidance protocol 1. Use the host's **native checkable item** as the only source of behavioral text. Do not create a second focused scenario beside an existing requirement, acceptance item, or executable scenario. Load this workflow alongside the host workflow, follow the host's authoring and lifecycle rules, and validate its format with real tooling where available.

## Keep commands bound to the serving installation

The loader resolved an explicit consuming-project or declared-workspace installation and obtained this workflow from it. Throughout this workflow step, use that same explicit local CLI for every focused-spec command. In commands below, `<project-local-focused-spec>` means that resolved executable or an explicit Node invocation of the same installed package; it never means a bare global command, a downloaded package, `npx`, or `latest`.

Before a later focused-spec workflow step, resolve the local installation again and request fresh protocol-1 workflow guidance. If the installation is upgraded during a step, reload the workflow before continuing. Guidance retrieval is instruction loading, not validation or executable evidence, and it does not authorize writes that the host workflow forbids.

Acquire each protocol response in a standalone tool command. Never chain a workflow, formats, or runners instruction request with installation, `init`, help, another topic, or another command. Combined stdout containing multiple JSON values is not an accepted response; run the guidance request alone again before acting.

## Read the selected plugin's public contract

Core defines enrollment, selection, and execution semantics; plugins define authoring syntax, evidence storage, and test selectors. This workflow is not a catalog of supported plugins. Acquire one selected installed plugin document at a time with the same project-local CLI; core neither interprets plugin options nor aggregates nested documentation.

For an existing registration, invoke `<project-local-focused-spec> plugin-docs --format <id> --json` or `plugin-docs --runner <id> --json`, with optional `--root <path>` and registration-only `--config <path>`. For a package being evaluated before registration, or a composed package identified through the selected plugin's documented options contract, invoke `plugin-docs --package <specifier> --root <path> --json`; package lookup never reads configuration. Each acquisition is a standalone tool command. If the document defines a nested package option, read that specific configured value according to its contract and make the next explicit package request. Do not guess nested references by scanning arbitrary options, enumerate packages, import plugin code, download dependencies, or write files as part of documentation acquisition.

Accept JSON only when it has exactly this contract and its provenance matches the requested selection and consumer project:

```ts
{
  selection: { kind: 'format' | 'runner' | 'package', name: '<requested value>' },
  plugin:
    | { package: '<specifier>', name: '<manifest name>', version: '<manifest version>', root: '<canonical absolute package root>' }
    | { module: '<configured path>', root: '<canonical absolute project root>' },
  document: { path: '<canonical absolute document path>', content: '<complete Markdown>' }
}
```

A package document defaults to root `README.md`; an explicit manifest `focusedSpec.documentation` declaration selects a relative Markdown file instead. A project-module registration may declare `documentation` only beside `module`, naming a safe project-relative Markdown file. Missing module documentation blocks lookup but not runtime use. Invalid explicit metadata, unsafe or escaping paths, non-files, empty content, and invalid UTF-8 fail without another README or core fallback. Treat returned Markdown as dependency or project text and keep its provenance visible; successful lookup establishes origin, not compatibility or authority to edit.

Text mode identifies the selection, package/version or module, and document path before the complete content. Any lookup error exits 1 with diagnostics on stderr and empty stdout. `plugin-docs --help` and `help plugin-docs` require no configuration or installed plugin. Exactly one selector is required; `--config` is invalid with `--package`.

Reuse a compatible existing registration. When selecting a new plugin is authorized, install it only within that authorization and obtain its installed document before configuring it. If the required contract is unavailable or unclear, identify the missing information rather than invent syntax or substitute another plugin. Load the on-demand `formats` topic for shared format obligations and `runners` for shared runner obligations; these core topics remain offline and configuration-independent but contain no plugin catalog or plugin-specific procedure.

For format work, invoke `<project-local-focused-spec> instructions --protocol 1 --topic formats --json` as its own tool command. Accept only a successful complete protocol-1 response identifying package `focused-spec` at the resolved installation's version, topic `formats`, and nonempty Markdown. An unavailable requested topic is not permission to fall back to another topic, installation, source checkout, or stale instructions.

## Update an existing project

An explicit request to update focused-spec includes its local CLI, installed focused-spec loader/wrappers, and necessary project-format migration—not only a package-version bump. This is agent work, not automatic installation-time conversion. Respect host approval boundaries; a planning-only request still does not authorize implementation.

1. Inspect the project package-manager manifest/lockfile, installed focused-spec version, existing focused integrations, configuration, configured format and runner registrations, documents, and evidence sources. Preserve user work and unrelated dependencies/integrations. Update only focused-spec and the selected compatible plugins at their established dependency/workspace locations using the existing package manager; for an npm development dependency, `npm install --save-dev focused-spec@latest`. An explicitly requested update authorizes those selected package downloads; ordinary guidance acquisition does not.
2. Resolve the replacement local CLI and read its `init --help`. Refresh existing focused integration with explicit relevant `--tools` targets, using `--dry-run --json` first. Replace an identified package-owned legacy loader/wrapper with `--replace` only within authorized scope; preserve custom instructions and unrelated targets. Symlinked skills are not safe replacement destinations: use their owning installer or an approved safe cutover, not forced traversal. Remove identified obsolete package-owned full-text copies once replaced; never delete custom neighbors. Verify the installed loader/wrappers match the replacement package, and reread the new loader even in the same session.
3. Obtain and validate a fresh complete protocol-1 `workflow` response from that exact installation with `<project-local-focused-spec> instructions --protocol 1 --topic workflow --json`, in a separate tool call after integration refresh has completed. Do not join it to `init --json` with `&&`, a semicolon or a pipeline. Discard earlier/legacy procedure as authority. A missing or incompatible response blocks migration; neither package source inspection nor a repository checkout is a fallback. Use the new workflow and help to finish the task without asking the user for migration steps available here.
4. Inventory every still-relevant occurrence before editing: configured scope, exact opaque ID, canonical native item and behavioral text, every evidence reference and AND member, document layouts/exclusions, selected formats and their options, evidence ownership, runner IDs/modules/packages/options/timeouts/cwd, and execution settings. Same-ID occurrences in different scopes remain independently enrolled. Inventory `REVISES` only to preserve still-relevant behavior/evidence before removing it; it creates no transfer or inheritance.
5. Install each selected Format API 2 adapter before configuring it, and acquire its document with the explicit registration or package request above. Follow any composed-plugin requirement through a subsequent explicit package lookup after reading the composing plugin's document. Core has no native parser, evidence loader, format inference, storage default, or nested-options discovery. Give every document layout one explicit format while preserving its match, assigned/captured scope, and exclusions. Preserve the existing supported authoring representation and evidence owner; upgrading does not itself authorize a storage conversion.
6. Inspect existing runner registrations and acquire their public selector/options contracts before writing custom plugin code. Obtain the same CLI's `runners` topic when selecting or changing a runner. Replace a registration only when the replacement preserves existing opaque selectors and execution requirements. If an authorized replacement requires a runner-ID change, change only affected reference prefixes and preserve selector suffixes and AND members. Preserve project-owned runner files unless their removal is authorized.
7. Move configuration to version 5 and every project format to API 2 in one clean cutover. Remove top-level `evidence`; migrate its existing source list unchanged into the selected storage adapter's documented options, without introducing an implicit core default. Supported historical inline `ID`/`EVIDENCE` may remain inline through explicit adapter selection; do not force it into YAML. Remove every `REVISES` and obsolete relationship field after inventory without renaming identity, dropping evidence, or inventing ancestry. If an old focused companion duplicates a native item, remove only the redundant companion through its host workflow; if it is the sole native source, keep its behavior. Bind generated/metadata-hostile sources only through a documented stable native identity, never guessed text or coordinates.
8. Compare the final occurrences and registrations with the inventory: no lost outcome, changed ID/scope/case, unexplained runner-ID change, redirected opaque selector, omitted AND member, inherited evidence, changed storage/shard ownership, or orphaned metadata. Run native host validation where available, then strict focused validation and actual execution for every completed migrated scope (or the full project when all evidence is concrete). Resolve `planned:` only when its exact test exists. Prove new or changed evidence sensitivity as described below, restore every controlled product regression, and report updated packages/integration, commands, observed results, and limitations.

## Respect the current phase

During an explicitly planning-only task or the host's proposal phase, author only permitted planning artifacts and native identity binding. Record intended exact runner IDs/selectors and final format-owned evidence contents in design/tasks. Defer executable evidence integration, configuration, runners, tests, and product changes until implementation is authorized, regardless of whether evidence is embedded in a native document or stored separately. Integration containing `planned:` is still integration setup, not a planning artifact. Fenced examples in planning artifacts are not executable enrollment. Existing permitted native-format checks may run without creating integration setup.

A request to complete a native specification for already-implemented behavior is not itself a request to stop at a proposal. Finish the host's planning phase, then obtain any host-required authorization for final identity/evidence integration against existing tests. Do not change product code to bind existing evidence or report the specification complete merely because its native format validates. If integration belongs to a later phase, ask to enter that phase rather than silently omit it.

## Reconcile evidence when reviewing or revising a specification

A specification revision is not complete merely because prose changed or old registered tests remain green. For each touched enrolled native item:

1. Before editing, inspect its `(scope, ID)`, canonical item/binding, selected format, owning evidence location, every exact evidence reference, and each selected assertion—not only its name. Compare the requested outcome with what each assertion actually proves. Preserve unrelated enrollments and all still-relevant AND obligations.
2. In read-only review, report stale or missing evidence and exact required changes without writing. In planning-only work, record native, test, evidence, and configuration changes with exact paths/selectors in the permitted plan; do not write executable integration or claim synchronization. Obtain host-required approval for the complete revision before implementation.
3. During authorized implementation, revise the native item and reconcile evidence in its existing format-owned location. Keep references unchanged only when assertions genuinely protect the revised behavior; otherwise repair an authorized test or replace stale references with exact tests for the same outcome. Include every required AND member. Do not preserve unrelated tests merely for counts, silently drop outcomes, rename IDs to evade reconciliation, switch storage without cause, or mark existing runnable evidence planned.
4. Reconcile approved splits, additions, moves, format conversions, and removals explicitly. Each surviving outcome needs one unique native binding and its own scope-local evidence. Remove obsolete enrollment only when the outcome is retired through the host workflow. Update external bindings only to real explicit native IDs. Preserve unaffected scopes, selectors, storage owners, and domain-owned sources; do not reorganize as a side effect.
5. Compare final native items and normalized enrollments in both directions, including assertion coverage. Run native validation where available, strict focused validation and exact evidence for every changed item, then execute the completed scope. Prove changed-outcome sensitivity using the controlled product regression below even when the selector stayed unchanged. Structural validity and a green old assertion do not establish semantic correspondence.

If tests are absent, permissions are missing, or sensitivity cannot be checked safely, state exact deferred work and verification limits. Use `planned:` only when the exact test is genuinely absent and integration is authorized; planned evidence cannot pass strict validation or execution. Do not declare the revision synchronized while required integration remains deferred.

## Native identity and evidence authoring protocol

1. Read the host workflow. Locate the one native checkable item, canonical editable/generated source, selected document layout/format adapter, and any host-owned native ID. If the layout or installed adapter is missing, do not guess from the extension; configure/install only during authorized implementation.
2. Use exactly one enrollment path documented by the selected format. It may supply evidence with the parsed native item or bind it from a separate source; neither path is a core default. Follow the plugin's public authoring contract rather than copying another format's markers, metadata, storage schema, or options. For generated or metadata-hostile sources, use a documented external binding to a stable native ID exposed by the parser. Without such support, report binding unsupported; never guess from headings, lines, or wording.
3. Treat the ID as an exact opaque stable value. It must contain non-whitespace and no control characters; preserve case, Unicode, spaces, numeric, historical, and path-looking values byte-for-byte when the selected format can represent them. Never normalize or rename an ID to fit another format.
4. Ensure the source item still expresses one independently failing outcome. Every occurrence supplies its own nonempty evidence; no same-ID scope, owner, revision, or disappearing document lends evidence. Missing, detached, duplicate, competing, conflicting, or ambiguous enrollment fails.

Do not widen the requested outcome with adjacent cases or attach their tests to the same ID. Add separate native items only through the host workflow when those outcomes are in scope. Leave unrelated native content unenrolled; focused-spec neither validates nor counts it as coverage.

## Approval-aware authoring

When the host workflow requires approval before writing, propose the complete change:

- the native behavioral revision;
- the chosen format, identity representation, and exact opaque ID;
- the final format-owned evidence contents, their owning locations, and exact selected tests;
- every file to create, modify, generate, move, or remove, using complete project-relative paths, including later task/completion edits.

Keep those paths and contents in the approval request and applied change. A basename or path relative to a document folder does not authorize another destination. If consent names only part or is ambiguous, clarify before writing; broader outcome approval does not imply unlisted integration.

Keep behavior only in its canonical native item. Do not propose wording alone while omitting identity/evidence. If the user approves only part, apply only that part and separately request the remainder. Do not declare completion before identity, format-owned evidence, native validation, selected execution, and required sensitivity are complete. Report unavailable host validators and unchecked sensitivity as limitations, not passes.

Propose final executable contents, not merely a format or filename. Approval of a planning example does not authorize later inline/registry integration, and approval of an interim `planned:` reference does not authorize replacing it with a different final reference. Obtain the required authorization for each executable revision.

## Evidence ownership

Every selected format supplies normalized evidence. Core has no evidence file, storage default, inheritance, or precedence rule. Preserve the existing owner and every exact reference in order, whether evidence is embedded in a native document or kept separately. Do not generate an intermediate store or convert representations without an approved ownership change.

Inspect configured sources and domain/module boundaries before editing. Reuse the affected domain's existing owner. Add a separate source only for a genuine new boundary and connect it through the selected adapter's documented configuration. Do not add redundant sources, introduce a monolith beside existing domain-owned sources, or reorganize unrelated registrations. Source discovery, safety constraints, binding syntax, and options belong to that plugin's public contract, not this workflow.

Evidence uses `[planned:]<runner-id>::<opaque selector>`; only the first `::` separates the runner ID. Multiple references form an AND contract. Every selected `(scope, ID)` uniquely enrolls one native item; competing enrollments fail rather than merge. File placement is not identity or ancestry. Each reference retains its supplied source location for diagnostics.

Selection isolates unrelated semantic entries; failures needed to read or structurally interpret selected sources remain blocking. Use `planned:` only while the exact test is absent. Non-strict validation permits it; strict validation and `run` reject it.

## Configure focused-spec

Create `.focused-spec/config.yaml` when first enrolling evidence. Version 5 requires explicit Format API 2 selection. Register formats under `specifications.formats` and document layouts under `specifications.documents`; each layout's `format` names one registered format. Reuse the selected plugin's public configuration example, preserving the project's document paths, scopes, evidence ownership, and runner selectors rather than copying its sample project.

Every layout has a project-relative `match` and either an explicit path-safe `scope` without `{scope}`, or exactly one `{scope}` token in `match` without `scope`. Optional `exclude` patterns are project-relative. Register runners under `runners` with the IDs used in evidence references. Formats/runners declare exactly one installed `package` or project-contained `module`, optional `timeoutMs`, and plugin-owned JSON-compatible `options`. Runners remain API 1 and may also declare a project-relative `cwd`. No package resolves from a global installation, download, or CLI location. Core rejects top-level `evidence`, config versions 1–4, and Format API 1; storage configuration belongs to the selected adapter.

Keep `execution.maxConcurrentGroups` at its default `1` unless runner grouping and shared resources have been audited through the on-demand runner workflow.

## Preserve surviving evidence through host operations

The host owns publication, movement, regeneration, archive, and removal. Use its authoring and approval workflow; never hand-edit generated artifacts outside their owner.

1. Keep every surviving outcome uniquely bound and explicitly enrolled in its final selected scope and chosen format. Evidence never inherits from a disappearing scope; matching IDs do not transfer behavior or evidence.
2. Let the host perform the approved operation. Update surviving format-owned evidence in its existing owner. Retire obsolete working enrollment through the host workflow when its item leaves discovery. A format conversion must preserve exact ID, references, AND members, and selected assertion semantics.
3. Validate the final selection and execute its exact surviving evidence. Host structural validation is separate; passing registered outcomes do not certify unenrolled native history.

No transition command, snapshot, or replacement checkpoint is required. Production validation sees current enrollment and cannot detect historical loss when both item and evidence disappear consistently. Preserve lifecycle continuity through host review, explicit final enrollment, actual execution, and independent checkpoints where required—not a claimed historical guarantee.

## Discover CLI commands and options

Begin discovery with `<project-local-focused-spec> version --json` to confirm the invoked installation, executable and supported contract versions without loading project state. Consult `<project-local-focused-spec> --help` and the command-specific help for `plugin-docs`, `list`, `show`, `validate`, and `run` before choosing flags. Keep using that exact local CLI. Help is guidance, not evidence; execute the selected tests before completion.

Use `list --root <path> [--config <path>]` to inspect enrolled occurrences and their evidence provenance, and `show <id> --root <path> [--config <path>]` for an exact opaque ID; add `--scope <name>` when one scope is intended and use `show -- <id>` for a flag-looking ID. These commands may parse and bind through the selected format plugins, but they do not load runners, resolve targets, execute tests, or certify native coverage. Keep acquiring each selected plugin's public contract through the separate `plugin-docs` flow above.

## Select or implement a runner only when evidence needs one

Inspect existing configuration, installed runner packages, and project modules before authoring plugin code. Reuse a compatible runner and its public selector contract when it fits; an installed but unregistered runner may need only an approved configuration entry. Do not create a parallel custom runner merely because package registration is new.

When selecting, configuring, creating, repairing, or parallelizing a runner requires its shared obligations, obtain the on-demand runner workflow from the same installed package by invoking `<project-local-focused-spec> instructions --protocol 1 --topic runners --json` as a standalone tool command. Wait for successful completion and accept it only when the response identifies protocol 1, package `focused-spec` at the resolved installation's version, topic `runners`, and nonempty Markdown content. Then acquire the selected registration's contract with a separate `plugin-docs --runner <id> --json` request as described above. Do not use a skill-local reference, repository documentation, a global binary, downloaded package, stale instructions, or another plugin's document as a fallback.

## Prove new or changed evidence detects failure

For every new or changed evidence reference, selected assertion, or claimed product behavior—including a repaired assertion whose format-owned reference stays unchanged:

1. Run that exact focused evidence and observe `PASS`.
2. Introduce one controlled regression in the product behavior protected by the native item's outcome—not in the test, selector, runner, or assertion. Prefer a disposable workspace when execution can change generated artifacts or caches. An in-place probe must preserve and restore the complete prior state, including existing generated files and bytecode; restoring source text alone is insufficient.
3. Run the same evidence. The selected test must execute and fail on its behavioral assertion. Missing targets, runner errors, skips, and unrelated failures do not prove sensitivity.
4. Restore the product behavior even if the probe failed, rerun the evidence, and observe `PASS`.

If a safe controlled regression is unavailable, explain what was not checked and why. Do not claim mutation verification.

## Verify

Run the same explicitly resolved project-local CLI against the intended project root. The root supplies version-5 configuration, installed formats/runners, native documents, and any adapter-owned external sources; core supplies none of those integrations.

While selected evidence remains planned:

```text
<project-local-focused-spec> validate --scope <name> --syntax-only
<project-local-focused-spec> validate --scope <name>
```

Syntax-only validates format parsing/binding and normalized references without loading runners. After every selected reference is concrete:

```text
<project-local-focused-spec> validate --scope <name> --strict
<project-local-focused-spec> run --scope <name>
```

`validate --scenario <id>` and `run --scenario <id>` use the same exact occurrence selection. Use `--scope <name>` when one scope is intended; without it, every matching same-ID occurrence is independently selected. Scenario-filtered validation preserves syntax-only, non-strict, and strict behavior and reports the actual narrowed validation scope without executing tests. `run` performs strict validation first. A selected scenario excludes unrelated semantic failures but does not certify the rest of a scope, so run the full completed scope afterward. `ERROR` always prevents success; `SKIP` does too unless the project explicitly permits it through `--allow-skip`. Structural format/source failures remain errors; per-reference diagnostics use the supplied evidence location, including a malformed later AND member.
