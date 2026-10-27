import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

export const OUTPUT_LIMIT = 4_000_000

export interface ExecuteOptions {
  readonly cwd: string
  readonly signal: AbortSignal
  readonly input?: string
  readonly environment?: NodeJS.ProcessEnv
  readonly cancellationPath?: string
}

export async function execute(command: string, args: readonly string[], options: ExecuteOptions): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> {
  options.signal.throwIfAborted()
  const input = options.input ?? ''
  if (Buffer.byteLength(input) > OUTPUT_LIMIT) throw new Error('.NET process input exceeds 4000000 bytes')
  const grouped = process.platform !== 'win32'
  const child = spawn(command, args, {
    cwd: options.cwd,
    shell: false,
    detached: grouped,
    env: options.environment ?? process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const stdout: Buffer[] = []
  const stderr: Buffer[] = []
  let stdoutBytes = 0
  let stderrBytes = 0
  let overflow: string | undefined
  let timer: NodeJS.Timeout | undefined
  let forceCompletion: Promise<void> | undefined
  let settled = false
  let abortRequested = false
  const force = (): void => {
    try {
      if (process.platform === 'win32' && child.pid !== undefined) {
        if (forceCompletion === undefined) {
          const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { shell: false, stdio: 'ignore', windowsHide: true })
          const completion = Promise.withResolvers<void>()
          forceCompletion = completion.promise
          killer.once('error', () => completion.resolve())
          killer.once('close', () => completion.resolve())
        }
      } else if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL')
      else child.kill('SIGKILL')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
  }
  const terminate = (): void => {
    try {
      if (grouped && child.pid !== undefined) process.kill(-child.pid, 'SIGTERM')
      else child.kill('SIGTERM')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
  }
  const abort = (): void => {
    abortRequested = true
    if (options.cancellationPath) {
      try { writeFileSync(options.cancellationPath, 'cancelled', { flag: 'wx' }) } catch { /* hard termination remains the bounded fallback */ }
    }
    else terminate()
    timer ??= setTimeout(force, 500)
    timer.unref()
  }
  const fail = (message: string): void => {
    overflow ??= message
    force()
  }
  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBytes += chunk.length
    if (stdoutBytes <= OUTPUT_LIMIT) stdout.push(chunk)
    else fail('.NET process stdout exceeds 4000000 bytes')
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderrBytes += chunk.length
    if (stderrBytes <= OUTPUT_LIMIT) stderr.push(chunk)
    else fail('.NET process stderr exceeds 4000000 bytes')
  })
  child.stdin.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE') force() })
  options.signal.addEventListener('abort', abort, { once: true })
  if (options.signal.aborted) abort()
  try {
    const completion = Promise.withResolvers<number>()
    child.once('error', completion.reject)
    child.once('close', value => completion.resolve(value ?? 1))
    child.stdin.end(input)
    const code = await completion.promise
    settled = true
    options.signal.throwIfAborted()
    if (overflow) throw new Error(overflow)
    return { code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }
  } finally {
    options.signal.removeEventListener('abort', abort)
    clearTimeout(timer)
    if (abortRequested || process.platform !== 'win32' || !settled) force()
    await forceCompletion
  }
}
