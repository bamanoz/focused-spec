## Context

The portable skill and seven host evals exercise an evidence-only registry with editable-item markers, Gherkin tags, and external generated-item native IDs. The published CLI currently parses only four-hash Markdown Scenario blocks and inline metadata, which can duplicate native behavior.

## Goals / Non-Goals

Goals: one native behavior source; exact evidence per scope/ID; unique structural binding; production CLI execution; complete clean migration; honest native validity and coverage.

Non-goals: interpreting behavior prose, replacing host validators/generators, inferred ancestry, inherited evidence, backwards-compatible inline parsing, changing runner IPC, or changing protected eval results and host workflows.

## Decisions

1. Use config version 3, retaining explicit fixed/captured scope layouts and runner/execution configuration. Native documents may be Markdown or Gherkin. Read a required fixed `.focused-spec/evidence.yaml` containing only scope-local ID mappings, evidence arrays, and optional `{path,nativeId}` source bindings.
2. Use CommonMark AST boundaries for editable headings, paragraphs, and list items; comments bind adjacent individual items, never containers or code examples. Use the official Gherkin AST for Scenario/Scenario Outline tags, excluding inherited Feature/Rule/Examples tags. Marker grammar is the evaluated lowercase dotted ID.
3. Resolve external bindings against explicit native ID declarations such as a leading bold/code ID in a native list item or explicit heading anchor, not arbitrary text mentions, headings, line numbers, or behavior matching. Generated sources remain unmarked. All documents and bindings remain project-relative and symlink-safe.
4. Keep runner plans and result terminology stable, but simplify bound Scenario to one `id` and evidence array; delete old malformed-row/cardinality bookkeeping. Syntax-only checks registry and native bindings without loading runner modules. Selected scope/scenario checks ignore unrelated entries except global registry syntax/root-shape errors.
5. Do not count all unmarked native behavior: arbitrary host documents have no universal checkable-item count. Report registered items and actual evidence results, never guessed native coverage or host validity.
6. Promote evals to actual installed CLI validation/execution while preserving blind task prompts, protected product/tests, host prerequisites, fresh apply/sync checkpoints, regenerated BMad source constraints, and controlled sensitivity. Registry snapshots preserve evidence across publication; final items still require explicit own evidence.

## Risks / Trade-offs

- This is a breaking config/public-parser/model transition; owning docs provide a clean migration, not aliases.
- Native syntax is structurally parsed, not semantically validated. Missing host validators stay unverified in evals.
- Markdown item boundaries are syntactic and explicit; detached/ambiguous metadata fails rather than guessing author intent.
