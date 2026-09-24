# Releasing focused-spec

This repository publishes the `focused-spec` npm package manually. There is no release workflow: publishing to npm does not create a Git tag or a GitHub Release. A release is complete only when the published package was built from the commit identified by its `v<version>` tag. GitHub Releases are optional and are not created by the steps below.

Only bump the version for consumer-facing changes to the published package (the CLI/API in `src/`, packaged `skills/`, the root README, or metadata such as exports and runtime dependencies). Changes confined to tests, `docs/`, `openspec/`, examples, dev-only dependencies, or the repository-local `.focused-spec/` runner do not need an npm release. Choose `patch`, `minor`, or `major` according to the consumer-visible change; for pre-1.0 releases, explain compatibility changes explicitly.

## Prepare

Use Node.js 22.16.0+ and an npm account authorized to publish `focused-spec`. Start on `main` with a clean working tree. Confirm the registry and current published version:

```sh
git pull --ff-only origin main
git status --short --branch
npm whoami
npm config get registry
npm view focused-spec version
```

Do not publish from a dirty tree or an unpublished feature branch. After merging the change and updating its documentation, bump the version in both `package.json` and `package-lock.json` without letting npm create a commit and tag prematurely:

```sh
npm version patch --no-git-tag-version
```

Replace `patch` with `minor` or `major` when appropriate. Record the version printed by npm; substitute it for `X.Y.Z` below. Confirm `focused-spec@X.Y.Z` is not already published: npm versions are immutable and cannot be reused.

## Verify and publish

```sh
npm test
npm run smoke
openspec validate --all --strict --no-interactive
node dist/cli.js validate --strict
node dist/cli.js run
npm pack --dry-run
```

Inspect the dry-run file list: the tarball must contain `dist/cli.js`, `dist/index.js`, `dist/runner-api.js`, their declarations, `skills/`, the root README, and `LICENSE`; it must not contain tests or `.focused-spec/`. `prepare` builds `dist/` when packing/publishing; `dist/` is intentionally ignored by Git. Stop if any check fails or the tarball is incomplete.

Commit the version and push the exact source revision before publishing:

```sh
git add package.json package-lock.json
git commit -m "Release focused-spec X.Y.Z"
git push origin main
npm publish
npm view focused-spec@X.Y.Z version
```

If publishing fails, do not claim a release or create a tag. Resolve the npm error and retry publishing the same committed version if it has not reached the registry. If that version exists, inspect what was published before proceeding; never overwrite a published version.

After the registry confirms the published version, tag **the release commit**, not a later commit, and push that tag explicitly:

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
git ls-remote --tags origin refs/tags/vX.Y.Z
```

Confirm the remote tag resolves to the release commit and `npm view focused-spec version` reports the intended `latest` version. If the npm publication succeeds but the tag push fails, retry pushing the same tag; do not bump the package again just to repair the tag. Existing tags must never be silently moved. A GitHub Release can be created separately from the tag if release notes or downloadable assets are needed; it is not required for npm installation.
