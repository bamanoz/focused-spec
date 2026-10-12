# Concepts

## Focused specification

A focused specification protects the smallest product-boundary outcome that can fail independently. The owning framework's native checkable item remains the only behavioral text. `focused-spec` adds only:

- a lowercase dotted ID bound to that item;
- one or more exact evidence references in a configured YAML registry, optionally split into domain files;
- execution results from runner plugins loaded from the consuming project.

The ID is not a second requirement, and the registry must not repeat or reinterpret the behavior.

## Native items and bindings

Version 4 discovers documents through explicit layouts and parses each with its explicitly registered format adapter. Core records a native item's normalized structural name and location; it does not infer a format from an extension, infer requirements from prose, or require a particular source framework. The core package has no built-in Markdown or Gherkin parser.

The official Markdown adapter binds an ID with `<!-- focused-spec:id=<id> -->` immediately before one heading, paragraph, or list item. A paragraph or list item may instead end with the marker inline. The marker must resolve to exactly that adjacent item.

The official Gherkin adapter binds an ID with `@focused.<id>` on one `Scenario` or `Scenario Outline`. Focused tags on `Feature`, `Rule`, `Background`, or `Examples` are invalid because those structures do not identify one executable scenario.

When a document is generated or cannot preserve either marker, the registry may bind an explicit host-owned native ID:

```yaml
scopes:
  current:
    order.limit.reject-at-capacity:
      source:
        path: generated/SPEC.md
        nativeId: CAP-1
      evidence:
        - pytest::tests/test_order_limit.py::test_order_at_limit_rejects_another_item
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

## Plugin boundaries

Format API version 1 normalizes native items and diagnostics; core retains ownership of discovery, path, scope, identity validation and evidence binding. A project registers every format under `specifications.formats` and selects one on each document layout. Official Markdown and Gherkin adapters are independently installed packages, not implicit core behavior.

Runner API version 1 is unchanged. Core does not know Vitest, pytest, Go, or another test framework. A project registers a package or project-contained runner module in `.focused-spec/config.yaml`; the CLI asks each plugin to resolve opaque selectors and execute only the resolved targets. The official `vitest`, `pytest`, and `go` runners are separate packages, while framework installations remain consumer-owned.

Plugins are trusted project code executed in bounded isolated hosts, not security sandboxes. They must use safe process invocation, bounded diagnostics, deterministic identities and real framework results. A runner must never return `pass` without executing the selected test; invalid format output must never become a bound native item.

The focused behavioral contract is recorded in the [capability specs](../../openspec/specs/scenario-authoring/spec.md); the [documentation map](../README.md) links every capability.
