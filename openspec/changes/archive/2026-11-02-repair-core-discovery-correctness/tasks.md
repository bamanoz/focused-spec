# Tasks

## 1. Correct Pattern Validation and Scope Discovery

- [x] 1.1 Validate every expanded document and exclusion alternative against the project-relative path policy; add focused cases for brace-generated parent segments and absolute paths, and verify both reject before glob traversal.
- [x] 1.2 Preserve the expanded alternative for each matched path and derive captured scope from that match; cover alternatives with differing path-segment counts and assert correct `(scope, ID)` selection.
- [x] 1.3 Replace selected captured-scope double glob with a single discovery pass; verify selected documents, off-scope overlap detection, invalid-scope diagnostics, and deterministic ordering remain correct.
- [x] 1.4 Split discovery responsibilities into explicit claim, parse, bind/catalog, and enrollment stages; verify existing discovery, binding, and validation cases retain their diagnostics and ordering.

## 2. Isolate Format Failures and Migration Guidance

- [x] 2.1 Treat plugin-declared parse failure as a request-local rejection while retaining fatal handling for protocol/host failures; add a plugin that fails only one document and verify sibling documents still parse and bind.
- [x] 2.2 Align config and format API migration messages with selected-executable `upgrade` guidance; update CLI/configuration documentation and verify obsolete config and API diagnostics match it.

## 3. Remove Redundant Planning and Runtime Coupling

- [x] 3.1 Collapse duplicate validation document collections and redundant execution-plan projection; confirm selected execution, validation counts, and scenario filtering pass the owning core and CLI cases.
- [x] 3.2 Move JSON-value validation to a dependency-light module and update all config, host, client, and event consumers; verify runner-facing imports no longer load YAML and existing JSON-envelope boundary cases remain unchanged.
- [x] 3.3 Remove `RunnerRunOutput` and the `sources.ts` `isScopeName` re-export after confirming no consumers; typecheck the core package and search for remaining references.

## 4. Consolidate CLI Option Metadata

- [x] 4.1 Define command-local declarative option metadata and use it in command parsing and CLI error JSON detection; verify duplicate/missing values, command-specific options, opaque scenario values, aliases, help scanning, and `--` handling through existing CLI tests.
