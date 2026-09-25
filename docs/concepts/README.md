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

## Uniform scopes

Every configured Markdown document belongs to an ordinary, path-safe scope. A document layout either names that scope explicitly with `scope: <name>` or captures exactly one `{scope}` fragment from its match pattern; it never does both or neither. Names such as `current`, `release-7`, and `baseline` have identical semantics.

Stable IDs are unique within a scope. Across scopes, the same ID has exactly one unmarked owner; every additional occurrence needs exactly one `- **REVISES**: <source-scope>` row naming another scope with that ID. Revision chains may branch or pass through another revision, but must reach the owner without self-references, missing sources, or cycles. The relationship is explicit: framework headings and particular scope names grant no special ownership.

Document locations are framework-neutral and explicit. The CLI does not infer OpenSpec changes, Spec Kit features, Kiro requirements, archives, or fallback files. It parses focused scenario blocks from the configured Markdown and leaves native SDD prose and schema validation to the owning framework. Projects whose native format cannot host focused scenarios can configure a companion Markdown file. The [configuration guide](../guides/configuration.md) owns the exact version-2 layout contract.

Without `--scope`, validation and execution select every discovered scope. With `--scope <name>`, both select only that scope. `run --scenario <id>` strictly validates and executes only matching scenario instances in those scopes; plain `validate` still checks every scenario in its scope selection without running tests.

## Evidence

Evidence has the form `<runner-id>::<opaque selector>`. Only the first `::` separates the runner ID; the remainder belongs to the runner. Every evidence row must resolve to exactly one target and produce exactly one result.

Any scope may use the `planned:` prefix while an exact test target does not yet exist. Non-strict validation counts but does not resolve planned rows. Strict validation and execution reject planned evidence in every scope.

A scenario passes only when every evidence target passes. `SKIP` and `ERROR` are not success by default.

## Runner boundary

The core does not know Go, pytest, or any other framework. A project registers runner plugins in `.focused-spec/config.yaml`. The CLI loads each plugin in a child Node process, asks it to resolve selectors, then asks it to execute the resolved targets.

Runner plugins are trusted project code. They must still use argument arrays with `shell: false`, bounded diagnostics, deterministic target IDs, and real framework exit status. A runner must never return a passing result without executing the selected test.

The focused behavioral contract is recorded in the [capability specs](../../openspec/specs/scenario-authoring/spec.md); the [documentation map](../README.md) links every capability.
