import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { lstat, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { glob } from 'glob'
import { parse } from 'yaml'
import { discoverDocuments, loadConfig } from '../dist/index.js'
import { runProcess } from './process.ts'
import type { EvalGate } from './types.ts'

export const LEGACY_VERSION = '0.5.0'
const PACKAGE = 'node_modules/focused-spec/'
const INTEGRATION = '.omp/skills/focused-spec/'
const COMMAND = '.omp/commands/focused-spec.md'
const BLOCKED = ['go-unit::./auth::TestBlockedAccount', 'pytest-functional::tests/functional/test_auth.py::test_blocked_account']
const ACTIVE = ['go-unit::./auth::TestValidActiveAccount', 'pytest-functional::tests/functional/test_auth.py::test_valid_active_account']
const OCCURRENCES = [
  { scope: 'current', id: 'auth.login.blocked-account', path: 'specs/account-authentication.md', name: 'Scenario: Blocked account submits valid credentials', evidence: BLOCKED },
  { scope: 'current', id: 'auth.login.active-account', path: 'specs/account-authentication.md', name: 'Scenario: Active account submits valid credentials', evidence: ACTIVE },
  { scope: 'refresh', id: 'auth.login.blocked-account', path: 'changes/refresh/spec.md', name: 'Scenario: Blocked account submits valid credentials', evidence: BLOCKED },
] as const

export interface UpgradeBaseline {
  readonly artifacts: ReadonlyMap<string, string>
  readonly config: unknown
  readonly manifest: unknown
  readonly documents: ReadonlyMap<string, string>
}

const hash = (source: Buffer | string): string => createHash('sha256').update(source).digest('hex')
const gate = (name: string, passed: boolean, detail: string): EvalGate => ({ name, passed, detail })

export function isUpgradeArtifact(path: string): boolean {
  return path.startsWith(PACKAGE) || path.startsWith(INTEGRATION) || path === COMMAND
}

export async function captureUpgradeBaseline(workspace: string, candidateRoot: string): Promise<UpgradeBaseline> {
  const artifacts = new Map<string, string>()
  for (const path of await glob('**/*', { cwd: candidateRoot, nodir: true, dot: true, follow: true, nocase: false })) {
    artifacts.set(PACKAGE + path, hash(await readFile(join(candidateRoot, path))))
  }
  artifacts.set(INTEGRATION + 'SKILL.md', hash(await readFile(join(candidateRoot, 'skills/focused-spec/SKILL.md'))))
  artifacts.set(COMMAND, hash(await readFile(join(candidateRoot, 'skills/commands/oh-my-pi/focused-spec.md'))))
  const documents = new Map<string, string>()
  for (const path of new Set(OCCURRENCES.map(item => item.path))) documents.set(path, await readFile(join(workspace, path), 'utf8'))
  return {
    artifacts,
    config: parse(await readFile(join(workspace, '.focused-spec/config.yaml'), 'utf8')) as unknown,
    manifest: JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8')) as unknown,
    documents,
  }
}

export async function serveUpgradeCandidate(tarball: string, metadata: Record<string, unknown>): Promise<{ url: string; close(): Promise<void> }> {
  const bytes = await readFile(tarball)
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  let url = ''
  const server = createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(404).end()
    } else if (request.url?.split('?')[0] === '/focused-spec') {
      const version = String(metadata.version)
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({
        name: 'focused-spec', 'dist-tags': { latest: version },
        versions: { [version]: { ...metadata, dist: { integrity, tarball: `${url}/focused-spec/-/candidate.tgz` } } },
      }))
    } else if (request.url === '/focused-spec/-/candidate.tgz') {
      response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': bytes.length }).end(bytes)
    } else {
      response.writeHead(302, { location: `https://registry.npmjs.org${request.url ?? '/'}` }).end()
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve() })
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('upgrade registry has no TCP address')
  url = `http://127.0.0.1:${address.port}`
  return { url, close: async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error === undefined ? resolve() : reject(error)))
  } }
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected object')
  return value as Record<string, unknown>
}

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered)
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, ordered(child)]))
  return value
}
const same = (left: unknown, right: unknown): boolean => JSON.stringify(ordered(left)) === JSON.stringify(ordered(right))

function nativeText(source: string): string {
  return source.replace(/<!--\s*focused-spec:id=[^>]+-->/gu, '')
    .replace(/^- \*\*(?:ID|EVIDENCE|REVISES)\*\*:.*(?:\r?\n|$)/gmu, '')
    .split(/\r?\n/u).map(line => line.trim()).filter(Boolean).join('\n')
}

export async function upgradeArtifactsGate(workspace: string, baseline: UpgradeBaseline): Promise<EvalGate> {
  const paths = await glob(['node_modules/focused-spec/**/*', '.omp/skills/focused-spec/**/*', COMMAND], { cwd: workspace, nodir: true, dot: true, follow: true, nocase: false })
  const changed: string[] = paths.filter(path => !baseline.artifacts.has(path))
  for (const [path, expected] of baseline.artifacts) {
    try {
      if (!(await lstat(join(workspace, path))).isFile() || hash(await readFile(join(workspace, path))) !== expected) changed.push(path)
    } catch { changed.push(path) }
  }
  return gate('upgrade-artifacts', changed.length === 0, changed.length === 0
    ? 'installed package, loader and wrapper match independent candidate; no stale package-owned files'
    : `missing, altered or extra upgrade artifacts: ${changed.join(', ')}`)
}

