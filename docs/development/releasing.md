# Releasing npm packages and the Go, Python, and .NET SDKs

This repository prepares seventeen independently published npm packages from one private npm workspace, plus independent Go, Python, and .NET SDK distributions:

- `focused-spec` from `packages/core`;
- the existing official formats/runners and `@focused-spec/scenarios-typescript` suite;
- `@focused-spec/format-scenarios-python`, `@focused-spec/runner-scenarios-python`, `@focused-spec/format-scenarios-dotnet`, and `@focused-spec/runner-scenarios-dotnet` as optional direct native integrations;
- the separate Go module at `packages/sdk/go`;
- the Python distribution at `packages/sdk/python`;
- the NuGet project at `packages/sdk/dotnet/FocusedSpec.Scenarios`.

The Python and .NET SDKs are framework-independent. Their pytest/xUnit bank consumers are repository verification projects, not runtime dependencies of the SDKs. Publishing each native SDK requires its own authorized registry account and exact package verification.

The CLI, all seventeen npm packages, and the Go, Python, and .NET SDKs share one release version, currently `0.11.0`. SDKs remain runtime-independent; an unchanged package still receives the coordinated release version. Configuration, guidance, format, and runner protocol versions remain separate compatibility contracts. Source versions are not proof of registry publication: source-only or partially published GitHub Releases must identify the exact pending distributions. The four Python/.NET integration packages are prepared locally by this change, not certified as remotely published.

Local verification is exposed through `npm run test:node`, `npm run test:go`, `npm run test:python`, and `npm run test:dotnet`. `npm run release:prepare-check` is the publisher-aware pre-publication gate; `npm run release:check` additionally requires the exact native CLI package versions to be published and certifies registry availability after publication. The compatible workflow at `.github/workflows/local-verification.yml` is for local `act` plus Docker only, using the `act-local` runner label. No job targets GitHub-hosted runners. Direct npm scripts do not require Docker or `act`.

## Local verification tiers

Run `npm run release:preflight -- --tier node|go|python|dotnet|full` to list the tier's required executables and network paths. The Node tier builds and runs repository tests while excluding suites that invoke Go, Python, or .NET. Native tiers fail during preflight if their tools are missing; Python and .NET restores may require network access. The complete release gate additionally executes the repository's CLI and native bank scenarios. It pins disposable release-gate pytest to `8.4.2`.

For local Actions orchestration, install Docker and `act` separately. The observed macOS/Apple Silicon combination is `act` 0.2.94, Docker Desktop 4.40.0 / Engine 28.0.4, `ghcr.io/catthehacker/ubuntu:act-latest`, and `--container-architecture linux/arm64`. Run one job at a time to avoid concurrent action-cache resets:

```sh
act workflow_dispatch -W .github/workflows/local-verification.yml -j node -P self-hosted=ghcr.io/catthehacker/ubuntu:act-latest --container-architecture linux/arm64
```

Use `-j go`, `-j python`, or `-j dotnet` for the corresponding tier. The base image does not supply those complete native toolchains: observed native jobs failed visibly at preflight for Go, uv, and .NET respectively, while the Node job passed with native-command tripwires. Install the declared toolchains in a suitable local image before expecting native jobs to pass. Image/action downloads and tool-cache population need network access; `--pull=false --reuse --action-offline-mode` reuses already populated local caches, not a guaranteed offline bootstrap. Filesystem behavior, Apple Silicon emulation, tool caches, secrets, and OIDC differ from hosted runners. Successful local execution does not certify hosted parity. Direct npm verification requires neither Docker nor `act`.

## Version and publisher preflight

`npm run release:versions` compares the coordinated version in every non-private npm workspace, the Python `project.version`, .NET `Version` and target frameworks, designated version-pinned release/test references, and Go's module identity and subdirectory tag plan. `npm run release:registry` checks the exact Python/.NET CLI package names at the source version. An unavailable name, version mismatch, registry error, or lack of confirmed publisher scope blocks full npm release completion; resolve names and access through an authorized maintainer decision before attempting coordinated publication. These checks do not reserve names or prove write access.

