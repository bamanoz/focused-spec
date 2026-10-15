# Design

## Context

See proposal.md. Core already resolves package/subpath registrations from an explicit consumer root with Node's parent-aware ESM import resolver in a child process. Package READMEs are already shipped; format-registry's nested parser is opaque plugin-owned options. Core guidance currently duplicates adapter-specific material.

## Goals / Non-Goals

**Goals:** expose the exact selected installed document and its provenance without importing plugin code, retain offline configuration-independent shared topics, and make sequential discovery explicit.

**Non-Goals:** package enumeration, downloads, options traversal, dependency graphs, documentation aggregation, runtime API changes, automatic migration, version bumps, sync/archive/release.

## Decisions

- CLI: `plugin-docs (--format <id> | --runner <id> | --package <specifier>) [--root <path>] [--config <path>] [--json]`. Exactly one selector; --config is only valid with a registration selector. Help takes precedence like existing commands. Registration lookup uses loadConfig; explicit package lookup never reads project configuration. No --all, module guessing or implicit nested resolution.
- JSON: `{ selection: { kind: 'format' | 'runner' | 'package', name: <requested value> }, plugin: { package: <specifier>, name: <manifest name>, version: <manifest version>, root: <absolute canonical package root> } | { module: <configured path>, root: <absolute canonical project root> }, document: { path: <absolute canonical document path>, content: <complete Markdown> } }`. Text identifies selection, package/version or module and document path before full content. Failures exit 1 with stderr and no partial stdout. This is not a loader-protocol response or validation/evidence result.
- Packages use the existing ESM import-condition resolver from consumer root in a code-free resolver child; require-resolution is not equivalent. Find owning installed manifest from resolved entry, including export-blocked package.json, scoped names, public subpaths and symlinked workspace packages. Package manifest must identify a nonempty name/version. Default document is README.md; optional manifest `focusedSpec.documentation` selects a Markdown path. A malformed explicit declaration fails, not fallback. No special package names or option schemas.
- Local module registrations optionally declare `documentation: <project-relative Markdown file>` beside module. Only module registrations accept it; package documentation remains package-owned. Additive optional metadata in config 5, exported PluginConfig, no API version change. Absence blocks documentation lookup, not runtime validation/execution. Module lookup does not import the module; its path follows the existing containment contract.
- Documentation paths must be nonempty relative .md/.markdown paths, no absolute/drive/backslash/traversal/NUL paths, regular readable nonempty UTF-8 files, contained within the canonical package/project root after symlinks. Read bytes without executing or interpreting Markdown. No fallback or output truncation; links stay as authored and document path provides their base.
- Remove all named adapter catalogs, dialects, selectors and concrete framework procedures from core-owned guidance. Keep generic Format API/Runner API rules. Workflow/loader teach standalone plugin-docs requests and provenance checks. A composed plugin explains its nested configuration in its own document; agent makes the next explicit --package request. Unknown options stay opaque.
- Human-facing official package docs remain authoritative and are not copied into core. Installed runtime sources remain untouched by documentation acquisition.
- This change supersedes the official-reference clause introduced by the still-unsynced add-formats-guidance-topic delta. Its modified offline-guidance requirement preserves all prior scenarios while removing that clause. Leave older completed change artifacts intact; publish the changes in dependency order only when sync/archive is separately authorized.

## Evidence plan

New capability scenarios use exact tests under `plugin documentation CLI` in `test/plugin-docs.spec.ts`: consumer import-condition lookup; explicit package lookup without configuration; selected manifest document; contained local module; unavailable or invalid docs fail; unsafe paths fail; invalid requests/help. One packed-consumer test extends existing package distribution coverage with plugin-docs and complete sequential registry/parser requests. Shared guidance remains covered by existing offline/packed delivery tests; manual content/mirror check verifies no concrete plugin catalogs rather than wording-pinning tests.

Build, narrow tests and real CLI JSON/text/help smoke first; validate/run the new scope, run npm test and polyglot smoke, then isolated PASS → assertion FAIL → restored PASS on key new evidence by mutating product lookup/containment, never tests. Verify documentation links, exact staged guidance and packed contracts. Report default eval timeout separately if it recurs; do not alter unrelated eval tests.

## Risks / Trade-offs

- Full configuration validation can block registration lookup in a broken project; direct --package is the explicit independent path, not a silent fallback.
- Sequential nested requests cost another call, deliberately avoiding a composition protocol and plugin execution.
- A README is trusted project/dependency text, not elevated core instructions. Provenance must remain visible; no claim of runtime compatibility from successful reading.
