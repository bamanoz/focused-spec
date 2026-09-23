import { spawn } from 'node:child_process'

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
  child.stdout.on('data', chunk => { output += String(chunk) })
  child.stderr.on('data', chunk => { output += String(chunk) })
  child.once('error', reject)
  child.once('close', code => resolve({ code: code ?? 1, output }))
  return promise
}