Before first publication, explicitly approve the native names with `FOCUSED_SPEC_NATIVE_NAMES_APPROVED=1` and run `npm run release:prepare-check` with authenticated npm access. It executes the same build, tests, smoke, native/CLI bank checks, version check, and advisory OpenSpec guard as `release:check`, but verifies authorized publishing scope or approved unclaimed names instead of demanding already published versions. After publication, `release:check` remains the strict exact-version certification gate; preparation does not certify publication.

`npm run release:openspec` reports active task lists whose checkboxes are all checked. It excludes `openspec/changes/archive` and `skip_specs: true` changes, reads without modifying, and is advisory only. Use the explicit OpenSpec lifecycle workflow to sync or archive; this guard never performs either action.

## Authorized local publication

`npm run release:publish` performs a guarded, read-only preparation by default. It requires the same local source, version, registry-name, GitHub-release, and toolchain checks as an authorized run, then prepares and inspects npm tarballs, the Python wheel/sdist, and the .NET `FocusedSpec.Scenarios.<version>.nupkg` plus its `.nupkg.sha256` manifest. For unpublished native package names, preparation requires the explicit maintainer name/access decision and authenticated npm identity/access preflight; it does not require PyPI publication credentials. It prints a JSON report with prepared and pending distributions and performs no publish, upload, tag, push, or registry mutation. This read-only preparation is not publication certification. Preparation may contact read-only registry and GitHub APIs; use `npm run release:versions -- --json` and `npm run release:openspec -- --json` for source-only checks.

Only an explicit `npm run release:publish -- --authorize-release` opts into publication. That path requires a clean source revision whose root release tag and `origin/main` resolve to `HEAD`, approved native package names and publisher access, usable npm and PyPI credentials supplied to the process, and `gh auth status`. It uploads the verified .NET package and checksum manifest to the existing GitHub Release, publishes missing immutable npm/PyPI artifacts, and pushes the independently tagged Go module only after each prior result is verified. It does not publish to NuGet.org and never reads or stores credentials itself.

Publication is not atomic. A successfully verified immutable package stays published if a later distribution fails; the JSON report identifies `published`, `pending`, and `failed` distributions and stops dependent work. Never retry successful immutable versions under a new version, bump versions, or move tags to mask a partial release. Provenance is reported unavailable unless the selected local publisher verifies it; `act` does not provide GitHub OIDC identity. The .NET package is a GitHub Release/local-feed asset, not a NuGet.org publication. The checksum manifest must match the package bytes before installation.

## Local release automation regression evidence

The dedicated release fixtures are deterministic and use disposable fake clients; they never contact npm, PyPI, GitHub, Docker, `act`, or a native publisher. Run them only after the source checkout is otherwise ready:

```sh
./node_modules/.bin/vitest run test/release-automation.spec.mjs test/release-process.spec.mjs test/release-versions.spec.mjs test/release-tiers.spec.mjs
```

The native IDs map to these exact test names: `release.ci.preflight` → `release automation > fails the requested native preflight with actionable missing-tool detail`; `release.openspec-stale-guard` → `release automation > reports checked active changes and leaves every fixture byte unchanged`; `release.partial-publication` → `local release process > reports successful npm artifacts and stops dependent registries after a later publication fails`; `release.registry-provenance` → `local release process > prepares exact artifacts in dry run without any publication or tag mutation`; `release.version-consistency` → the drift cases in `test/release-versions.spec.mjs`; and `release.go-module-version` → `release-versions > rejects a noncanonical Go module and a drifted example marker independently`.

The fake process tests cover approved first publication, immutable hash checks, the `.nupkg.sha256` asset, remote Go tag verification, repeat-run skipping, and pending-distribution reporting. They are orchestration evidence only. A real release remains blocked until a maintainer supplies the explicit native-name decision, credentials through the approved local mechanism, a clean tagged source revision, and verified local `act`/Docker prerequisites. Do not run `--authorize-release` during ordinary verification.

