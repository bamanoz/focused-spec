import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LIMIT = 4_000_000
const HELPER = fileURLToPath(new URL('./python/catalog.py', import.meta.url))

export interface CatalogDriverBinding {
  readonly path: string
  readonly exportName: string
}

export interface CatalogSuite {
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
  readonly exportName: string
}

export class CatalogError extends Error {
  readonly line: number

  constructor(message: string, line: number) {
    super(message)
    this.name = 'CatalogError'
    this.line = line
  }
}

export function validPythonCommand(command: string): boolean {
  if (!command || command !== command.trim() || /[\u0000-\u001f\u007f-\u009f]/u.test(command)) return false
  return isAbsolute(command) || /^[A-Za-z0-9][A-Za-z0-9._+-]*$/u.test(command)
}

function validId(id: string): boolean {
  return Boolean(id.trim()) && !/[\u0000-\u001f\u007f-\u009f]/u.test(id)
}

function validSuitePath(path: string): boolean {
  return Boolean(path)
    && !/[\\\u0000-\u001f\u007f-\u009f]/u.test(path)
    && !/^[a-z]:/iu.test(path)
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..')
    && path.endsWith('.py')
}

function validDriverPath(path: string): boolean {
  return Boolean(path)
    && !isAbsolute(path)
    && !/[\\\u0000-\u001f\u007f-\u009f]/u.test(path)
    && !/^[a-z]:/iu.test(path)
    && path.endsWith('.py')
}

export function encodeSelector(path: string, id: string): string {
  if (!validSuitePath(path)) throw new Error('suite path must be a contained project-relative .py file')
  if (!validId(id)) throw new Error('scenario ID must be nonblank and control-free')
  return JSON.stringify([path, id])
}

export function decodeSelector(selector: string): readonly [string, string] {
  let value: unknown
  try {
    value = JSON.parse(selector)
  } catch {
    throw new Error('expected JSON [project-relative suite path, exact scenario ID]')
  }
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string'
    || !validSuitePath(value[0]) || !validId(value[1])) {
    throw new Error('expected JSON [contained project-relative .py path, exact nonblank control-free scenario ID]')
  }
  return [value[0], value[1]]
}

interface HelperFailure {
  readonly ok: false
  readonly error: { readonly message: string; readonly line: number }
}

interface HelperSuccess {
  readonly ok: true
  readonly catalog?: unknown
  readonly driver?: unknown
}

type HelperResponse = HelperFailure | HelperSuccess

function parseResponse(text: string): HelperResponse {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Python catalog helper returned malformed JSON')
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Python catalog helper returned an invalid response')
  const candidate = value as { readonly ok?: unknown; readonly error?: unknown; readonly catalog?: unknown; readonly driver?: unknown }
  if (typeof candidate.ok !== 'boolean') throw new Error('Python catalog helper returned an invalid response')
  if (!candidate.ok) {
    if (candidate.error === null || typeof candidate.error !== 'object' || Array.isArray(candidate.error)) {
      throw new Error('Python catalog helper returned an invalid diagnostic')
    }
    const diagnostic = candidate.error as { readonly message?: unknown; readonly line?: unknown }
    if (typeof diagnostic.message !== 'string' || typeof diagnostic.line !== 'number'
      || !Number.isInteger(diagnostic.line) || diagnostic.line < 1) {
      throw new Error('Python catalog helper returned an invalid diagnostic')
    }
    return { ok: false, error: { message: diagnostic.message, line: diagnostic.line } }
  }
  return {
    ok: true,
    ...(candidate.catalog === undefined ? {} : { catalog: candidate.catalog }),
    ...(candidate.driver === undefined ? {} : { driver: candidate.driver }),
  }
}

function validateBinding(value: unknown): CatalogDriverBinding {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Python catalog helper returned invalid driver metadata')
  const binding = value as { readonly path?: unknown; readonly exportName?: unknown }
  if (typeof binding.path !== 'string' || !binding.path.trim() || /[\u0000-\u001f\u007f-\u009f]/u.test(binding.path)
    || typeof binding.exportName !== 'string' || !/^[_\p{ID_Start}][\p{ID_Continue}]*$/u.test(binding.exportName) || binding.exportName.startsWith('_')) {
    throw new Error('Python catalog helper returned invalid driver metadata')
  }
  return { path: binding.path, exportName: binding.exportName }
}

