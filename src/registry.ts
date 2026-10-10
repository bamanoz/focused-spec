import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, posix, relative, resolve, sep } from 'node:path'
import { LineCounter, parseDocument } from 'yaml'
import type { EvidenceEntry, Violation } from './model.js'
import { STABLE_ID } from './parser.js'
import { isScopeName } from './sources.js'

export interface EvidenceRegistry {
  readonly entries: readonly EvidenceEntry[]
  readonly violations: readonly Violation[]
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

export function parseEvidenceRegistry(
  source: string,
  path = '.focused-spec/evidence.yaml',
  selectedScope?: string,
  selectedScenarioId?: string,
): EvidenceRegistry {
  const entries: EvidenceEntry[] = []
  const violations: Violation[] = []
  const lineCounter = new LineCounter()
  const document = parseDocument(source, { lineCounter })
  if (document.errors.length > 0) return { entries, violations: document.errors.map(error => ({ path, line: lineCounter.linePos(error.pos[0]).line, message: `invalid evidence registry YAML: ${error.message}` })) }
  let value: unknown
  try { value = document.toJS({ maxAliasCount: 0 }) }
  catch (error) { return { entries, violations: [{ path, message: `invalid evidence registry: ${error instanceof Error ? error.message : String(error)}` }] } }
  const root = record(value)
  if (root === undefined || Object.keys(root).length !== 1 || !Object.hasOwn(root, 'scopes')) {
    return { entries, violations: [{ path, message: 'evidence registry must contain only a scopes mapping; behavior belongs in native items' }] }
  }
  const scopes = record(root.scopes)
  if (scopes === undefined) return { entries, violations: [{ path, message: 'evidence registry scopes must be a mapping' }] }
  for (const [scope, rawEntries] of Object.entries(scopes)) {
    if (selectedScope !== undefined && selectedScope !== scope) continue
    if (!isScopeName(scope)) { violations.push({ path, message: `invalid registry scope name ${scope}` }); continue }
    const scopedEntries = record(rawEntries)
    if (scopedEntries === undefined) { violations.push({ path, message: `registry scope ${scope} must be a mapping of focused IDs` }); continue }
    for (const [id, rawEntry] of Object.entries(scopedEntries)) {
      if (selectedScenarioId !== undefined && id !== selectedScenarioId) continue
      const node: unknown = document.getIn(['scopes', scope, id], true)
      const offset = node !== null && typeof node === 'object' && 'range' in node && Array.isArray(node.range) && typeof node.range[0] === 'number' ? node.range[0] : 0
      const line = lineCounter.linePos(offset).line
      const report = (message: string): void => { violations.push({ path, line, scenarioId: id, message }) }
      const previous = violations.length
      if (!STABLE_ID.test(id)) report(`invalid stable ID ${id}; expected a lowercase dotted ID`)
      const entry = record(rawEntry)
      if (entry === undefined) { report('registry entry must be a mapping of evidence and optional source'); continue }
      for (const key of Object.keys(entry)) if (key !== 'evidence' && key !== 'source') report(`unknown registry entry key ${key}; behavior belongs in native items`)
      if (!Array.isArray(entry.evidence) || entry.evidence.length === 0 || !entry.evidence.every(reference => typeof reference === 'string' && reference.length > 0)) {
        report('registry entry must declare at least one non-empty evidence reference')
      }
      let binding: EvidenceEntry['source']
      if (Object.hasOwn(entry, 'source')) {
        const rawBinding = record(entry.source)
        if (rawBinding === undefined || Object.keys(rawBinding).length !== 2 || typeof rawBinding.path !== 'string' || typeof rawBinding.nativeId !== 'string' || rawBinding.nativeId.trim() === '') {
          report('source binding must contain only path and a non-empty nativeId')
        } else if (isAbsolute(rawBinding.path) || rawBinding.path === '' || rawBinding.path.includes('\\') || rawBinding.path.includes('\0') || /(?:^|\/)\.\.(?:\/|$)/u.test(rawBinding.path) || /[*?\[\]{}]/u.test(rawBinding.path) || !/\.(?:md|feature)$/iu.test(rawBinding.path)) {
          report('source.path must name one safe project-relative native .md or .feature document')
        } else {
          binding = { path: posix.normalize(rawBinding.path), nativeId: rawBinding.nativeId }
        }
      }
      if (previous === violations.length) entries.push({ scope, id, line, evidence: entry.evidence as string[], ...(binding === undefined ? {} : { source: binding }) })
    }
  }
  return { entries, violations }
}

export async function loadEvidenceRegistry(projectRoot: string, selectedScope?: string, selectedScenarioId?: string): Promise<EvidenceRegistry> {
  const path = '.focused-spec/evidence.yaml'
  try {
    const [root, registry] = await Promise.all([realpath(projectRoot), realpath(resolve(projectRoot, path))])
    const fromRoot = relative(root, registry)
    if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) return { entries: [], violations: [{ path, message: 'evidence registry resolves outside project root' }] }
    return parseEvidenceRegistry(await readFile(registry, 'utf8'), path, selectedScope, selectedScenarioId)
  } catch (error) {
    return { entries: [], violations: [{ path, message: `cannot read evidence registry: ${error instanceof Error ? error.message : String(error)}` }] }
  }
}
