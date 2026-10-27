import { spawn } from 'node:child_process'
import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const TRANSPORT_LIMIT = 4_000_000
const TERMINATION_GRACE_MS = 500

export interface PythonProcessResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
  readonly report?: string
}

export async function executePythonWorker(
  command: string,
  worker: string,
  request: unknown,
  cwd: string,
  signal: AbortSignal,
): Promise<PythonProcessResult> {
  signal.throwIfAborted()
  const temporary = await mkdtemp(join(tmpdir(), 'focused-spec-python-worker-'))
  const reportPath = join(temporary, 'report.json')
  const cancelPath = join(temporary, 'cancel')
  const input = JSON.stringify({ ...(request as Record<string, unknown>), cancelPath })
  if (Buffer.byteLength(input) > TRANSPORT_LIMIT) {
    await rm(temporary, { recursive: true, force: true })
    throw new Error('Python worker input exceeds 4000000 bytes')
  }
  const grouped = process.platform !== 'win32'
  const child = spawn(command, ['-B', worker, reportPath], {
    cwd,
    shell: false,
    detached: grouped,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const stdout: Buffer[] = []
  const stderr: Buffer[] = []
  let stdoutBytes = 0
  let stderrBytes = 0
  let overflow: Error | undefined
  let stdinError: Error | undefined
  let terminationTimer: NodeJS.Timeout | undefined

  const terminate = (force: boolean): void => {
    if (force && process.platform === 'win32' && child.pid !== undefined) {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false, stdio: 'ignore' })
      killer.unref()
      return
    }
    try {
      if (grouped && child.pid !== undefined) process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM')
      else child.kill(force ? 'SIGKILL' : 'SIGTERM')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
  }
  const abort = (): void => {
    void writeFile(cancelPath, 'cancelled', { flag: 'wx' }).catch(() => undefined)
    terminationTimer ??= setTimeout(() => terminate(true), TERMINATION_GRACE_MS)
    terminationTimer.unref()
  }
  const exceed = (stream: string): void => {
    overflow ??= new Error(`Python worker ${stream} exceeds 4000000 bytes`)
    terminate(true)
  }
  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBytes += chunk.length
    if (stdoutBytes <= TRANSPORT_LIMIT) stdout.push(chunk)
    else exceed('stdout')
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderrBytes += chunk.length
    if (stderrBytes <= TRANSPORT_LIMIT) stderr.push(chunk)
    else exceed('stderr')
  })
  child.stdin.on('error', error => {
    if ((error as NodeJS.ErrnoException).code !== 'EPIPE') stdinError = error
  })
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()

  try {
    const code = await new Promise<number>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', value => resolve(value ?? 1))
      child.stdin.end(input)
    })
    signal.throwIfAborted()
    if (overflow) throw overflow
    if (stdinError) throw stdinError
    let report: string | undefined
    try {
      const info = await lstat(reportPath)
      if (!info.isFile()) throw new Error('Python execution report is not a regular file')
      if (info.size > TRANSPORT_LIMIT) throw new Error('Python execution report exceeds 4000000 bytes')
      report = await readFile(reportPath, 'utf8')
      if (Buffer.byteLength(report) > TRANSPORT_LIMIT) throw new Error('Python execution report exceeds 4000000 bytes')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return {
      code,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
      ...(report === undefined ? {} : { report }),
    }
  } finally {
    signal.removeEventListener('abort', abort)
    clearTimeout(terminationTimer)
    terminate(true)
    await rm(temporary, { recursive: true, force: true })
  }
}
