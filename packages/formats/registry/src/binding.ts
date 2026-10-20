import { access, realpath } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type {
  BindDiagnostic,
  BindRequest,
  BindResult,
  CatalogDocument,
  Enrollment,
  FormatPlugin,
  ParseRequest,
  ParseResult,
} from 'focused-spec/format'
import type { JsonValue } from 'focused-spec/runner'
import { isFocusedId, loadEvidenceRegistry, validateRegistryFiles } from './registry.js'
import type { EvidenceEntry, RegistryViolation } from './registry.js'

const PACKAGE_SPECIFIER = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/[A-Za-z0-9_.-]+)*$/u
const MODULE_EXTENSIONS: Readonly<Record<string, true>> = { '.js': true, '.mjs': true, '.ts': true, '.mts': true }
const DEFAULT_FILES = ['.focused-spec/evidence.yaml'] as const

export type NativeParserOptions = (
  | { readonly package: string; readonly module?: never }
  | { readonly module: string; readonly package?: never }
) & { readonly options?: JsonValue }

export interface RegistryFormatOptions {
  readonly parser: NativeParserOptions
  readonly files?: readonly string[]
}

interface IndexedItem {
  readonly document: number
  readonly item: number
  readonly documentValue: CatalogDocument
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function isJsonValue(value: unknown): value is JsonValue {
  const active = new Set<object>()
  function visit(candidate: unknown): boolean {
    if (candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean') return true
    if (typeof candidate === 'number') return Number.isFinite(candidate)
    if (typeof candidate !== 'object' || active.has(candidate)) return false
    active.add(candidate)
    try {
      if (Array.isArray(candidate)) return candidate.every(visit)
      const item = record(candidate)
      return item !== undefined && Object.values(item).every(visit)
    } finally {
      active.delete(candidate)
    }
  }
  return visit(value)
}

function parseOptions(value: JsonValue): RegistryFormatOptions {
  const options = record(value)
  if (options === undefined) throw new Error('registry format options must be an object containing parser')
  for (const key of Object.keys(options)) {
    if (key !== 'parser' && key !== 'files') throw new Error(`unknown registry format option ${key}`)
  }
  const parser = record(options.parser)
  if (parser === undefined) throw new Error('registry format options.parser is required')
  for (const key of Object.keys(parser)) {
    if (key !== 'package' && key !== 'module' && key !== 'options') throw new Error(`unknown registry parser option ${key}`)
  }
  if ((parser.package === undefined) === (parser.module === undefined)) {
    throw new Error('registry parser must declare exactly one package or module')
  }
  let location: { readonly package: string } | { readonly module: string }
  if (parser.package !== undefined) {
    if (typeof parser.package !== 'string' || !PACKAGE_SPECIFIER.test(parser.package)
      || parser.package.split('/').some(part => part === '.' || part === '..')) {
      throw new Error('registry parser package must name an installed package or public subpath')
    }
    location = { package: parser.package }
  } else {
    if (typeof parser.module !== 'string' || parser.module.trim() === '') {
      throw new Error('registry parser module must be a non-empty project-relative path')
    }
    location = { module: parser.module }
  }
  if (parser.options !== undefined && !isJsonValue(parser.options)) {
    throw new Error('registry parser options must be JSON-compatible')
  }
  let files: readonly string[] | undefined
  if (options.files !== undefined) {
    if (!Array.isArray(options.files) || options.files.length === 0
      || options.files.some(path => typeof path !== 'string')) {
      throw new Error('registry format files must be a non-empty array of project-relative YAML paths or patterns')
    }
    files = options.files as string[]
    const violations = validateRegistryFiles(files)
    if (violations.length > 0) throw new Error(violations[0]!.message)
  }
  return {
    parser: { ...location, ...(parser.options === undefined ? {} : { options: parser.options as JsonValue }) } as NativeParserOptions,
    ...(files === undefined ? {} : { files }),
  }
}

function isInside(root: string, path: string): boolean {
  const fromRoot = relative(resolve(root), resolve(path))
  return fromRoot === '' || (fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot))
}

async function parserUrl(projectRoot: string, parser: NativeParserOptions): Promise<string> {
  if (parser.package !== undefined) {
    return import.meta.resolve(parser.package, pathToFileURL(resolve(projectRoot, 'package.json')).href)
  }
  const path = resolve(projectRoot, parser.module)
  if (isAbsolute(parser.module) || !isInside(projectRoot, path) || MODULE_EXTENSIONS[extname(path)] !== true) {
    throw new Error('registry parser module must be a contained .ts, .mts, .js, or .mjs file')
  }
  await access(path)
  if (!isInside(await realpath(projectRoot), await realpath(path))) {
    throw new Error('registry parser module must stay inside project root after resolving symlinks')
  }
  return pathToFileURL(path).href
}

const parserPlugins = new Map<string, FormatPlugin>()

async function loadParser(projectRoot: string, parser: NativeParserOptions): Promise<FormatPlugin> {
  const url = await parserUrl(projectRoot, parser)
  const cached = parserPlugins.get(url)
  if (cached !== undefined) return cached
  // The configured native parser is selected by the consuming project, so a static import cannot name it.
  const loaded: unknown = await import(url)
  const module = record(loaded)
  const candidate = record(module?.default)
  if (candidate === undefined || candidate.apiVersion !== 2 || typeof candidate.parse !== 'function') {
    throw new Error('registry native parser must default-export a FormatPlugin with apiVersion 2; migrate it using `./node_modules/.bin/focused-spec instructions --protocol 1 --topic workflow --json`')
  }
  if (candidate.bind !== undefined) {
    throw new Error('registry native parser must be structural and must not define catalog binding')
  }
  const plugin = candidate as unknown as FormatPlugin
  parserPlugins.set(url, plugin)
  return plugin
}

export async function parseRegistryDocument(request: ParseRequest): Promise<ParseResult> {
  const options = parseOptions(request.options)
  const parser = await loadParser(request.projectRoot, options.parser)
  return parser.parse({
    projectRoot: request.projectRoot,
    path: request.path,
    source: request.source,
    options: options.parser.options ?? null,
    signal: request.signal,
  })
}

function diagnostic(violation: RegistryViolation): BindDiagnostic {
  return {
    location: { path: violation.path, line: violation.line ?? 1 },
    message: violation.message,
    ...(violation.scope === undefined ? {} : { scope: violation.scope }),
    ...(violation.scenarioId === undefined || !isFocusedId(violation.scenarioId)
      ? {}
      : { focusedId: violation.scenarioId }),
  }
}

function enrollment(entry: EvidenceEntry, target: IndexedItem): Enrollment {
  return {
    document: target.document,
    item: target.item,
    id: entry.id,
    evidence: entry.evidence,
    evidenceLocations: entry.evidenceLocations,
    location: { path: entry.registryPath, line: entry.line },
  }
}

export async function bindRegistryCatalog(request: BindRequest): Promise<BindResult> {
  const options = parseOptions(request.options)
  await loadParser(request.projectRoot, options.parser)
  const registry = await loadEvidenceRegistry(
    request.projectRoot,
    options.files ?? DEFAULT_FILES,
    request.selection.scope,
    request.selection.scenarioId,
  )
  const diagnostics = registry.violations.map(diagnostic)
  const enrollments: Enrollment[] = []
  const byMarker = new Map<string, IndexedItem[]>()
  const byDocument = new Map<string, IndexedItem[]>()
  for (const [documentIndex, document] of request.documents.entries()) {
    const documentKey = `${document.scope}\u0000${document.path}`
    const documentItems: IndexedItem[] = []
    byDocument.set(documentKey, documentItems)
    for (const [itemIndex, item] of document.items.entries()) {
      const target = { document: documentIndex, item: itemIndex, documentValue: document }
      documentItems.push(target)
      if (item.markerId !== undefined) {
        const markerKey = `${document.scope}\u0000${item.markerId}`
        const matches = byMarker.get(markerKey)
        if (matches === undefined) byMarker.set(markerKey, [target])
        else matches.push(target)
      }
    }
  }

  const registeredMarkers = new Set<string>()
  const boundItems = new Set<string>()
  for (const entry of registry.entries) {
    const identity = `${entry.scope}\u0000${entry.id}`
    if (entry.source === undefined) registeredMarkers.add(identity)
    const matches = entry.source === undefined
      ? byMarker.get(identity) ?? []
      : (byDocument.get(`${entry.scope}\u0000${entry.source.path}`) ?? [])
        .filter(target => target.documentValue.items[target.item]!.nativeIds.includes(entry.source!.nativeId))
    if (matches.length !== 1) {
      diagnostics.push({
        location: { path: entry.registryPath, line: entry.line },
        scope: entry.scope,
        focusedId: entry.id,
        message: `registry binding ${entry.scope}/${entry.id} must resolve uniquely to one native item; found ${matches.length}`,
      })
      continue
    }
    const target = matches[0]!
    const item = target.documentValue.items[target.item]!
    if (entry.source !== undefined && item.markerId !== undefined) {
      diagnostics.push({
        location: { path: target.documentValue.path, line: item.line },
        scope: entry.scope,
        focusedId: entry.id,
        message: 'external native-ID binding requires an unmarked native item',
      })
      continue
    }
    const targetKey = `${target.document}\u0000${target.item}`
    if (boundItems.has(targetKey)) {
      diagnostics.push({
        location: { path: target.documentValue.path, line: item.line },
        scope: entry.scope,
        focusedId: entry.id,
        message: 'native item is bound more than once within its scope',
      })
      continue
    }
    boundItems.add(targetKey)
    enrollments.push(enrollment(entry, target))
  }

  for (const [key, matches] of byMarker) {
    const target = matches[0]!
    const item = target.documentValue.items[target.item]!
    const focusedId = item.markerId!
    if (request.selection.scope !== undefined && target.documentValue.scope !== request.selection.scope) continue
    if (request.selection.scenarioId !== undefined && item.markerId !== request.selection.scenarioId) continue
    if (!registeredMarkers.has(key) && item.evidence === undefined) {
      diagnostics.push({
        location: { path: target.documentValue.path, line: item.line },
        scope: target.documentValue.scope,
        focusedId,
        message: 'focused marker has no evidence registry entry',
      })
    }
  }

  diagnostics.sort((left, right) => left.location.path.localeCompare(right.location.path)
    || left.location.line - right.location.line
    || left.message.localeCompare(right.message))
  enrollments.sort((left, right) => left.document - right.document || left.item - right.item)
  return { enrollments, diagnostics, sourceClaims: registry.sourceClaims }
}
