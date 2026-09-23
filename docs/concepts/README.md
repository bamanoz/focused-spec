# Concepts

## Focused specification

A focused specification protects the smallest product-boundary outcome that can fail independently. It is intentionally smaller than a test plan and leaves implementation free to change.

A scenario contains:

- one repository-unique lowercase dotted ID;
- one `WHEN` request;
- one user-visible or durable `THEN` outcome;
- one or more evidence references that form an `AND` contract.

Example:

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **EVIDENCE**: `go-unit::./auth::TestBlockedAccount`
- **EVIDENCE**: `pytest-functional::tests/functional/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

## Evidence

Evidence has the form `<runner-id>::<opaque selector>`. Only the first `::` separates the runner ID; the remainder belongs to the runner. Every evidence row must resolve to exactly one target and produce exactly one result.

A scenario passes only when every evidence target passes. `SKIP` and `ERROR` are not success by default. OpenSpec changes may use `planned:` evidence during planning, but strict validation and final execution require concrete selectors.

## Runner boundary

- The core does not know Go, pytest, or any other framework. A project registers runner plugins in `.focused-spec/config.yaml`. The CLI loads the plugin in a child Node process, asks it to resolve selectors, then asks it to execute the resolved targets.

Runner plugins are trusted project code. They must still use argument arrays with `shell: false`, bounded diagnostics, deterministic target IDs, and real framework exit status. A runner must never return a passing result without executing the selected test.

## OpenSpec boundary

With `source: openspec`, current behavior is owned by `openspec/specs/**/spec.md`; active change deltas are selected with `--change <name>`. Proposal turns create planning artifacts only. Apply turns replace planned evidence, add runners/configuration, and execute the change-scoped evidence.
