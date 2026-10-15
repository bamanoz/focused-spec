# Spec Delta

## Purpose

Expose selected installed plugin documentation with exact provenance so agents can use public contracts without core knowing plugin-specific syntax or executing plugin code.

## ADDED Requirements

### Requirement: Explicit consumer-local documentation lookup
The CLI SHALL provide `plugin-docs` with exactly one `--format <id>`, `--runner <id>`, or `--package <specifier>`, optional `--root`, registration-only `--config`, and `--json`. It SHALL resolve packages using consumer-local ESM import conditions without importing plugin code, downloading packages, enumerating plugins, or changing project files.

<!-- focused-spec:id=plugin-docs.selection.registration -->
#### Scenario: Selected registrations resolve their own installed contract
- **WHEN** a consumer requests documentation for configured format and runner registrations whose installed packages have import and require entries
- **THEN** each request returns the selected package's complete document and exact registration, package name/version, canonical root, and document path without loading either entry or interpreting nested plugin options

<!-- focused-spec:id=plugin-docs.selection.package -->
#### Scenario: An explicit installed package needs no project configuration
- **WHEN** a consumer requests an installed package or public subpath with invalid project configuration
- **THEN** JSON and text expose its complete document with installed identity and origin without reading configuration or substituting a core/global contract

### Requirement: Package-owned and module-owned document selection
Package documentation SHALL default to root README.md or use its manifest's explicit `focusedSpec.documentation` path. Local-module registrations MAY declare a project-relative `documentation` path; absent metadata SHALL block documentation lookup but not ordinary plugin execution. Package registrations SHALL NOT override package-owned documentation in project configuration.

<!-- focused-spec:id=plugin-docs.document.manifest -->
#### Scenario: A package explicitly selects its public document
- **WHEN** the installed package declares a Markdown documentation file distinct from README.md
- **THEN** lookup returns that exact file, including for a symlinked installation and a manifest not exported as a package subpath

<!-- focused-spec:id=plugin-docs.document.module -->
#### Scenario: A local module has explicit project documentation
- **WHEN** a selected local format or runner declares a contained documentation path
- **THEN** lookup returns that file with configured module and project-root provenance without executing module code or guessing documentation for another module

### Requirement: Documentation failures are explicit and contained
Unavailable packages, registrations, documents, empty or invalid UTF-8 content, malformed declarations, and non-file documents SHALL fail nonzero with actionable stderr and no usable stdout. Documentation paths SHALL be relative Markdown files contained within their owning package/project both lexically and after resolving symlinks. No core, README, remote or sibling fallback SHALL replace a failed explicit selection.

<!-- focused-spec:id=plugin-docs.document.unavailable -->
#### Scenario: Missing or malformed documentation cannot be substituted
- **WHEN** a selected package, registration, module document or explicitly declared file is unavailable, empty, malformed, or not a regular UTF-8 file
- **THEN** the CLI rejects the request rather than reporting a successful document from another source

<!-- focused-spec:id=plugin-docs.document.containment -->
#### Scenario: Documentation cannot escape its owner
- **WHEN** metadata names a traversal, absolute, non-Markdown or symlink-escaping document path
- **THEN** lookup rejects it without returning outside content

### Requirement: Documentation command discovery
The CLI SHALL document selectors and lookup boundaries through root, command and help-command forms without requiring project configuration or installed plugins. Unknown, duplicate, missing or conflicting options SHALL fail with a plugin-docs help pointer.

<!-- focused-spec:id=plugin-docs.cli.arguments -->
#### Scenario: Help is independent and invalid requests fail
- **WHEN** a consumer requests help or supplies missing, conflicting or invalid documentation selectors/options
- **THEN** help succeeds without project setup while invalid requests fail nonzero with empty stdout and an actionable command-help pointer

### Requirement: Packed documentation remains usable
A consumer SHALL be able to read installed plugin contracts through the packed CLI without source-checkout access. Composed plugins SHALL describe their own nested contract in their documentation; agents SHALL acquire nested plugin documentation in a subsequent explicit request, not through core options traversal.

<!-- focused-spec:id=plugin-docs.distribution.sequential -->
#### Scenario: Packed consumers acquire composed contracts sequentially
- **WHEN** a clean consumer installs core and selected plugin tarballs and requests a configured composing format followed by its parser package
- **THEN** each call returns only that installed package's own document and provenance without automatic aggregation or creating project/agent files
