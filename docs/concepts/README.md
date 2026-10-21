# Concepts

## Focused specification

A focused specification protects the smallest product-boundary outcome that can fail independently. There are two independent paths:

- **Executable BDD scenarios:** keep Given/When/Expect in code; a thin driver invokes the real application and the language SDK compares its actual observation with independently authored expectations. JavaScript/TypeScript, Go, Python, and .NET SDKs execute natively without an SDD framework, Markdown companion, registry, or focused-spec CLI.
- **Native requirement binding:** keep an existing requirement or acceptance item in its owning format and bind it to exact executable tests. The framework retains approval and lifecycle ownership when present.

Optional CLI integration discovers and executes code scenarios through the JS/TS or Go plugins, or binds native text through compatible formats and runners. For CLI-integrated items, `focused-spec` adds only:

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

The independent [JS/TS](../../packages/sdk/typescript/README.md), [Go](../../packages/sdk/go/README.md), [Python](../../packages/sdk/python/README.md), and [.NET](../../packages/sdk/dotnet/FocusedSpec.Scenarios/README.md) SDKs prepare the application from Given, perform When, and compare actual observations with Expect, with execution-local cleanup. A test wrapper executes that same suite without becoming another behavioral source. Optional native discovery/direct CLI execution exists for JS/TS and Go; Python and .NET retain native SDK/test execution. Static CLI discovery accepts the selected format's documented grammar rather than every dynamically constructed suite.

## Agent-owned loading

The installed skill applies to BDD/executable-scenario and application-driver work as well as SDD requirements, even without a framework or a request naming focused-spec. The agent loads it and current local guidance without requiring a user invocation; it follows the host workflow when present and preserves read-only/planning boundaries. Its project-local CLI is guidance tooling, not an SDK runtime dependency. SDK-only work does not thereby require CLI plugins, configuration, or enrollment. See [installation and discovery](../guides/install.md#agent-skill); a discoverable loader does not guarantee host compliance.

An authorized revision to a native item selected by existing CLI configuration includes resolving missing identity, binding, or evidence before claiming completion, subject to host approval. A missing enrollment is not an implied prose-only boundary; unrelated native content remains unenrolled. Ordinary direct-test success does not complete configured evidence verification.

Integrating evidence for an existing native text item retains that item and connects its tests; it is not SDK-only scenario authoring. The installed integration guidance owns composition selection, and selected plugin contracts govern their syntax and selectors. A language's lack of native code-scenario discovery does not prevent binding its ordinary tests as evidence through a compatible runner.

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
