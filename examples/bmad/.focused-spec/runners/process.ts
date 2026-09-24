import { spawn } from 'node:child_process'

const MAX_OUTPUT_LENGTH = 16_000
const TRUNCATION_NOTICE = '\n[diagnostic output truncated]'

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
  let truncated = false
  const capture = (chunk: unknown) => {
    if (output.length >= MAX_OUTPUT_LENGTH) {
      truncated = true
      return
    }
    const text = String(chunk)
    const remaining = MAX_OUTPUT_LENGTH - output.length
    output += text.slice(0, remaining)
    truncated ||= text.length > remaining
  }
  child.stdout.on('data', capture)
  child.stderr.on('data', capture)
  child.once('error', reject)
  child.once('close', code => resolve({
    code: code ?? 1,
    output: truncated ? `${output}${TRUNCATION_NOTICE}` : output,
  }))
  return promise
}
