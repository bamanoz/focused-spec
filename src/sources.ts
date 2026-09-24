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
  readonly scope?: string
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

function selectedMatch(layout: DocumentLayout, selectedScope: string | undefined): string {
  if (layout.scope === 'baseline') return layout.match
  return layout.match.replace(SCOPE_TOKEN, selectedScope === undefined ? '*' : fg.escapePath(selectedScope))
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
  selectedScope: string | undefined,
  violations: Violation[],
): Promise<Claim[]> {
  if (selectedScope !== undefined && layout.scope !== 'baseline' && !isScopeName(selectedScope)) return []
  const pattern = selectedMatch(layout, selectedScope)
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
    if (layout.scope === 'baseline') return [{ absolutePath, path, layoutIndex }]
    const scope = capturedScope(layout, path)
    if (scope === undefined || (selectedScope !== undefined && scope !== selectedScope)) {
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
  baseline: readonly SpecDocument[]
  scopes: ReadonlyMap<string, readonly SpecDocument[]>
  violations: readonly Violation[]
}> {
  const violations: Violation[] = []
  let projectRealPath: string
  try {
    projectRealPath = await realpath(projectRoot)
  } catch (error) {
    return {
      baseline: [],
      scopes: new Map(),
      violations: [{ path: projectRoot, message: `cannot resolve project root: ${error instanceof Error ? error.message : String(error)}` }],
    }
  }

  const claims = (await Promise.all(config.specifications.documents.map((layout, index) => (
    claimsForLayout(projectRoot, layout, index, selectedScope, violations)
  )))).flat().sort((left, right) => compareText(left.path, right.path) || left.layoutIndex - right.layoutIndex)

  const claimsByPath = new Map<string, Claim[]>()
  for (const claim of claims) {
    const existing = claimsByPath.get(claim.path)
    if (existing === undefined) claimsByPath.set(claim.path, [claim])
    else existing.push(claim)
  }

  const baseline: SpecDocument[] = []
  const scopes = new Map<string, SpecDocument[]>()
  const canonicalClaims = new Map<string, string>()
  for (const [path, pathClaims] of claimsByPath) {
    if (pathClaims.length > 1) {
      const locations = pathClaims.map(claim => (
        `layout ${claim.layoutIndex + 1} (${claim.scope === undefined ? 'baseline' : `scope ${claim.scope}`})`
      )).join(', ')
      violations.push({ path, message: `document is claimed more than once: ${locations}` })
      continue
    }

    const claim = pathClaims[0]
    if (claim === undefined) continue
    let canonicalPath: string
    try {
      canonicalPath = await realpath(claim.absolutePath)
    } catch (error) {
      violations.push({ path, message: `cannot resolve document path: ${error instanceof Error ? error.message : String(error)}` })
      continue
    }
    const fromRoot = relative(projectRealPath, canonicalPath)
    if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
      violations.push({ path, message: `document resolves outside project root: ${canonicalPath}` })
      continue
    }

    const previousPath = canonicalClaims.get(canonicalPath)
    if (previousPath !== undefined) {
      violations.push({ path, message: `document is also claimed through ${previousPath}` })
      continue
    }
    canonicalClaims.set(canonicalPath, path)

    let document: SpecDocument
    try {
      document = parseFocusedSpecDocument(path, await readFile(claim.absolutePath, 'utf8'))
    } catch (error) {
      violations.push({ path, message: `cannot read document: ${error instanceof Error ? error.message : String(error)}` })
      continue
    }
    if (claim.scope === undefined) baseline.push(document)
    else {
      const existing = scopes.get(claim.scope)
      if (existing === undefined) scopes.set(claim.scope, [document])
      else existing.push(document)
    }
  }

  baseline.sort((left, right) => compareText(left.path, right.path))
  const sortedScopes = new Map<string, readonly SpecDocument[]>()
  for (const name of [...scopes.keys()].sort(compareText)) {
    sortedScopes.set(name, (scopes.get(name) ?? []).sort((left, right) => compareText(left.path, right.path)))
  }
  violations.sort((left, right) => compareText(left.path, right.path) || compareText(left.message, right.message))
  return { baseline, scopes: sortedScopes, violations }
}
