import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, posix, relative, resolve, sep } from 'node:path'
import type { SourceLocation } from 'focused-spec/format'
import { glob } from 'glob'
import { braceExpand } from 'minimatch'
import { LineCounter, parseDocument } from 'yaml'
import type { Document } from 'yaml'

const DEFAULT_REGISTRY_PATH = '.focused-spec/evidence.yaml'
const MAX_PATTERN_LENGTH = 4096
const MAX_PATTERN_DEPTH = 32
const MAX_BRACE_DELIMITERS = 256
const MAX_EXPANSIONS = 256
const PARENT_SEGMENT = /(?:^|[/{,])\.\.(?:[/},]|$)/u
const SCOPE_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?$/u
const YAML_EXTENSION = /\.(?:yaml|yml)$/iu
const CONTROL_CHARACTER = /\p{Cc}/u

export interface RegistryViolation {
  readonly path: string
  readonly line?: number
  readonly scope?: string
  readonly scenarioId?: string
  readonly message: string
}

export interface EvidenceEntry {
  readonly scope: string
  readonly id: string
  readonly line: number
  readonly registryPath: string
  readonly evidence: readonly string[]
  readonly evidenceLocations: readonly SourceLocation[]
  readonly source?: { readonly path: string; readonly nativeId: string }
}

export interface RegistrySourceClaim {
  readonly key: string
  readonly location: SourceLocation
}

