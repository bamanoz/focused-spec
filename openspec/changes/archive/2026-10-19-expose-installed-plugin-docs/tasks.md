# Tasks

## 1. Explicit documentation delivery

- [x] 1.1 Implement plugin-docs selector parsing, help, consumer-local package documentation resolution, provenance and fail-closed path/content checks; verify real CLI JSON/text and focused boundary tests without importing plugin code.
- [x] 1.2 Add optional module documentation metadata to config 5 and exported plugin configuration, document package manifest and module contracts, and verify contained local-module lookup plus invalid configuration behavior.

## 2. Plugin-independent guidance

- [x] 2.1 Remove concrete plugin catalogs/framework examples from shared formats/runners guidance and route workflow/loader through explicit sequential documentation calls; verify offline topic delivery, generic content, staged equality and documentation links.
- [x] 2.2 Update owning CLI/configuration/install/index/API documentation and composing-plugin public discovery instructions; verify pack inventory and a source-independent packed consumer's sequential registry/parser requests.

## 3. Behavioral proof

- [x] 3.1 Register every changed scenario's exact scope-local evidence and pass strict validation/execution for expose-installed-plugin-docs; demonstrate isolated product regression PASS → assertion FAIL → restored PASS for new lookup and containment boundaries.
- [x] 3.2 Run npm test, the real polyglot smoke and installed plugin-docs paths; report actual results including any default eval timeout, validate the final OpenSpec change, and leave versions/integrations/spec publication unchanged.

## Observed verification

- `npm run build` and `npm run typecheck:tests`: passed.
- Narrow CLI, offline guidance and packed-consumer selection: 12 tests passed; 89 outside the selection skipped.
- Explicit installed CLI JSON/text requests for the configured format, nested parser package and runner returned their canonical installed provenance and complete documents.
- `node node_modules/focused-spec/dist/cli.js validate --scope expose-installed-plugin-docs --strict --json`: valid, 13 scenarios, zero planned evidence, 12 unique targets.
- `node node_modules/focused-spec/dist/cli.js run --scope expose-installed-plugin-docs --json`: 13 PASS, execution started, 12 unique targets.
- Disposable copied workspaces: complete-document corruption, blank-document acceptance, disabled canonical containment and broken command help each produced the expected behavioral assertion FAIL; restoring each product change returned PASS. Working source and tests were not mutated; disposable workspaces were removed in `finally`.
- `npm test`: 15 suites and 269 tests passed with the default timeout (88.41 seconds Vitest duration). The earlier eval timeout did not recur in this run.
- `npm run smoke`: Go and pytest evidence passed, two unique targets.
- Authored/staged workflow, formats, runners and loader assets match; all eight package dry-run inventories retain version 0.9.1 and include their required documents and new compiled resolver modules.
- Documentation check: 17 files, 78 local links, no broken targets/anchors; changed human-facing pages are reachable from `docs/README.md`.
- Core source and shared guidance contain no concrete plugin package names or framework procedures. No integration reinstall, version bump, release, spec sync or archive was performed.
