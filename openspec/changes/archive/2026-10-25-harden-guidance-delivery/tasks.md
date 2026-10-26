# Tasks

## 1. Installed CLI guidance and topic routing

- [x] 1.1 Extend `instructions` with the focused topic allowlist, remove project-local ownership enforcement, and update CLI help plus activation checks; verify external installations, unknown topics, duplicate options, and protocol errors through targeted tests.
- [x] 1.2 Replace the large workflow asset with a compact router and add the `review`, `author-revise`, `upgrade`, and `verify` package-owned topics; reduce the authored loader to activation and routing only, then verify every topic is nonempty, bounded, and served offline from a packed installation.

## 2. Documentation and distribution contract

- [x] 2.1 Update the CLI reference, installation guidance, documentation map, and root README to describe installation-independent guidance, project-root plugin resolution, focused topics, router/loader ownership, and unchanged protocol-1 fields; verify links and command examples against the authored assets.
- [x] 2.2 Update package-distribution checks and staging expectations so generated core assets mirror authored guidance without hand-edited generated files; verify a fresh packed consumer receives the compact loader, router, and all focused topics while malformed project configuration remains irrelevant.

## 3. Evidence and completion verification

- [x] 3.1 Add the installation-independent, focused-topic, compact-router, packed-replacement and activation behavioral tests named in `design.md`; enroll the exact selectors in the existing guidance evidence owners and replace every `planned:` reference only after each target exists, then verify strict change-scope validation resolves all references.
- [x] 3.2 Run the affected CLI/package/activation tests, `npm test`, `openspec validate harden-guidance-delivery --strict`, and `focused-spec validate --scope harden-guidance-delivery --strict` plus `focused-spec run --scope harden-guidance-delivery`; verify offline topic delivery, independent installations, exact packed bytes where required, and report any unavailable mutation or host checks.

## Workflow follow-up

- Sync the validated deltas into `openspec/specs/agent-guidance/spec.md` and `openspec/specs/agent-workflow/spec.md` only after implementation and evidence pass.
- Validate the resulting main specs and archive the change through the OpenSpec workflow.
- After archive, validate and execute the full discovered focused-spec selection; publishing and refreshing consumer installations remain separately authorized.

## Verification observed

- `npm test`: 21 files, 401 tests passed, including packed installation, staging, replacement, CLI, and activation coverage.
- `openspec validate harden-guidance-delivery --strict`: valid.
- `node packages/core/dist/cli.js validate --scope harden-guidance-delivery --strict`: 24 enrolled items, zero planned evidence, 33 unique targets.
- `node packages/core/dist/cli.js run --scope harden-guidance-delivery`: 24 PASS, zero FAIL/SKIP/ERROR, all 33 targets executed.
- Real disposable `npm install --global --prefix <temp> --offline` from the freshly packed core: all eight topics matched authored bytes from an unconfigured consumer with malformed configuration and no local CLI. `plugin-docs --format markdown --root <repository>` resolved the consumer's registry package, not the global installation. Removing the installed review topic failed with exit 1 and empty stdout; exact restoration passed.
- Isolated product regressions: reintroducing CLI ownership enforcement failed each of the external-install, focused-topic, packed-loader, and compatible-replacement tests on its assertion; substituting workflow fallback failed the missing-topic assertion; reintroducing local-only activation failed the selected-installation assertion. Each probe observed baseline PASS, selected assertion FAIL, byte-exact restoration, and restored PASS. Original CLI/assets stayed unchanged; disposable copies were removed.
- Relative documentation links and fragments: 206 checked across 23 authored pages; all four new topics reachable through the documentation index.
- No new model-driven host activation matrix was run; that measurement remains in later blocks. Windows shell shims and non-POSIX terminals were not exercised on this host.
- Both deltas were synchronized into the main capability specs and compared requirement-for-requirement before `openspec archive harden-guidance-delivery --skip-specs --yes --json` moved the change to this directory. `--skip-specs` avoided reapplying the already synchronized deltas; it did not skip validation.
- `openspec validate --specs --strict`: all 21 capability specs passed. Archived working-scope evidence was retired; current-scope evidence remains explicit.
- `node packages/core/dist/cli.js validate --strict` after archive: all discovered scopes valid, 333 enrolled items, zero planned evidence, 368 unique targets.
- Final link-path check after archive: 207 local destinations reachable, including this completion record. The README explicitly distinguishes implemented checkout behavior from npm publication and consumer rollout.
- The first post-archive default `node packages/core/dist/cli.js run` hit the configured 120,000 ms runner deadline: 0 PASS, 0 FAIL, 0 SKIP, 333 ERROR; 368 unique targets. That attempt was not successful.
- Final full execution: `node packages/core/dist/cli.js run --config .eval-cache/harden-guidance-delivery-verification.yaml` completed in 118.91 seconds with 333 PASS, 0 FAIL, 0 SKIP, 0 ERROR; all 368 unique targets executed. The disposable configuration retained every document, format, registry and runner setting, changing only the runner deadline to 600,000 ms. No competing test suite ran during this attempt. The disposable file was removed afterward; `.focused-spec/config.yaml` remains unchanged at 120,000 ms.
