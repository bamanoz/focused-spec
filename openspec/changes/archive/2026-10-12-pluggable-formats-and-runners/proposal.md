# Proposal

## Why

The core embeds Markdown and Gherkin parsers while consumers must copy project runners. Explicit independently installed adapters keep the core format/framework-neutral and provide reliable reusable evidence execution.

## What Changes

- **BREAKING**: configuration version 4 requires a registered format on every document layout; no extension-based selection or built-in parser fallback.
- Split development into npm workspaces: private root, published core and separate Markdown/Gherkin, Vitest/pytest/Go packages.
- Add a public JSON-compatible format interface and isolated bounded parser hosts; preserve native binding semantics.
- Support explicit project-installed package/subpath or project-relative module selection for formats and runners.
- Provide real collection and per-target result parsing for official runners; use framework-only runner IDs (`vitest`, `pytest`, `go`) throughout current examples and evals.
- Migrate CLI/API consumers, fixtures, evidence, documentation and portable guidance; remove obsolete parser and copied runner paths. Do not publish or create a release.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-configuration`: version 4 and explicit format selection.
- `runner-protocol`: project-installed packages and official framework runners.
- `distribution`: independent workspace packages and format interface.
- `scenario-authoring`: normalized plugin parsing without built-in format dispatch.

## Impact

Core sources move to packages/core; public parsing becomes async and explicitly configured. Core production dependencies no longer include Markdown/Cucumber. Formats and runners publish compiled ESM with declarations and independent package manifests. All consuming configurations and selected exact evidence migrate without changing behavioral text. Archived history and historical evaluation results remain unchanged.
