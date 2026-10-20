# Concepts

## Focused specification

A focused specification protects the smallest product-boundary outcome that can fail independently. The owning framework's native checkable item remains the only behavioral text. `focused-spec` adds only:

- one opaque stable ID bound to that item;
- one or more exact evidence references supplied by the selected format;
- execution results from runner plugins loaded from the consuming project.

The ID is not a second requirement, and evidence metadata must not repeat or reinterpret the behavior.

## Native items, enrollment, and evidence

Version 5 discovers documents through explicit layouts and parses each with an explicitly registered Format API 2 adapter. Core records each native item's normalized structural name and location; it does not infer a format from an extension, infer requirements from prose, require a source framework, or load an evidence registry.

Normalized scenarios retain their canonical native `path` and `line`. Evidence coordinates are separate: optional `evidenceLocation` supplies the enrollment origin, and parallel `evidenceLocations` supplies each reference's origin. Diagnostics use the reference origin, then enrollment origin, then native item; metadata storage cannot redirect the behavioral source.

A format enrolls an item by supplying its ID and evidence directly during parsing or by binding against the complete discovered catalog. Core validates the resulting item identity, scope, evidence references, enrollment uniqueness, and diagnostics independent of the adapter's storage. Official authoring paths include:

- `@focused-spec/format-inline` owns a Markdown scenario dialect whose `ID` and repeated `EVIDENCE` rows enroll the scenario directly, with no registry file;
- `@focused-spec/format-registry` composes an explicit native parser such as `@focused-spec/format-markdown` or `@focused-spec/format-gherkin`, then binds YAML registry entries against the complete catalog.
- `@focused-spec/format-scenarios-typescript` statically reads literal JS/TS suites and derives exact execution references; code scenarios are the native specification, with no Markdown companion or registry.

For editable Markdown, the native parser binds an ID with `<!-- focused-spec:id=<id> -->` adjacent to one heading, paragraph, or list item. For Gherkin, it binds `@focused.<id>` on one `Scenario` or `Scenario Outline`. These are representation syntaxes, not core ID policy. Generated or metadata-hostile documents can instead use the registry adapter's `source.path` and explicit host-owned `source.nativeId`; headings, lines, and behavior wording are never guessed as identity.

An enrollment is invalid when it is missing evidence, claims a nonexistent item, binds more than one item, conflicts with a marked identity, duplicates a selected `(scope, ID)`, or competes with another adapter for the same item. Unmarked native content remains outside focused execution: it is neither an error nor an arbitrary count reported as verified.

The independent [`@focused-spec/scenarios-typescript` SDK](../../packages/sdk/typescript/README.md) prepares an application from Given, performs When and compares actual observations with Expect, including awaited cleanup. It needs neither focused-spec nor a test framework. The optional [JS/TS format](../../packages/formats/scenarios-typescript/README.md) and [scenario runner](../guides/runners.md#direct-jsts-scenarios) integrate those same scenarios through the existing plugin APIs. Static integration accepts only the documented literal grammar; standalone SDK callers may construct suites programmatically. Other languages require their own SDK/parser/runtime implementations.

## Identity and evidence semantics

Identity is the pair `(scope, ID)`. IDs are exact opaque strings with at least one non-whitespace character and no control characters. Core preserves case, Unicode, spaces, numeric and path-looking values without normalization or interpretation; a format may support only values its native syntax can represent. IDs are unique within a scope. The same value may appear in another scope, but every occurrence independently binds its own item and evidence.

Evidence has the form `[planned:]<runner-id>::<opaque selector>`. Only the first `::` separates the runner ID; the remainder belongs to the runner. Every reference must resolve to exactly one target and produce exactly one result. Multiple references form an AND contract.

Any scope may use `planned:` while an exact target does not yet exist. Non-strict validation records but does not resolve planned references. Strict validation and execution reject them. `SKIP` and `ERROR` are not success by default.

Evidence never inherits across scopes or lifecycle operations. `REVISES`, owner/revision ancestry, and precedence between competing enrollments are unsupported.

## Selection

Without `--scope`, validation and execution select all discovered scopes. With `--scope <name>`, both select only that scope. `run --scenario <id>` further isolates matching occurrences, their bindings, evidence, and selection-aware diagnostics; unrelated semantic entry failures do not block that run. Structural source failures remain errors because the adapter could not reliably produce its normalized contract.

An all-scope project with no discovered documents, enrollments, or structural source failures is valid and empty. Selecting a missing scope or scenario is an error. A selected marked item without its own evidence cannot borrow evidence from the same ID elsewhere.

## Plugin boundaries

Format API version 2 supports per-document parsing and optional whole-catalog binding. Core owns discovery, path, scope, response validation, global identity/enrollment invariants, selection, resolution, and execution. Adapters own native syntax, evidence acquisition, and storage-specific provenance. Opaque source claims allow core to detect overlapping adapter ownership without interpreting filesystem or registry conventions.

Runner API version 1 is unchanged. Core does not know Vitest, pytest, Go, or another test framework. A project registers a package or project-contained runner module in `.focused-spec/config.yaml`; the CLI asks each plugin to resolve opaque selectors and execute only selected targets. The official `vitest`, `pytest`, and `go` runners are separate packages, while framework installations remain consumer-owned.

Plugins are trusted project code executed in bounded isolated hosts, not security sandboxes. A runner must never return `pass` without executing the selected test; malformed format output, forged catalog targets, overlapping source claims, crashes, and timeouts fail without fallback.

The focused behavioral contract is recorded in the [capability specs](../../openspec/specs/scenario-authoring/spec.md); the [documentation map](../README.md) links every capability.
