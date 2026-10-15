import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, sep } from 'node:path'
import type { CatalogDocument, SourceLocation } from './format-api.js'
import { FormatClient } from './format-client.js'
import { expandGlobPattern, globFiles } from './glob.js'
import type { DocumentLayout, FocusedSpecConfig, NativeDocument, NativeItem, Scenario, SpecDocument, Violation } from './model.js'
import { isScopeName } from './model.js'
import type { OperationTimings } from './timings.js'

const SCOPE_TOKEN = '{scope}'

interface Claim {
  readonly absolutePath: string
  readonly path: string
  readonly layoutIndex: number
  readonly scope: string
}

export { isScopeName } from './model.js'

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

interface EnrollmentCandidate {
  readonly document: number
  readonly item: number
  readonly id: string
  readonly evidence: readonly string[]
  readonly evidenceLocations?: readonly SourceLocation[]
  readonly location: SourceLocation
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

  const claims = (await Promise.all(config.specifications.documents.map(async (layout, layoutIndex) => {
    if (selectedScope === undefined) return claimsForLayout(projectRoot, layout, layoutIndex, violations)
    if (layout.scope !== undefined) {
      return layout.scope === selectedScope
        ? claimsForLayout(projectRoot, layout, layoutIndex, violations)
        : claimsForLayout(projectRoot, layout, layoutIndex, [])
    }
    const allClaims = await claimsForLayout(projectRoot, layout, layoutIndex, [])
    const selectedClaims = await claimsForLayout(projectRoot, layout, layoutIndex, violations, selectedScope)
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
  const unavailableFormats = new Set<string>()
  const startedFormats = new Set<string>()
  for (const layout of config.specifications.documents) {
    if (formatClients.has(layout.format)) continue
    const format = config.specifications.formats[layout.format]
    if (format !== undefined) formatClients.set(layout.format, new FormatClient(projectRoot, format))
  }

  try {
    for (const [path, pathClaims] of claimsByPath) {
      if (pathClaims.length > 1) {
        if (selectedScope === undefined || pathClaims.some(claim => claim.scope === selectedScope)) {
          const locations = pathClaims.map(claim => `layout ${claim.layoutIndex + 1} (scope ${claim.scope})`).join(', ')
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
        if (selectedScope === undefined || claim.scope === selectedScope || previousClaim.scope === selectedScope) violations.push({ path, message: `document is also claimed through ${previousClaim.path}` })
        continue
      }
      canonicalClaims.set(canonicalPath, claim)

      if (selectedScope !== undefined && claim.scope !== selectedScope) continue
      const layout = config.specifications.documents[claim.layoutIndex]!
      const client = formatClients.get(layout.format)
      let source: string
      try {
        source = await readFile(claim.absolutePath, 'utf8')
      } catch (error) {
        violations.push({ path, message: `cannot parse native document: ${error instanceof Error ? error.message : String(error)}` })
        continue
      }
      let document: NativeDocument
      try {
        if (client === undefined) throw new Error(`unknown format ${layout.format}`)
        const coldStart = !startedFormats.has(layout.format)
        startedFormats.add(layout.format)
        document = timings === undefined
          ? await client.parse(path, source, claim.scope)
          : await timings.format({ formatId: layout.format, path, scope: claim.scope, coldStart }, () => client.parse(path, source, claim.scope))
      } catch (error) {
        unavailableFormats.add(layout.format)
        violations.push({ path, message: `cannot parse native document: ${error instanceof Error ? error.message : String(error)}` })
        continue
      }
      nativeDocuments.push(document)
      const existing = scopes.get(claim.scope)
      const bound: SpecDocument = { path: document.path, scope: document.scope, scenarios: [] }
      if (existing === undefined) scopes.set(claim.scope, [bound])
      else existing.push(bound)
    }

    for (const document of nativeDocuments) {
      if (selectedScenarioId === undefined) violations.push(...document.violations)
      else violations.push(...document.violations.filter(violation => violation.scenarioId === undefined || violation.scenarioId === selectedScenarioId))
    }

    const catalog: CatalogDocument[] = nativeDocuments.map(document => ({
      path: document.path,
      scope: document.scope,
      items: document.items.map(item => ({
        line: item.line,
        name: item.name,
        nativeIds: item.nativeIds,
        ...(item.markerId === undefined ? {} : { markerId: item.markerId }),
        ...(item.evidence === undefined ? {} : { evidence: item.evidence }),
        ...(item.evidenceLocations === undefined ? {} : { evidenceLocations: item.evidenceLocations }),
      })),
    }))
    const candidates: EnrollmentCandidate[] = []
    for (const [documentIndex, document] of nativeDocuments.entries()) {
      for (const [itemIndex, item] of document.items.entries()) {
        if (item.markerId === undefined || item.evidence === undefined) continue
        candidates.push({
          document: documentIndex,
          item: itemIndex,
          id: item.markerId,
          evidence: item.evidence,
          ...(item.evidenceLocations === undefined ? {} : { evidenceLocations: item.evidenceLocations }),
          location: { path: item.path, line: item.line },
        })
      }
    }

    const sourceClaims = new Map<string, SourceLocation>()
    for (const [formatId, client] of formatClients) {
      if (unavailableFormats.has(formatId)) continue
      try {
        const result = await client.bind(catalog, {
          ...(selectedScope === undefined ? {} : { scope: selectedScope }),
          ...(selectedScenarioId === undefined ? {} : { scenarioId: selectedScenarioId }),
        })
        if (result === undefined) continue
        for (const diagnostic of result.diagnostics) {
          if (diagnostic.scope !== undefined && diagnostic.focusedId !== undefined) {
            if (selectedScope !== undefined && diagnostic.scope !== selectedScope) continue
            if (selectedScenarioId !== undefined && diagnostic.focusedId !== selectedScenarioId) continue
          }
          violations.push({ path: diagnostic.location.path, line: diagnostic.location.line, message: diagnostic.message, ...(diagnostic.focusedId === undefined ? {} : { scenarioId: diagnostic.focusedId }) })
        }
        candidates.push(...result.enrollments)
        for (const claim of result.sourceClaims) {
          const previous = sourceClaims.get(claim.key)
          if (previous === undefined) sourceClaims.set(claim.key, claim.location)
          else violations.push({ path: claim.location.path, line: claim.location.line, message: `format evidence source claim ${JSON.stringify(claim.key)} overlaps ${previous.path}:${previous.line}` })
        }
      } catch (error) {
        violations.push({ path: formatId, message: `cannot bind native catalog: ${error instanceof Error ? error.message : String(error)}` })
      }
    }

    const boundItems = new Set<NativeItem>()
    const identities = new Map<string, Scenario>()
    const boundByDocument = new Map<string, Scenario[]>()
    for (const candidate of candidates) {
      if (selectedScenarioId !== undefined && candidate.id !== selectedScenarioId) continue
      const document = nativeDocuments[candidate.document]
      const item = document?.items[candidate.item]
      if (document === undefined || item === undefined) {
        violations.push({ path: candidate.location.path, line: candidate.location.line, scenarioId: candidate.id, message: `format enrollment targets absent catalog item ${candidate.document}/${candidate.item}` })
        continue
      }
      if (selectedScope !== undefined && document.scope !== selectedScope) continue
      if (item.markerId !== undefined && item.markerId !== candidate.id) {
        violations.push({ path: candidate.location.path, line: candidate.location.line, scenarioId: candidate.id, message: `format enrollment ID conflicts with native marker ${item.markerId}` })
        continue
      }
      if (boundItems.has(item)) {
        violations.push({ path: candidate.location.path, line: candidate.location.line, scenarioId: candidate.id, message: 'native item is enrolled more than once within its scope' })
        continue
      }
      const identity = `${document.scope}\u0000${candidate.id}`
      const previous = identities.get(identity)
      if (previous !== undefined) {
        violations.push({ path: candidate.location.path, line: candidate.location.line, scenarioId: candidate.id, message: `duplicate focused ID within scope ${document.scope}; first enrolled at ${previous.evidenceLocation?.path ?? previous.path}:${previous.evidenceLocation?.line ?? previous.line}` })
        continue
      }
      boundItems.add(item)
      const scenario: Scenario = {
        id: candidate.id,
        scope: document.scope,
        path: item.path,
        line: item.line,
        name: item.name,
        evidence: candidate.evidence,
        evidenceLocation: candidate.location,
        ...(candidate.evidenceLocations === undefined ? {} : { evidenceLocations: candidate.evidenceLocations }),
      }
      identities.set(identity, scenario)
      const documentKey = `${document.scope}\u0000${document.path}`
      const previousScenarios = boundByDocument.get(documentKey)
      if (previousScenarios === undefined) boundByDocument.set(documentKey, [scenario])
      else previousScenarios.push(scenario)
    }

    const markers = new Map<string, NativeItem[]>()
    for (const document of nativeDocuments) {
      for (const item of document.items) {
        if (item.markerId === undefined || (selectedScenarioId !== undefined && item.markerId !== selectedScenarioId)) continue
        const identity = `${document.scope}\u0000${item.markerId}`
        const prior = markers.get(identity)
        if (prior === undefined) markers.set(identity, [item])
        else prior.push(item)
        if (!boundItems.has(item)) violations.push({ path: item.path, line: item.line, scenarioId: item.markerId, message: 'focused marker has no format-provided evidence enrollment' })
      }
    }
    for (const items of markers.values()) {
      const item = items[0]
      if (item !== undefined && item.markerId !== undefined && items.length > 1) violations.push({ path: item.path, line: item.line, scenarioId: item.markerId, message: `duplicate focused marker within scope ${item.scope}` })
    }

    for (const [scope, documents] of scopes) {
      scopes.set(scope, documents.map(document => ({ ...document, scenarios: boundByDocument.get(`${scope}\u0000${document.path}`) ?? [] })))
    }
  } finally {
    for (const client of formatClients.values()) client.close()
  }

  const sortedScopes = new Map<string, readonly SpecDocument[]>()
  for (const name of [...scopes.keys()].sort(compareText)) sortedScopes.set(name, (scopes.get(name) ?? []).sort((left, right) => compareText(left.path, right.path)))
  violations.sort((left, right) => compareText(left.path, right.path) || (left.line ?? 0) - (right.line ?? 0) || compareText(left.message, right.message))
  return { scopes: sortedScopes, violations }
}
