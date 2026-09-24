# Project-local runners

Use the public `focused-spec/runner` contract. Do not depend on internal package modules or implementation details.

A runner must:

1. export a default `RunnerPlugin` with `apiVersion: 1`;
2. resolve every selector to exactly one stable target or one actionable error;
3. execute every target and return exactly one `pass`, `fail`, or `skip` result;
4. use executable and argument arrays with `shell: false`;
5. honor the supplied project root, working directory, options, and abort signal;
6. keep diagnostics bounded and paths deterministic.

Minimal shape:

```ts
import type { RunnerPlugin, TargetResult } from 'focused-spec/runner'

export default {
  apiVersion: 1,
  async resolve(request) {
    return {
      targets: request.selectors.map(selector => ({
        selector,
        targetId: selector,
        displayName: selector,
      })),
      errors: [],
    }
  },
  async run(request) {
    const results: TargetResult[] = []
    for (const target of request.targets) {
      // Spawn the real framework command and map its exit status.
      results.push({ targetId: target.targetId, status: 'pass' })
    }
    return { results }
  },
} satisfies RunnerPlugin
```

The example's `pass` is only a shape illustration. Production runners must execute and interpret the selected test; returning unconditional `pass` is invalid.

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