Observed implementation acceptance: full `npm test` passed 520 tests, direct Go SDK/bank checks passed, Python SDK/bank checks passed 16/6 tests, and .NET SDK/bank checks passed 13/6 tests. `smoke` and `release:specs` exercised real framework evidence and all four ordinary/CLI bank suites. The exact release scope passed nine occurrences and sixteen targets. These are source verification results, not publication certification. The actual nonpublishing `release:publish` command stopped before preparing artifacts because the checkout was not clean; the complete real release-preparation path remains unverified until a clean exact tagged revision is available. Fake-client dry-run and partial-publication checks passed independently. No publishing authorization was supplied and no registry, tag or GitHub asset was mutated.

## Prepare one coordinated version

Use Node.js 22.16.0+ and an npm account authorized for both `focused-spec` and the `@focused-spec` scope. Start on `main` with a clean working tree. Confirm the registry and inspect every currently published version:

```sh
git pull --ff-only origin main
git status --short --branch
npm whoami
npm config get registry
npm view focused-spec version
npm view @focused-spec/format-markdown version
npm view @focused-spec/format-gherkin version
npm view @focused-spec/format-inline version
npm view @focused-spec/format-registry version
npm view @focused-spec/runner-vitest version
npm view @focused-spec/runner-pytest version
npm view @focused-spec/runner-go version
npm view @focused-spec/scenarios-typescript version
npm view @focused-spec/format-scenarios-typescript version
npm view @focused-spec/runner-scenarios-typescript version
npm view @focused-spec/format-scenarios-go version
npm view @focused-spec/runner-scenarios-go version
npm view @focused-spec/format-scenarios-python version
npm view @focused-spec/runner-scenarios-python version
npm view @focused-spec/format-scenarios-dotnet version
npm view @focused-spec/runner-scenarios-dotnet version
```

Choose one `X.Y.Z` for the CLI, all npm packages, Python's `project.version`, .NET's project `Version`, and the Go SDK's `packages/sdk/go/vX.Y.Z` tag. Core-facing changes include the CLI/API under `packages/core/src`, packaged root `skills/` or `guidance/`, the staged root `README.md`/`LICENSE`, and core package metadata. Keep every adapter's `focused-spec` peer range compatible with the coordinated version; framework packages remain peer/consumer dependencies rather than core runtime dependencies. The JS/TS SDK has no focused-spec peer or runtime dependency; only its optional format owns the TypeScript parser dependency. The Go format ships a standard-library helper; the Go SDK is a separate standard-library-only module, not an npm package.

Update all seventeen workspace manifests, the root lockfile, Python and .NET SDK manifests, and version-pinned distribution consumers before tagging. Confirm every exact version is unused in its registry; published versions and tags are immutable. Versioned manifests are preparation only—do not publish them as part of implementation or validation without release authorization. If alignment is approved after a source tag exists, commit and push native SDK metadata separately, keep the existing source tag fixed, and identify both source revisions in the release notes; never rebuild or overwrite already published npm artifacts.

## Build and inspect separate tarballs

Install and build centrally from the private root:

```sh
npm ci
npm run release:prepare-check
openspec validate --all --strict --no-interactive
npx focused-spec validate --strict
npx focused-spec run
npm pack --dry-run --workspace focused-spec
npm pack --dry-run --workspace @focused-spec/format-markdown
npm pack --dry-run --workspace @focused-spec/format-gherkin
npm pack --dry-run --workspace @focused-spec/format-inline
npm pack --dry-run --workspace @focused-spec/format-registry
npm pack --dry-run --workspace @focused-spec/runner-vitest
npm pack --dry-run --workspace @focused-spec/runner-pytest
npm pack --dry-run --workspace @focused-spec/runner-go
npm pack --dry-run --workspace @focused-spec/scenarios-typescript
npm pack --dry-run --workspace @focused-spec/format-scenarios-typescript
npm pack --dry-run --workspace @focused-spec/runner-scenarios-typescript
npm pack --dry-run --workspace @focused-spec/format-scenarios-go
npm pack --dry-run --workspace @focused-spec/runner-scenarios-go
npm pack --dry-run --workspace @focused-spec/format-scenarios-python
npm pack --dry-run --workspace @focused-spec/runner-scenarios-python
npm pack --dry-run --workspace @focused-spec/format-scenarios-dotnet
npm pack --dry-run --workspace @focused-spec/runner-scenarios-dotnet
```

