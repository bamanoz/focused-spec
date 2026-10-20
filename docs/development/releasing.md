# Releasing npm packages and the Go, Python, and .NET SDKs

This repository prepares thirteen independently published npm packages from one private npm workspace, plus independent Go, Python, and .NET SDK distributions:

- `focused-spec` from `packages/core`;
- the existing official formats/runners and `@focused-spec/scenarios-typescript` suite;
- the separate Go module at `packages/sdk/go`;
- the Python distribution at `packages/sdk/python`;
- the NuGet project at `packages/sdk/dotnet/FocusedSpec.Scenarios`.

The Python and .NET SDKs are framework-independent. Their pytest/xUnit bank consumers are repository verification projects, not runtime dependencies of the SDKs. Publishing each native SDK requires its own authorized registry account and exact package verification.

The coordinated npm manifests use version `0.10.0`; that source version is not evidence that any package has been published. A source-only GitHub Release may precede explicitly deferred package publication, but its notes must state that registry publication is pending. It is not a completed npm suite release. Publishing requires an authorized npm account and every registry verification below.

There is no automated release workflow. An npm suite release is complete only when all thirteen exact npm versions are available from the registry, the remote `v<version>` tag identifies the built source commit, and a published (not draft) GitHub Release exists for that tag. npm publication and Git tags do not create a GitHub Release. Go, Python, and .NET SDKs have their own native publication gates.

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
```

Choose one `X.Y.Z` for the coordinated npm suite. Core-facing changes include the CLI/API under `packages/core/src`, packaged root `skills/` or `guidance/`, the staged root `README.md`/`LICENSE`, and core package metadata. Keep all thirteen npm packages at the coordinated version and every adapter's `focused-spec` peer range compatible with it; framework packages remain peer/consumer dependencies rather than core runtime dependencies. The JS/TS SDK has no focused-spec peer or runtime dependency; only its optional format owns the TypeScript parser dependency. The Go format ships a standard-library helper; the Go SDK is a separate standard-library-only module, not an npm package.

Update all thirteen workspace manifests and the root lockfile without creating a tag. Confirm every `X.Y.Z` is unused before continuing; npm versions are immutable. Versioned manifests are preparation only—do not publish them as part of implementation or validation without release authorization.

## Build and inspect separate tarballs

Install and build centrally from the private root:

```sh
npm ci
npm test
npm run smoke
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
```

Inspect each dry-run independently. Core must contain `dist/cli.js`, `dist/index.js`, `dist/format-api.js`, `dist/runner-api.js`, declarations, staged `skills/`, all three `guidance/workflow.md`, `guidance/formats.md`, and `guidance/runners.md` assets, root `README.md`, and `LICENSE`; it must not contain tests, `.focused-spec/`, a native parser, or registry loader. Each adapter must contain its own compiled ESM and declarations, package metadata, public README and any runtime helper assets it owns, without repository tests or another package's source. Root `src`/`dist` are obsolete; core output is `packages/core/dist`. Build stages root-owned assets into core so they are authored only once.

Check that the packed core `dist/cli.js` retains executable mode; a shebang alone is insufficient for `npx focused-spec` in the built workspace.

Repeated builds are clean at the package-owned output boundary: each package replaces `dist/`, and staging replaces core's generated skill/guidance mirrors. Removed authored files must not appear in subsequent pack inventories; building does not delete authored inputs or unrelated directories.

Core uses `prepack` to build and stage assets for ordinary packing; checkout installation builds through the workspace root's `prepare`. After an explicit build, `npm pack --ignore-scripts` must use prepared output without replacing it. Do not put a workspace-package build back in `prepare`: npm 10 may run that hook even with scripts disabled, racing concurrent verification against shared outputs.

Every official format and runner tarball includes its public `README.md`. Runner READMEs are generated by asset staging from `docs/guides/runners.md`; format READMEs remain package-owned. Root `README.md` is the default `plugin-docs` contract, so existing package manifests need no documentation metadata. Add `focusedSpec.documentation` only when a package intentionally publishes a different relative Markdown authority. Public selectors, options, and authoring contracts must be usable without inspecting compiled plugin JavaScript. Packed-consumer distribution evidence typechecks Format API 2, retains Runner API 1, and executes inline, registry, Vitest, pytest, and Go paths, including a real product assertion regression.

Build core and SDK first, the scenario format next, then its runner. Each new tarball must include compiled ESM, declarations, public README and LICENSE; the runner additionally owns its worker/transport runtime. Install only the SDK tarball in one clean consumer and prove execution/public types without focused-spec or TypeScript. Install core plus all three extension tarballs together in another consumer and exercise the maintained bank example's ordinary tests/output and local CLI list/show, strict validation and selected/all execution. Check plugin-docs provenance from installed tarballs and actual TypeScript-driver execution on Node.js 22.16.0 without consumer flags.

For install-level certification, create tarballs separately and install core alone in a clean consumer first: it must expose the CLI and APIs but have no native parser, inline dialect, registry loader, or test-framework fallback. In clean consumers, install the required core, selected format and runner tarballs together, configure package names explicitly, and validate/run both no-registry inline and explicit-registry evidence. Verify `plugin-docs` against a configured format and runner and against an explicit `--package` while configuration is invalid. For a composing format, request its configured registration first, read its public nested-package contract, then request that parser with a separate explicit `--package` call; neither response may aggregate the other document or import plugin code. Do not rely on workspace symlinks or source-checkout access for this check.

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
```

