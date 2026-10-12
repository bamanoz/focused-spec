import { spawn } from 'node:child_process'

const OUTPUT_LIMIT = 4_000_000
const DIAGNOSTIC_LIMIT = 8_000

export interface ProcessResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

function appendBounded(current: string, chunk: Buffer, limit: number): { text: string; overflow: boolean } {
  const next = current + chunk.toString('utf8')
  return next.length <= limit
    ? { text: next, overflow: false }
    : { text: next.slice(next.length - limit), overflow: true }
}

export async function runProcess(command: string, args: readonly string[], cwd: string, signal: AbortSignal): Promise<ProcessResult> {
  signal.throwIfAborted()
  const child = spawn(command, args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  let overflow = false
  let killTimer: NodeJS.Timeout | undefined
  let aborting = false
  const abort = (): void => {
    if (aborting) return
    aborting = true
    child.kill()
    killTimer = setTimeout(() => child.kill('SIGKILL'), 500)
    killTimer.unref()
  }
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  child.stdout.on('data', (chunk: Buffer) => {
    const appended = appendBounded(stdout, chunk, OUTPUT_LIMIT)
    stdout = appended.text
    if (appended.overflow) {
      overflow = true
      child.kill('SIGKILL')
    }
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = appendBounded(stderr, chunk, DIAGNOSTIC_LIMIT).text
  })
  let result: ProcessResult
  try {
    result = await new Promise<ProcessResult>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', code => resolve({ code: code ?? 1, stdout, stderr }))
    })
  } finally {
    signal.removeEventListener('abort', abort)
    clearTimeout(killTimer)
  }
  signal.throwIfAborted()
  if (overflow) throw new Error('go test output exceeded 4000000 bytes')
  return result
}
