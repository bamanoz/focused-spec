# Concepts

## Focused specification

A focused specification protects the smallest product-boundary outcome that can fail independently. The owning framework's native checkable item remains the only behavioral text. `focused-spec` adds only:

- a lowercase dotted ID bound to that item;
- one or more exact evidence references in `.focused-spec/evidence.yaml`;
- execution results from project-local runners.

The ID is not a second requirement, and the registry must not repeat or reinterpret the behavior.

## Native items and bindings

Version 3 discovers native `.md` and `.feature` documents. It records a native item's structural name and location; it does not infer requirements from prose or require a particular source framework.

Editable Markdown binds an ID with `<!-- focused-spec:id=<id> -->` immediately before one heading, paragraph, or list item. A paragraph or list item may instead end with the marker inline. The marker must resolve to exactly that adjacent item.

Gherkin binds an ID with `@focused.<id>` on one `Scenario` or `Scenario Outline`. Focused tags on `Feature`, `Rule`, `Background`, or `Examples` are invalid because those structures do not identify one executable scenario.

When a document is generated or cannot preserve either marker, the registry may bind an explicit host-owned native ID:

```yaml
scopes:
  current:
    order.limit.reject-at-capacity:
      source:
        path: generated/SPEC.md
        nativeId: CAP-1
      evidence:
        - pytest-functional::tests/test_order_limit.py::test_order_at_limit_rejects_another_item
```

`source.nativeId` is resolved only from an explicit declaration in `source.path`. Headings, line numbers, and behavior wording are not identities and are never guessed. Generated output stays unmarked.

A marked item without its matching registry entry is invalid. A registry entry is also invalid when it is unbound, binds more than one native item, conflicts with another binding, or names a missing or ambiguous explicit native ID. Unmarked native content is outside focused coverage: it is neither an error nor an arbitrary count reported as if focused-spec had verified it.

## Registry identity and evidence

Identity is the pair `(scope, ID)`. IDs are unique within a scope. The same ID may appear in another scope, but every occurrence must bind its own item and declare its own evidence. Scopes are execution contexts, not ownership or ancestry, and evidence never inherits between them.

Evidence has the form `<runner-id>::<opaque selector>`. Only the first `::` separates the runner ID; the remainder belongs to the runner. Every reference must resolve to exactly one target and produce exactly one result. Multiple references on an entry form an AND contract.

Any scope may use the `planned:` prefix while an exact target does not yet exist. Non-strict validation records but does not resolve planned references. Strict validation and execution reject them. `SKIP` and `ERROR` are not success by default.

The registry shape is deliberately closed: unknown fields, duplicate YAML fields, malformed IDs, malformed evidence, and malformed source bindings fail validation instead of being ignored.

## Selection

Without `--scope`, validation and execution select all registry scopes and discovered documents. With `--scope <name>`, both select only that scope. `run --scenario <id>` further isolates the selected `(scope, ID)` entries, including their binding and evidence validation; unrelated entry, binding, and evidence failures do not block that run.

An all-scope selection with `scopes: {}` and no discovered documents is valid and empty. The registry file itself is required. Selecting a missing scope or scenario is an error.

## Runner boundary

The runner API is unchanged. The core does not know Go, pytest, or another test framework. A project registers runner plugins in `.focused-spec/config.yaml`; the CLI asks each plugin to resolve opaque selectors and then execute the resolved targets.

Runner plugins are trusted project code. They must use safe process invocation, bounded diagnostics, deterministic target IDs, and real framework results. A runner must never return `pass` without executing the selected test.

The focused behavioral contract is recorded in the [capability specs](../../openspec/specs/scenario-authoring/spec.md); the [documentation map](../README.md) links every capability.
