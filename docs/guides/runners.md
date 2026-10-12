# Runner plugins

Use the public [runner API contract](../reference/runner-api.md), not internal package modules or implementation details. Version 4 loads a runner through exactly one installed `package` or project-relative `module`; both implement unchanged `RunnerPlugin` API version 1. Package resolution starts from the consuming project, honors ESM import exports and never falls back to a global or downloaded package. A runner must distinguish an executed selected test from a skipped, missing, ambiguous, or unreported test; a successful framework exit alone cannot establish `pass`.

## Official runners

Official runner IDs describe only the framework: `vitest`, `pytest`, and `go`. Install and register the corresponding package independently:

Each installed official runner exposes this public guide as its `README.md`, staged from this single authored owner. Read the installed README, package manifest and declarations to discover its contract; no implementation inspection is needed. The installed core also serves selector/options guidance through a standalone `instructions --protocol 1 --topic runners --json` call.

```yaml
runners:
  vitest:
    package: '@focused-spec/runner-vitest'
  pytest:
    package: '@focused-spec/runner-pytest'
    options:
      command: uv
      commandArgs: [run, --with, pytest, python]
  go:
    package: '@focused-spec/runner-go'
```

All three accept the closed options object `{ command?: string, commandArgs?: string[] }`; invalid fields and values fail instead of silently defaulting. Vitest defaults to Node and resolves consumer-installed Vitest `^4.0.0`. Pytest defaults to `python` followed by `-m pytest`; the example retains the existing `uv run --with pytest python` prefix and supports pytest 8/9 on Python 3.10+ without an added reporter dependency. The Python reporter disables bytecode writes so execution does not modify its installed package. Go defaults to `go` followed by `test` arguments, supports Go 1.22+, and consumes real `go test -json` events. `commandArgs` is inserted after the command and before runner-controlled framework arguments. Commands are spawned without shell interpolation. The consumer owns Vitest, Python/pytest, and the Go toolchain.

| ID | Exact selector |
| --- | --- |
| `vitest` | `<project-relative-file>::<full test name>`, with nested names joined by ` > `, for example `test/a.spec.ts::outer > inner > works`; collection uses the public Vitest API and includes skipped tests |
| `pytest` | Exact collector node ID `<project-relative-file>::<class/function>[parameter-id]`; a bare parameterized parent that collects multiple cases is ambiguous |
| `go` | `<go-package>::<top-level TestName>`, for example `./auth::TestLogin`; a project-relative `.go` test file selects its containing package, preserving the authored selector; selecting a parent conservatively aggregates its subtests |

Runnable selector examples (create the corresponding ordinary framework test):

| ID | Example selector |
| --- | --- |
| `vitest` | `test/a.spec.ts::outer > inner > works` |
| `pytest` | `tests/test_auth.py::test_blocked_account` |
| `go` | `./auth::TestLogin` |

Duplicate full Vitest names within the same file are ambiguous; identical names in different files remain distinct selectors. The official runners omit `partition`, so their invocations are exclusive. They collect exact selectors and read per-test results: missing, ambiguous, skipped, failed, unexecuted, or malformed outcomes cannot become `pass` because a process exited zero.

Vitest execution selects collected public task identities in one batch, not a regex over flattened titles. Results retain both file and test identity. Distinct hierarchy paths that flatten to the same spaced name do not execute each other's tests, and literal ` > ` text in a title remains literal. All official process helpers decode stdout and stderr as UTF-8 streams, preserving multibyte characters split across output chunks.

## Custom runners

Before writing one, inspect the project's existing runner registrations and installed official packages; reuse a compatible selector contract rather than creating a second plugin. Register a custom project module only when no installed runner fits. For an agent implementing or repairing one, the package-owned [runner guidance](../../guidance/runners.md) owns the exact collection, report interpretation, and verification procedure. The project's explicit installed CLI serves it through `instructions --protocol 1 --topic runners --json`; no skill-local reference, global/downloaded CLI, or source-checkout fallback is allowed. Start with serial execution and add partitioning only after auditing shared resources.

## Optional execution groups

When a project opts into `execution.maxConcurrentGroups > 1`, a runner can implement `partition(request)` to map the **selected** targets to independently executable groups. For example, a runner may return:

```ts
{
  groups: [
    { targetIds: ['accounts'], resources: ['postgres:integration'] },
    { targetIds: ['billing'], resources: ['postgres:integration'] },
    { targetIds: ['parser'], resources: [] },
    { targetIds: ['unknown'], exclusive: true },
  ],
}
```

`accounts` and `billing` cannot overlap; `parser` can run with either; `unknown` runs alone. Each selected target must appear exactly once. The runner decides how to derive these groups and resource keys—its code, its own config, or framework metadata. No runner-specific policy format is mandated by `focused-spec`. An empty `resources` array is an explicit assertion of independence, **not** a default for unclassified tests. If safety cannot be established, declare an exclusive group or return an actionable error.

The core calls `run` separately for each group, so the plugin must execute arbitrary declared subsets and report each target's actual status. Existing plugins without `partition` keep one exclusive `run` call and need no migration. The global limit counts concurrent runner hosts, not Vitest/Jest/pytest/Go workers; tune framework worker limits separately to avoid nested oversubscription. Resource exclusion protects only groups in the same `focused-spec run`, not tests started in another process. Exact request/response and validation rules live in the [runner API reference](../reference/runner-api.md).
