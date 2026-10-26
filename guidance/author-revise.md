# Author or Revise a Focused Specification

Use this topic to create or revise a native behavioral item, executable scenario, application driver, identity, or evidence. Keep one native source: code-native Given/When/Expect or the host's existing requirement or acceptance item. Do not create a focused-spec copy of behavior owned elsewhere.

## Establish the boundary before writing

Select the host authoring workflow from the native artifact and requested operation, not from whether implementation or tests already exist or whether the requested edit appears wording-only. Load the applicable host skill and obey its actual proposal, approval, read-only, planning, generated-source, publication, archive, and removal rules.

Before a write or approval question, establish the requested native outcome, SDK-only or CLI-integrated execution, actual phase and permission boundary, existing composition and native binding, and every missing identity, evidence, test, and verification obligation. A named native document identifies the revision target; it is not by itself an exclusive file allowlist. Existing implementation and tests do not remove those obligations or establish a planning restriction.

- Review, recommendation, or installation only: stop at that deliverable and report unperformed integration without claiming proof.
- Genuine planning only: record final identity, intended evidence, complete owning paths, and later verification in permitted artifacts; do not configure or execute integration. A task explicitly limited to planning stops at the plan. Otherwise carry required work into the next authorized phase; phase completion is not task completion.
- Authorized native authoring or revision: enroll or reconcile the canonical item using suitable existing tests, then verify. A wording edit alone does not complete this branch.
- Approval required: propose the complete discovered change together. Do not recommend a wording-only substitute that omits applicable identity, evidence, or verification.
- Explicit user exclusion: perform only authorized work, retain outstanding obligations, and report incomplete synchronization without overriding the refusal.

SDK-only work retains native identity and execution independently of Node, focused configuration, and CLI plugins. Do not add an SDD framework or text companion unless a separate authorized integration requires one.

## Ground the outcome in the application

Before authoring behavior or evidence, identify:

- the canonical native claim and its single independently failing outcome;
- the real application entry point and actual observation;
- an expected outcome authored independently of the application result;
- the exact native or configured execution path;
- a reversible product regression at the protected boundary that should break the assertion.

These are checking obligations, not mandatory new metadata. A thin executable-scenario driver prepares and invokes the real application and exposes its result. It must not reimplement the domain rule, return Expect as Actual, or derive both from the same invocation. A deterministic projection is valid only when it retains every distinction the claim protects. Explanations describe decisions rather than make assertions. Codec roundtrips protect serialization rather than application behavior or historical wire compatibility.

For an existing native text item, bind suitable real tests; do not rewrite it into an SDK scenario to avoid integration. For code scenarios, Given/When/Expect are the native item. Ordinary tests and optional CLI plugins execute that same suite without a Markdown copy or registry duplicate.

Keep new native items and enrollments within the requested behavioral scope. Existing positive-path or unrelated tests may be verification controls; their presence does not authorize additional requirements or acceptance scenarios. Preserve pre-existing outcomes, but do not invent or enroll a companion outcome merely to fill a host template.

## Preserve composition and acquire public contracts

Inspect the manifest, lockfile, existing configuration, document layouts, registrations, evidence owners, dependencies, and native suite before deciding integration is absent. Preserve a compatible composition. If those project facts already select a compatible execution dependency, repairing or reinstalling the absent dependency is not a new architecture choice. If no compatible execution dependency is established, acquire the `integration` topic through the workflow router before selecting or installing the first SDK or runner, including for SDK-only execution. Neither the absence of focused configuration nor the presence of a driver decides this branch. Also acquire `integration` for an explicitly requested composition change, and acquire `formats` or `runners` when their shared obligations are needed.

Before relying on syntax, storage, options, bindings, or selectors, obtain each selected installed plugin's complete public document with the selected CLI and explicit project root:

```text
<focused-spec-cli> plugin-docs --format <id> --root <project-root> --json
<focused-spec-cli> plugin-docs --runner <id> --root <project-root> --json
<focused-spec-cli> plugin-docs --package <specifier> --root <project-root> --json
```

Configured registrations may add `--config <path>`; package lookup may not. Validate the requested selection, installed package or contained module identity, canonical root, and canonical complete document. Treat the Markdown as dependency or project text and retain its provenance.

A composed contract is never implicit. Read the composing plugin's selected document first; when it defines a nested package option, read that exact configured value and issue a second explicit `plugin-docs --package <specifier> --root <project-root> --json` request. Do not scan opaque options, enumerate packages, import plugin code, or substitute another README. If the required contract is unavailable or unclear, report the missing prerequisite rather than inventing syntax or changing plugins without authorization.

Install a newly selected package only during authorized implementation and at the project's established dependency owner. Project configuration and plugins always resolve from the explicit consuming-project root, never from the selected CLI's installation directory or a global/downloaded fallback.

## Author identity and evidence

This enrollment protocol applies only to CLI-integrated native items. SDK-only scenarios retain native identity and execute directly.