Inspect each dry-run independently. Core must contain `dist/cli.js`, `dist/index.js`, `dist/format-api.js`, `dist/runner-api.js`, declarations, staged `skills/`, all eight guidance assets (`workflow`, `review`, `author-revise`, `upgrade`, `verify`, `integration`, `formats`, and `runners`), root `README.md`, and `LICENSE`; it must not contain tests, `.focused-spec/`, a native parser, or registry loader. Each adapter must contain its own compiled ESM and declarations, package metadata, public README and any runtime helper assets it owns, without repository tests or another package's source. Root `src`/`dist` are obsolete; core output is `packages/core/dist`. Build stages root-owned assets into core so they are authored only once.

Check that the packed core `dist/cli.js` retains executable mode; a shebang alone is insufficient for `npx focused-spec` in the built workspace.

Repeated builds are clean at the package-owned output boundary: each package replaces `dist/`, and staging replaces core's generated skill/guidance mirrors. Removed authored files must not appear in subsequent pack inventories; building does not delete authored inputs or unrelated directories.

Core uses `prepack` to build and stage assets for ordinary packing; checkout installation builds through the workspace root's `prepare`. After an explicit build, `npm pack --ignore-scripts` must use prepared output without replacing it. Do not put a workspace-package build back in `prepare`: npm 10 may run that hook even with scripts disabled, racing concurrent verification against shared outputs.

Every official format and runner tarball includes its public `README.md`. Runner READMEs are generated from package-specific templates in `scripts/stage-assets.mjs` and link to the shared runner guide; format READMEs remain package-owned. Root `README.md` is the default `plugin-docs` contract, so existing package manifests need no documentation metadata. Add `focusedSpec.documentation` only when a package intentionally publishes a different relative Markdown authority. Public selectors, options, and authoring contracts must be usable without inspecting compiled plugin JavaScript. Packed-consumer distribution evidence typechecks Format API 2, retains Runner API 1, and executes inline, registry, Vitest, pytest, and Go paths, including a real product assertion regression.

Build core and SDK first, the scenario format next, then its runner. Each new tarball must include compiled ESM, declarations, public README and LICENSE; the runner additionally owns its worker/transport runtime. Install only the SDK tarball in one clean consumer and prove execution/public types without focused-spec or TypeScript. Install core plus all three extension tarballs together in another consumer and exercise the maintained bank example's ordinary tests/output and local CLI list/show, strict validation and selected/all execution. Check plugin-docs provenance from installed tarballs and actual TypeScript-driver execution on Node.js 22.16.0 without consumer flags.

The Python format/runner tarballs additionally ship their standard-library AST helper and execution worker. The .NET format ships its prebuilt Roslyn parser, pinned runtime dependencies and third-party notices; building requires .NET SDK 9+ and dependency restore, while installed inspection must work offline without restore, MSBuild or application loading. The .NET runner ships its typed bridge source and builds only during trusted execution against the explicitly selected consumer project/framework. Certify each pair in an isolated consumer with its separately installed native wheel/nupkg, public plugin-docs, inert inspection, exact native equality, bounded failures/cancellation and bank regression/restoration. Core-only and native-SDK-only consumers remain independent of these extensions.

For install-level certification, create tarballs separately and install core alone in a clean consumer first: it must expose the CLI and APIs but have no native parser, inline dialect, registry loader, or test-framework fallback. In clean consumers, install the required core, selected format and runner tarballs together, configure package names explicitly, and validate/run both no-registry inline and explicit-registry evidence. Verify `plugin-docs` against a configured format and runner and against an explicit `--package` while configuration is invalid. For a composing format, request its configured registration first, read its public nested-package contract, then request that parser with a separate explicit `--package` call; neither response may aggregate the other document or import plugin code. Do not rely on workspace symlinks or source-checkout access for this check.
### Mandatory executable specification gate

Before any publication or release tag, `npm run release:prepare-check` MUST succeed on the exact release source revision with approved native names and authenticated publisher access. It builds and runs the full repository Vitest suite once, runs the real CLI smoke example, then invokes `npm run release:specs` for all four bank suites both natively and through the CLI. It prepares a disposable Python environment with the local SDK and pinned pytest and removes it in `finally`, rather than relying on a global SDK installation. These execute the existing canonical scenarios, not duplicate specifications. Separately validate and execute the repository's full configured evidence scope before certifying the release. After publication, `npm run release:check` repeats the executable gate and requires the exact native CLI package versions to exist remotely.

