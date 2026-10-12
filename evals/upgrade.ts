import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { lstat, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { glob } from 'glob'
import { parse } from 'yaml'
import { discoverDocuments, loadConfig } from '../packages/core/dist/index.js'
import { runProcess } from './process.ts'
import type { EvalGate } from './types.ts'

export const LEGACY_VERSION = '0.5.0'
const PACKAGE = 'node_modules/focused-spec/'
const ADAPTER_PACKAGE_ROOT = 'node_modules/@focused-spec/'
const CANDIDATE_PACKAGES = [
  ['node_modules/focused-spec/', 'focused-spec'],
  [`${ADAPTER_PACKAGE_ROOT}format-markdown/`, '@focused-spec/format-markdown'],
  [`${ADAPTER_PACKAGE_ROOT}runner-go/`, '@focused-spec/runner-go'],
  [`${ADAPTER_PACKAGE_ROOT}runner-pytest/`, '@focused-spec/runner-pytest'],
] as const
const INTEGRATION = '.omp/skills/focused-spec/'
const COMMAND = '.omp/commands/focused-spec.md'
const BLOCKED = ['go::./auth::TestBlockedAccount', 'pytest::tests/functional/test_auth.py::test_blocked_account']
const ACTIVE = ['go::./auth::TestValidActiveAccount', 'pytest::tests/functional/test_auth.py::test_valid_active_account']
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
  return path.startsWith(PACKAGE) || path.startsWith(ADAPTER_PACKAGE_ROOT) || path.startsWith(INTEGRATION) || path === COMMAND
}

export async function captureUpgradeBaseline(workspace: string, candidateRoot: string): Promise<UpgradeBaseline> {
  const artifacts = new Map<string, string>()
  const nodeModules = join(candidateRoot, '..')
  for (const [prefix, packageName] of CANDIDATE_PACKAGES) {
    const packageRoot = packageName === 'focused-spec' ? candidateRoot : join(nodeModules, ...packageName.split('/'))
    for (const path of await glob('**/*', { cwd: packageRoot, nodir: true, dot: true, follow: true, nocase: false })) {
      artifacts.set(prefix + path, hash(await readFile(join(packageRoot, path))))
    }
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

export interface UpgradeCandidatePackage {
  readonly name: string
  readonly tarball: string
  readonly metadata: Record<string, unknown>
}

export async function serveUpgradeCandidate(candidates: readonly UpgradeCandidatePackage[]): Promise<{ url: string; close(): Promise<void> }> {
  const packages = await Promise.all(candidates.map(async (candidate, index) => {
    const bytes = await readFile(candidate.tarball)
    return { ...candidate, bytes, index, integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` }
  }))
  let url = ''
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(request.url?.split('?')[0] ?? '/')
    const metadata = packages.find(candidate => pathname === `/${candidate.name}`)
    const archive = packages.find(candidate => pathname === `/candidate/${candidate.index}.tgz`)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(404).end()
    } else if (metadata !== undefined) {
      const version = String(metadata.metadata.version)
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({
        name: metadata.name, 'dist-tags': { latest: version },
        versions: { [version]: { ...metadata.metadata, dist: { integrity: metadata.integrity, tarball: `${url}/candidate/${metadata.index}.tgz` } } },
      }))
    } else if (archive !== undefined) {
      response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': archive.bytes.length }).end(archive.bytes)
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
  const paths = await glob(['node_modules/focused-spec/**/*', 'node_modules/@focused-spec/**/*', '.omp/skills/focused-spec/**/*', COMMAND], { cwd: workspace, nodir: true, dot: true, follow: true, nocase: false })
  const changed: string[] = paths.filter(path => !baseline.artifacts.has(path))
  for (const [path, expected] of baseline.artifacts) {
    try {
      if (!(await lstat(join(workspace, path))).isFile() || hash(await readFile(join(workspace, path))) !== expected) changed.push(path)
    } catch { changed.push(path) }
  }
  return gate('upgrade-artifacts', changed.length === 0, changed.length === 0
    ? 'installed core, format and runner packages plus loader and wrapper match the independent candidate; no stale package-owned files'
    : `missing, altered or extra upgrade artifacts: ${changed.join(', ')}`)
}

export async function upgradePreservationGate(workspace: string, baseline: UpgradeBaseline): Promise<EvalGate> {
  const problems: string[] = []
  try {
    const legacyConfig = object(baseline.config)
    const specifications = object(legacyConfig.specifications)
    const documents = (specifications.documents as Record<string, unknown>[]).map(layout => ({ ...layout, format: 'markdown' }))
    const expectedConfig = {
      ...legacyConfig,
      version: 4,
      specifications: {
        formats: { markdown: { package: '@focused-spec/format-markdown' } },
        documents,
      },
      runners: {
        go: { package: '@focused-spec/runner-go', timeoutMs: 120000 },
        pytest: {
          package: '@focused-spec/runner-pytest',
          timeoutMs: 120000,
          options: { command: 'uv', commandArgs: ['run', '--with', 'pytest', 'python'] },
        },
      },
    }
    const finalConfig = object(parse(await readFile(join(workspace, '.focused-spec/config.yaml'), 'utf8')))
    delete finalConfig.evidence
    if (!same(expectedConfig, finalConfig)) problems.push('configuration did not perform the required version-4 format and official-runner migration')
    const manifest = object(JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8')))
    const focusedPackages = [
      'focused-spec',
      '@focused-spec/format-markdown',
      '@focused-spec/runner-go',
      '@focused-spec/runner-pytest',
    ]
    const dependencies = ['dependencies', 'devDependencies', 'optionalDependencies']
      .flatMap(key => manifest[key] === undefined ? [] : Object.keys(object(manifest[key])))
    if (!focusedPackages.every(name => dependencies.includes(name))) problems.push('manifest does not install core plus required format and runner packages')
    const withoutFocused = (value: Record<string, unknown>) => {
      const result = { ...value }
      for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        if (result[key] === undefined) continue
        const entries = { ...object(result[key]) }
        for (const name of focusedPackages) delete entries[name]
        if (Object.keys(entries).length === 0) delete result[key]
        else result[key] = entries
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
    ? 'all original scope-local IDs, native behavior, exact selectors and AND contracts preserved through the required format/runner migration'
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
            && (reference.startsWith('go::') ? item.diagnostic?.includes('blocked account authenticated') : item.diagnostic?.includes('assert True is False'))))
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
