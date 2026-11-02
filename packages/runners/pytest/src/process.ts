import { runBoundedProcess, type BoundedProcessResult } from 'focused-spec/runner'

const OUTPUT_LIMIT = 2_000_000
const DIAGNOSTIC_LIMIT = 8_000

export type ProcessResult = BoundedProcessResult

export function runProcess(
  command: string,
  args: readonly string[],
  cwd: string,
  signal: AbortSignal,
  env?: NodeJS.ProcessEnv,
): Promise<ProcessResult> {
  return runBoundedProcess(command, args, {
    cwd,
    signal,
    env,
    outputLimit: OUTPUT_LIMIT,
    diagnosticLimit: DIAGNOSTIC_LIMIT,
    outputError: () => 'pytest process output exceeded 2000000 bytes',
  })
}
