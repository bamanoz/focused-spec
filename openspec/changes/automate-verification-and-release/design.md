# Design

## Context

See [proposal.md](./proposal.md). The workspace currently exposes `npm test`, Python/.NET test scripts, and `release:check = npm test && npm run smoke && npm run release:specs`. `npm test` runs the whole Vitest suite; release specs install unpinned `pytest` and execute repository-wide CLI evidence again. `releasing.md` documents manual npm, Go, PyPI, and GitHub Release operations. No `.github/workflows/` directory exists. The four Python/.NET CLI integration names are present as workspace packages but each exact npm registry lookup returned `E404` on 2026-10-29.

`improve-native-sdk-distribution` owns Python metadata, the .NET `net8.0;net10.0` package shape, and the GitHub Release `.nupkg` asset with SHA-256/local-feed contract. This change consumes those decisions and automates authorized local publication. The repository also has four active changes with all tasks checked; the stale guard reports those paths only and never archives or syncs them.

## Goals / Non-Goals

**Goals:** Give contributors named local verification tiers with honest prerequisite boundaries; make release version drift and partial registry outcomes observable; automate authorized local publication; and identify completed active OpenSpec changes without lifecycle actions.

**Non-Goals:** Use GitHub-hosted or paid Actions runners; publish during proposal/apply verification; create credentials or repository/organization settings; reserve npm package names; change SDK runtime behavior; auto-archive/sync OpenSpec changes; alter OpenSpec/Spec Kit integrations; or turn ordinary verification into release authorization.

## Decisions

1. **Local scripts are canonical; `act` is the workflow-YAML adapter.** Provide Node-only, native-toolchain, and full release checks as direct npm scripts with prerequisite preflight. Define GitHub Actions-compatible jobs only so contributors can run them locally with the open-source `act` runner and Docker. Do not configure or invoke GitHub-hosted runners or consume hosted Actions minutes. Routine checks remain directly invocable without Docker/act. `act` is selected as the closest local runner for Actions YAML; Dagger is not introduced because it requires a separate pipeline DSL and repository integration.
2. **Treat local execution as orchestration verification, not hosted parity.** `act` requires Docker and runner-image downloads. Verify macOS/Apple Silicon compatibility, filesystem/architecture behavior, tool-cache availability, secrets handling, and OIDC limitations before relying on a workflow. Direct project scripts remain the canonical proof for release-critical behavior; local `act` validates workflow orchestration only.
3. **Remove accidental repeated Vitest evidence execution.** Map the existing test, smoke, and release-spec entrypoints and ensure full repository Vitest evidence runs once in one release-check invocation. Keep the separate CLI smoke and all four native/CLI bank executions. Pin the disposable release-gate pytest dependency to a supported version or repository-owned deterministic input.
4. **Make one checker own coordinated versions.** Read structured package/project metadata. Compare root version with every publishable npm workspace manifest, Python project version, and .NET PackageVersion/Version. Scan designated release/test fixtures for stale hardcoded release versions. Treat Go SDK version as the subdirectory tag `packages/sdk/go/vX.Y.Z`, not as `go.mod` metadata; validate module path, version template/stamp, and expected tag. Keep protocol/API compatibility versions out of this comparison.
5. **Use explicitly authorized local release orchestration.** A local release command verifies the exact source revision and versions, builds artifacts once, then invokes authenticated `gh` and registry clients only after explicit release authorization. Upload the verified .NET `.nupkg` as a GitHub Release asset under the distribution-owned checksum/local-feed contract; do not publish to NuGet.org. Credentials enter the publisher process through its environment or an authorized credential manager only; never log, persist, or place credentials in source or workflow files. Report provenance only when the chosen local publishing mechanism actually produces verifiable provenance; do not promise OIDC support through `act`.
6. **Resolve npm package availability before requiring four CLI plugins.** The exact Python/.NET format and runner names returned `E404` on 2026-10-29. Before release automation depends on them, an authorized maintainer confirms name availability and publisher scope, then publishes them together. If ownership/name availability differs, stop for an explicit naming decision; do not omit or rename them silently.
7. **Make stale OpenSpec detection advisory and read-only.** Scan active change directories only, excluding archive. A task list with all tracked tasks checked is a candidate for human review. Report name/path and completion signal; do not infer safe sync/archive, modify files, or block unrelated local verification. The four existing completed changes remain active until an authorized lifecycle operation.
8. **Refactor tests for ownership and stable contracts.** Split oversized CLI, evaluator, and package-distribution Vitest files into behavior-focused modules while preserving test cases and Vitest discovery. Replace incidental setup-copy assertions only with structural observations of confirmation and no-write-before-confirmation. Do not weaken terminal, package, eval, or safety checks.

## Exact evidence