If one publication fails, do not claim a suite release or create the tag. Already published versions cannot be rolled back or overwritten; diagnose the failure, publish only the still-missing packages from the same committed revision, and recheck the complete version set. Never bump or move successful packages merely to hide a partial publication.

After all thirteen registry checks succeed, tag the npm release commit and push that tag explicitly:

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
- [ ] All thirteen npm `X.Y.Z` versions are visible in the registry; a clean consumer can install the published packages.
- [ ] Remote tag `vX.Y.Z` resolves to that exact release commit; it was not moved to repair a partial publish.
- [ ] GitHub Release `vX.Y.Z` exists for that tag, has reviewed notes, is published (not draft), and is not marked prerelease for a stable version.
- [ ] Report the npm version, Git commit, remote tag and **GitHub Release URL** together; never call a tag page or npm publication alone a completed release.

## Separate Go SDK module

`packages/sdk/go/go.mod` declares `github.com/bamanoz/focused-spec/packages/sdk/go`. It is not included in npm workspace builds or publication. Run `go test ./...` inside that module, exercise both its README example and the Go bank, and verify a copied SDK module works outside this checkout before release. The checkout bank uses an explicit local replacement; that proves local distribution, not a published module version.

An authorized Go release requires a distinct `packages/sdk/go/vX.Y.Z` tag pointing to the verified source commit. A root `vX.Y.Z` npm tag does not publish this subdirectory module. Verify the remote module tag and install that exact version from a fresh Go consumer with no `replace` directive before claiming Go publication. Module tags and versions are immutable. No Go module tag, npm publish, or registry download is part of ordinary implementation checks.

For the Python SDK, build a wheel and sdist from `packages/sdk/python`, install each artifact in a clean Python consumer, run the standalone example and pytest contract suite, then verify the exact PyPI project/version before claiming publication. Do not make the Python bank example depend on a registry release during repository checks; use the explicit local editable SDK path.

For the .NET SDK, run `dotnet pack packages/sdk/dotnet/FocusedSpec.Scenarios/FocusedSpec.Scenarios.csproj` from the verified source commit, install the exact `.nupkg` into a clean consumer using a local NuGet source, run the standalone example and xUnit contract suite, then verify the exact NuGet package/version before claiming publication. xUnit remains a consumer/test dependency and is not included in the SDK package.
