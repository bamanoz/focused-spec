import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, sep } from 'node:path'
import { expandGlobPattern, globFiles } from './glob.js'
import type { DocumentLayout, FocusedSpecConfig, NativeDocument, NativeItem, Scenario, SpecDocument, Violation } from './model.js'
import { FormatClient } from './format-client.js'
import { loadEvidenceRegistry } from './registry.js'
import type { OperationTimings } from './timings.js'

const SCOPE_TOKEN = '{scope}'
const SCOPE_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?$/u

interface Claim {
  readonly absolutePath: string
  readonly path: string
  readonly layoutIndex: number
  readonly scope: string
}

export function isScopeName(name: string): boolean {
  return SCOPE_NAME.test(name)
}

function portable(path: string): string {
  return path.split('\\').join('/')
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}


function capturedScope(layout: DocumentLayout, path: string): string | undefined {
  const segments = layout.match.replace(/^(?:\.\/)+/u, '').split('/')
  const captureIndex = segments.findIndex(segment => segment.includes(SCOPE_TOKEN))
  const captureSegment = segments[captureIndex]
  if (captureIndex < 0 || captureSegment === undefined) return undefined
  const pathSegments = path.split('/')
  const actualIndex = segments.slice(captureIndex + 1).includes('**')
    ? captureIndex
    : pathSegments.length - (segments.length - captureIndex)
  const actual = pathSegments[actualIndex]
  if (actual === undefined) return undefined
  const [prefix = '', suffix = ''] = captureSegment.split(SCOPE_TOKEN)
  if (!actual.startsWith(prefix) || !actual.endsWith(suffix)) return undefined
  const end = actual.length - suffix.length
  const name = actual.slice(prefix.length, end)
  return isScopeName(name) ? name : undefined
}

async function claimsForLayout(
  projectRoot: string,
  layout: DocumentLayout,
  layoutIndex: number,
  violations: Violation[],
  capturedScopeSelection?: string,
): Promise<Claim[]> {
  if (layout.scope !== undefined && !isScopeName(layout.scope)) {
    violations.push({
      path: '.focused-spec/config.yaml',
      message: `layout ${layoutIndex + 1} has invalid scope name ${layout.scope}`,
    })
    return []
  }
  const pattern = layout.scope === undefined
    ? layout.match.replace(SCOPE_TOKEN, capturedScopeSelection ?? '*')
    : layout.match
  let paths: string[]
  try {
    paths = await globFiles(expandGlobPattern(pattern), {
      absolute: true,
      cwd: projectRoot,
      ignore: (layout.exclude ?? []).flatMap(expandGlobPattern),
    })
  } catch (error) {
    violations.push({
      path: '.focused-spec/config.yaml',
      message: `cannot discover documents for layout ${layoutIndex + 1} (${layout.match}): ${error instanceof Error ? error.message : String(error)}`,
    })
    return []
  }

  return paths.sort(compareText).flatMap(absolutePath => {
    const path = portable(relative(projectRoot, absolutePath))
    const scope = layout.scope ?? capturedScope(layout, path)
    if (scope === undefined) {
      violations.push({
        path,
        message: `document matched layout ${layoutIndex + 1} but its scope capture is not a path-safe non-empty fragment`,
      })
      return []
    }
    return [{ absolutePath, path, layoutIndex, scope }]
  })
}

