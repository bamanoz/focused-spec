# Project-local runners

Use the public `focused-spec/runner` contract. Do not depend on internal package modules or implementation details.

A runner must:

1. export a default `RunnerPlugin` with `apiVersion: 1`;
2. resolve every selector to exactly one stable target or one actionable error;
3. execute every target and return exactly one `pass`, `fail`, or `skip` result;
4. use executable and argument arrays with `shell: false`;
5. honor the supplied project root, working directory, options, and abort signal;
6. keep diagnostics bounded and paths deterministic.

Build the smallest runner that can prove the chosen selector contract:

1. Start without `partition` and leave `execution.maxConcurrentGroups` at 1. Choose a framework-native selector that can identify one test; do not implement a parser for test source unless the selector contract requires one.
2. In `resolve`, use the framework's collection mechanism to reject missing or ambiguous selectors. Give the selected test a stable `targetId`.
3. In `run`, execute only the selected test and interpret its reported result. A zero exit code is insufficient if the framework also exits zero when no test matched or every test skipped. Report a missing test or unreadable report as `fail`, not `pass`.
4. Prove the boundary: the selected test passes, an unrelated failing test is not executed, a selected-test mutation fails, and a missing selector produces an actionable resolution error.

The [Go](../../examples/openspec/.focused-spec/runners/go-test.ts) and [pytest](../../examples/openspec/.focused-spec/runners/pytest.ts) examples illustrate framework-specific collection and invocation, not a production result parser: both classify by process exit code and need adaptation to detect skipped or unexecuted selected tests. Do not copy another project's source parser or resource policy. Add `partition` only after the selected tests' shared filesystem, database, ports, processes, and time-sensitive behavior have been reviewed.

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
