# Tasks

## 1. Source runner compatibility

- [x] 1.1 Repair the helper argument prefix in `packages/runner-vitest/src/index.ts`, update `docs/guides/runners.md`, bind the source-runtime outcome in `.focused-spec/evidence/runner-protocol.yaml`, and verify existing exact-selection tests on Node 22.16.0 without NODE_OPTIONS.

## 2. Package lifecycle and consumer reproducibility

- [x] 2.1 Add the prepared-output packing regression in `test/package.spec.ts`, observe RED on npm 10.9.2, move core's lifecycle hook to prepack, update repository/release documentation and distribution evidence, and verify script-free plus ordinary packing.
- [x] 2.2 Seed only framework-consuming disposable fixtures from the existing lock's external package graph without workspace links or peer-validation bypasses, and verify all four previously failing consumer paths execute their real behavior.

## 3. Cross-runtime integration

- [x] 3.1 Run complete `npm test` on Node 22.16.0/npm 10.9.2 and Node 26.8.1/npm 11.19.0; require all suites and tests to pass without skip or ambient type-stripping workarounds.
- [x] 3.2 Run strict focused validation and all enrolled scopes (312 scenarios, 262 targets), including compatibility and CLI discovery, plus real Go/pytest smoke on both runtimes; prove controlled regression sensitivity, validate OpenSpec and documentation links, and report the exact matrix without release, sync, or archive.