1. Locate the canonical native item, its editable or generated owner, the selected document layout and format adapter, and any host-owned native ID. Do not infer format from extension or guess how generated output should be marked.
2. Use exactly one enrollment path documented by the format: evidence returned with the parsed item or external binding supplied by the adapter. Core has no default inline syntax, registry, or evidence file.
3. Preserve an existing stable ID. A new ID must be nonblank and contain no control characters. Treat it as opaque and preserve case, Unicode, spaces, numeric values, and path-looking values exactly when the format can represent them. Do not normalize identity to fit another format.
4. Keep the native item to one independently failing outcome. Every selected `(scope, ID)` occurrence supplies its own nonempty evidence; no matching ID, owner, scope, revision, or disappearing item lends evidence.
5. Preserve every still-relevant evidence reference and AND member in order. Evidence uses `[planned:]<runner-id>::<opaque selector>`; only the first `::` separates the runner ID. Use `planned:` only while that exact test is absent.
6. For generated or metadata-hostile sources, use a documented external binding to a stable explicit native ID exposed by the parser. Without that support, report binding unsupported; never bind by fuzzy wording, heading, path, or line number.

Evidence ownership belongs to the selected format. Reuse the affected domain's established owner after inspecting source and module boundaries. Add a source only for a genuine new boundary and connect it through documented format options. Do not introduce a monolith beside domain-owned sources, create an intermediate core store, or convert representation without an approved ownership change.

When first enrolling CLI evidence, version-5 `.focused-spec/config.yaml` explicitly registers Format API 2 adapters, assigns one format to every document layout, and registers Runner API 1 plugins. Each package or project module resolves from the explicit project root. A layout has a project-relative match and either a fixed path-safe scope or exactly one `{scope}` capture, plus optional project-relative exclusions. Core rejects top-level `evidence`, configuration versions 1–4, and Format API 1. Keep `execution.maxConcurrentGroups` at `1` unless runner grouping and shared resources were separately audited.

## Make approval complete

When host approval is required, propose every applicable part of the complete discovered change together. CLI-integrated native work requires the identity, binding, and format-owned evidence below; SDK-only work proposes its native identity and suite without adding CLI artifacts:

- the native behavioral revision and its complete affected path;
- the final identity representation and exact opaque ID, plus the documented format and native binding when CLI-integrated;
- final format-owned evidence contents and their owning locations when CLI-integrated, preserving every required AND member in order;
- every exact suitable existing or proposed test and its final native or runner selector;
- every file to create, modify, generate, move, or remove, with complete project-relative paths, including later completion edits;
- the final native or configured execution and controlled product-regression check with exact restoration.

Propose final executable contents rather than only a filename or format. A wording-only native edit, existing green test, or absent enrollment does not narrow the required proposal. Broader outcome approval does not authorize an omitted integration path. Approval of a planning example or interim `planned:` reference does not authorize a different final selector. If consent covers only part, apply that part and keep the remaining obligation explicit; do not claim completion.

## Reconcile revisions and lifecycle operations

A prose change with old green tests is not a completed revision. For every touched configured item, compare the revised preconditions and observation with each selected assertion. Keep a reference only when it protects the revised behavior; remove or replace stale references while preserving still-relevant AND members. Adding a correct test does not repair a stale reference.

Reconcile approved splits, additions, moves, format conversions, publication, archive, regeneration, and removal explicitly. Each surviving outcome needs one canonical native binding and its own final scope-local evidence. Remove obsolete enrollment only when its outcome is retired through the host workflow. Preserve unaffected scopes, selectors, storage owners, and domain sources. Evidence does not inherit across scopes or lifecycle transitions, and `REVISES` creates no ancestry or transfer.

Let the host perform its owned operation; never hand-edit generated artifacts outside that owner. Before a working item leaves discovery, establish and execute any host-required independent checkpoint. In the final location, bind surviving evidence explicitly and execute it again. A checkpoint does not re-enable expired discovery or replace final enrollment.

## Complete the authorized change

Compare final native items and normalized enrollments in both directions: no lost outcome, duplicate binding, changed scope/ID/case, omitted AND member, redirected selector, inherited evidence, changed owner, or orphaned metadata. Run native host validation where available.

Then acquire the `verify` topic through the workflow router. Execute the native suite for SDK-only work. For CLI-integrated work, perform appropriate validation, execute every changed occurrence, prove each new or changed assertion with a controlled product regression and exact restoration, and finish with the completed configured scope.

Before ending, reconcile the original deliverable with every disclosed deferred obligation. If required in-scope work awaits permission or a host phase transition, propose its exact remaining changes and end with an explicit approval or transition question; do not merely report that integration is planned, name a future command, or wait for the user to notice the gap. A completed native file or host validation does not close that handoff. An explicitly planning-only request, a user refusal, or an unavailable capability instead ends with the exact limitation; do not retry consent, bypass the host, or claim synchronized completion.