A failed command, missing runtime, runner error, skip that prevents CLI success, or interrupted check blocks publication. Strict validation, old results, a partial selection, and `npm test` alone do not satisfy this gate. Install Node.js, Go, Python/uv, and .NET prerequisites; do not omit an unavailable SDK. Any subsequent source change invalidates the result and requires a new complete run. `release:specs` alone assumes packages are already built; use `release:prepare-check` before publication and `release:check` for published-version certification.


## Publish in dependency order

Commit and push the exact versioned source revision before publishing:

```sh
git add package.json package-lock.json packages/core/package.json packages/sdk/*/package.json packages/formats/*/package.json packages/runners/*/package.json
git commit -m "Release focused-spec X.Y.Z"
git push origin main
```

Publish core and the independent SDK first. Confirm both exact versions before their dependents, then publish each existing adapter, the scenario format, and finally its runner as separate immutable registry operations:

```sh
npm publish --workspace focused-spec
npm view focused-spec@X.Y.Z version
npm publish --workspace @focused-spec/scenarios-typescript
npm view @focused-spec/scenarios-typescript@X.Y.Z version

npm publish --workspace @focused-spec/format-markdown
npm publish --workspace @focused-spec/format-gherkin
npm publish --workspace @focused-spec/format-inline
npm publish --workspace @focused-spec/format-registry
npm publish --workspace @focused-spec/runner-vitest
npm publish --workspace @focused-spec/runner-pytest
npm publish --workspace @focused-spec/runner-go
npm publish --workspace @focused-spec/format-scenarios-typescript
npm publish --workspace @focused-spec/runner-scenarios-typescript
npm publish --workspace @focused-spec/format-scenarios-go
npm publish --workspace @focused-spec/runner-scenarios-go
npm publish --workspace @focused-spec/format-scenarios-python
npm publish --workspace @focused-spec/runner-scenarios-python
npm publish --workspace @focused-spec/format-scenarios-dotnet
npm publish --workspace @focused-spec/runner-scenarios-dotnet

npm view @focused-spec/format-markdown@X.Y.Z version
npm view @focused-spec/format-gherkin@X.Y.Z version
npm view @focused-spec/format-inline@X.Y.Z version
npm view @focused-spec/format-registry@X.Y.Z version
npm view @focused-spec/runner-vitest@X.Y.Z version
npm view @focused-spec/runner-pytest@X.Y.Z version
npm view @focused-spec/runner-go@X.Y.Z version
npm view @focused-spec/format-scenarios-typescript@X.Y.Z version
npm view @focused-spec/runner-scenarios-typescript@X.Y.Z version
npm view @focused-spec/format-scenarios-go@X.Y.Z version
npm view @focused-spec/runner-scenarios-go@X.Y.Z version
npm view @focused-spec/format-scenarios-python@X.Y.Z version
npm view @focused-spec/runner-scenarios-python@X.Y.Z version
npm view @focused-spec/format-scenarios-dotnet@X.Y.Z version
npm view @focused-spec/runner-scenarios-dotnet@X.Y.Z version
```

If one publication fails, do not claim a suite release or create the tag. Already published versions cannot be rolled back or overwritten; diagnose the failure, publish only the still-missing packages from the same committed revision, and recheck the complete version set. Never bump or move successful packages merely to hide a partial publication.

