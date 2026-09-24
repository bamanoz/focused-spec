# Concepts

## Focused specification

A focused specification protects the smallest product-boundary outcome that can fail independently. It is intentionally smaller than a test plan and leaves implementation free to change.

A scenario contains:

- one repository-unique lowercase dotted ID;
- one `WHEN` request;
- one user-visible or durable `THEN` outcome;
- one or more evidence references that form an `AND` contract.

Malformed `EVIDENCE` rows are validation errors even when other evidence rows are valid; no authored evidence may be silently omitted.

Example:

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **EVIDENCE**: `go-unit::./auth::TestBlockedAccount`
- **EVIDENCE**: `pytest-functional::tests/functional/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

## Baseline and named scopes

Configured Markdown documents belong either to the baseline or to a named scope. The baseline owns current stable IDs. A named-scope scenario may retain a baseline ID only by declaring `- **REVISES**: baseline`; its surrounding framework headings do not imply that relationship. New IDs must remain unique across the discovered scopes.

Document locations are framework-neutral and explicit. The CLI does not infer OpenSpec changes, Spec Kit features, Kiro requirements, archives, or fallback files. It parses focused scenario blocks from the configured Markdown and leaves native SDD prose and schema validation to the owning framework. Projects whose native format cannot host focused scenarios can configure a companion Markdown file. The [configuration guide](../guides/configuration.md) owns the exact version-2 layout contract.

Without an explicit scope selection, validation sees the baseline and every discovered named scope; execution selects only the baseline. Selecting a scope validates the baseline plus that scope and executes the scope. This separation lets validation protect repository-wide ownership without confusing unexecuted scenarios with proof.

## Evidence

Evidence has the form `<runner-id>::<opaque selector>`. Only the first `::` separates the runner ID; the remainder belongs to the runner. Every evidence row must resolve to exactly one target and produce exactly one result.

Named scopes may use the `planned:` prefix while their exact test targets do not yet exist. Planning validation counts but does not resolve those rows. Baseline evidence is always concrete, and strict validation plus execution reject all planned evidence.

A scenario passes only when every evidence target passes. `SKIP` and `ERROR` are not success by default.

## Runner boundary

The core does not know Go, pytest, or any other framework. A project registers runner plugins in `.focused-spec/config.yaml`. The CLI loads each plugin in a child Node process, asks it to resolve selectors, then asks it to execute the resolved targets.

Runner plugins are trusted project code. They must still use argument arrays with `shell: false`, bounded diagnostics, deterministic target IDs, and real framework exit status. A runner must never return a passing result without executing the selected test.

The focused behavioral baseline is recorded in the [capability specs](../../openspec/specs/scenario-authoring/spec.md); the [documentation map](../README.md) links every capability.
