# Design

## Context

See [proposal.md](./proposal.md). Before this change, the Go, Vitest, and pytest process helpers duplicated bounded UTF-8 capture and signalled only the direct child. Other runner/format helpers implemented group termination independently. .NET bridge compilation inherited a temporary `DOTNET_CLI_HOME`; pytest reporter collection depended on controller-side `session.items`; Go resolve invoked `go test -list` once per selector. Core package resolution used experimental parent-aware `import.meta.resolve`; task 3.2 replaces that implementation with a consumer-cwd eval. Existing contracts require exact selectors/results, bounded subprocesses, consumer-local resolution, and the supported Node.js floor of 22.16.0.

## Goals / Non-Goals

**Goals:** Share bounded process management and terminate complete owned process trees cross-platform; preserve exact runner outcomes and consumer restore state; reduce redundant Go discovery and .NET package resources; retain consumer-local ESM resolution without experimental caller flags.

**Non-Goals:** Change Runner API 1, selector grammar, test-framework dependency ownership, runner parallelism policy, evidence semantics, .NET package publication/install instructions, or source-only installation documentation. No OpenSpec or Spec Kit integration.

## Decisions

1. Add one shared process helper for the process consumers in scope, likely under core's existing public `./runner` subpath. It must preserve UTF-8 decoding, bounded output/diagnostics, custom environment support, abort handling, and operation-specific limits/messages. On POSIX spawn a detached process group and signal the group; on Windows terminate the owned process tree using a platform-native mechanism (for example `taskkill /T /F`) with bounded escalation. Handle already-exited processes and missing PIDs without masking the original abort/overflow result. Migrate in-scope runner and format helper call sites and remove copied implementations. The actual export shape and Windows mechanism must be checked against the current runtime/tooling before implementation; do not silently fall back to direct-child-only termination.
2. Keep each framework's selected-target interpretation unchanged. On pytest, do not rely on controller `session.items` when xdist owns workers: use the reporter's real per-test reports or explicitly disable xdist for the runner invocation in a documented way. Prefer consuming actual nodeid reports so framework configuration remains effective. Preserve missing/unreported outcomes as nonpassing.
3. Group Go selectors by validated package path before resolution. For each package, invoke one `go test -list` with an anchored alternation of escaped valid Test names, then verify each requested name appears exactly once. Keep per-selector errors and avoid converting a package-level discovery error into a target.
4. Build the .NET bridge without relocating `DOTNET_CLI_HOME`. Use environment switches already present to suppress first-run banners/telemetry, or another approach proven not to rewrite consumer `obj/project.assets.json` to a deleted cache. Preserve user NuGet.Config and global package cache, including private source configuration.
5. Add `<SatelliteResourceLanguages>en</SatelliteResourceLanguages>` to the project that builds the Roslyn-backed static parser helper, after confirming its produced assembly/resource needs. Verify the packed archive omits localized satellites and still parses the supported C# grammar.
6. Resolve packages with stable one-argument `import.meta.resolve` inside `node --input-type=module --eval`, setting `cwd` to the selected consumer. The eval imports the existing emitted/source resolver by its absolute file URL and supplies its own native resolver callback; the helper retains `findPackageJSON` manifest provenance without importing plugin code. Two-argument stable `import.meta.resolve` ignores the parent on Node 22.16.0 and 26.8.1, while consumer-anchored `createRequire.resolve` rejects import-only exports. Parent experiments observed the cwd-eval alternative select the local import-only package on both runtimes. Core format/runner hosts await this resolver; the independently installed registry adapter uses the same cwd-eval primitive for its nested parser, without a new core API or dependency. Source execution enables type stripping only where the runtime requires it. No compatibility flag, require-condition fallback, global lookup or downloaded fallback remains; the complete regression must still be rerun on both runtimes after integration.
7. Add focused regression coverage at the consumer-observable boundary. Keep source edits and behavioral assertions rather than pinning internals. New native scenarios are intended for existing capabilities only; enrollment occurs during apply after code exists and exact selectors are confirmed.

## Exact evidence

