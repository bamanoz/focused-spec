# Tasks

## 1. Shared Process Lifecycle

- [ ] 1.1 Implement a shared bounded subprocess helper with UTF-8 stream decoding, configurable output/diagnostic limits and environment, abort handling, and POSIX process-group plus Windows process-tree termination; verify spawned child-and-grandchild fixtures terminate after abort and overflow on both supported CI platforms.
- [x] 1.2 Migrate Go, Vitest, pytest, and in-scope scenario/catalog process consumers to the shared helper, preserving caller behavior and limits; verify existing split-UTF-8 tests and the exact abort-tree regressions pass, and confirm copied implementations are removed.

## 2. Runner Correctness

- [x] 2.1 Update pytest reporting to derive selected outcomes reliably with xdist enabled through project addopts; verify a selected pass reports pass alongside an unselected failing sentinel and that missing or unreported tests remain nonpassing.
- [x] 2.2 Batch Go selector discovery once per validated package and preserve exact-one cardinality; verify mixed unique, missing, duplicate/ambiguous selectors across multiple packages and one discovery invocation per package.
- [x] 2.3 Repair .NET bridge build isolation without overriding user NuGet configuration or leaving consumer assets tied to temporary paths; verify a restored Humanizer.Core 2.14.1 consumer can successfully run `dotnet build --no-restore` after bridge execution and temporary cleanup.

## 3. Package and Resolution Compatibility

- [x] 3.1 Restrict the Roslyn helper build to required English resources; verify the packed archive omits localized satellite assemblies and the static C# parser still returns exact IDs and locations for supported fixtures.
- [x] 3.2 Evaluate stable package-resolution APIs on Node.js 22.16.0 and current Node for consumer-local workspace packages and import-only public subpaths; implement the proven option and remove the experimental resolver flag only if those tests pass, otherwise preserve behavior and document the concrete runtime blocker.
- [x] 3.3 Verify packed core and affected adapter packages expose the shared helper to intended in-scope consumers without adding package dependencies or changing Runner API 1; exercise a disposable consumer package resolution and runner invocation.

## Observed acceptance and remaining platform gate

After restoring the native parser with `npm run build:dotnet` following the portable-only build, the complete working scope reported 14 PASS, 0 FAIL/SKIP/ERROR across 21 exact targets on Node.js 22.16.0. A further Node 22 run of the consumer-local plugin/doc suites passed 21 tests. Existing current-runtime package checks and local consumer execution are recorded separately.

Task 1.1 remains unchecked: actual child/grandchild abort/overflow behavior passed on POSIX, but no Windows runtime or configured SSH verification host is available; the local Docker daemon is Linux ARM64. Windows process-tree acceptance is not inferred from POSIX results, simulated taskkill calls, source inspection or green scope totals. This change must remain active until that required observation or an explicit user decision resolves the gate.

User decision on 2026-11-02: defer Windows verification for now. Do not provision a Windows VM or set up a verification host under the current task. This is a deferral, not evidence of Windows correctness or removal of the requirement; task 1.1 stays unchecked and this change stays active.
