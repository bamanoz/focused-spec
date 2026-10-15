import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { lstat, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { glob } from 'glob'
import { parse } from 'yaml'
import { discoverDocuments, loadConfig } from '../packages/core/dist/index.js'
import type { Scenario } from '../packages/core/dist/index.js'
import { parseTrustedNativeDocument } from './native-parse.ts'
import { runProcess } from './process.ts'
import type { EvalGate } from './types.ts'

export const LEGACY_VERSION = '0.5.0'
const PACKAGE = 'node_modules/focused-spec/'
const ADAPTER_PACKAGE_ROOT = 'node_modules/@focused-spec/'
const CANDIDATE_PACKAGES = [
  ['node_modules/focused-spec/', 'focused-spec'],
  [`${ADAPTER_PACKAGE_ROOT}format-inline/`, '@focused-spec/format-inline'],
  [`${ADAPTER_PACKAGE_ROOT}runner-go/`, '@focused-spec/runner-go'],
  [`${ADAPTER_PACKAGE_ROOT}runner-pytest/`, '@focused-spec/runner-pytest'],
] as const
const INTEGRATION = '.omp/skills/focused-spec/'
const COMMAND = '.omp/commands/focused-spec.md'
const LEGACY_DOCUMENTS = [
  { scope: 'current', path: 'specs/account-authentication.md' },
  { scope: 'refresh', path: 'changes/refresh/spec.md' },
] as const

export interface UpgradeBaseline {
  readonly artifacts: ReadonlyMap<string, string>
  readonly config: unknown
  readonly manifest: unknown
  readonly documents: ReadonlyMap<string, string>
  readonly occurrences: readonly Scenario[]
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
  const occurrences: Scenario[] = []
  for (const { scope, path } of LEGACY_DOCUMENTS) {
    const source = await readFile(join(workspace, path), 'utf8')
    documents.set(path, source)
    const parsed = parseTrustedNativeDocument('inline', path, source.replace(/^- \*\*REVISES\*\*:.*\n/gmu, ''), scope, workspace)
    if (parsed.violations.length > 0) throw new Error(`invalid legacy inventory: ${JSON.stringify(parsed.violations)}`)
    for (const item of parsed.items) {
      if (item.markerId === undefined || item.evidence === undefined) throw new Error('legacy item lacks explicit identity or evidence')
      occurrences.push({ scope, path, line: item.line, name: item.name, id: item.markerId, evidence: [...item.evidence] })
    }
  }
  return {
    artifacts,
    config: parse(await readFile(join(workspace, '.focused-spec/config.yaml'), 'utf8')) as unknown,
    manifest: JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8')) as unknown,
    documents,
    occurrences,
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
  const loaded = await loadConfig(workspace)
  const required = new Set(['focused-spec', '@focused-spec/format-inline',
    ...Object.values(loaded.config?.runners ?? {}).flatMap(runner => runner.package === undefined ? [] : [runner.package])])
  const selected: string[] = []
  for (const [prefix, name] of CANDIDATE_PACKAGES) {
    if (required.has(name) || await lstat(join(workspace, prefix)).then(() => true, () => false)) selected.push(prefix)
  }
  const paths = await glob([...selected.map(prefix => `${prefix}**/*`), '.omp/skills/focused-spec/**/*', COMMAND], { cwd: workspace, nodir: true, dot: true, follow: true, nocase: false })
  const changed: string[] = paths.filter(path => !baseline.artifacts.has(path))
  for (const [path, expected] of baseline.artifacts) {
    if (CANDIDATE_PACKAGES.some(([prefix]) => path.startsWith(prefix) && !selected.includes(prefix))) continue
    try {
      if (!(await lstat(join(workspace, path))).isFile() || hash(await readFile(join(workspace, path))) !== expected) changed.push(path)
    } catch { changed.push(path) }
  }
  return gate('upgrade-artifacts', changed.length === 0, changed.length === 0
    ? 'installed core, format and runner packages plus loader and wrapper match the independent candidate; no stale package-owned files'
    : `missing, altered or extra upgrade artifacts: ${changed.join(', ')}`)
}

function retainedRunners(legacy: Record<string, unknown>, current: Record<string, unknown>): Map<string, string> {
  const mapping = new Map<string, string>()
  for (const [id, value] of Object.entries(legacy)) {
    const registration = object(value)
    const { module, documentation: _documentation, ...options } = registration
    const replacement = module === './.focused-spec/runners/go-test.ts'
      ? { ...options, package: '@focused-spec/runner-go' }
      : module === './.focused-spec/runners/pytest.ts'
        ? { ...options, package: '@focused-spec/runner-pytest', options: { command: 'uv', commandArgs: ['run', '--with', 'pytest', 'python'] } }
        : undefined
    const matches = Object.entries(current).filter(([name, actual]) => name === id && same(actual, registration)
      || replacement !== undefined && same(actual, replacement))
    if (matches.length !== 1 || [...mapping.values()].includes(matches[0]![0])) throw new Error(`runner ${id} was lost, changed incompatibly, or mapped ambiguously`)
    mapping.set(id, matches[0]![0])
  }
  if (Object.keys(current).length !== mapping.size) throw new Error('unrelated runner registrations changed')
  return mapping
}

export async function upgradePreservationGate(workspace: string, baseline: UpgradeBaseline): Promise<EvalGate> {
  const problems: string[] = []
  try {
    const legacyConfig = object(baseline.config)
    const specifications = object(legacyConfig.specifications)
    const documents = (specifications.documents as Record<string, unknown>[]).map(layout => ({ ...layout, format: 'inline' }))
    const finalConfig = object(parse(await readFile(join(workspace, '.focused-spec/config.yaml'), 'utf8')))
    const finalRunners = object(finalConfig.runners)
    const runners = retainedRunners(object(legacyConfig.runners), finalRunners)
    const migratedEvidence = (references: readonly string[]) => references.map(reference => {
      const separator = reference.indexOf('::')
      return `${runners.get(reference.slice(0, separator)) ?? reference.slice(0, separator)}${reference.slice(separator)}`
    })
    const expectedConfig = {
      ...legacyConfig,
      version: 5,
      specifications: {
        formats: { inline: { package: '@focused-spec/format-inline' } },
        documents,
      },
      runners: finalRunners,
    }
    if (!same(expectedConfig, finalConfig)) problems.push('configuration did not preserve layouts and execution settings through the version-5 inline migration')
    const manifest = object(JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8')))
    const focusedPackages = CANDIDATE_PACKAGES.map(([, name]) => name)
    const requiredPackages = ['focused-spec', '@focused-spec/format-inline',
      ...Object.values(finalRunners).flatMap(value => {
        const runner = object(value)
        return typeof runner.package === 'string' ? [runner.package] : []
      })]
    const dependencies = ['dependencies', 'devDependencies', 'optionalDependencies']
      .flatMap(key => manifest[key] === undefined ? [] : Object.keys(object(manifest[key])))
    if (!requiredPackages.every(name => dependencies.includes(name))) problems.push('manifest does not install core plus selected format and runner packages')
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
      if (after.includes('focused-spec:id=') || /^- \*\*REVISES\*\*:/mu.test(after)) problems.push(`inline representation was replaced or retained unsupported ancestry: ${path}`)
      for (const expected of baseline.occurrences.filter(item => item.path === path)) {
        const idRows = after.split(/\r?\n/u).filter(line => line === `- **ID**: \`${expected.id}\``)
        if (idRows.length !== 1 || migratedEvidence(expected.evidence).some(reference => !after.includes(`- **EVIDENCE**: \`${reference}\``))) {
          problems.push(`inline ID or exact evidence changed: ${expected.scope}/${expected.id}`)
        }
      }
    }
    const registryFiles = await glob(['.focused-spec/evidence.yaml', '.focused-spec/evidence.yml', '.focused-spec/evidence/**/*.{yaml,yml}'], { cwd: workspace, nodir: true, dot: true, follow: false, nocase: false })
    if (registryFiles.length > 0) problems.push(`inline upgrade was forced into YAML evidence: ${registryFiles.join(', ')}`)
    const loaded = await loadConfig(workspace)
    if (loaded.config === undefined) problems.push('current configuration invalid')
    else {
      const discovery = await discoverDocuments(workspace, loaded.config)
      problems.push(...discovery.violations.map(item => item.message))
      const scenarios = [...discovery.scopes.values()].flat().flatMap(document => document.scenarios)
      if (scenarios.length !== baseline.occurrences.length) problems.push(`expected ${baseline.occurrences.length} occurrences, found ${scenarios.length}`)
      for (const expected of baseline.occurrences) {
        const matches = scenarios.filter(item => item.scope === expected.scope && item.id === expected.id)
        const actual = matches[0]
        if (matches.length !== 1 || actual?.path !== expected.path || actual.name !== expected.name
          || !same(actual.evidence, migratedEvidence(expected.evidence))) problems.push(`lost or redirected occurrence: ${expected.scope}/${expected.id}`)
      }
    }
  } catch (error) { problems.push(String(error)) }
  return gate('upgrade-preservation', problems.length === 0, problems.length === 0
    ? 'all original scope-local IDs, native behavior, exact selectors and AND contracts preserved through the format migration'
    : problems.join('; '))
}

export async function upgradeSensitivityGate(workspace: string): Promise<EvalGate> {
  const cli = join(workspace, 'node_modules/focused-spec/dist/cli.js')
  const loaded = await loadConfig(workspace)
  if (loaded.config === undefined) return gate('mutation-sensitivity', false, 'migrated configuration is invalid')
  const discovery = await discoverDocuments(workspace, loaded.config, 'current', 'auth.login.blocked-account')
  const selected = [...discovery.scopes.values()].flat().flatMap(document => document.scenarios)
  const references = selected.length === 1 ? selected[0]!.evidence : []
  const go = references.find(reference => reference.endsWith('::./auth::TestBlockedAccount'))
  const python = references.find(reference => reference.endsWith('::tests/functional/test_auth.py::test_blocked_account'))
  if (discovery.violations.length > 0 || references.length !== 2 || go === undefined || python === undefined) {
    return gate('mutation-sensitivity', false, 'migrated occurrence must retain its exact Go and Python selectors')
  }
  const run = () => runProcess(process.execPath, [cli, 'run', '--scope', 'current', '--scenario', 'auth.login.blocked-account', '--json'], { cwd: workspace, timeoutMs: 240_000 })
  const resultMatches = (output: string, status: string, reference?: string): boolean => {
    try {
      const value = JSON.parse(output) as { executionStarted?: boolean; scenarios?: { scope: string; id: string; status: string; evidence: { reference: string; status: string; diagnostic?: string }[] }[] }
      const selected = value.scenarios?.find(item => item.scope === 'current' && item.id === 'auth.login.blocked-account')
      return value.executionStarted === true && selected?.status === status && selected.evidence.length === references.length
        && (reference === undefined ? selected.evidence.every(item => item.status === 'PASS')
          : selected.evidence.some(item => item.reference === reference && item.status === 'FAIL'
            && (reference === go ? item.diagnostic?.includes('blocked account authenticated') : item.diagnostic?.includes('assert True is False'))))
    } catch { return false }
  }
  const before = await run()
  if (before.code !== 0 || !resultMatches(before.stdout, 'PASS')) return gate('mutation-sensitivity', false, 'migrated selected evidence did not pass before regression')
  const probes: string[] = []
  for (const [path, originalExpression, replacement, reference] of [
    ['auth/auth.go', 'return credentialsValid && !blocked', 'return credentialsValid', go],
    ['app/auth.py', 'return credentials_valid and not blocked', 'return credentials_valid', python],
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