export async function upgradePreservationGate(workspace: string, baseline: UpgradeBaseline): Promise<EvalGate> {
  const problems: string[] = []
  try {
    const originalConfig = { ...object(baseline.config), version: 3 }
    const finalConfig = object(parse(await readFile(join(workspace, '.focused-spec/config.yaml'), 'utf8')))
    delete finalConfig.evidence
    if (!same(originalConfig, finalConfig)) problems.push('configuration changed outside version/evidence setup')
    const manifest = object(JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8')))
    const withoutFocused = (value: Record<string, unknown>) => {
      const result = { ...value }
      for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        if (result[key] !== undefined) {
          const dependencies = { ...object(result[key]) }
          delete dependencies['focused-spec']
          result[key] = dependencies
        }
      }
      return result
    }
    if (!same(withoutFocused(object(baseline.manifest)), withoutFocused(manifest))) problems.push('unrelated manifest changes')
    for (const [path, before] of baseline.documents) {
      const after = await readFile(join(workspace, path), 'utf8')
      if (nativeText(before) !== nativeText(after)) problems.push(`native behavior/content changed: ${path}`)
    }
    const loaded = await loadConfig(workspace)
    if (loaded.config === undefined) problems.push('current configuration invalid')
    else {
      const discovery = await discoverDocuments(workspace, loaded.config)
      problems.push(...discovery.violations.map(item => item.message))
      const scenarios = [...discovery.scopes.values()].flat().flatMap(document => document.scenarios)
      if (scenarios.length !== OCCURRENCES.length) problems.push(`expected ${OCCURRENCES.length} occurrences, found ${scenarios.length}`)
      for (const expected of OCCURRENCES) {
        const matches = scenarios.filter(item => item.scope === expected.scope && item.id === expected.id)
        const actual = matches[0]
        if (matches.length !== 1 || actual?.path !== expected.path || actual.name !== expected.name
          || !same([...actual.evidence].sort(), [...expected.evidence].sort())) problems.push(`lost or redirected occurrence: ${expected.scope}/${expected.id}`)
      }
    }
  } catch (error) { problems.push(String(error)) }
  return gate('upgrade-preservation', problems.length === 0, problems.length === 0
    ? 'all original scope-local IDs, native behavior, exact AND selectors and runner/execution settings preserved'
    : problems.join('; '))
}

export async function upgradeSensitivityGate(workspace: string): Promise<EvalGate> {
  const cli = join(workspace, 'node_modules/focused-spec/dist/cli.js')
  const run = () => runProcess(process.execPath, [cli, 'run', '--scope', 'current', '--scenario', 'auth.login.blocked-account', '--json'], { cwd: workspace, timeoutMs: 240_000 })
  const resultMatches = (output: string, status: string, reference?: string): boolean => {
    try {
      const value = JSON.parse(output) as { executionStarted?: boolean; scenarios?: { scope: string; id: string; status: string; evidence: { reference: string; status: string; diagnostic?: string }[] }[] }
      const selected = value.scenarios?.find(item => item.scope === 'current' && item.id === 'auth.login.blocked-account')
      return value.executionStarted === true && selected?.status === status && selected.evidence.length === BLOCKED.length
        && (reference === undefined ? selected.evidence.every(item => item.status === 'PASS')
          : selected.evidence.some(item => item.reference === reference && item.status === 'FAIL'
            && (reference.startsWith('go-unit') ? item.diagnostic?.includes('blocked account authenticated') : item.diagnostic?.includes('assert True is False'))))
    } catch { return false }
  }
  const before = await run()
  if (before.code !== 0 || !resultMatches(before.stdout, 'PASS')) return gate('mutation-sensitivity', false, 'migrated selected evidence did not pass before regression')
  const probes: string[] = []
  for (const [path, originalExpression, replacement, reference] of [
    ['auth/auth.go', 'return credentialsValid && !blocked', 'return credentialsValid', BLOCKED[0]!],
    ['app/auth.py', 'return credentials_valid and not blocked', 'return credentials_valid', BLOCKED[1]!],
  ]) {
    const source = await readFile(join(workspace, path!), 'utf8')
    if (!source.includes(originalExpression!)) return gate('mutation-sensitivity', false, `regression target absent: ${path}`)
    let failed = false
    try {
      await writeFile(join(workspace, path!), source.replace(originalExpression!, replacement!))
      const regression = await run()
      failed = regression.code === 1 && resultMatches(regression.stdout, 'FAIL', reference)
    } finally { await writeFile(join(workspace, path!), source) }
    const restored = await run()
    if (!failed || restored.code !== 0 || !resultMatches(restored.stdout, 'PASS')) return gate('mutation-sensitivity', false, `selected behavioral assertion failure or restoration missing: ${reference}`)
    probes.push(reference!)
  }
  return gate('mutation-sensitivity', true, `migrated PASS → selected behavioral assertion FAIL → restored PASS: ${probes.join(', ')}`)
}
