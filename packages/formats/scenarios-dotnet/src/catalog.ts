import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LIMIT = 4_000_000
const HELPER = fileURLToPath(new URL('./dotnet/FocusedSpec.Catalog.dll', import.meta.url))

export interface CatalogDriverBinding {
  readonly path: string
  readonly exportName: string
}

export interface CatalogSuite {
  readonly namespaceName: string
  readonly typeName: string
  readonly exportName: string
  readonly driver: CatalogDriverBinding
}

export interface CatalogScenario {
  readonly id: string
  readonly name: string
  readonly line: number
}

export interface Catalog {
  readonly suite: CatalogSuite
  readonly scenarios: readonly CatalogScenario[]
}

export interface DriverCatalog {
  readonly typeName: string
  readonly exportName: string
}

export class CatalogError extends Error {
  readonly line: number

  constructor(message: string, line: number) {
    super(message.slice(-8000))
    this.name = 'CatalogError'
    this.line = Number.isInteger(line) && line > 0 ? line : 1
  }
}

function validId(id: string): boolean {
  return Boolean(id.trim()) && !/[\u0000-\u001f\u007f-\u009f]/u.test(id)
}

function validPath(path: string): boolean {
  return Boolean(path) && !isAbsolute(path) && !/^[a-z]:/iu.test(path) && !/[\\\u0000-\u001f\u007f-\u009f]/u.test(path)
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..') && path.toLowerCase().endsWith('.cs')
}

export function encodeSelector(path: string, id: string): string {
  if (!validPath(path) || !validId(id)) throw new Error('expected a contained project-relative C# suite path and exact scenario ID')
  return JSON.stringify([path, id])
}

export function decodeSelector(selector: string): readonly [string, string] {
  let value: unknown
  try { value = JSON.parse(selector) } catch { throw new Error('expected JSON [project-relative suite path, exact scenario ID]') }
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string'
    || !validPath(value[0]) || !validId(value[1])) throw new Error('expected JSON [project-relative C# suite path, exact scenario ID]')
  return [value[0], value[1]]
}

function commandName(value: string): string {
  if (!value || value !== value.trim() || /[\u0000-\u001f\u007f-\u009f]/u.test(value) || (!isAbsolute(value) && /[\\/\s]/u.test(value))) throw new Error('dotnet command must be one executable name or absolute path')
  return value
}

interface HelperFailure { readonly ok: false; readonly error: string; readonly line: number }
interface HelperSuccess { readonly ok: true; readonly catalog?: unknown; readonly driver?: unknown }
type HelperResponse = HelperFailure | HelperSuccess

function helperResponse(text: string): HelperResponse {
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('invalid .NET catalog helper response') }
  if (value === null || typeof value !== 'object' || Array.isArray(value) || !('ok' in value) || typeof value.ok !== 'boolean') throw new Error('invalid .NET catalog helper response')
  if (!value.ok) {
    if (!('error' in value) || typeof value.error !== 'string' || !('line' in value) || typeof value.line !== 'number') throw new Error('invalid .NET catalog helper error')
    return { ok: false, error: value.error, line: value.line }
  }
  return value as HelperSuccess
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`invalid ${label} from .NET catalog helper`)
  return value as Record<string, unknown>
}

function stringField(value: Record<string, unknown>, key: string, label: string): string {
  const field = value[key]
  if (typeof field !== 'string' || !field) throw new Error(`invalid ${label} from .NET catalog helper`)
  return field
}

function validateCatalog(value: unknown): Catalog {
  const root = record(value, 'catalog')
  const suite = record(root.suite, 'catalog suite')
  const driver = record(suite.driver, 'catalog driver')
  if (!Array.isArray(root.scenarios) || root.scenarios.length === 0) throw new Error('invalid catalog scenarios from .NET catalog helper')
  const ids = new Set<string>()
  const scenarios = root.scenarios.map(candidate => {
    const item = record(candidate, 'catalog scenario')
    const id = stringField(item, 'id', 'catalog scenario ID')
    const name = stringField(item, 'name', 'catalog scenario name')
    if (!validId(id) || !name.trim() || typeof item.line !== 'number' || !Number.isInteger(item.line) || item.line < 1 || ids.has(id)) throw new Error('invalid catalog scenario from .NET catalog helper')
    ids.add(id)
    return { id, name, line: item.line }
  })
  const binding = { path: stringField(driver, 'path', 'driver path'), exportName: stringField(driver, 'exportName', 'driver export') }
  if (isAbsolute(binding.path) || /^[a-z]:/iu.test(binding.path) || /[\\\u0000-\u001f\u007f-\u009f]/u.test(binding.path) || !binding.path.toLowerCase().endsWith('.cs')) throw new Error('invalid catalog driver binding from .NET catalog helper')
  return {
    suite: {
      namespaceName: stringField(suite, 'namespaceName', 'catalog namespace'),
      typeName: stringField(suite, 'typeName', 'catalog suite type'),
      exportName: stringField(suite, 'exportName', 'catalog suite export'),
      driver: binding,
    },
    scenarios,
  }
}

