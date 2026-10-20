import { spawn } from 'node:child_process'

export const OUTPUT_LIMIT = 4_000_000

export async function execute(command: string, args: readonly string[], cwd: string, signal: AbortSignal, input = '') {
  signal.throwIfAborted()
  if (Buffer.byteLength(input) > OUTPUT_LIMIT) throw new Error('Go input exceeds 4000000 bytes')
  const grouped = process.platform !== 'win32'
  const child = spawn(command, args, { cwd, shell: false, detached: grouped, env: { ...process.env, GOTOOLCHAIN: 'local', GOWORK: 'off' }, stdio: ['pipe', 'pipe', 'pipe'] })
  const stdout: Buffer[] = []
  const stderr: Buffer[] = []
  let outBytes = 0
  let errBytes = 0
  let overflow = false
  let timer: NodeJS.Timeout | undefined
  const kill = (signal: NodeJS.Signals) => {
    try {
      if (grouped && child.pid !== undefined) process.kill(-child.pid, signal)
      else child.kill(signal)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
  }
  const abort = () => {
    kill('SIGTERM')
    timer = setTimeout(() => kill('SIGKILL'), 500)
    timer.unref()
  }
  child.stdout.on('data', (chunk: Buffer) => {
    outBytes += chunk.length
    if (outBytes <= OUTPUT_LIMIT) stdout.push(chunk)
    else { overflow = true; kill('SIGKILL') }
  })
  child.stderr.on('data', (chunk: Buffer) => {
    errBytes += chunk.length
    if (errBytes <= OUTPUT_LIMIT) stderr.push(chunk)
    else { overflow = true; kill('SIGKILL') }
  })
  child.stdin.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE') kill('SIGKILL') })
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  try {
    const code = await new Promise<number>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', code => resolve(code ?? 1))
      child.stdin.end(input)
    })
    signal.throwIfAborted()
    if (overflow) throw new Error('Go output exceeds 4000000 bytes')
    return { code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }
  } finally {
    signal.removeEventListener('abort', abort)
    clearTimeout(timer)
    // End descendants too: an application may have closed its pipes before exiting.
    kill('SIGKILL')
  }
}
