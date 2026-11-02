import { writeFileSync } from 'node:fs'
import { runBoundedProcess } from 'focused-spec/runner'

export const OUTPUT_LIMIT = 4_000_000

export interface ExecuteOptions {
  readonly cwd: string
  readonly signal: AbortSignal
  readonly input?: string
  readonly environment?: NodeJS.ProcessEnv
  readonly cancellationPath?: string
}

export async function execute(command: string, args: readonly string[], options: ExecuteOptions): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> {
  return runBoundedProcess(command, args, {
    cwd: options.cwd,
    signal: options.signal,
    env: options.environment,
    input: options.input ?? '',
    inputLimit: OUTPUT_LIMIT,
    inputError: '.NET process input exceeds 4000000 bytes',
    outputLimit: OUTPUT_LIMIT,
    diagnosticLimit: OUTPUT_LIMIT,
    diagnosticOverflow: true,
    outputError: stream => `.NET process ${stream} exceeds 4000000 bytes`,
    onAbort: options.cancellationPath === undefined ? undefined : () => {
      try { writeFileSync(options.cancellationPath!, 'cancelled', { flag: 'wx' }) } catch { /* force termination remains the bounded fallback */ }
    },
    terminateOnAbort: options.cancellationPath === undefined,
    terminateAfterCompletion: true,
  })
}