export interface EvidenceRegistry {
  readonly entries: readonly EvidenceEntry[]
  readonly files: readonly string[]
  readonly violations: readonly RegistryViolation[]
  readonly sourceClaims: readonly RegistrySourceClaim[]
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export function isFocusedId(value: string): boolean {
  return /\S/u.test(value) && !CONTROL_CHARACTER.test(value)
}

function lineOf(document: Document.Parsed, lineCounter: LineCounter, path: readonly (string | number)[]): number {
  const node: unknown = document.getIn(path, true)
  const offset = node !== null && typeof node === 'object' && 'range' in node
    && Array.isArray(node.range) && typeof node.range[0] === 'number'
    ? node.range[0]
    : 0
  return lineCounter.linePos(offset).line
}

export function parseEvidenceRegistry(
  source: string,
  path = DEFAULT_REGISTRY_PATH,
  selectedScope?: string,
  selectedScenarioId?: string,
): EvidenceRegistry {
  const entries: EvidenceEntry[] = []
  const violations: RegistryViolation[] = []
  const files = [path]
  const lineCounter = new LineCounter()
  const document = parseDocument(source, { lineCounter })
  if (document.errors.length > 0) {
    return {
      entries,
      files,
      sourceClaims: [],
      violations: document.errors.map(error => ({
        path,
        line: lineCounter.linePos(error.pos[0]).line,
        message: `invalid evidence registry YAML: ${error.message}`,
      })),
    }
  }

  let value: unknown
  try {
    value = document.toJS({ maxAliasCount: 0 })
  } catch (error) {
    return {
      entries,
      files,
      sourceClaims: [],
      violations: [{ path, message: `invalid evidence registry: ${error instanceof Error ? error.message : String(error)}` }],
    }
  }

  const root = record(value)
  if (root === undefined || Object.keys(root).length !== 1 || !Object.hasOwn(root, 'scopes')) {
    return {
      entries,
      files,
      sourceClaims: [],
      violations: [{ path, message: 'evidence registry must contain only a scopes mapping; behavior belongs in native items' }],
    }
  }
  const scopes = record(root.scopes)
  if (scopes === undefined) {
    return {
      entries,
      files,
      sourceClaims: [],
      violations: [{ path, message: 'evidence registry scopes must be a mapping' }],
    }
  }

  for (const [scope, rawEntries] of Object.entries(scopes)) {
    if (selectedScope !== undefined && selectedScope !== scope) continue
    if (!SCOPE_NAME.test(scope)) {
      violations.push({ path, message: `invalid registry scope name ${scope}` })
      continue
    }
    const scopedEntries = record(rawEntries)
    if (scopedEntries === undefined) {
      violations.push({ path, scope, message: `registry scope ${scope} must be a mapping of focused IDs` })
      continue
    }
    for (const [id, rawEntry] of Object.entries(scopedEntries)) {
      if (selectedScenarioId !== undefined && selectedScenarioId !== id) continue
      const line = lineOf(document, lineCounter, ['scopes', scope, id])
      const report = (message: string): void => {
        violations.push({ path, line, scope, scenarioId: id, message })
      }
      const previous = violations.length
      if (!isFocusedId(id)) report(`invalid focused ID ${JSON.stringify(id)}; expected a nonblank string without control characters`)
      const entry = record(rawEntry)
      if (entry === undefined) {
        report('registry entry must be a mapping of evidence and optional source')
        continue
      }
      for (const key of Object.keys(entry)) {
        if (key !== 'evidence' && key !== 'source') report(`unknown registry entry key ${key}; behavior belongs in native items`)
      }
      const validEvidence = Array.isArray(entry.evidence) && entry.evidence.length > 0
        && entry.evidence.every(reference => typeof reference === 'string' && reference.length > 0)
      if (!validEvidence) report('registry entry must declare at least one non-empty evidence reference')

      let binding: EvidenceEntry['source']
      if (Object.hasOwn(entry, 'source')) {
        const rawBinding = record(entry.source)
        if (rawBinding === undefined || Object.keys(rawBinding).length !== 2
          || typeof rawBinding.path !== 'string' || typeof rawBinding.nativeId !== 'string'
          || rawBinding.nativeId.trim() === '') {
          report('source binding must contain only path and a non-empty nativeId')
        } else if (isAbsolute(rawBinding.path) || rawBinding.path === '' || rawBinding.path.includes('\\')
          || rawBinding.path.includes('\0') || /^[A-Za-z]:/u.test(rawBinding.path)
          || /(?:^|\/)\.\.(?:\/|$)/u.test(rawBinding.path) || /[*?\[\]{}]/u.test(rawBinding.path)) {
          report('source.path must name one safe project-relative native document')
        } else {
          binding = { path: posix.normalize(rawBinding.path), nativeId: rawBinding.nativeId }
        }
      }

      if (previous === violations.length) {
        const evidence = entry.evidence as string[]
        entries.push({
          scope,
          id,
          line,
          registryPath: path,
          evidence,
          evidenceLocations: evidence.map((_, index) => ({
            path,
            line: lineOf(document, lineCounter, ['scopes', scope, id, 'evidence', index]),
          })),
          ...(binding === undefined ? {} : { source: binding }),
        })
      }
    }
  }
  return { entries, files, violations, sourceClaims: [] }
}

export function validateRegistryFiles(files: readonly string[]): RegistryViolation[] {
  const violations: RegistryViolation[] = []
  if (files.length === 0) {
    return [{ path: '.focused-spec/config.yaml', message: 'registry files must be a non-empty array of project-relative YAML paths or patterns' }]
  }
  for (const [index, pattern] of files.entries()) {
    const location = typeof pattern === 'string' ? pattern : `.focused-spec/config.yaml`
    if (typeof pattern !== 'string' || pattern.length === 0 || pattern.trim() === ''
      || isAbsolute(pattern) || pattern.startsWith('!') || pattern.includes('\\') || pattern.includes('\0')
      || /^[A-Za-z]:/u.test(pattern) || PARENT_SEGMENT.test(pattern)) {
      violations.push({ path: location, message: `registry files[${index}] must be a safe non-empty project-relative path pattern` })
    }
  }
  return violations
}

function expandGlobPattern(pattern: string): string[] {
  if (pattern.length > MAX_PATTERN_LENGTH) throw new Error(`glob pattern exceeds ${MAX_PATTERN_LENGTH} characters`)
  let braceDepth = 0
  let parenthesisDepth = 0
  let braces = 0
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === '\\') {
      index += 1
      continue
    }
    if (character === '{' || character === '}') {
      if (++braces > MAX_BRACE_DELIMITERS) throw new Error(`glob pattern exceeds ${MAX_BRACE_DELIMITERS} brace delimiters`)
    }
    if (character === '{') braceDepth += 1
    else if (character === '}') braceDepth = Math.max(0, braceDepth - 1)
    else if (character === '(') parenthesisDepth += 1
    else if (character === ')') parenthesisDepth = Math.max(0, parenthesisDepth - 1)
    if (parenthesisDepth > 2) throw new Error('glob pattern exceeds parenthesis nesting depth 2')
    if (braceDepth + parenthesisDepth > MAX_PATTERN_DEPTH) throw new Error(`glob pattern exceeds nesting depth ${MAX_PATTERN_DEPTH}`)
  }
  const expanded = braceExpand(pattern, { braceExpandMax: MAX_EXPANSIONS + 1 })
  if (expanded.length > MAX_EXPANSIONS) throw new Error(`glob pattern exceeds ${MAX_EXPANSIONS} brace expansions`)
  return expanded
}

