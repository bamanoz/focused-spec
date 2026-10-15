# Proposal

## Why

Evidence storage is currently hard-coded into core: a format plugin cannot return an executable inline scenario without a YAML registry. Restore our inline `ID`/`EVIDENCE` authoring while making the format boundary responsible for evidence acquisition and native binding, and treat focused IDs as opaque stable strings rather than lowercase dotted names.

## What Changes

- **BREAKING** Replace Format API 1 with Format API 2: document parsing plus catalog-level enrollment return normalized native items, exact evidence and diagnostic provenance. Core owns discovery, document scopes, response validation, global identity/binding invariants, selection and execution, not evidence storage syntax or location.
- Add official `@focused-spec/format-inline` for historical Markdown scenario headings and inline `ID`, repeated `EVIDENCE`, `WHEN` and `THEN` rows. No separate evidence file, generated registry, automatic format inference or `REVISES` support.
- Add official `@focused-spec/format-registry`, a format adapter that composes explicit native parsers with the existing YAML registry dialect. Move YAML evidence loading, source safety, external-native-ID lookup, orphan detection and provenance out of core. Preserve domain shards and every independent AND obligation.
- **BREAKING** Config version 5 removes top-level `evidence`; external evidence settings live in the selected adapter's opaque options. Reject older config and format APIs with actionable migration guidance; no runtime shims or hidden fallback. YAML configuration of the CLI itself remains supported and is not evidence-storage logic.
- Remove the lowercase/dotted core ID restriction. Preserve case and exact value, accept historical `auth-login` and `123`, and reject empty/blank IDs and control characters. Formats own representation/escaping; scopes keep their existing path-safe rules. No automatic ID renaming, normalization, ownership or inheritance.
- Keep runners at API 1 and retain strict/planned validation, opaque selectors, AND results, unique target execution, selected-scenario isolation and the just-delivered timing contract. Mixed inline and external declarations conflict on duplicate `(scope, ID)` or double enrollment of one item rather than merging or choosing precedence.
- Migrate the repository, existing official formats, examples, installed guidance and black-box evaluations in one clean cutover. Proposal work writes planning artifacts only; executable integration belongs to a separately approved apply step.

## Capabilities

### New Capabilities

- `inline-format`: Inline Markdown scenario grammar, enrollment, errors, literal examples, planned evidence and explicit selection of the official inline adapter.

### Modified Capabilities

- `scenario-authoring`: Opaque identity and normalized format-owned evidence/binding rather than a required YAML registry.
- `project-configuration`: Config 5, adapter-owned options, and no required or inferred external evidence file.
- `evidence-registry-sharding`: Preserve YAML composition, safety, scope isolation and provenance behind the explicit registry adapter.
- `validation`: Validate normalized enrollments independently of their physical evidence source.
- `agent-guidance`: Format-aware obsolete-version diagnostics and authoritative migration instructions.
- `agent-workflow`: Preserve the chosen authoring/storage format, exact evidence and opaque identities through revisions, upgrades and host lifecycle operations.
- `cli-help`: Describe normalized evidence and explicit formats without implying every project needs YAML evidence.
- `distribution`: Independently packed inline/registry adapters, public Format API 2, config 5 consumer execution and unchanged runner exports.

## Impact

- Core: `packages/core/src/{format-api,format-client,format-host,model,parser,sources,config,validate,index,cli}.ts`; retire evidence-specific `packages/core/src/registry.ts` and its public exports. Keep planner/executor behavior unchanged except necessary type integration.
- Adapters: update `packages/format-markdown` and `packages/format-gherkin`; create `packages/format-inline` and `packages/format-registry` with public documentation, compiled runtime and type declarations. Workspace manifests, lockfile, builds, staging and packed-consumer checks include both new packages.
- Integration: explicitly migrate `.focused-spec/config.yaml`, all examples and eval fixture/config builders; preserve the contents and ownership of existing evidence shards. Reconcile affected test assertions and all touched native/evidence occurrences; exact evidence and permitted paths are specified in design/tasks.
- Documentation: concepts, configuration, plugin API, CLI, installation, repository workflow, release packaging and agent evaluations; portable procedures remain in package-owned `guidance/`, not copied into repository docs.
- This proposal does not implement, commit, push, bump package versions, install integrations or publish releases. Runner protocols, retry policies, scheduler optimizations and `REVISES` are not changed or reintroduced.
