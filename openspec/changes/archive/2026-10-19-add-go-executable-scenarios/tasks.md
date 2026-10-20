# Tasks

## 1. Independent Go SDK

- [x] 1.1 Create `packages/sdk/go/go.mod`, `scenarios.go` and `LICENSE` with the typed SDK and explicit validation described in design decision 1; prove an isolated Go-only module can execute a real scenario and reject invalid data before preparation, with no npm dependencies.
- [x] 1.2 Implement typed input cloning, exact comparison, cleanup/error joining and context cancellation; add behavioral `scenarios_test.go` cases for mutation, nil-versus-empty data, mismatch detail, dual failures and cancellation, and run `go test ./...` in `packages/sdk/go`.
- [x] 1.3 Write `packages/sdk/go/README.md` with actual public types, supported data, driver lifecycle and independent module installation; exercise its standalone example and distinguish local replacement from future module publication.

## 2. Native Go discovery

- [x] 2.1 Add `packages/formats/scenarios-go/` manifest, tsconfig, source, public `/catalog` export and standard-library `go/catalog.go`; integrate the new npm workspace/build ordering and prove actual typed suite discovery returns exact IDs and object-start lines without executing consumer initializers.
- [x] 2.2 Implement the restricted static grammar, source diagnostics, safe selectors, helper isolation, cancellation and output limits; add relevant cases to `test/go-executable-scenarios.spec.ts` for dynamic rejection, missing fields, duplicates and opaque identities, then run those exact checks with real Go source.
- [x] 2.3 Write `packages/formats/scenarios-go/README.md`, add the public format link to `docs/guides/configuration.md` and `docs/README.md`, and update package build/staging so its Go helper is in its tarball; verify packed plugin documentation and static discovery outside the checkout.

## 3. Exact Go runner

- [x] 3.1 Add `packages/runners/scenarios-go/` manifest, tsconfig and source implementing static resolve through the shared catalog, canonical suite/driver containment and runtime identity revalidation; prove escaped drivers and removed targets cannot execute or pass.
- [x] 3.2 Implement the temporary compiled Go bridge, same-SDK selected execution, dedicated bounded report protocol, process-tree cancellation and temporary-path removal; prove an exact Unicode/punctuation ID runs alone beside an unrelated failing action and that missing/invalid reports and process failures never pass.
- [x] 3.3 Document the selector, options, Go prerequisites, initializer trust boundary, failure handling and cleanup limits in `docs/guides/runners.md`; stage its generated package README through `scripts/stage-assets.mjs`, then verify the installed runner contract with `plugin-docs` and real selected execution.

## 4. Language-separated bank consumers

- [x] 4.1 Move all authored TypeScript bank files listed in design decision 5 into `examples/scenarios/typescript/`, adjust package paths, preserve six exact IDs and the optional Node test-wrapper comment, and migrate `test/executable-scenarios.spec.ts`; run its tests, demo and focused one-ID/all execution at the new root.
- [x] 4.2 Create `examples/scenarios/go/` with its real account, six native scenarios, driver, ordinary Go wrapper, readable demo and independent Go module; run `go test ./...` and `go run ./cmd/demo` there without relying on focused-spec configuration or npm packages.
- [x] 4.3 Add optional Go consumer npm dependencies and the exact version-5 configuration from design decision 3; exercise local CLI list/show, syntax-only/strict validation, `account.withdraw.entire-balance` selection and all-six execution using no Markdown companion or consumer registry.
- [x] 4.4 Update `README.md`, `docs/guides/configuration.md`, `docs/development/workflow.md` and affected section indexes with both language commands and the optional test-wrapper explanation; execute the documented commands and confirm no active caller retains the old executable consumer root.
- [x] 4.5 Extend the relocated TypeScript bank regression assertion and add the Go bank regression assertion to cover baseline ordinary tests/demo/focused execution; in disposable copies change the overdraft boundary from `>` to `>=`, observe affected assertion failure in standalone and focused paths, restore and observe PASS in both languages.

## 5. Distribution and native evidence

- [x] 5.1 Finish root `package.json`/`package-lock.json`, thirteen-package npm build/staging and `test/package.spec.ts` inventories without adding the Go module to npm; pack the new plugins and prove an isolated consumer with a copied SDK distribution has no dependency path into the checkout.
- [x] 5.2 Finish the exact behavioral tests and all sixteen native-ID bindings in `.focused-spec/evidence/go-executable-scenarios.yaml` according to design decision 6, preserving the old capability's existing evidence; run strict focused validation and exact evidence for `add-go-executable-scenarios` with no planned references remaining.
- [x] 5.3 Update installation, development and release owners and indexes listed in design decision 7, including distinct Go module tag rules and public SDK/format links; validate links/reachability and verify install/pack examples without publishing, tagging or claiming unavailable registry versions.

## 6. End-to-end acceptance

- [x] 6.1 Run `npm test`, native SDK tests, both standalone examples and both CLI integrations, then strict validation and full execution of the new scope; record actual commands, results and tested runtime versions in `.eval-cache/go-executable-scenarios-verification.json`, including any untested declared Go baseline.
- [x] 6.2 Prove every new or changed evidence assertion detects its protected controlled product regression, restore each probe and rerun to PASS; validate this change with `openspec validate add-go-executable-scenarios --strict` and report any unverified requirement explicitly rather than treating partial checks as complete.

## Workflow follow-up

- Implementation requires starting the apply workflow after proposal review; this checklist does not authorize publication.
- Only upon separate authorization, reconcile the earlier unsynced executable-scenarios capability with this language-separated example contract before sync/archive. Preserve existing identities and evidence; do not publish conflicting old paths.
- npm/Go module publication, version changes and release tags are separate work, not tracked implementation tasks here.
