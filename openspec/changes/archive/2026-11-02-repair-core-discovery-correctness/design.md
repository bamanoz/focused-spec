# Design

## Context

See proposal.md for the correctness gaps. `discoverDocuments` currently combines glob claims, containment checks, parse, bind, enrollment and diagnostics. It derives captured scope from the raw pattern, and selected captured-scope runs perform both an all-scope and a selected-scope glob. `FormatClient` currently treats a plugin-level `{ ok: false }` response as a transport failure. CLI options are parsed in separate hand-written command parsers, while error formatting separately maintains value-taking option names.

## Goals / Non-Goals

**Goals:**

- Keep document-local plugin failures local while preserving fatal host/protocol failure handling.
- Enforce path containment on all expanded document and exclusion patterns before glob traversal.
- Resolve captured scope against the exact alternative that matched a path and avoid a second glob for selected scope.
- Keep docs and migration diagnostics aligned with the selected CLI's `upgrade` topic contract.
- Remove redundant planning/data surfaces and isolate JSON runtime validation from YAML configuration loading.
- Improve maintainability of discovery and command parsing without changing public APIs, CLI grammar, or result semantics beyond the specified correctness fixes.

**Non-Goals:**

- Changing format or runner APIs, scope identity rules, glob syntax/bounds, evidence semantics, or package composition.
- Adding compatibility aliases, new flags, new dependencies, or OpenSpec/Spec Kit integrations.
- Reworking runner isolation or the unrelated lifecycle of child processes.

## Decisions

- Treat a validated host envelope with `ok: false` as a rejected operation: clear only the matching pending request, cancel its timer, reject that request, and keep the child available. Malformed envelopes, unsolicited messages, exit, timeout, and send/host errors remain fatal to the client.
- Reuse the bounded `expandGlobPattern` implementation at configuration load. Validate every resulting include and exclude alternative against the existing relative-path policy before configuration becomes usable, so discovery cannot start an unsafe traversal.
- During claim construction, retain enough alternative context to identify the alternative matching each project-relative file path. Extract the scope from that matched alternative, not from the raw brace expression. For selected-scope discovery, expand and traverse once, then preserve off-scope claims needed to detect cross-scope overlaps while suppressing unrelated diagnostics as today.
- Replace migration advice that embeds `./node_modules/.bin` and the `workflow` topic with the selected-executable-compatible `upgrade` topic wording already documented in the CLI and configuration guides. Update the current diagnostic assertion with that user-visible contract.
- Simplify validation output to one document collection because current target and resolution collections are identical. Pass the already-resolved plan directly to execution; remove `projectExecutionPlan` only after confirming its sole caller is redundant. Remove `RunnerRunOutput` and the `sources.ts` re-export only after repository-wide callsite checks.
- Move `isJsonValue` into a dependency-light JSON utility module and import it from config, format/runner hosts and clients, and execution-event validation. Preserve the existing runtime acceptance/rejection rules.
- Split discovery into explicit claim collection, document parsing, catalog/binding, and enrollment stages, keeping data structures local and diagnostics/order stable. Do not create a generic pipeline framework.
- Consolidate CLI option metadata by command so parsers and `cli-error.ts` derive value-taking options from one declarative definition. Preserve command-specific semantics, duplicate/missing-value errors, `--` handling, help behavior, and accepted option orderings; avoid a broad parser dependency.

## Risks / Trade-offs

- Glob alternatives may overlap; a path can match more than one expanded alternative. Treat multiple alternative matches as a layout ambiguity rather than selecting a scope by enumeration order, preserving the existing no-ambiguous-ownership rule.
- Path checks must use the same platform path semantics as current validation; tests should include absolute and parent-segment alternatives for both include and exclude patterns.
- Splitting discovery can accidentally change diagnostics, deterministic ordering, selected-scope overlap reporting, or plugin call frequency. Preserve these observable details except where the specified failure-isolation fix requires a change.
- Declarative CLI metadata can become another abstraction if it does not replace duplicated option knowledge. Keep it command-local and test public argument behavior.

## Exact evidence

- `test/core.spec.ts`: format-plugin parse failure isolation; safe expanded include/exclude patterns; captured-scope brace alternatives; selected-scope discovery with overlap checks; migration diagnostic; strict and syntax-only validation remain stable.
- `test/cli.spec.ts`: command-specific options, duplicate and missing values, aliases, help scanning, and `--` behavior remain unchanged.
- Run the repository's public focused-spec selection for the touched native requirements at apply time; exact selectors to confirm are `config.glob.expanded-path-safety`, `config.glob.expanded-absolute-safety`, `config.source.expanded-capture-scope`, `config.migration.selected-cli-upgrade`, and `validation.format.document-failure-isolation`.