async function globFiles(patterns: string[], projectRoot: string): Promise<string[]> {
  return glob(patterns, {
    cwd: projectRoot,
    dot: true,
    nodir: true,
    follow: true,
    nocase: false,
    nobrace: true,
  })
}

export async function loadEvidenceRegistry(
  projectRoot: string,
  files: readonly string[] = [DEFAULT_REGISTRY_PATH],
  selectedScope?: string,
  selectedScenarioId?: string,
): Promise<EvidenceRegistry> {
  const entries: EvidenceEntry[] = []
  const violations = validateRegistryFiles(files)
  const registryFiles: string[] = []
  const sourceClaims: RegistrySourceClaim[] = []
  if (violations.length > 0) return { entries, files: registryFiles, violations, sourceClaims }

  const sources: { pattern: string; expanded: string[] }[] = []
  for (const pattern of files) {
    try {
      sources.push({ pattern, expanded: expandGlobPattern(pattern) })
    } catch (error) {
      violations.push({ path: pattern, message: `cannot discover evidence registry: ${error instanceof Error ? error.message : String(error)}` })
    }
  }
  if (violations.length > 0) return { entries, files: registryFiles, violations, sourceClaims }

  let root: string
  try {
    root = await realpath(projectRoot)
  } catch (error) {
    return {
      entries,
      files: registryFiles,
      sourceClaims,
      violations: [{ path: projectRoot, message: `cannot resolve registry project root: ${error instanceof Error ? error.message : String(error)}` }],
    }
  }

  const claims = new Map<string, string>()
  const canonicalClaims = new Map<string, string>()
  const identities = new Map<string, EvidenceEntry>()
  const duplicates = new Set<string>()
  for (const { pattern, expanded } of sources) {
    let paths: string[]
    try {
      paths = await globFiles(expanded, projectRoot)
    } catch (error) {
      violations.push({ path: pattern, message: `cannot discover evidence registry: ${error instanceof Error ? error.message : String(error)}` })
      continue
    }
    if (paths.length === 0) {
      violations.push({ path: pattern, message: `cannot read evidence registry: missing source ${pattern}; pattern matched no files` })
    }
    for (const matched of paths.sort()) {
      const path = posix.normalize(matched)
      const previousPattern = claims.get(path)
      if (previousPattern !== undefined) {
        violations.push({ path, message: `evidence registry is claimed more than once by ${previousPattern} and ${pattern}` })
        continue
      }
      claims.set(path, pattern)
      if (!YAML_EXTENSION.test(path)) {
        violations.push({ path, message: 'evidence registry source must be a .yaml or .yml file' })
        continue
      }
      try {
        const registry = await realpath(resolve(projectRoot, path))
        const fromRoot = relative(root, registry)
        if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
          violations.push({ path, message: 'evidence registry resolves outside project root' })
          continue
        }
        const previousPath = canonicalClaims.get(registry)
        if (previousPath !== undefined) {
          violations.push({ path, message: `evidence registry is also claimed through ${previousPath}` })
          continue
        }
        canonicalClaims.set(registry, path)
        const parsed = parseEvidenceRegistry(await readFile(registry, 'utf8'), path, selectedScope, selectedScenarioId)
        registryFiles.push(path)
        sourceClaims.push({ key: registry, location: { path, line: 1 } })
        violations.push(...parsed.violations)
        for (const entry of parsed.entries) {
          const key = `${entry.scope}\u0000${entry.id}`
          const previous = identities.get(key)
          if (previous === undefined) {
            identities.set(key, entry)
          } else {
            duplicates.add(key)
            violations.push({
              path: entry.registryPath,
              line: entry.line,
              scope: entry.scope,
              scenarioId: entry.id,
              message: `duplicate registry identity ${entry.scope}/${entry.id}; also registered at ${previous.registryPath}:${previous.line}`,
            })
          }
        }
      } catch (error) {
        violations.push({ path, message: `cannot read evidence registry: ${error instanceof Error ? error.message : String(error)}` })
      }
    }
  }

  for (const [key, entry] of identities) {
    if (!duplicates.has(key)) entries.push(entry)
  }
  entries.sort((left, right) => left.registryPath.localeCompare(right.registryPath) || left.line - right.line)
  violations.sort((left, right) => left.path.localeCompare(right.path)
    || (left.line ?? 0) - (right.line ?? 0)
    || left.message.localeCompare(right.message))
  registryFiles.sort()
  sourceClaims.sort((left, right) => left.key.localeCompare(right.key))
  return { entries, files: registryFiles, violations, sourceClaims }
}
