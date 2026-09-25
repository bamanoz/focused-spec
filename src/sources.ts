import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, sep } from 'node:path'
import fg from 'fast-glob'
import type { DocumentLayout, FocusedSpecConfig, SpecDocument, Violation } from './model.js'
import { parseFocusedSpecDocument } from './parser.js'

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
  const segments = layout.match.split('/')
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
    ? layout.match.replace(SCOPE_TOKEN, capturedScopeSelection === undefined ? '*' : fg.escapePath(capturedScopeSelection))
    : layout.match
  let paths: string[]
  try {
    paths = await fg(pattern, {
      absolute: true,
      cwd: projectRoot,
      dot: true,
      followSymbolicLinks: true,
      ignore: [...(layout.exclude ?? [])],
      onlyFiles: true,
      throwErrorOnBrokenSymbolicLink: true,
      unique: true,
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
  const canonicalClaims = new Map<string, Claim>()
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

    let document: SpecDocument
    try {
      document = parseFocusedSpecDocument(path, await readFile(claim.absolutePath, 'utf8'), claim.scope)
    } catch (error) {
      if (selectedScope === undefined || claim.scope === selectedScope) violations.push({ path, message: `cannot read document: ${error instanceof Error ? error.message : String(error)}` })
      continue
    }
    const existing = scopes.get(claim.scope)
    if (existing === undefined) scopes.set(claim.scope, [document])
    else existing.push(document)
  }

  const sortedScopes = new Map<string, readonly SpecDocument[]>()
  for (const name of [...scopes.keys()].sort(compareText)) {
    sortedScopes.set(name, (scopes.get(name) ?? []).sort((left, right) => compareText(left.path, right.path)))
  }
  violations.sort((left, right) => compareText(left.path, right.path) || compareText(left.message, right.message))
  return { scopes: sortedScopes, violations }
}