| Native ID | Exact evidence |
| --- | --- |
| `runner.official.vitest` | `vitest::test/official-runners.spec.ts::official framework runners > reports exact Vitest outcomes` |
| `runner.official.pytest` | `vitest::test/official-runners.spec.ts::official framework runners > reports exact pytest outcomes` |
| `runner.official.go` | `vitest::test/official-runners.spec.ts::official framework runners > reports exact Go outcomes` |
| `runner.official.process-tree-cancel` | AND-set of the six selectors below; the fixture creates a child/grandchild tree and verifies bounded termination on abort and output overflow. Run the set on POSIX and Windows CI; local POSIX observations do not certify Windows. |
| `runner.official.go-discovery-batch` | `vitest::test/runner-lifecycle-go.spec.ts::Go runner lifecycle > batches discovery by package and preserves exact selector cardinality` AND `vitest::test/runner-lifecycle-go.spec.ts::Go runner lifecycle > rejects ambiguous discovery and package failures without losing unique selectors`; consumer discovery outcomes and wrapper calls establish batching and exact-one cardinality. |
| `runner.official.pytest-xdist` | `vitest::test/runner-lifecycle-python.spec.ts::pytest runner lifecycle > reports selected outcomes with xdist addopts and leaves an unselected failing test unrun`; requires pytest-xdist in the selected test environment. |
| `dotnet-runner.nuget-state-preserved` | `vitest::test/dotnet-native-plugins.spec.ts::dotnet native plugins > preserves restored consumer NuGet assets after bridge execution`; the Humanizer.Core 2.14.1 consumer preserves configuration/package folders, removes bridge files and builds with `--no-restore`. |
| `distribution.adapters.independent` | `vitest::test/package.spec.ts::package distribution > installs independent core and adapter packages` |
| `distribution.adapters.inline-registry` | `vitest::test/package.spec.ts::package distribution > executes independently packed inline and registry formats` |
| `distribution.adapters.roslyn-resources` | `vitest::test/dotnet-native-plugins.spec.ts::dotnet native plugins > omits localized Roslyn satellites while retaining static C# discovery`; the packed archive omits localized resources and the static parser returns exact IDs/locations. |
| `plugin.package.consumer-local` | `vitest::test/plugins.spec.ts::plugin architecture > resolves an import-only consumer package subpath` |
| `plugin.package.stable-resolver` | `vitest::test/plugins.spec.ts::plugin architecture > resolves an import-only consumer package subpath` AND `vitest::test/plugin-docs.spec.ts::plugin documentation CLI > reads configured plugins using consumer import conditions` AND `vitest::test/plugin-docs.spec.ts::plugin documentation CLI > reads the declared document from a symlinked package`; rerun under Node 22.16.0 and current Node without resolver flags. The disposable workspace covers package root and import-only subpaths, direct/nested format and runner execution, source TypeScript, missing/non-exported rejection, and code-free manifest/document provenance. |

The exact process-tree AND-set is:

```text
vitest::test/runner-lifecycle.spec.ts::runner process lifecycle > terminates the Vitest child and grandchild on abort
vitest::test/runner-lifecycle.spec.ts::runner process lifecycle > terminates the Vitest child and grandchild on overflow
vitest::test/runner-lifecycle.spec.ts::runner process lifecycle > terminates the pytest child and grandchild on abort
vitest::test/runner-lifecycle.spec.ts::runner process lifecycle > terminates the pytest child and grandchild on overflow
vitest::test/runner-lifecycle.spec.ts::runner process lifecycle > terminates the Go child and grandchild on abort
vitest::test/runner-lifecycle.spec.ts::runner process lifecycle > terminates the Go child and grandchild on overflow
```

Shared helper compatibility also exercises `vitest::test/runner-lifecycle.spec.ts::runner process lifecycle > preserves split UTF-8 and bounds head and tail diagnostics at code-point boundaries` and `vitest::test/runner-lifecycle.spec.ts::runner process lifecycle > counts split multibyte bytes toward overflow before decoding finishes`, alongside the existing `vitest::test/official-runners.spec.ts::official framework runners > preserves split UTF-8 stdout and stderr in the <Vitest|pytest|Go> process helper` selectors. Enrollment covers all unchanged scenarios present in the lifecycle deltas as independent scope/ID occurrences; parent integration owns the distribution and .NET registries. Windows verification remains unobserved locally, so task 1.1 cannot be completed from POSIX results alone.

## Risks / Trade-offs

- Windows tree termination differs from POSIX process groups and must be exercised on Windows; process ownership must not accidentally terminate unrelated processes.
- Shared helper consolidation can change output limits, error wording, or environment defaults if those are not preserved deliberately.
- Disabling xdist could surprise consumers and hide concurrency-related behavior; consuming worker reports better preserves configured execution but must represent setup/collection failures correctly.
- Go test names are grammar-constrained, but regex construction still needs explicit escaping and package-level failures need per-selector diagnostics.
- Bridge builds can alter shared NuGet assets even without a temporary home; the acceptance reproduction must prove post-run consumer build success and preserve user configuration.
- Restricting satellite resources must not remove compiler resources required by the parser runtime.
- The cwd-eval primitive was observed on Node 22.16.0 and 26.8.1, but final integrated workspace/import-only and documentation regressions still need both runtimes. Failed resolution must remain a failure rather than trying CommonJS conditions or another installation.
