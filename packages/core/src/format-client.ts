import { fork } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { BindResult, CatalogDocument, SourceLocation } from './format-api.js'
import { pluginExecArgv, pluginReference } from './plugin-module.js'
import type { FormatConfig, NativeDocument, NativeItem, Violation } from './model.js'
import { isFocusedId, isScopeName } from './model.js'

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('format response must contain objects')
  return value as Record<string, unknown>
}

function keys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('format response contains unsupported fields')
}

function positiveLine(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function index(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function sourceLocation(value: unknown): SourceLocation {
  const location = record(value)
  keys(location, ['path', 'line'])
  if (typeof location.path !== 'string' || location.path.length === 0 || !positiveLine(location.line)) throw new Error('format returned an invalid source location')
  return { path: location.path, line: location.line }
}

function evidence(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some(reference => typeof reference !== 'string')) throw new Error('format returned invalid evidence')
  return value as string[]
}

function evidenceLocations(value: unknown, count: number): readonly SourceLocation[] {
  if (!Array.isArray(value) || value.length !== count) throw new Error('format returned evidence locations that do not match its evidence')
  return value.map(sourceLocation)
}

export function normalizeFormatResult(path: string, scope: string, value: unknown): NativeDocument {
  const result = record(value)
  keys(result, ['items', 'diagnostics'])
  if (!Array.isArray(result.items) || !Array.isArray(result.diagnostics)) throw new Error('format response must contain items and diagnostics arrays')
  const items: NativeItem[] = result.items.map((raw: unknown) => {
    const item = record(raw)
    keys(item, ['line', 'name', 'nativeIds', 'markerId', 'evidence', 'evidenceLocations'])
    if (!positiveLine(item.line) || typeof item.name !== 'string' || !Array.isArray(item.nativeIds) || item.nativeIds.some(id => typeof id !== 'string' || id.trim() === '') || new Set(item.nativeIds).size !== item.nativeIds.length) throw new Error('format returned an invalid native item')
    if (item.markerId !== undefined && (typeof item.markerId !== 'string' || !isFocusedId(item.markerId) || item.name.trim() === '')) throw new Error('format returned an invalid focused ID or empty marked item')
    if (item.evidence !== undefined && item.markerId === undefined) throw new Error('format returned direct evidence without a focused ID')
    const references = item.evidence === undefined ? undefined : evidence(item.evidence)
    if (item.evidenceLocations !== undefined && references === undefined) throw new Error('format returned evidence locations without evidence')
    const locations = item.evidenceLocations === undefined ? undefined : evidenceLocations(item.evidenceLocations, references!.length)
    return {
      path,
      scope,
      line: item.line,
      name: item.name,
      nativeIds: item.nativeIds as string[],
      ...(item.markerId === undefined ? {} : { markerId: item.markerId as string }),
      ...(references === undefined ? {} : { evidence: references }),
      ...(locations === undefined ? {} : { evidenceLocations: locations }),
    }
  })
  const violations: Violation[] = result.diagnostics.map((raw: unknown) => {
    const diagnostic = record(raw)
    keys(diagnostic, ['line', 'message', 'focusedId'])
    if (typeof diagnostic.message !== 'string' || diagnostic.message.trim() === '' || (diagnostic.line !== undefined && !positiveLine(diagnostic.line)) || (diagnostic.focusedId !== undefined && (typeof diagnostic.focusedId !== 'string' || !isFocusedId(diagnostic.focusedId)))) throw new Error('format returned an invalid diagnostic')
    return { path, message: diagnostic.message, ...(diagnostic.line === undefined ? {} : { line: diagnostic.line as number }), ...(diagnostic.focusedId === undefined ? {} : { scenarioId: diagnostic.focusedId as string }) }
  })
  return { path, scope, items, violations }
}

export function normalizeBindResult(value: unknown): BindResult {
  const result = record(value)
  keys(result, ['enrollments', 'diagnostics', 'sourceClaims'])
  if (!Array.isArray(result.enrollments) || !Array.isArray(result.diagnostics) || !Array.isArray(result.sourceClaims)) throw new Error('format binding response must contain enrollments, diagnostics, and sourceClaims arrays')
  const enrollments = result.enrollments.map(raw => {
    const enrollment = record(raw)
    keys(enrollment, ['document', 'item', 'id', 'evidence', 'evidenceLocations', 'location'])
    if (!index(enrollment.document) || !index(enrollment.item) || typeof enrollment.id !== 'string' || !isFocusedId(enrollment.id)) throw new Error('format returned an invalid catalog enrollment')
    const references = evidence(enrollment.evidence)
    const locations = enrollment.evidenceLocations === undefined ? undefined : evidenceLocations(enrollment.evidenceLocations, references.length)
    return {
      document: enrollment.document,
      item: enrollment.item,
      id: enrollment.id,
      evidence: references,
      ...(locations === undefined ? {} : { evidenceLocations: locations }),
      location: sourceLocation(enrollment.location),
    }
  })
  const diagnostics = result.diagnostics.map(raw => {
    const diagnostic = record(raw)
    keys(diagnostic, ['location', 'message', 'scope', 'focusedId'])
    if (typeof diagnostic.message !== 'string' || diagnostic.message.trim() === '' || (diagnostic.scope !== undefined && (typeof diagnostic.scope !== 'string' || !isScopeName(diagnostic.scope))) || (diagnostic.focusedId !== undefined && (typeof diagnostic.focusedId !== 'string' || !isFocusedId(diagnostic.focusedId)))) throw new Error('format returned an invalid binding diagnostic')
    return {
      location: sourceLocation(diagnostic.location),
      message: diagnostic.message,
      ...(diagnostic.scope === undefined ? {} : { scope: diagnostic.scope as string }),
      ...(diagnostic.focusedId === undefined ? {} : { focusedId: diagnostic.focusedId as string }),
    }
  })
  const sourceClaims = result.sourceClaims.map(raw => {
    const claim = record(raw)
    keys(claim, ['key', 'location'])
    if (typeof claim.key !== 'string' || claim.key.length === 0) throw new Error('format returned an invalid source claim')
    return { key: claim.key, location: sourceLocation(claim.location) }
  })
  return { enrollments, diagnostics, sourceClaims }
}

interface HostValue {
  readonly value: unknown
  readonly hasBind: boolean
}

interface Pending {
  readonly id: number
  readonly resolve: (value: HostValue) => void
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
      cwd: this.projectRoot, execArgv: pluginExecArgv(this.reference, true), stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    })
    this.child = child
    const append = (chunk: unknown): void => { this.output = (this.output + String(chunk)).slice(-16_384) }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    child.once('error', error => this.fail(error))
    child.once('exit', code => {
      if (this.child !== child) return
      this.fail(new Error(`format host exited before completing a request with code ${String(code)}${this.output === '' ? '' : `\n${this.output}`}`))
    })
    child.on('message', message => {
      const pending = this.pending
      if (pending === undefined) { this.fail(new Error('format host sent an unsolicited response')); return }
      try {
        const response = record(message)
        if (response.id !== pending.id || typeof response.ok !== 'boolean') throw new Error('format host returned an invalid response')
        if (!response.ok) throw new Error(typeof response.error === 'string' ? response.error : 'format plugin failed')
        if (typeof response.hasBind !== 'boolean' || typeof response.json !== 'string' || response.json.length > 8_000_000) throw new Error('format host returned an invalid or oversized response')
        const value: unknown = JSON.parse(response.json)
        this.pending = undefined
        clearTimeout(pending.timer)
        pending.resolve({ value, hasBind: response.hasBind })
      } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))) }
    })
  }

  private async request(operation: 'parse' | 'bind', payload: object): Promise<HostValue> {
    await this.start()
    if (this.pending !== undefined) throw new Error('format client does not support concurrent requests')
    const timeoutMs = this.config.timeoutMs ?? 30_000
    const id = ++this.nextId
    return new Promise<HostValue>((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`format ${operation === 'parse' ? 'parsing' : 'binding'} timed out after ${timeoutMs}ms`)), timeoutMs)
      this.pending = { id, resolve, reject, timer }
      this.child!.send({ id, reference: this.reference, operation, projectRoot: this.projectRoot, options: this.config.options ?? null, timeoutMs, ...payload }, error => { if (error) this.fail(error) })
    })
  }

  async parse(path: string, source: string, scope: string): Promise<NativeDocument> {
    if (source.length > 16_000_000) throw new Error('native document exceeds the format input limit')
    const response = await this.request('parse', { path, source })
    return normalizeFormatResult(path, scope, response.value)
  }

  async bind(documents: readonly CatalogDocument[], selection: { readonly scope?: string; readonly scenarioId?: string }): Promise<BindResult | undefined> {
    const serialized = JSON.stringify({ documents, selection })
    if (serialized === undefined || serialized.length > 16_000_000) throw new Error('native catalog exceeds the format input limit')
    const response = await this.request('bind', { documents, selection })
    return response.hasBind ? normalizeBindResult(response.value) : undefined
  }

  close(): void {
    const child = this.child
    this.child = undefined
    if (child !== undefined) { child.removeAllListeners('message'); child.kill('SIGKILL') }
  }
}