After all seventeen registry checks succeed, tag the npm release commit and push that tag explicitly:

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
git ls-remote --tags origin refs/tags/vX.Y.Z
```

Confirm the remote tag resolves to the release commit and every package reports `X.Y.Z`. If tag push fails, retry the same tag; do not bump the suite just to repair it. Existing tags must never be silently moved. Write release notes covering consumer-visible changes and migration, then create and verify the GitHub Release separately:

```sh
gh release create vX.Y.Z --verify-tag --title "focused-spec vX.Y.Z" --notes-file release-notes.txt
gh release view vX.Y.Z --json url,tagName,isDraft,isPrerelease,publishedAt,body
```

`release-notes.txt` above is a reviewed local input, not a file to commit or a required downloadable release asset. For a stable release, verify the returned URL opens the published release, `tagName` is `vX.Y.Z`, `isDraft` and `isPrerelease` are false, `publishedAt` is set, and `body` contains the reviewed notes. If the release already exists, inspect and correct it rather than creating a duplicate; if GitHub creation fails, report the npm versions and tag as published but the suite release as incomplete.

## Release completion checklist

- [ ] The release commit is on `origin/main`; the working tree used to build and pack was clean and all required checks passed.
- [ ] `npm run release:prepare-check` passed before tagging/publication and `npm run release:check` passed afterward on the release revision; full-root focused validation/execution and all four ordinary/CLI bank suites passed without skipped required checks.
- [ ] All seventeen npm `X.Y.Z` versions are visible in the registry; a clean consumer can install the published packages.
- [ ] Remote tag `vX.Y.Z` resolves to that exact release commit; it was not moved to repair a partial publish.
- [ ] GitHub Release `vX.Y.Z` exists for that tag, has reviewed notes, is published (not draft), and is not marked prerelease for a stable version.
- [ ] Go, Python, and .NET SDKs use the same `X.Y.Z` and each passes its native publication and clean-registry-consumer gate. Missing credentials leave that distribution explicitly pending, not released.
- [ ] Report the npm version, Git commit, remote tag and **GitHub Release URL** together; never call a tag page or npm publication alone a completed release.

## Separate Go SDK module

`packages/sdk/go/go.mod` declares `github.com/bamanoz/focused-spec/packages/sdk/go`. It is not included in npm workspace builds or publication. Run `go test ./...` inside that module, exercise both its README example and the Go bank, and verify a copied SDK module works outside this checkout before release. The checkout bank uses an explicit local replacement; that proves local distribution, not a published module version.

An authorized Go release requires a distinct `packages/sdk/go/vX.Y.Z` tag pointing to the verified source commit. A root `vX.Y.Z` npm tag does not publish this subdirectory module. Verify the remote module tag and install that exact version from a fresh Go consumer with no `replace` directive before claiming Go publication. Module tags and versions are immutable. No Go module tag, npm publish, or registry download is part of ordinary implementation checks.

For the Python SDK, build a wheel and sdist from `packages/sdk/python`, install each artifact in a clean Python consumer, run the standalone example and pytest contract suite, then verify the exact PyPI project/version before claiming publication. Do not make the Python bank example depend on a registry release during repository checks; use the explicit local editable SDK path.

For the .NET SDK, run `dotnet pack packages/sdk/dotnet/FocusedSpec.Scenarios/FocusedSpec.Scenarios.csproj` from the verified source commit, install the exact `.nupkg` into a clean consumer using a local NuGet source, and run the standalone example and xUnit contract suite. Before claiming delivery, verify the versioned package and SHA-256 assets on the coordinated GitHub Release. xUnit is a consumer/test dependency, not an SDK runtime dependency. NuGet.org publication is not required or performed.

### GitHub Release delivery

The verified `.nupkg` and SHA-256 manifest are distributed as public assets on the coordinated GitHub Release. Consumers verify the checksum and restore from a project-local NuGet feed. Upload the already verified artifacts without rebuilding or replacing existing assets:

```sh
gh release upload vX.Y.Z path/to/FocusedSpec.Scenarios.X.Y.Z.nupkg path/to/FocusedSpec.Scenarios.X.Y.Z.nupkg.sha256
```

Download the asset through its public release URL without authentication, compare its SHA-256 with the verified build, and install it in a clean consumer with a fresh `NUGET_PACKAGES` cache. Execute the SDK example and repeat restore using the documented project-local feed. Keep the [installation instructions](../guides/install.md#net-sdk-from-github-releases), SDK README link, version, checksum, release notes, and CLI-owned [integration guidance](../../guidance/integration.md#install-the-net-sdk-from-a-github-release) consistent. A guidance change requires a new core package release to reach installed consumers; never overwrite an existing npm version. Preserve existing source and module tags; publishing a download does not authorize moving them.
