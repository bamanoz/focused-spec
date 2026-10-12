import { fork } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { pluginExecArgv, pluginReference } from './plugin-module.js'
import type { FormatConfig, NativeDocument, NativeItem, Violation } from './model.js'
import { STABLE_ID } from './model.js'

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('format response must contain objects')
  return value as Record<string, unknown>
}

function keys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('format response contains unsupported fields')
}

function line(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

export function normalizeFormatResult(path: string, scope: string, value: unknown): NativeDocument {
  const result = record(value)
  keys(result, ['items', 'diagnostics'])
  if (!Array.isArray(result.items) || !Array.isArray(result.diagnostics)) throw new Error('format response must contain items and diagnostics arrays')
  const items: NativeItem[] = result.items.map((raw: unknown) => {
    const item = record(raw)
    keys(item, ['line', 'name', 'nativeIds', 'markerId'])
    if (!line(item.line) || typeof item.name !== 'string' || !Array.isArray(item.nativeIds) || item.nativeIds.some(id => typeof id !== 'string' || id.trim() === '') || new Set(item.nativeIds).size !== item.nativeIds.length) throw new Error('format returned an invalid native item')
    if (item.markerId !== undefined && (typeof item.markerId !== 'string' || !STABLE_ID.test(item.markerId) || item.name.trim() === '')) throw new Error('format returned an invalid focused ID or empty marked item')
    return { path, scope, line: item.line, name: item.name, nativeIds: item.nativeIds as string[], ...(item.markerId === undefined ? {} : { markerId: item.markerId as string }) }
  })
  const violations: Violation[] = result.diagnostics.map((raw: unknown) => {
    const diagnostic = record(raw)
    keys(diagnostic, ['line', 'message', 'focusedId'])
    if (typeof diagnostic.message !== 'string' || diagnostic.message.trim() === '' || (diagnostic.line !== undefined && !line(diagnostic.line)) || (diagnostic.focusedId !== undefined && typeof diagnostic.focusedId !== 'string')) throw new Error('format returned an invalid diagnostic')
    return { path, message: diagnostic.message, ...(diagnostic.line === undefined ? {} : { line: diagnostic.line as number }), ...(diagnostic.focusedId === undefined ? {} : { scenarioId: diagnostic.focusedId as string }) }
  })
  return { path, scope, items, violations }
}

interface Pending {
  readonly id: number
  readonly resolve: (value: unknown) => void
  readonly reject: (error: Error) => void
  readonly timer: ReturnType<typeof setTimeout>
}

export class FormatClient {
  private child: ChildProcess | undefined
  private pending: Pending | undefined
  private reference: string | undefined
  private nextId = 0
  private output = ''
  private failed: Error | undefined

  constructor(private readonly projectRoot: string, private readonly config: FormatConfig) {}

  private fail(error: Error): void {
    this.failed = error
    const pending = this.pending
    this.pending = undefined
    if (pending !== undefined) { clearTimeout(pending.timer); pending.reject(error) }
    this.close()
  }

  private async start(): Promise<void> {
    if (this.failed !== undefined) throw this.failed
    if (this.child !== undefined) return
    this.reference = await pluginReference(this.projectRoot, this.config)
    const child = fork(fileURLToPath(new URL('./format-host.js', import.meta.url)), [], {
      cwd: this.projectRoot, execArgv: pluginExecArgv(this.reference), stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    })
    this.child = child
    const append = (chunk: unknown): void => { this.output = (this.output + String(chunk)).slice(-16_384) }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    child.once('error', error => this.fail(error))
    child.once('exit', code => {
      if (this.child !== child) return
      this.fail(new Error(`format host exited before completing parsing with code ${String(code)}${this.output === '' ? '' : `\n${this.output}`}`))
    })
    child.on('message', message => {
      const pending = this.pending
      if (pending === undefined) { this.fail(new Error('format host sent an unsolicited response')); return }
      try {
        const response = record(message)
        if (response.id !== pending.id || typeof response.ok !== 'boolean') throw new Error('format host returned an invalid response')
        if (!response.ok) throw new Error(typeof response.error === 'string' ? response.error : 'format plugin failed')
        if (typeof response.json !== 'string' || response.json.length > 8_000_000) throw new Error('format host exceeded the response limit')
        const value: unknown = JSON.parse(response.json)
        this.pending = undefined
        clearTimeout(pending.timer)
        pending.resolve(value)
      } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))) }
    })
  }

  async parse(path: string, source: string, scope: string): Promise<NativeDocument> {
    if (source.length > 16_000_000) throw new Error('native document exceeds the format input limit')
    await this.start()
    if (this.pending !== undefined) throw new Error('format client does not support concurrent requests')
    const timeoutMs = this.config.timeoutMs ?? 30_000
    const id = ++this.nextId
    const value = await new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`format parsing timed out after ${timeoutMs}ms`)), timeoutMs)
      this.pending = { id, resolve, reject, timer }
      this.child!.send({ id, reference: this.reference, projectRoot: this.projectRoot, path, source, options: this.config.options ?? null, timeoutMs }, error => { if (error) this.fail(error) })
    })
    return normalizeFormatResult(path, scope, value)
  }

  close(): void {
    const child = this.child
    this.child = undefined
    if (child !== undefined) { child.removeAllListeners('message'); child.kill('SIGKILL') }
  }
}
