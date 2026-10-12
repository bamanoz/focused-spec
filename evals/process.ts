import { spawn } from 'node:child_process'

export interface ProcessResult {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
  readonly durationMs: number
}

export class ProcessFailureError extends Error {
  readonly stdout: string
  readonly stderr: string
  readonly durationMs: number

  constructor(message: string, stdout: string, stderr: string, durationMs: number) {
    super(message)
    this.stdout = stdout
    this.stderr = stderr
    this.durationMs = durationMs
  }
}

export async function runProcess(command: string, args: readonly string[], options: {
  readonly cwd: string
  readonly timeoutMs: number
  readonly env?: NodeJS.ProcessEnv
}): Promise<ProcessResult> {
  const started = Date.now()
  const child = spawn(command, [...args], {
    cwd: options.cwd, env: options.env ?? process.env, shell: false,
    detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const { promise, resolve, reject } = Promise.withResolvers<ProcessResult>()
  let stdout = ''
  let stderr = ''
  let timedOut = false
  let outputExceeded = false
  let exited = false
  let settled = false
  let closed = false
  let code: number | null = null
  let drain: ReturnType<typeof setTimeout> | undefined
  const finish = () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    if (drain !== undefined) clearTimeout(drain)
    child.stdout.destroy()
    child.stderr.destroy()
    if (timedOut || outputExceeded) {
      const reason = timedOut ? `timed out after ${options.timeoutMs}ms` : 'exceeded the output capture limit'
      reject(new ProcessFailureError(`${command} ${reason}`, stdout, stderr, Date.now() - started))
    } else resolve({ code, stdout, stderr, durationMs: Date.now() - started })
  }
  const terminate = () => {
    if (child.pid === undefined) return
    if (process.platform !== 'win32') {
      try { process.kill(-child.pid, 'SIGKILL') } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') child.kill('SIGKILL')
      }
    } else {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' })
      const bound = setTimeout(() => { killer.kill(); child.kill('SIGKILL') }, 2_000)
      killer.once('error', () => { clearTimeout(bound); child.kill('SIGKILL') })
      killer.once('exit', () => { clearTimeout(bound); if (!exited) child.kill('SIGKILL') })
    }
  }
  const timer = setTimeout(() => {
    timedOut = true
    terminate()
    if (exited) drain = setTimeout(finish, 250)
  }, options.timeoutMs)
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    if (stdout.length + chunk.length > 67_108_864) {
      stdout = (stdout + chunk).slice(0, 67_108_864)
      outputExceeded = true
      terminate()
    } else stdout += chunk
  })
  child.stderr.on('data', (chunk: string) => {
    if (stderr.length + chunk.length > 67_108_864) {
      stderr = (stderr + chunk).slice(0, 67_108_864)
      outputExceeded = true
      terminate()
    } else stderr += chunk
  })
  child.once('error', error => { clearTimeout(timer); reject(error) })
  child.once('exit', value => {
    exited = true
    code = value
    // A descendant can retain the pipes after its parent exits.
    terminate()
    if (!closed) drain = setTimeout(finish, 250)
  })
  child.once('close', value => { closed = true; code = value; finish() })
  return promise
}