export async function discoverDocuments(
  projectRoot: string,
  config: FocusedSpecConfig,
  selectedScope?: string,
  selectedScenarioId?: string,
  timings?: OperationTimings,
): Promise<{
  scopes: ReadonlyMap<string, readonly SpecDocument[]>
  violations: readonly Violation[]
}> {
  const violations: Violation[] = []
  let projectRealPath: string
  try {
    projectRealPath = await realpath(projectRoot)
  } catch (error) {
    return {
      scopes: new Map(),
      violations: [{ path: projectRoot, message: `cannot resolve project root: ${error instanceof Error ? error.message : String(error)}` }],
    }
  }

  const claims = (await Promise.all(config.specifications.documents.map(async (layout, index) => {
    if (selectedScope === undefined) return claimsForLayout(projectRoot, layout, index, violations)
    if (layout.scope !== undefined) {
      return layout.scope === selectedScope
        ? claimsForLayout(projectRoot, layout, index, violations)
        : claimsForLayout(projectRoot, layout, index, [])
    }
    const allClaims = await claimsForLayout(projectRoot, layout, index, [])
    const selectedClaims = await claimsForLayout(projectRoot, layout, index, violations, selectedScope)
    return [...allClaims.filter(claim => claim.scope !== selectedScope), ...selectedClaims]
  }))).flat().sort((left, right) => compareText(left.path, right.path) || left.layoutIndex - right.layoutIndex)

  const claimsByPath = new Map<string, Claim[]>()
  for (const claim of claims) {
    const existing = claimsByPath.get(claim.path)
    if (existing === undefined) claimsByPath.set(claim.path, [claim])
    else existing.push(claim)
  }

  const scopes = new Map<string, SpecDocument[]>()
  const nativeDocuments: NativeDocument[] = []
  const canonicalClaims = new Map<string, Claim>()
  const formatClients = new Map<string, FormatClient>()
  try {
  for (const [path, pathClaims] of claimsByPath) {
    if (pathClaims.length > 1) {
      if (selectedScope === undefined || pathClaims.some(claim => claim.scope === selectedScope)) {
        const locations = pathClaims.map(claim => (
          `layout ${claim.layoutIndex + 1} (scope ${claim.scope})`
        )).join(', ')
        violations.push({ path, message: `document is claimed more than once: ${locations}` })
      }
      continue
    }

    const claim = pathClaims[0]
    if (claim === undefined) continue
    let canonicalPath: string
    try {
      canonicalPath = await realpath(claim.absolutePath)
    } catch (error) {
      if (selectedScope === undefined || claim.scope === selectedScope) violations.push({ path, message: `cannot resolve document path: ${error instanceof Error ? error.message : String(error)}` })
      continue
    }
    const fromRoot = relative(projectRealPath, canonicalPath)
    if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
      if (selectedScope === undefined || claim.scope === selectedScope) violations.push({ path, message: `document resolves outside project root: ${canonicalPath}` })
      continue
    }

    const previousClaim = canonicalClaims.get(canonicalPath)
    if (previousClaim !== undefined) {
      if (selectedScope === undefined || claim.scope === selectedScope || previousClaim.scope === selectedScope) {
        violations.push({ path, message: `document is also claimed through ${previousClaim.path}` })
      }
      continue
    }
    canonicalClaims.set(canonicalPath, claim)

    if (selectedScope !== undefined && claim.scope !== selectedScope) continue
    let document: NativeDocument
    try {
      const layout = config.specifications.documents[claim.layoutIndex]!
      const format = config.specifications.formats[layout.format]
      if (format === undefined) throw new Error(`unknown format ${layout.format}`)
      const source = await readFile(claim.absolutePath, 'utf8')
      let client = formatClients.get(layout.format)
      const coldStart = client === undefined
      if (client === undefined) {
        client = new FormatClient(projectRoot, format)
        formatClients.set(layout.format, client)
      }
      document = timings === undefined
        ? await client.parse(path, source, claim.scope)
        : await timings.format({ formatId: layout.format, path, scope: claim.scope, coldStart }, () => client.parse(path, source, claim.scope))
    } catch (error) {
      if (selectedScope === undefined || claim.scope === selectedScope) violations.push({ path, message: `cannot parse native document: ${error instanceof Error ? error.message : String(error)}` })
      continue
    }
    nativeDocuments.push(document)
    // Documents establish scope existence even if no item is enrolled.
    const existing = scopes.get(claim.scope)
    const bound: SpecDocument = { path: document.path, scope: document.scope, scenarios: [] }
    if (existing === undefined) scopes.set(claim.scope, [bound])
    else existing.push(bound)
  }
  } finally {
    for (const client of formatClients.values()) client.close()
  }

  const registry = await loadEvidenceRegistry(projectRoot, config.evidence?.files, selectedScope, selectedScenarioId)
  violations.push(...registry.violations)
  const byMarker = new Map<string, NativeItem[]>()
  const byDocument = new Map<string, NativeDocument>()
  const boundByDocument = new Map<string, Scenario[]>()
  for (const document of nativeDocuments) {
    byDocument.set(`${document.scope}\u0000${document.path}`, document)
    if (selectedScenarioId === undefined) violations.push(...document.violations)
    else violations.push(...document.violations.filter(violation => violation.scenarioId === undefined || violation.scenarioId === selectedScenarioId))
    for (const item of document.items) {
      if (item.markerId === undefined || (selectedScenarioId !== undefined && item.markerId !== selectedScenarioId)) continue
      const key = `${item.scope}\u0000${item.markerId}`
      const previous = byMarker.get(key)
      if (previous === undefined) byMarker.set(key, [item])
      else previous.push(item)
    }
  }
  const registeredMarkers = new Set<string>()
  const boundItems = new Set<NativeItem>()
  for (const entry of registry.entries) {
    const key = `${entry.scope}\u0000${entry.id}`
    registeredMarkers.add(key)
    const matches = entry.source === undefined
      ? byMarker.get(key) ?? []
      : (byDocument.get(`${entry.scope}\u0000${entry.source.path}`)?.items ?? []).filter(item => item.nativeIds.includes(entry.source!.nativeId))
    if (matches.length !== 1) {
      violations.push({ path: entry.registryPath, line: entry.line, scenarioId: entry.id,
        message: `registry binding ${entry.scope}/${entry.id} must resolve uniquely to one native item; found ${matches.length}` })
      continue
    }
    const item = matches[0]!
    if (entry.source !== undefined && item.markerId !== undefined) {
      violations.push({ path: item.path, line: item.line, scenarioId: entry.id, message: 'external native-ID binding requires an unmarked native item' })
      continue
    }
    if (boundItems.has(item)) {
      violations.push({ path: item.path, line: item.line, scenarioId: entry.id, message: 'native item is bound more than once within its scope' })
      continue
    }
    boundItems.add(item)
    const documentKey = `${item.scope}\u0000${item.path}`
    const scenario: Scenario = { id: entry.id, scope: item.scope, path: item.path, line: item.line, name: item.name, evidence: entry.evidence }
    const previous = boundByDocument.get(documentKey)
    if (previous === undefined) boundByDocument.set(documentKey, [scenario])
    else previous.push(scenario)
  }
  for (const [key, items] of byMarker) {
    const item = items[0]!
    if (items.length > 1) violations.push({ path: item.path, line: item.line, scenarioId: item.markerId!, message: `duplicate focused marker within scope ${item.scope}` })
    if (!registeredMarkers.has(key)) violations.push({ path: item.path, line: item.line, scenarioId: item.markerId!, message: 'focused marker has no evidence registry entry' })
  }
  for (const [scope, documents] of scopes) {
    scopes.set(scope, documents.map(document => ({ ...document, scenarios: boundByDocument.get(`${scope}\u0000${document.path}`) ?? [] })))
  }

  const sortedScopes = new Map<string, readonly SpecDocument[]>()
  for (const name of [...scopes.keys()].sort(compareText)) {
    sortedScopes.set(name, (scopes.get(name) ?? []).sort((left, right) => compareText(left.path, right.path)))
  }
  violations.sort((left, right) => compareText(left.path, right.path) || compareText(left.message, right.message))
  return { scopes: sortedScopes, violations }
}