| Native ID | Required evidence |
| --- | --- |
| `release.ci.tiers` | `vitest::test/release-tiers.spec.mjs::executes the Node-only tier without invoking native-toolchain jobs` exercises the real npm orchestration with compiler/test leaves recorded and native calls rejected; real `act` execution separately checks that included suite bodies never invoke native tools. |
| `release.ci.preflight` | `vitest::test/release-automation.spec.mjs::release automation > fails the requested native preflight with actionable missing-tool detail`. |
| `release.version-consistency` | `vitest::test/release-versions.spec.mjs::release-versions > reports npm manifest drift with the exact path and observed value`; `vitest::test/release-versions.spec.mjs::release-versions > compares only the Python project.version value`; `vitest::test/release-versions.spec.mjs::release-versions > checks effective .NET PackageVersion and distribution identity`; `vitest::test/release-versions.spec.mjs::release-versions > finds stale staged public URLs and hardcoded .NET test-consumer versions`. |
| `release.go-module-version` | `vitest::test/release-versions.spec.mjs::release-versions > accepts matching structured distribution metadata and orders workspaces by dependencies`; `vitest::test/release-versions.spec.mjs::release-versions > rejects a noncanonical Go module and a drifted example marker independently`. |
| `release.registry-provenance` | `vitest::test/release-process.spec.mjs::local release process > refuses authorized publication without publisher configuration before any client is called`; `vitest::test/release-process.spec.mjs::local release process > prepares exact artifacts in dry run without any publication or tag mutation`; `vitest::test/release-automation.spec.mjs::release automation > keeps published-version certification separate from explicit publisher approval`. These local tests do not establish hosted Actions behavior or real provenance. |
| `release.partial-publication` | `vitest::test/release-process.spec.mjs::local release process > reports successful npm artifacts and stops dependent registries after a later publication fails`; `vitest::test/release-automation.spec.mjs::release automation > preserves verified immutable results and leaves dependent distributions pending after failure`. |
| `release.native-cli-plugins` | `vitest::test/release-automation.spec.mjs::release automation > keeps published-version certification separate from explicit publisher approval`; `vitest::test/release-process.spec.mjs::local release process > publishes approved first-publication fake distributions once and verifies hashes and the remote Go tag`. These exercise isolated fake clients, not live registry availability. |
| `release.verification-determinism` | `vitest::test/release-tiers.spec.mjs::release-check pins pytest and executes full repository Vitest evidence exactly once`. The trace executes the actual npm/release orchestration with isolated leaf clients; real native/CLI banks are verified separately. |
| `release.openspec-stale-guard` | `vitest::test/release-automation.spec.mjs::release automation > reports checked active changes and leaves every fixture byte unchanged`. |

External checks and remaining blockers:

- Live local `act` execution on macOS/Apple Silicon used act 0.2.94, Docker Desktop 4.40.0 / Engine 28.0.4 and linux/arm64 act-latest. The Node job passed with native-command tripwires; Go, Python and .NET jobs each reached their declared tier and failed visibly at missing-tool preflight. Native container success and hosted parity are not claimed. Serial jobs avoid the observed shared action-cache reset/EOF race.
- The four exact Python/.NET npm package names returned real registry `E404` on 2026-10-29, as recorded in Context. This is an external observation, not a Vitest selector. Recheck exact `<name>@<version>` availability only after name ownership and publisher authorization are resolved, before first coordinated publication.
- Do not publish or access credentials as part of this change. Publication remains blocked pending explicit release authorization and resolved package names/access.
- The real nonpublishing release command stopped at its clean-source prerequisite with no prepared or published distributions. Full real artifact preparation remains unverified until the exact clean tagged source revision is available. Fake-client dry runs cannot replace that observation; tasks 2.3 and 4.3 stay open.

Both tier/determinism selectors now exist and execute the actual npm lifecycle in disposable fixtures; native leaves are recorded, not certified by those fixtures. Retain real workflow and bank observations separately rather than treating a trace as full native execution.

## Risks / Trade-offs

- `act` and Docker are local prerequisites for workflow orchestration. Image downloads may require network access; local containers do not reproduce hosted images, permissions, tool caches, or OIDC behavior exactly.
- npm provenance and PyPI OIDC trusted publishing may not be available through local execution. Release automation must fail closed or report provenance unavailable; it must not silently substitute an unsafe credential path.
- Four CLI plugin names currently return `E404`; confirm registry ownership and publisher access before requiring them in a complete release.
- Multi-registry publication is not atomic. Preserve successful immutable artifacts and report remaining distributions as pending.
- Native toolchain tests may require package feeds and network access; preflight must state these dependencies.
- Splitting large specs risks behavior loss; preserve cases and verify discovered selectors after moves.
- A completed active change can intentionally remain open; the guard is advisory and read-only.

## Open Questions

- Verified local combination: act 0.2.94, Docker Desktop 4.40.0 / Engine 28.0.4 and linux/arm64 act-latest; native-capable images still need their declared toolchains. See the release guide for invocation and differences from hosted execution.
- Are the four Python/.NET npm plugin names available to the project publisher? Exact queries returned `E404`; confirm availability and scope access before requiring them.
- Pytest is pinned to 8.4.2 in disposable release verification; the actual npm trace and real native/CLI bank gate were independently exercised.