function validateCatalog(value: unknown): Catalog {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Python catalog helper returned an invalid catalog')
  const candidate = value as { readonly suite?: unknown; readonly scenarios?: unknown }
  if (candidate.suite === null || typeof candidate.suite !== 'object' || Array.isArray(candidate.suite)
    || !Array.isArray(candidate.scenarios)) throw new Error('Python catalog helper returned an invalid catalog')
  const suite = candidate.suite as { readonly exportName?: unknown; readonly driver?: unknown }
  if (typeof suite.exportName !== 'string' || !suite.exportName || suite.exportName.startsWith('_')) {
    throw new Error('Python catalog helper returned an invalid suite')
  }
  const scenarios: CatalogScenario[] = candidate.scenarios.map(entry => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Python catalog helper returned an invalid scenario')
    const scenario = entry as { readonly id?: unknown; readonly name?: unknown; readonly line?: unknown }
    if (typeof scenario.id !== 'string' || !validId(scenario.id) || typeof scenario.name !== 'string' || !scenario.name.trim()
      || typeof scenario.line !== 'number' || !Number.isInteger(scenario.line) || scenario.line < 1) {
      throw new Error('Python catalog helper returned an invalid scenario')
    }
    return { id: scenario.id, name: scenario.name, line: scenario.line }
  })
  return { suite: { exportName: suite.exportName, driver: validateBinding(suite.driver) }, scenarios }
}

function validateDriver(value: unknown): DriverCatalog {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Python catalog helper returned invalid driver metadata')
  const candidate = value as { readonly exportName?: unknown }
  if (typeof candidate.exportName !== 'string' || !candidate.exportName || candidate.exportName.startsWith('_')) {
    throw new Error('Python catalog helper returned invalid driver metadata')
  }
  return { exportName: candidate.exportName }
}

async function invoke(command: string, request: Record<string, string>, signal?: AbortSignal): Promise<HelperResponse> {
  if (!validPythonCommand(command)) throw new Error('Python command must name one executable, not a shell command')
  signal?.throwIfAborted()
  const input = JSON.stringify(request)
  if (Buffer.byteLength(input) > LIMIT) throw new Error('Python catalog helper input exceeds 4000000 bytes')
  const directory = await mkdtemp(join(tmpdir(), 'focused-spec-python-catalog-'))
  try {
    signal?.throwIfAborted()
    const grouped = process.platform !== 'win32'
    const child = spawn(command, ['-I', '-B', HELPER], {
      cwd: directory,
      detached: grouped,
      shell: false,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let stdoutBytes = 0
    let stderrBytes = 0
    let overflow = false
    let killTimer: NodeJS.Timeout | undefined
    let stdinError: Error | undefined

    const kill = (name: NodeJS.Signals): void => {
      if (name === 'SIGKILL' && process.platform === 'win32' && child.pid !== undefined) {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false, stdio: 'ignore' })
        killer.unref()
        return
      }
      try {
        if (grouped && child.pid !== undefined) process.kill(-child.pid, name)
        else child.kill(name)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    const abort = (): void => {
      kill('SIGTERM')
      killTimer ??= setTimeout(() => kill('SIGKILL'), 500)
      killTimer.unref()
    }
    const failOverflow = (): void => { overflow = true; kill('SIGKILL') }
    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length
      if (stdoutBytes <= LIMIT) stdout.push(chunk)
      else failOverflow()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.length
      if (stderrBytes <= LIMIT) stderr.push(chunk)
      else failOverflow()
    })
    child.stdin.on('error', error => {
      if ((error as NodeJS.ErrnoException).code !== 'EPIPE') stdinError = error
    })
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    try {
      const code = await new Promise<number>((resolve, reject) => {
        child.once('error', reject)
        child.once('close', value => resolve(value ?? 1))
        child.stdin.end(input)
      })
      signal?.throwIfAborted()
      if (overflow) throw new Error('Python catalog helper output exceeds 4000000 bytes')
      if (stdinError) throw stdinError
      const output = Buffer.concat(stdout).toString('utf8')
      const diagnostic = Buffer.concat(stderr).toString('utf8')
      if (code !== 0) throw new Error((diagnostic.trim() || output.trim() || `Python catalog helper exited ${code}`).slice(-8_000))
      return parseResponse(output)
    } finally {
      signal?.removeEventListener('abort', abort)
      clearTimeout(killTimer)
      kill('SIGKILL')
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export async function readCatalog(path: string, source: string, signal?: AbortSignal, command = 'python3'): Promise<Catalog> {
  if (!validSuitePath(path)) throw new CatalogError('suite path must be a contained project-relative .py file', 1)
  const response = await invoke(command, { mode: 'catalog', path, source }, signal)
  if (!response.ok) throw new CatalogError(response.error.message, response.error.line)
  if (response.catalog === undefined || response.driver !== undefined) throw new Error('Python catalog helper returned the wrong response mode')
  return validateCatalog(response.catalog)
}

export async function readDriver(path: string, source: string, exportName: string, signal?: AbortSignal, command = 'python3'): Promise<DriverCatalog> {
  if (!validDriverPath(path)) throw new CatalogError('driver path must be a relative .py file', 1)
  const response = await invoke(command, { mode: 'driver', path, source, exportName }, signal)
  if (!response.ok) throw new CatalogError(response.error.message, response.error.line)
  if (response.driver === undefined || response.catalog !== undefined) throw new Error('Python catalog helper returned the wrong response mode')
  return validateDriver(response.driver)
}
