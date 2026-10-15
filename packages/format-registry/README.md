# `@focused-spec/format-registry`

`@focused-spec/format-registry` is the explicit Format API 2 adapter for native documents whose evidence is stored in the focused-spec YAML registry dialect. It composes one structural Format API 2 parser, delegates each document parse to it, then binds the configured registry once against the complete catalog supplied by focused-spec. The core package does not discover or load registry files.

## Installation

```sh
npm install --save-dev focused-spec @focused-spec/format-registry @focused-spec/format-markdown
```

Install the native parser named by `parser` separately. The adapter never downloads a parser or resolves one from its own dependencies.

## Configuration

```yaml
version: 5
specifications:
  formats:
    registry-markdown:
      package: '@focused-spec/format-registry'
      options:
        parser:
          package: '@focused-spec/format-markdown'
        files:
          - .focused-spec/evidence/**/*.yaml
  documents:
    - match: specs/**/*.md
      scope: current
      format: registry-markdown
runners: {}
```

The options object is closed and has this shape:

```ts
interface RegistryFormatOptions {
  parser:
    | { package: string; options?: JsonValue }
    | { module: string; options?: JsonValue }
  files?: readonly string[]
}
```

`parser` is required and declares exactly one installed package or project-relative module. Packages are resolved from the consuming project. Modules must use `.js`, `.mjs`, `.ts`, or `.mts`, remain inside the project both lexically and after symlink resolution, and export a structural Format API 2 plugin. The parser receives its nested `options` unchanged and runs in the registry adapter's already isolated format host; it may not define a second catalog binder.

An unavailable, escaping, malformed, binding-capable, or API-1 parser fails before registry binding. API-1 rejection includes the project-local protocol-1 workflow command needed to migrate the parser; the adapter has no compatibility path.

`files` is an optional nonempty list of project-relative YAML paths or glob patterns. Omitting it selects the adapter-owned canonical default `.focused-spec/evidence.yaml`. Supplying `files` never falls back to that default and never searches the repository implicitly.

## Read this composition sequentially

After registering the adapter, acquire this installed package's authoritative document and provenance through the configured format ID:

```sh
npx focused-spec plugin-docs --format registry-markdown --json
```

Read that response first. Its `options.parser` contract names exactly one nested parser, but core does not inspect the opaque options or aggregate that parser's document. Request the configured package value explicitly in a second command:

```sh
npx focused-spec plugin-docs --package @focused-spec/format-markdown --root . --json
```

Replace the example ID, package, and root with the consumer's actual values. Each call returns only the selected installed package's complete public document and provenance without importing code, downloading packages, or writing files. The returned public plugin documents—not core guidance or implementation source—are the authority for this composition. A module parser likewise needs its own publicly documented contract; `plugin-docs --package` does not guess a module from nested options.

## Registry dialect

Each configured file contributes to one logical registry:

```yaml
scopes:
  current:
    account.access.blocked:
      evidence:
        - vitest::test/access.spec.ts::rejects a blocked account
        - pytest::tests/test_access.py::test_blocked_account
```

An unmarked generated item can be addressed through a parser-provided native ID in one exact catalog document:

```yaml
scopes:
  current:
    RULE-7:
      source:
        path: specs/generated.md
        nativeId: RULE-7
      evidence:
        - pytest::tests/test_rules.py::test_rule_7
```

The root contains only `scopes`. Each entry contains only a nonempty `evidence` list and optional `source`; `source` contains exactly `path` and a nonblank `nativeId`. Unknown fields and duplicate YAML keys fail. Focused IDs are opaque, retain exact case and spelling, and must contain a non-whitespace character and no control character. Multiple evidence references retain order and form an AND contract.

A registry row without `source` resolves the same scope and exact marker ID. A row with `source` resolves its native ID uniquely inside the exact scope and path and may bind only an unmarked item. Binding addresses catalog document/item indices, so separate items may share source coordinates. Missing, ambiguous, multiply bound, or conflicting targets fail. A marked item without a selected registry row also fails unless its parser supplied direct evidence.

Scope/ID selection filters semantic entries, duplicate checks, and binding diagnostics to the requested occurrence. YAML syntax, closed-schema failures needed to read the source, unreadable files, and source-safety failures remain blocking. Diagnostic and evidence locations identify the actual registry file and lines; focused-spec does not open those returned origin paths.

## Source safety and determinism

Every configured pattern must match at least one `.yaml` or `.yml` file. Absolute paths, parent traversal, negated sources, NULs, backslashes, missing sources, unsupported matched extensions, lexical overlaps, canonical/symlink aliases, escapes outside the project, and dangling matched links fail. Nested registry includes are not supported. Files load deterministically. Patterns are bounded to 4096 characters, 32 combined nesting levels, 2 parenthesis levels, 256 brace delimiters, and 256 expanded alternatives; bounded padded and stepped numeric ranges are preserved.

The adapter returns an opaque canonical source claim for every readable registry file. Core can therefore reject the same underlying source claimed by another adapter without learning the registry's storage rules.

## Public exports

The default export is the Format API 2 plugin. The package also exports `RegistryFormatOptions`, `NativeParserOptions`, `EvidenceEntry`, `EvidenceRegistry`, `RegistryViolation`, `RegistrySourceClaim`, `parseEvidenceRegistry`, and `loadEvidenceRegistry` for tooling that needs to inspect the adapter-owned dialect directly.

```ts
parseEvidenceRegistry(source, path?, selectedScope?, selectedScenarioId?)
loadEvidenceRegistry(projectRoot, files?, selectedScope?, selectedScenarioId?)
```

The helper's omitted `path`/`files` value is `.focused-spec/evidence.yaml`, the same adapter-owned default. Helpers report structured entries, loaded files, violations, and canonical source claims; they do not parse native documents or execute evidence.
