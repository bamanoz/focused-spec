# Tasks

## 1. Runtime security

- [x] 1.1 Replace fast-glob with glob and bounded minimatch expansion; reject oversized, deeply nested and excessive-alternative patterns before matching.
- [x] 1.2 Preserve document and registry selection, exclusions, numeric ranges and lexical/canonical source safety.

## 2. Consumers and evidence

- [x] 2.1 Migrate all evaluation consumers and provisioning fixtures without retaining fast-glob imports.
- [x] 2.2 Add exact regression evidence, update owning configuration documentation and prove PASS/FAIL/restored PASS sensitivity.

## 3. Verification

- [x] 3.1 Run full tests, real CLI/example checks on supported Node runtimes and isolated production audit.

## Release obligations

After archiving the verified behavioral implementation, commit and push it, bump and verify the patch artifact, publish that artifact to npm, push the exact release tag, create GitHub Release and verify the published installation. These remain required delivery tasks tracked separately from the implementation checklist; they are not complete merely because this change is archived.
