import { fork } from 'node:child_process'
import { retainExecutionEvents } from 'focused-spec/runner'
import type { TargetResult } from 'focused-spec/runner'
import type { WorkItem } from './index.js'

const LIMIT = 4_000_000

export async function execute(worker: string, work: readonly WorkItem[], cwd: string, signal: AbortSignal): Promise<TargetResult[]> {
  signal.throwIfAborted()
  const payload = { kind: 'run', work }
  if (Buffer.byteLength(JSON.stringify(payload)) > LIMIT) throw new Error('scenario worker input exceeded 4000000 bytes')
  const [major, minor] = process.versions.node.split('.').map(Number)
  const flags = major === 22 && (minor ?? 0) < 18 ? ['--experimental-strip-types'] : []
  const child = fork(worker, [], { cwd, execArgv: flags, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], serialization: 'json' })
  let outputBytes = 0
  let diagnostic = ''
  let failure: Error | undefined
  let timer: NodeJS.Timeout | undefined
  const results = new Map<string, TargetResult>()
  const expected = new Set(work.map(item => item.targetId))
  const abort = (): void => {
    if (child.connected) child.send({ kind: 'abort' }, () => {})
    timer ??= setTimeout(() => child.kill('SIGKILL'), 500)
    timer.unref()
  }
  const fail = (message: string): void => {
    failure ??= new Error(message)
    child.kill('SIGKILL')
  }
  const capture = (chunk: Buffer): void => {
    outputBytes += chunk.length
    diagnostic = (diagnostic + chunk.toString('utf8')).slice(-8000)
    if (outputBytes > LIMIT) fail('scenario worker output exceeded 4000000 bytes')
  }
  child.stdout?.on('data', capture)
  child.stderr?.on('data', capture)
  child.on('message', (value: unknown) => {
    if (Buffer.byteLength(JSON.stringify(value)) > LIMIT) return fail('scenario worker message exceeded transport limit')
    if (value === null || typeof value !== 'object' || Array.isArray(value) || !('targetId' in value) || typeof value.targetId !== 'string'
      || !expected.has(value.targetId) || results.has(value.targetId) || !('status' in value) || (value.status !== 'pass' && value.status !== 'fail')
      || ('diagnostic' in value && (typeof value.diagnostic !== 'string' || value.diagnostic.length > 8000))) return fail('invalid scenario worker result')
    try {
      const events = 'events' in value ? retainExecutionEvents(value.events) : undefined
      results.set(value.targetId, {
        targetId: value.targetId,
        status: value.status,
        ...('diagnostic' in value ? { diagnostic: value.diagnostic as string } : {}),
        ...(events === undefined ? {} : { events }),
      })
    } catch {
      fail('invalid scenario worker result')
    }
  })
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  let code: number | null
  try {
    code = await new Promise<number | null>((done, reject) => {
      child.once('error', reject)
      child.once('exit', done)
      child.send(payload, error => { if (error) fail(`cannot send scenario worker input: ${error.message}`) })
    })
  } finally {
    signal.removeEventListener('abort', abort)
    clearTimeout(timer)
    child.stdout?.destroy()
    child.stderr?.destroy()
    if (child.connected) child.disconnect()
    child.kill('SIGKILL')
  }
  signal.throwIfAborted()
  if (failure) throw failure
  return work.map(item => {
    const result = results.get(item.targetId)
    if (code !== 0 || result === undefined) return { targetId: item.targetId, status: 'fail', diagnostic: diagnostic || `scenario worker exited ${code} without completing selected execution` }
    return result
  })
}
