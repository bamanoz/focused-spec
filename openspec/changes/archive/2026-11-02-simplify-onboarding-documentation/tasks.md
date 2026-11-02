# Tasks

## 1. Root onboarding and product claims

- [x] 1.1 Reshape the root README into a concise overview with one chooser for SDK-only executable scenarios versus CLI-based native evidence; keep only core installation, runnable examples, and links to authoritative documentation.
- [x] 1.2 Replace mutable `main` agent-install URL with the current released tag; remove release/status assurances from the root README while retaining the product boundary that focused-spec links native requirements to real test evidence.
- [x] 1.3 Align the README inline example with the inline+Vitest install instructions, use an existing real test selector, and smoke-run the documented example from its stated consumer root.
- [x] 1.4 Clarify the generic evidence-layer positioning without implying specification authoring, host lifecycle ownership, or integrations with OpenSpec or Spec Kit.

## 2. Availability, examples, and package docs

- [x] 2.1 Update Python/.NET format and runner installation claims and package README commands to distinguish current npm publication from source-checkout availability; do not modify .NET SDK installation sections owned by the distribution change.
- [x] 2.2 Make the worktree consumer instructions executable from a stated location or clearly label the example as checkout-bound, including its `file:` dependency constraint.
- [x] 2.3 Rewrite repository-relative links when staging the root README into the core package and verify staged links resolve from a packed-consumer context.
- [x] 2.4 Replace the identical staged runner guide copies with package-specific runner READMEs that describe each package's framework prerequisites and public selector contract and link to the shared guide.

## 3. Documentation navigation and verification

- [x] 3.1 Shorten `docs/README.md` to a practical user navigation map; remove `candidate-improvements.md` from user-facing documentation navigation, including the development map.
- [x] 3.2 Remove tracked documentation references that rely on ignored `.eval-cache` or `evals/results` artifacts; preserve only reproducible, public evidence.
- [x] 3.3 Correct stale instruction-version references outside the .NET installation materials; coordinate Python/.NET package availability wording with the distribution change without editing its owned sections.
- [x] 3.4 Record exact focused-spec evidence selectors in `design.md` after identifying the changed outcomes; validate links and run the documented inline+Vitest consumer example, then validate this change strictly and focused-spec non-strictly without enrollment.

## Acceptance inspection and runtime handoff

Manual editorial review is complete for all ten native outcomes; the exact observations and inspected owners are recorded in `design.md`. Review covered the root chooser and package identities, actual inline fixture files/selector, release-tagged agent URL, Python/.NET format and runner availability instructions, all seven runner staging templates, worktree dependency layout, source-to-core staging destinations, public navigation, ignored-artifact dependence, and framework-neutral positioning. In the delta, the eight manual-only scenario identities and full requirements now remain as ordinary native text rather than focus-enrollment markers; the two IDs backed by authorized executable selectors retain their markers. No .NET SDK installation section, generated package mirror, requirement, native ID, or scenario was removed.

The graph defect was the public path `README.md` → `docs/README.md` → `docs/development/agent-evals.md` → internal candidate register. The candidate-link sentence in `agent-evals.md` is now removed while its useful source-claims/execution-certification distinction remains. `docs/development/workflow.md` no longer promises an exhaustive capability map: it describes concise navigation to guides, references, SDKs and development resources. No new documentation page was introduced. This is a source inspection finding, not a navigation-test PASS.

Task 1.3 has the existing parent-reported PASS → product FAIL → restored PASS; this reviewer did not execute it again. Task 2.3 remains open pending a packed-core consumer after correcting the staging transform. Source review found the old packed image (`raw/.../v0.10.2/assets/focused-spec.svg`) and checkout-only onboarding fixture tree URL invalid in Main's remote check; Main reports raw `main` image URL works, sampled package/example/docs/license URLs returned 200, and npm page returned 403 (inconclusive). The staging source now uses the observed image destination and renders the fixture as checkout-only text in the package README, while root README retains its local fixture link and complete inline example. Tasks 2.1/2.4 have manual template findings only; the packed runner runtime selector is complementary proof for three examples, not all runner availability wording. Task 3.4 records the exact two executable selectors and manual identities, then remains open pending its strict OpenSpec and non-strict focused-spec checks without enrollment.

Pending runtime observations owned by Main:

- Run `test/documentation.spec.ts`, including `public documentation navigation > keeps local documentation navigation reachable from public entry points` after the candidate-link repair and the unchanged `follows the CLI reference to the current native SDK installation guide` selector. This must observe actual local links, fragments, public-page reachability, and candidate exclusion; source review is not a substitute.
- Run `test/onboarding.spec.ts::README consumer quick start > resolves and runs the exact documented inline Vitest selector` against the settled source. Its temporary consumer uses workspace-linked dependencies; do not describe it as a clean npm-registry installation.
- Run `test/package-docs-native.spec.ts::package distribution > executes selectors discovered from packed runner documentation`. It checks packed Vitest/pytest/Go documentation and selected execution with its existing regression/restoration probe, not all native runner copy or remote URL reachability.
- Complete task 2.3's packed-core README check: install/use a packed consumer outside the checkout and inspect image, SDK/package, example, fixture disclosure, guide/reference/map, and license destinations. The exact previous image/fixture dead links were observed remotely by Main; npm 403 was inconclusive and no registry availability conclusion is allowed.
- Run `openspec validate simplify-onboarding-documentation --strict` and the approved non-strict focused-spec validation without enrollment, then Main owns final native representation/evidence reconciliation, any required scope checks, synchronization and archive.

The evidence shard binds only the inline consumer and local progressive-navigation checks. All eight remaining native outcomes, literal IDs and manual findings remain present as ordinary native text, without focused enrollment markers or unrelated executable evidence. This corrects the initial planning representation to match task 3.4's explicit without-enrollment boundary; it does not remove, weaken or mark editorial outcomes executable. No tests, build, formatter, validator, packed consumer, remote request, or lifecycle command was run in this documentation follow-up; only local source inspection and installed guidance acquisition were performed.

## Final observed acceptance

Main ran the settled documentation/onboarding/packed-runner/report/action/process checks: 8 files and 27 tests passed. The exact focused onboarding scope then validated and executed: 2 PASS, no planned evidence or nonpassing outcomes. All native requirements and ten literal IDs remain; eight editorial findings are manual, not executable coverage.

Main built and packed core, installed the tarball into a disposable consumer outside this checkout, read its installed README, and executed its installed `version --json` successfully. All 17 installed README GitHub image/package/example/docs/license links returned HTTP 200. The new fixture is honestly disclosed as checkout-only text rather than a nonexistent release-tag URL. The npm website returned HTTP 403 during the earlier check, which is not evidence of registry availability. All 29 then-existing OpenSpec artifacts passed strict validation.
