# Tasks

## 1. Local verification tiers

- [x] 1.1 Split repository scripts into a Node-only tier and explicit native-toolchain/network tiers; add a preflight command that reports missing tools and required network paths, and verify with disposable environments that Node-only execution never invokes Go, Python, or .NET while requested native tiers fail clearly on missing prerequisites.
- [x] 1.2 Add GitHub Actions-compatible workflow definitions runnable locally through open-source `act` with Docker; do not configure or invoke GitHub-hosted runners. Verify workflow syntax and local execution, and observe each job invokes only its declared tier without turning missing required prerequisites into a pass. Keep direct npm scripts available without Docker/act.
- [x] 1.3 Pin the pytest version used by disposable release verification and remove the duplicate full Vitest-evidence run from `release:check`; verify the pinned environment is used and one release-check trace contains exactly one full repository Vitest invocation plus smoke and all native/CLI bank checks.

## 2. Version and distribution release checks

- [x] 2.1 Implement a structured release-version checker for every publishable npm workspace, Python `project.version`, .NET package version, designated hardcoded release/test version references, and Go module identity/version-template/subdirectory tag plan; verify matching fixtures pass and separate drift fixtures fail with exact path/value diagnostics.
- [x] 2.2 Consume the `improve-native-sdk-distribution` .NET package identity, TFM, GitHub Release asset, SHA-256, and local-feed contract without changing its owned installation documentation; verify version preparation and release instructions agree with package metadata. Do not add NuGet.org publication.
- [ ] 2.3 Add npm registry preflight for the exact Python/.NET format and runner names and their publishing access; verify the current four `E404` results block full-suite completion, then include all four in version verification, dependency order, provenance, and published-version checks only after an authorized availability/name decision and successful first publication.
- [x] 2.4 Add a read-only active-OpenSpec completion guard that reports each active all-checked task list and excludes archived changes; verify with checked, unchecked, and `skip_specs: true` disposable fixtures that reports are correct and all source bytes remain unchanged. Do not sync or archive the four existing completed/stale active changes.

## 3. Authorized local release automation

- [x] 3.1 Add a local release command that verifies the exact source revision and versions, builds artifacts once, and invokes authenticated `gh` and registry clients only after explicit release authorization. Upload the verified .NET `.nupkg` as a GitHub Release asset using the distribution-owned SHA-256/local-feed contract, and tag/verify the Go submodule. Do not publish to NuGet.org. Verify a non-publishing dry run checks artifacts and order without contacting publish endpoints.
- [x] 3.2 Add fail-closed publisher configuration checks and per-registry result reporting for missing credentials and partial immutable publication; verify a deterministic fake-registry run reports successful distributions versus pending ones, never retries successful versions, bumps versions, moves tags, or claims a complete release.
- [x] 3.3 Document local `gh` authorization, registry credentials, and provenance limitations in the release guide; verify documentation distinguishes prerequisites from source-controlled automation and contains no credentials or machine-specific credential locations.

## 4. Test maintainability and integration verification

- [x] 4.1 Split the oversized CLI, evaluator, and package-distribution Vitest files into behavior-focused modules without losing test cases; verify `vitest list --json` discovers the moved suites and the Node-only test tier passes.
- [x] 4.2 Replace incidental CLI setup copy assertions with observable structure checks for confirmation and no writes before confirmation; verify a changed welcome-copy fixture still passes while bypassing confirmation or writing before approval fails.
- [ ] 4.3 Run the scoped release-version/preflight/orchestration checks, OpenSpec strict validation, and the full local workflow/release dry-run path; verify all published registries remain untouched and document unresolved external publisher setup as a blocker rather than a successful release.

## 5. Local workflow runner verification

- [x] 5.1 Verify the selected `act` version and Docker setup on the supported macOS developer environment, including Apple Silicon image/platform constraints and network/image requirements; document known differences from hosted GitHub Actions without claiming remote parity.
- [x] 5.2 Verify every release-critical check remains directly invocable through npm scripts without Docker/act, and that local workflow orchestration adds no GitHub-hosted runner dependency or paid Actions minutes.

## Observed acceptance and unresolved external gates

Full repository verification passed 520 tests across 54 files. Direct Go SDK/bank checks, Python SDK/bank checks (16/6), and .NET SDK/bank checks (13/6) passed. `smoke` and `release:specs` executed real framework evidence plus all four ordinary/CLI bank suites. The release delta scope passed nine occurrences and sixteen exact targets; `vitest list --json` discovered the relocated suites. The public README remains release-neutral.

The local Node Actions job passed on macOS/Apple Silicon with act 0.2.94, Docker Desktop 4.40.0 / Engine 28.0.4, linux/arm64 act-latest, and fail-fast native-command tripwires. Native jobs were each observed invoking only their declared tier and failing at preflight for absent Go, uv, or .NET in the base image; they are not certified as successful native-container runs. Parallel act invocations initially encountered action-cache EOF/reset races; serial reruns reached the expected preflights. Hosted parity is not claimed.

Setup assertions were exercised in a disposable built CLI: baseline passed; three inert welcome-copy changes retained all five passes; a product regression applying installation before review caused the exact declined-confirmation test to fail on changed filesystem bytes; exact restoration returned all five passes. The disposable tree was removed after byte equality checks.

Tasks 2.3 and 4.3 remain unchecked. The real `npm run release:publish` dry run returned `authorized: false`, `complete: false`, no prepared/published distributions, and the clean-working-tree prerequisite before contacting publication endpoints. A complete real artifact-preparation run requires a clean exact tagged source revision. First publication also requires an explicit native-name/access decision and authorized publisher setup; none was supplied. The four registry E404 observations remain historical facts, not successful publication proof. Fake-client preparation, first-publication, immutable-artifact and partial-publication checks passed independently but do not close either external gate. Keep this change active; do not silently weaken the requirements or publish during implementation.

Final post-archive acceptance: `npm test` again passed all 520 tests in 54 files. Full-root strict focused validation resolved 452 enrolled occurrences and 469 exact targets with no planned evidence; the subsequent unfiltered run reported 452 PASS and zero FAIL/SKIP/ERROR. OpenSpec strict validation passed all 24 active/spec items; public documentation navigation passed both checks; coordinated versions and the read-only stale-change guard passed. The real OpenSpec example smoke passed its Go and pytest targets.

The final audit removed obsolete enrollments for three already archived changes, consolidated duplicate current activation bindings in the workflow-owned registry, and migrated eight surviving references to their relocated native lifecycle test suite without changing assertions or dropping AND members. An initial full-root attempt selected the global .NET SDK 9 and failed on net10.0; the successful full-suite and full-root runs explicitly selected the retained isolated SDK 10.0.403 with runtimes 8/9/10, without changing the global installation. A concurrent build/discovery attempt failed before execution; final build/tests and evidence execution were serialized. The retained act executable also successfully dry-ran the documented Node workflow command; that dry run is not an additional native-container execution. These checks do not close the Windows observation or release/publication gates.

The user subsequently authorized package publication and the complete real release dry run on 2026-11-02, superseding the earlier no-publication decision. Credential retrieval into publisher-process memory, release commits, new immutable tags, and publication are now authorized. Tasks 2.3 and 4.3 remain unchecked until their actual first-publication and complete-preparation results are observed. Windows-specific verification remains separately deferred; it is not certified by this release.
