# Tasks

## 1. JUnit Report Output

- [x] 1.1 Implement opt-in JUnit XML generation for `run` from the existing result without rerunning evidence; preserve scope/ID identity, native name/source, PASS/FAIL/ERROR/SKIP and nonpassing evidence diagnostics with valid XML escaping.
- [x] 1.2 Write reports atomically relative to project root, represent preflight violations at suite level and valid empty runs as empty suites, and make destination failures actionable without hiding execution results or returning success.
- [x] 1.3 Add black-box CLI coverage for mixed outcomes and XML parsing, preflight with no fabricated cases, empty selection, output failure, unchanged default behavior and unchanged `--json` result.

## 2. Composite GitHub Action

- [x] 2.1 Add a composite Action that consumes an already-installed focused-spec CLI, accepts a configurable report destination and safe argument inputs, exposes the report path and truthful command outcome, and propagates CLI failure.
- [x] 2.2 Add Action contract coverage for output path and exit-status preservation, including safe handling of caller-provided arguments without shell interpolation.
- [x] 2.3 Document a minimal consumer workflow and untrusted-PR least-privilege constraints: read-only permissions, no secrets/write token, no privileged publication in the untrusted execution context, and safe separation for any trusted upload or publication.

## 3. Contracts and Verification

- [x] 3.1 Update CLI help and CLI reference documentation for the JUnit option, destination resolution, preflight/empty behavior and interaction with existing JSON output.
- [x] 3.2 Run focused CLI and Action checks, parse generated JUnit with an XML parser, and verify all six report/action focused-spec scenarios against their exact evidence before enrollment.

Observed working-scope checkpoint: `./node_modules/.bin/focused-spec run --root . --scope add-machine-readable-run-reports` reported 6 PASS, 0 FAIL/SKIP/ERROR across 5 exact targets. The native JUnit case parsed the real generated XML; composite Action checks exercised local script/status/permission boundaries, not GitHub-hosted execution.
