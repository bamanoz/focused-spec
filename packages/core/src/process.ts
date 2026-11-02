import { spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'

export interface BoundedProcessOptions {
  readonly cwd: string
  readonly signal?: AbortSignal | undefined
  readonly env?: Readonly<Record<string, string | undefined>> | undefined
  readonly input?: string
  readonly inputLimit?: number
  readonly outputLimit: number
  readonly diagnosticLimit: number
  readonly inputError?: string
  readonly outputError?: (stream: 'stdout' | 'stderr') => string
  readonly diagnosticOverflow?: boolean
  readonly capture?: 'head' | 'tail'
  readonly onAbort?: (() => void) | undefined
  readonly terminationGraceMs?: number
  readonly terminateOnAbort?: boolean
  readonly terminateAfterCompletion?: boolean
}

export interface BoundedProcessResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

function appendBounded(current: string, chunk: string, limit: number, capture: 'head' | 'tail'): string {
  const next = current + chunk
  if (Buffer.byteLength(next, 'utf8') <= limit) return next
  const bytes = Buffer.from(next, 'utf8')
  if (capture === 'head') {
    let end = limit
    while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--
    return bytes.subarray(0, end).toString('utf8')
  }
  let start = bytes.byteLength - limit
  while (start < bytes.byteLength && (bytes[start]! & 0xc0) === 0x80) start++
  return bytes.subarray(start).toString('utf8')
}

export async function terminateProcessTree(pid: number | undefined, force: boolean): Promise<void> {
  if (pid === undefined) return
  if (process.platform === 'win32') {
    // Keep the root alive during the grace period so taskkill can walk the full tree.
    if (!force) return
    const completion = Promise.withResolvers<void>()
    const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      shell: false, stdio: 'ignore', windowsHide: true, timeout: 2_000,
    })
    killer.once('error', () => completion.resolve())
    killer.once('close', () => completion.resolve())
    await completion.promise
    return
  }
  try {
    process.kill(-pid, force ? 'SIGKILL' : 'SIGTERM')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    if (code !== 'ESRCH' && code !== 'EPERM') throw error
  }
}

export async function runBoundedProcess(
  command: string,
  args: readonly string[],
  options: BoundedProcessOptions,
): Promise<BoundedProcessResult> {
  const signal = options.signal
  signal?.throwIfAborted()
  const input = options.input
  if (input !== undefined && options.inputLimit !== undefined && Buffer.byteLength(input) > options.inputLimit) {
    throw new Error(options.inputError ?? `process input exceeds ${options.inputLimit} bytes`)
  }
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    detached: process.platform !== 'win32',
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let stdout = ''
  let stderr = ''
  let stdoutBytes = 0
  let stderrBytes = 0
  let stdoutOverflow = false
  let stderrOverflow = false
  let stdoutHeadComplete = false
  let stderrHeadComplete = false
  let stdinError: Error | undefined
  let aborting = false
  let terminationTimer: NodeJS.Timeout | undefined
  let forced: Promise<void> | undefined
  const completion = Promise.withResolvers<number>()
  child.once('error', completion.reject)
  child.once('close', code => completion.resolve(code ?? 1))
  if (options.terminateAfterCompletion === true) {
    child.once('exit', () => {
      void terminateProcessTree(child.pid, true).catch(() => undefined)
    })
  }
  const force = (): Promise<void> => {
    forced ??= terminateProcessTree(child.pid, true).finally(() => {
      // A descendant with inherited pipes must not hold cancellation open forever.
      child.stdout?.destroy()
      child.stderr?.destroy()
      child.stdin?.destroy()
      child.unref()
      completion.resolve(1)
    })
    return forced
  }
  const abort = (): void => {
    if (aborting) return
    aborting = true
    try { options.onAbort?.() } catch { /* preserve the original abort result */ }
    if (options.terminateOnAbort !== false && process.platform !== 'win32') {
      void terminateProcessTree(child.pid, false).catch(() => undefined)
    }
    terminationTimer = setTimeout(() => { void force().catch(() => undefined) }, options.terminationGraceMs ?? 500)
  }
  const overflow = (stream: 'stdout' | 'stderr'): void => {
    if (stream === 'stdout') stdoutOverflow = true
    else stderrOverflow = true
    void force().catch(() => undefined)
  }
  const stdoutDecoder = new StringDecoder('utf8')
  const stderrDecoder = new StringDecoder('utf8')
  const capture = options.capture ?? 'tail'
  const stdoutStream = child.stdout
  const stderrStream = child.stderr
  if (stdoutStream === null || stderrStream === null) throw new Error('process output pipes were not created')
  stdoutStream.on('data', (chunk: Buffer) => {
    stdoutBytes += chunk.byteLength
    if (!stdoutHeadComplete) stdout = appendBounded(stdout, stdoutDecoder.write(chunk), options.outputLimit, capture)
    if (capture === 'head' && stdoutBytes > options.outputLimit) stdoutHeadComplete = true
    if (stdoutBytes > options.outputLimit) overflow('stdout')
  })
  stderrStream.on('data', (chunk: Buffer) => {
    stderrBytes += chunk.byteLength
    if (!stderrHeadComplete) stderr = appendBounded(stderr, stderrDecoder.write(chunk), options.diagnosticLimit, capture)
    if (capture === 'head' && stderrBytes > options.diagnosticLimit) stderrHeadComplete = true
    if (stderrBytes > options.diagnosticLimit && options.diagnosticOverflow === true) overflow('stderr')
  })
  stdoutStream.on('end', () => {
    if (!stdoutHeadComplete) stdout = appendBounded(stdout, stdoutDecoder.end(), options.outputLimit, capture)
  })
  stderrStream.on('end', () => {
    if (!stderrHeadComplete) stderr = appendBounded(stderr, stderrDecoder.end(), options.diagnosticLimit, capture)
  })
  child.stdin?.on('error', error => {
    if ((error as NodeJS.ErrnoException).code !== 'EPIPE') stdinError = error
  })
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()
  try {
    if (input !== undefined) child.stdin?.end(input)
    const code = await completion.promise
    signal?.throwIfAborted()
    if (stdoutOverflow || stderrOverflow) {
      const stream = stdoutOverflow ? 'stdout' : 'stderr'
      throw new Error(options.outputError?.(stream) ?? `process ${stream} exceeded its output limit`)
    }
    if (stdinError) throw stdinError
    return { code, stdout, stderr }
  } finally {
    signal?.removeEventListener('abort', abort)
    clearTimeout(terminationTimer)
    // Even when the root closes first, reap descendants that ignored its SIGTERM.
    if (aborting || stdoutOverflow || stderrOverflow || options.terminateAfterCompletion === true) {
      await force().catch(() => undefined)
    }
  }
}
