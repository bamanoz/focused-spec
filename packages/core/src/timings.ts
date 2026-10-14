interface OperationTiming {
  readonly startedMs: number
  readonly durationMs: number
  readonly outcome: 'completed' | 'error'
}

type RunnerOperation =
  | { readonly runnerId: string; readonly operation: 'resolve'; readonly selectorCount: number }
  | { readonly runnerId: string; readonly operation: 'partition' | 'run'; readonly targetCount: number }

interface FormatOperation {
  readonly formatId: string
  readonly path: string
  readonly scope: string
  readonly coldStart: boolean
}

type RunnerOperationTiming = RunnerOperation & OperationTiming
type FormatOperationTiming = FormatOperation & OperationTiming

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export class OperationTimings {
  private readonly runners: RunnerOperationTiming[] = []
  private readonly formats: FormatOperationTiming[] = []

  constructor(private readonly origin: number) {}

  private async measure<T, Identity extends object>(
    rows: (Identity & OperationTiming)[],
    identity: Identity,
    operation: () => Promise<T>,
  ): Promise<T> {
    const started = performance.now()
    let outcome: OperationTiming['outcome'] = 'error'
    try {
      const result = await operation()
      outcome = 'completed'
      return result
    } finally {
      rows.push({ ...identity, startedMs: Math.max(0, started - this.origin), durationMs: Math.max(0, performance.now() - started), outcome })
    }
  }

  runner<T>(identity: RunnerOperation, operation: () => Promise<T>): Promise<T> {
    return this.measure(this.runners, identity, operation)
  }

  format<T>(identity: FormatOperation, operation: () => Promise<T>): Promise<T> {
    return this.measure(this.formats, identity, operation)
  }

  snapshot(): { readonly runnerOperations: readonly RunnerOperationTiming[]; readonly formatOperations: readonly FormatOperationTiming[] } {
    return {
      runnerOperations: [...this.runners].sort((left, right) => left.startedMs - right.startedMs
        || compareText(left.runnerId, right.runnerId) || compareText(left.operation, right.operation)),
      formatOperations: [...this.formats].sort((left, right) => left.startedMs - right.startedMs
        || compareText(left.formatId, right.formatId) || compareText(left.path, right.path) || compareText(left.scope, right.scope)),
    }
  }
}
