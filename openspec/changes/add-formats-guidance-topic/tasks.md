# Tasks

## 1. Topic delivery and discovery

- [x] 1.1 Accept `formats` in core topic parsing/help, add its static package-owned guidance, and document the CLI contract; verify offline JSON/text delivery and missing-asset rejection with focused CLI checks.
- [x] 1.2 Add standalone formats acquisition to the thin loader and generic workflow, update configuration/install/index references, and verify documentation links and staged guidance equality.

## 2. Consumer evidence and integration

- [x] 2.1 Extend source-independent packed guidance checks to formats, register every changed scenario's exact evidence in this change scope, and verify strict validation and execution without source-checkout or plugin requirements.
- [x] 2.2 Run `npm test`, the affected real CLI/example paths, and a controlled isolated topic-routing regression with PASS → assertion FAIL → restored PASS; verify official-format examples, pack inventory, and strict OpenSpec validation.

## Observed verification

- `npm run build` and the two focused CLI tests passed. Real formats JSON/text/help preserved protocol 1 and package version 0.9.1.
- Strict focused validation and execution of `add-formats-guidance-topic` passed: 8 scenarios, 8 exact targets, no planned evidence.
- Isolated product mutations proved PASS → assertion FAIL → restored PASS for formats delivery, missing-asset rejection, and the source-independent packed guidance test. Temporary workspaces were removed in `finally`; the working product was not mutated.
- Topic examples passed all five CLI stages for inline, registry+Markdown, and registry+Gherkin, ending with real Go evidence PASS. `npm run smoke` passed Go and pytest evidence.
- Core pack dry-run contained all three guidance assets and the loader. Checked 72 local documentation links with no broken destinations/anchors; formats is reachable from both indexes, and all four changed authored/staged assets matched.
- Default `npm test` reported 260 passed and one existing eval timeout at 5 seconds; the same eval also timed out in isolation and passed in 7.05 seconds with an explicit deadline. `npm test -- --testTimeout 30000` passed all 14 suites and 261 tests. No eval timeout or implementation was changed.
- No version bump, integration reinstall, spec sync, archive, or release was performed.
