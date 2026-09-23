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
