import { spawn } from 'node:child_process'

const MAX_OUTPUT_CHARS = 16_384

export interface CommandResult {
  readonly code: number
  readonly output: string
}

export async function runCommand(command: string, args: readonly string[], cwd: string, signal: AbortSignal): Promise<CommandResult> {
  const child = spawn(command, [...args], {
    cwd,
    signal,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const { promise, resolve, reject } = Promise.withResolvers<CommandResult>()
  let output = ''
  const appendOutput = (chunk: unknown): void => {
    output += String(chunk)
    if (output.length > MAX_OUTPUT_CHARS) output = output.slice(-MAX_OUTPUT_CHARS)
  }
  child.stdout.on('data', appendOutput)
  child.stderr.on('data', appendOutput)
  child.once('error', reject)
  child.once('close', code => resolve({ code: code ?? 1, output }))
  return promise
}