function validateDriver(value: unknown): DriverCatalog {
  const item = record(value, 'driver catalog')
  return { typeName: stringField(item, 'typeName', 'driver type'), exportName: stringField(item, 'exportName', 'driver export') }
}

async function invoke(request: Record<string, string>, signal: AbortSignal | undefined, command: string): Promise<HelperResponse> {
  signal?.throwIfAborted()
  const input = JSON.stringify(request)
  if (Buffer.byteLength(input) > LIMIT) throw new Error('.NET catalog helper input exceeds 4000000 bytes')
  const temporary = await mkdtemp(join(tmpdir(), 'focused-spec-dotnet-catalog-'))
  const grouped = process.platform !== 'win32'
  try {
    const child = spawn(commandName(command), [HELPER], {
      cwd: temporary,
      shell: false,
      detached: grouped,
      env: {
        ...process.env,
        DOTNET_CLI_HOME: temporary,
        DOTNET_NOLOGO: '1',
        DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
        DOTNET_CLI_TELEMETRY_OPTOUT: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let stdoutBytes = 0
    let stderrBytes = 0
    let overflow: string | undefined
    let timer: NodeJS.Timeout | undefined
    const kill = (name: NodeJS.Signals): void => {
      try {
        if (grouped && child.pid !== undefined) process.kill(-child.pid, name)
        else child.kill(name)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    const abort = (): void => {
      kill('SIGTERM')
      timer ??= setTimeout(() => kill('SIGKILL'), 500)
      timer.unref()
    }
    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length
      if (stdoutBytes <= LIMIT) stdout.push(chunk)
      else { overflow = '.NET catalog helper stdout exceeds 4000000 bytes'; kill('SIGKILL') }
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.length
      if (stderrBytes <= LIMIT) stderr.push(chunk)
      else { overflow = '.NET catalog helper stderr exceeds 4000000 bytes'; kill('SIGKILL') }
    })
    child.stdin.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE') kill('SIGKILL') })
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    try {
      const completion = Promise.withResolvers<number>()
      child.once('error', completion.reject)
      child.once('close', value => completion.resolve(value ?? 1))
      child.stdin.end(input)
      const code = await completion.promise
      signal?.throwIfAborted()
      if (overflow) throw new Error(overflow)
      const output = Buffer.concat(stdout).toString('utf8')
      const diagnostic = Buffer.concat(stderr).toString('utf8').slice(-8000)
      if (code !== 0) throw new Error((diagnostic || output || `.NET catalog helper exited ${code}`).slice(-8000))
      return helperResponse(output)
    } finally {
      signal?.removeEventListener('abort', abort)
      clearTimeout(timer)
      kill('SIGKILL')
    }
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

export async function readCatalog(path: string, source: string, signal?: AbortSignal, command = 'dotnet'): Promise<Catalog> {
  if (!validPath(path)) throw new CatalogError('suite path must be a contained project-relative C# source file', 1)
  const response = await invoke({ kind: 'catalog', path, source }, signal, command)
  if (!response.ok) throw new CatalogError(response.error, response.line)
  return validateCatalog(response.catalog)
}

export async function readDriver(path: string, source: string, exportName: string, signal?: AbortSignal, command = 'dotnet'): Promise<DriverCatalog> {
  if (!path || isAbsolute(path) || /^[a-z]:/iu.test(path) || /[\\\u0000-\u001f\u007f-\u009f]/u.test(path) || !path.toLowerCase().endsWith('.cs')) throw new CatalogError('driver path must name a relative C# source file', 1)
  const response = await invoke({ kind: 'driver', path, source, export: exportName }, signal, command)
  if (!response.ok) throw new CatalogError(response.error, response.line)
  return validateDriver(response.driver)
}
