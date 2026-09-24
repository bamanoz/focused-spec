import { spawn } from 'node:child_process'

const OUTPUT_LIMIT = 32 * 1024
const TRUNCATION_NOTICE = '\n... command output truncated'

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
  const capture = (chunk: unknown): void => {
    const text = String(chunk)
    const available = OUTPUT_LIMIT - output.length
    if (available <= 0) {
      truncated = true
      return
    }
    output += text.slice(0, available)
    truncated ||= text.length > available
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
