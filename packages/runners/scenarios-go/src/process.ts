import { runBoundedProcess } from 'focused-spec/runner'

export const OUTPUT_LIMIT = 4_000_000

export async function execute(command: string, args: readonly string[], cwd: string, signal: AbortSignal, input = '') {
  return runBoundedProcess(command, args, {
    cwd,
    signal,
    input,
    inputLimit: OUTPUT_LIMIT,
    inputError: 'Go input exceeds 4000000 bytes',
    env: { ...process.env, GOTOOLCHAIN: 'local', GOWORK: 'off' },
    outputLimit: OUTPUT_LIMIT,
    diagnosticLimit: OUTPUT_LIMIT,
    diagnosticOverflow: true,
    outputError: () => 'Go output exceeds 4000000 bytes',
    terminateAfterCompletion: true,
  })
}
