import { spawn } from 'node:child_process'

export interface ProcessResult {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
  readonly durationMs: number
}

export async function runProcess(
  command: string,
  args: readonly string[],
  options: {
    readonly cwd: string
    readonly timeoutMs: number
    readonly env?: NodeJS.ProcessEnv
  },
): Promise<ProcessResult> {
  const started = Date.now()
  const child = spawn(command, [...args], {
    cwd: options.cwd,
    env: options.env ?? process.env,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const { promise, resolve, reject } = Promise.withResolvers<ProcessResult>()
  let stdout = ''
  let stderr = ''
  const timer = setTimeout(() => {
    child.kill('SIGKILL')
    reject(new Error(`${command} timed out after ${options.timeoutMs}ms`))
  }, options.timeoutMs)
  child.stdout.on('data', chunk => { stdout += String(chunk) })
  child.stderr.on('data', chunk => { stderr += String(chunk) })
  child.once('error', error => {
    clearTimeout(timer)
    reject(error)
  })
  child.once('close', code => {
    clearTimeout(timer)
    resolve({ code, stdout, stderr, durationMs: Date.now() - started })
  })
  return promise
}
