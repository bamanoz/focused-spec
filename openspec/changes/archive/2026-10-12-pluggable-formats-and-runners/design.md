# Design

## Context

Current parser branches on .feature and embeds Cucumber/Markdown dependencies. RunnerPlugin API 1 already isolates resolve/run/partition but only loads project files. See proposal.md for scope.

## Goals / Non-Goals

Goals: explicit adapter selection, independently installable packages, stable exact evidence, production per-target framework outcomes, npm workspace bootstrap without prior publication.

Non-goals: package publication, global/download fallback, plugin marketplace, automatic adapter inference, unrelated dependency upgrades, security sandbox claims.

## Decisions

Private npm workspace root; packages/core owns src, dist, skills and guidance and publishes focused-spec 0.9.0. Sibling format-markdown, format-gherkin, runner-vitest, runner-pytest, runner-go publish @focused-spec packages at 0.9.0. Core has only yaml/glob/minimatch runtime dependencies. Root has explicit workspace devDependencies and build ordering. Built CLI is packages/core/dist/cli.js, linked through root node_modules/.bin. Root README and LICENSE are staged as package assets by the build, not duplicate authored documents.

FormatPlugin API 1 from focused-spec/format: parse({path,source,options,signal}) returns ParseResult or Promise<ParseResult>. ParseResult is {items: ParsedItem[], diagnostics: FormatDiagnostic[]}; ParsedItem has line,name,nativeIds, optional markerId; diagnostics have optional line/focusedId and message. Core assigns path/scope. Both official adapters preserve existing binding behavior and export their concretely typed default objects, allowing their parser to be used synchronously by trusted evaluation tooling. Core parsing is async and requires an explicit FormatConfig: parseNativeDocument(projectRoot,path,source,scope,formatConfig). It never guesses from an extension.

Version 4 specifications.formats maps project IDs to plugin config; each document has format. Plugin config declares exactly one package or module, optional timeoutMs/options; runners additionally support cwd. Package entries accept installed package/subpath specifiers, not URLs or paths. Resolve using ESM import conditions from the consuming project's installation ancestry; do not use createRequire's require conditions or a loader-relative import. Preserve workspace symlinks and published exports. Project modules remain root-contained. Trusted plugins are not sandboxes.

Use a per-discovery format host per configured adapter, reusing it for documents, with per-request timeouts and bounded IPC/output; terminate on completion/error. AbortSignal remains host-local. Validate JSON responses and IDs centrally. Format diagnostics are structured and retain identity-based selected-error isolation, not new framework-specific core rules. Generic lifecycle and response errors must always block selected parsing.

Runners retain API 1. Official IDs are vitest/pytest/go, never execution-layer names. Vitest uses project-installed collector/reporter; pytest ships a Python report helper and reads exact collection/run results without extra reporting dependency; Go reads real go test -json events. Runner options preserve useful executable prefixes (e.g. uv run --with pytest python) with command/commandArgs. No shell interpolation. Frameworks remain separately installed. Unknown resource compatibility remains exclusive.

## Evidence

Exact new evidence uses vitest::test/plugins.spec.ts::plugin architecture > followed by: selects explicit Markdown and Gherkin formats; rejects missing and conflicting format registrations; binds a project-native format without extension inference; rejects malformed format responses; terminates a blocking format host; resolves an import-only consumer package subpath. Distribution evidence uses vitest::test/package.spec.ts::package distribution > installs independent core and adapter packages. Official runners use vitest::test/official-runners.spec.ts::official framework runners > followed by: reports exact Vitest outcomes; reports exact pytest outcomes; reports exact Go outcomes. Existing parsing/registry/CLI evidence migrates without selector changes, except framework-only runner IDs in examples/evals.

Run exact evidence, introduce controlled product regressions for each distinct protected outcome, observe assertion FAIL, restore PASS. Run npm test and actual examples, Node 22.16.0 CLI, clean workspace npm ci/build, packed core-only and packed multi-adapter consumers. Agent evaluation guidance changes require genuine isolated upgrade/native evaluations where configured credentials permit; disclose any unavailable runtime prerequisites.

## Risks / Trade-offs

Workspace path move touches all CLI/provisioning/package tests -> clean cutover of every caller, no root dist/src alias. Format host IPC adds overhead -> reuse one host per adapter per discovery. Plugin package loading crosses realpath root -> constrain authored file modules, trust installed package code. Real framework reports differ by version -> explicit supported versions and observable error/skip/missing tests. Publishing is separately authorized; validate pack/install without publishing.
