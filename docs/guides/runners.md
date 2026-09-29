# Project-local runners

Use the public [runner API contract](../reference/runner-api.md), not internal package modules or implementation details. It defines `RunnerPlugin`, selector resolution, target results, request context, and optional partitioning. A runner is project-local and must distinguish an executed selected test from a skipped, missing, or unreported test; a successful framework process exit alone may not establish `pass`.

For an agent implementing or repairing a runner, the [bundled runner workflow](../../skills/focused-spec/references/runners.md) owns the exact selector, collection, report-interpretation, and verification steps. It ships with the skill and needs no access to this repository's docs. Start with serial execution; only add partitioning after auditing shared resources.

The [Go](../../examples/openspec/.focused-spec/runners/go-test.ts) and [pytest](../../examples/openspec/.focused-spec/runners/pytest.ts) examples illustrate framework-specific collection and invocation, not a production result parser: both classify by process exit code and need adaptation to detect skipped or unexecuted selected tests. Do not copy another project's source parser or resource policy.

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
