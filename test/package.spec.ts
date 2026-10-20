import { spawnSync } from 'node:child_process'
import { chmod, cp, lstat, mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'

type GuideTopic = 'workflow' | 'integration' | 'formats' | 'runners'

interface PackageIdentity {
  readonly name: string
  readonly version: string
}

interface AgentTarget {
  id: string
  skill: string
  command: string | null
  home: boolean
  format: 'yaml' | 'toml' | 'heading' | 'plain' | null
  metadata: Record<string, unknown>
  arguments: string | null
}
const agentTargets: AgentTarget[] = JSON.parse(await readFile(new URL('./fixtures/agent-targets.json', import.meta.url), 'utf8'))

const repository = fileURLToPath(new URL('..', import.meta.url))
let root: string
let consumer: string
let installedEntries: string[]
let packedTarball: string
let markdownTarball: string
let vitestRunnerTarball: string
let inlineTarball: string
let registryTarball: string

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

function packageIdentity(text: string): PackageIdentity {
  const metadata: unknown = JSON.parse(text)
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)
    || !('name' in metadata) || typeof metadata.name !== 'string'
    || !('version' in metadata) || typeof metadata.version !== 'string') {
    throw new Error('package metadata has no string name and version')
  }
  return { name: metadata.name, version: metadata.version }
}

function packedFilename(stdout: string): string {
  const result: unknown = JSON.parse(stdout)
  if (!Array.isArray(result) || result.length === 0) throw new Error('npm pack returned no result')
  const first: unknown = result[0]
  if (first === null || typeof first !== 'object' || !('filename' in first) || typeof first.filename !== 'string') {
    throw new Error('npm pack returned no tarball')
  }
  return first.filename
}

function packPackage(packageRoot: string, destination: string): string {
  const pack = spawnSync('npm', ['pack', '--ignore-scripts', '--pack-destination', destination, '--json'], {
    cwd: packageRoot,
    encoding: 'utf8',
    timeout: 120_000,
  })
  if (pack.status !== 0) throw new Error(`npm pack failed: ${pack.stderr}`)
  return join(destination, packedFilename(pack.stdout))
}

function installPackage(project: string, ...tarballs: readonly string[]): void {
  const install = spawnSync('npm', ['install', '--prefix', project, '--ignore-scripts', '--no-save', '--prefer-offline', '--no-audit', '--no-fund', ...tarballs], {
    encoding: 'utf8',
    timeout: 180_000,
  })
  if (install.status !== 0) throw new Error(`consumer install failed: ${install.stderr}`)
}

async function createPackedConsumer(prefix: string): Promise<string> {
  const project = await mkdtemp(join(root, prefix))
  await writeFile(join(project, 'package.json'), '{"name":"consumer","private":true,"type":"module"}\n')
  installPackage(project, packedTarball)
  return project
}

async function installConsumerFramework(project: string, ...tarballs: readonly string[]): Promise<void> {
  const manifest: Record<string, unknown> = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
  const lock: { packages: Record<string, { link?: boolean }> } = JSON.parse(await readFile(join(repository, 'package-lock.json'), 'utf8'))
  // Reuse the verified external graph, never checkout workspace links or floating optional peers.
  const packages = Object.fromEntries(Object.entries(lock.packages).filter(([path, metadata]) => path.startsWith('node_modules/') && !metadata.link))
  await writeFile(join(project, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, requires: true, packages: { '': manifest, ...packages } }))
  const vitestVersion = packageIdentity(await readFile(join(repository, 'node_modules/vitest/package.json'), 'utf8')).version
  installPackage(project, ...tarballs, `vitest@${vitestVersion}`)
}

function initializeConsumer(project: string, tools: string, ...options: string[]) {
  return initializeConsumerInHome(project, join(root, 'home'), tools, ...options)
}

function initializeConsumerInHome(project: string, home: string, tools: string, ...options: string[]) {
  return spawnSync(process.execPath, [join(project, 'node_modules/focused-spec/dist/cli.js'), 'init', '--tools', tools, '--json', ...options], {
    cwd: project, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, HOME: home, USERPROFILE: home, npm_config_offline: 'true', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' },
  })
}

async function integrationTree(project: string): Promise<Record<string, string>> {
  const entries: Record<string, string> = {}
  for (const directory of (await readdir(project)).filter(entry => entry !== 'node_modules' && entry !== 'package.json')) {
    const base = join(project, directory)
    if (!await lstat(base).then(() => true, () => false)) continue
    const baseInfo = await lstat(base)
    entries[directory] = baseInfo.isFile() ? await readFile(base, 'utf8') : baseInfo.isSymbolicLink() ? 'symlink' : 'directory'
    if (!baseInfo.isDirectory()) continue
    for (const path of await readdir(base, { recursive: true })) {
      const absolute = join(base, path)
      const info = await lstat(absolute)
      entries[`${directory}/${path}`] = info.isFile() ? await readFile(absolute, 'utf8') : info.isSymbolicLink() ? 'symlink' : 'directory'
    }
  }
  return entries
}

function expectedTree(files: Record<string, string>): Record<string, string> {
  const tree: Record<string, string> = {}
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/')
    for (let count = 1; count < parts.length; count++) tree[parts.slice(0, count).join('/')] = 'directory'
    tree[path] = content
  }
  return tree
}

async function initWorkspace(prefix: string) {
  const project = await createPackedConsumer(prefix)
  const home = await mkdtemp(join(root, 'home-'))
  return { project, home, invoke: (tools: string, ...options: string[]) => initializeConsumerInHome(project, home, tools, ...options) }
}

async function writeSnapshotVersion(packageRoot: string, version: string): Promise<void> {
  const packagePath = join(packageRoot, 'package.json')
  const metadata: unknown = JSON.parse(await readFile(packagePath, 'utf8'))
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('snapshot package metadata is not an object')
  }
  await writeFile(packagePath, `${JSON.stringify({ ...metadata, version }, null, 2)}\n`)
}

async function expectInstalledGuide(project: string, topic: GuideTopic): Promise<{ readonly content: string, readonly version: string }> {
  const packageRoot = join(project, 'node_modules/focused-spec')
  const identity = packageIdentity(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  expect(identity.name).toBe('focused-spec')
  const content = await readFile(join(packageRoot, 'guidance', `${topic}.md`), 'utf8')
  expect(content.trim()).not.toBe('')

  const cli = join(packageRoot, 'dist/cli.js')
  const argumentsList = ['instructions', '--protocol', '1', '--topic', topic]
  const json = spawnSync(process.execPath, [cli, ...argumentsList, '--json'], { cwd: project, encoding: 'utf8' })
  expect(json.status, json.stderr).toBe(0)
  expect(json.stderr).toBe('')
  expect(JSON.parse(json.stdout)).toEqual({
    protocolVersion: 1,
    package: identity,
    topic,
    content,
  })

  const text = spawnSync(process.execPath, [cli, ...argumentsList], { cwd: project, encoding: 'utf8' })
  expect(text.status, text.stderr).toBe(0)
  expect(text.stderr).toBe('')
  const contentOffset = text.stdout.indexOf(content)
  expect(contentOffset).toBeGreaterThan(0)
  const provenance = text.stdout.slice(0, contentOffset)
  expect(provenance).toContain(identity.name)
  expect(provenance).toContain(identity.version)
  expect(provenance).toContain(topic)
  expect(provenance).toMatch(/protocol[^0-9]*1\b/iu)
  return { content, version: identity.version }
}

async function expectInstallerReadableSkill(project: string): Promise<void> {
  const markdown = await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8')
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)?.[1]
  if (frontmatter === undefined) throw new Error('installed focused-spec skill has no YAML frontmatter')
  const document = parseDocument(frontmatter)
  expect(document.errors).toEqual([])
  expect(document.toJS()).toMatchObject({ name: 'focused-spec', description: expect.any(String) })
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'focused-spec-consumer-'))
  await mkdir(join(root, 'home'))
  consumer = join(root, 'project')
  await mkdir(consumer)
  await writeFile(join(consumer, 'package.json'), '{"name":"consumer","private":true,"type":"module"}\n')
  packedTarball = packPackage(join(repository, 'packages/core'), root)
  markdownTarball = packPackage(join(repository, 'packages/formats/markdown'), root)
  vitestRunnerTarball = packPackage(join(repository, 'packages/runners/vitest'), root)
  inlineTarball = packPackage(join(repository, 'packages/formats/inline'), root)
  registryTarball = packPackage(join(repository, 'packages/formats/registry'), root)
  installPackage(consumer, packedTarball)
  installedEntries = await readdir(consumer)
}, 300_000)

afterAll(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
})

describe('package distribution', () => {
  it('packs prepared core output without rebuilding it when scripts are disabled', async () => {
    const checkout = await mkdtemp(join(root, 'prepared-pack-'))
    for (const name of ['scripts', 'skills', 'guidance']) await cp(join(repository, name), join(checkout, name), { recursive: true })
    for (const name of ['tsconfig.json', 'package.json', 'README.md', 'LICENSE']) await cp(join(repository, name), join(checkout, name))
    await put(join(checkout, 'docs/guides/runners.md'), await readFile(join(repository, 'docs/guides/runners.md'), 'utf8'))
    await symlink(join(repository, 'node_modules'), join(checkout, 'node_modules'), 'dir')
    for (const name of ['core', 'sdk/typescript', 'sdk/go', 'formats/markdown', 'formats/gherkin', 'formats/inline', 'formats/registry', 'formats/scenarios-typescript', 'formats/scenarios-go', 'runners/vitest', 'runners/pytest', 'runners/go', 'runners/scenarios-typescript', 'runners/scenarios-go']) await mkdir(join(checkout, 'packages', name), { recursive: true })
    const packageRoot = join(checkout, 'packages/core')
    await cp(join(repository, 'packages/core'), packageRoot, { recursive: true })
    const prepared = join(packageRoot, 'dist/prepared-only.js')
    await put(prepared, 'export const prepared = true\n')
    const packed = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { cwd: packageRoot, encoding: 'utf8', timeout: 60000 })
    expect(packed.status, packed.stderr).toBe(0)
    const files = (JSON.parse(packed.stdout) as { files: { path: string }[] }[])[0]!.files.map(file => file.path)
    expect(files).toContain('dist/prepared-only.js')
    expect(await readFile(prepared, 'utf8')).toBe('export const prepared = true\n')
  }, 60000)

  it('omits retired generated assets after repeated staging', async () => {
    const checkout = await mkdtemp(join(root, 'staging-'))
    for (const name of ['scripts', 'skills', 'guidance']) await cp(join(repository, name), join(checkout, name), { recursive: true })
    await put(join(checkout, 'docs/guides/runners.md'), await readFile(join(repository, 'docs/guides/runners.md'), 'utf8'))
    for (const name of ['README.md', 'LICENSE']) await cp(join(repository, name), join(checkout, name))
    for (const name of ['core', 'sdk/typescript', 'sdk/go', 'formats/markdown', 'formats/gherkin', 'formats/inline', 'formats/registry', 'formats/scenarios-typescript', 'formats/scenarios-go', 'runners/vitest', 'runners/pytest', 'runners/go', 'runners/scenarios-typescript', 'runners/scenarios-go']) await mkdir(join(checkout, 'packages', name), { recursive: true })
    const stage = () => spawnSync(process.execPath, ['scripts/stage-assets.mjs'], { cwd: checkout, encoding: 'utf8' })
    await put(join(checkout, 'skills/retired/SKILL.md'), 'retired loader')
    await put(join(checkout, 'guidance/retired.md'), 'retired guidance')
    expect(stage().status).toBe(0)
    await rm(join(checkout, 'skills/retired'), { recursive: true })
    await rm(join(checkout, 'guidance/retired.md'))
    expect(stage().status).toBe(0)
    expect(await stat(join(checkout, 'packages/core/skills/retired/SKILL.md')).then(() => 'present', error => error.code)).toBe('ENOENT')
    expect(await stat(join(checkout, 'packages/core/guidance/retired.md')).then(() => 'present', error => error.code)).toBe('ENOENT')
    expect(await readFile(join(checkout, 'packages/core/guidance/workflow.md'), 'utf8')).toBe(await readFile(join(checkout, 'guidance/workflow.md'), 'utf8'))
    expect(await readFile(join(checkout, 'packages/core/skills/focused-spec/SKILL.md'), 'utf8')).toBe(await readFile(join(checkout, 'skills/focused-spec/SKILL.md'), 'utf8'))
  })

  it('omits retired runtime modules from every independently rebuilt package', async () => {
    const checkout = await mkdtemp(join(root, 'rebuild-'))
    await cp(join(repository, 'tsconfig.json'), join(checkout, 'tsconfig.json'))
    await cp(join(repository, 'package.json'), join(checkout, 'package.json'))
    await cp(join(repository, 'scripts'), join(checkout, 'scripts'), { recursive: true })
    await symlink(join(repository, 'node_modules'), join(checkout, 'node_modules'), 'dir')
    for (const name of ['core', 'sdk/typescript', 'formats/markdown', 'formats/gherkin', 'formats/inline', 'formats/registry', 'formats/scenarios-typescript', 'formats/scenarios-go', 'runners/vitest', 'runners/pytest', 'runners/go', 'runners/scenarios-typescript', 'runners/scenarios-go']) {
      const packageRoot = join(checkout, 'packages', name)
      await mkdir(packageRoot, { recursive: true })
      for (const asset of ['src', 'package.json', 'tsconfig.json']) await cp(join(repository, 'packages', name, asset), join(packageRoot, asset), { recursive: true })
      if (name === 'formats/scenarios-go') {
        for (const asset of ['go', 'build.mjs']) await cp(join(repository, 'packages', name, asset), join(packageRoot, asset), { recursive: true })
      }
      const retiredSource = join(packageRoot, 'src/audit-retired-runtime.ts')
      await put(retiredSource, 'export const retired = true\n')
      const build = () => spawnSync('npm', ['run', 'build'], { cwd: packageRoot, encoding: 'utf8', timeout: 60000 })
      const first = build()
      expect(first.status, name + first.stdout + first.stderr).toBe(0)
      expect(await readFile(join(packageRoot, 'dist/audit-retired-runtime.js'), 'utf8')).toContain('retired')
      await rm(retiredSource)
      const second = build()
      expect(second.status, name + second.stdout + second.stderr).toBe(0)
      const packed = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { cwd: packageRoot, encoding: 'utf8', timeout: 60000 })
      expect(packed.status, packed.stderr).toBe(0)
      const files = (JSON.parse(packed.stdout) as { files: { path: string }[] }[])[0]!.files.map(file => file.path)
      expect(files, name).toContain('dist/index.js')
      expect(files.filter(path => path.startsWith('dist/audit-retired-runtime')), name).toEqual([])
    }
  }, 180000)

  it('installs independent core and adapter packages', async () => {
    const project = await createPackedConsumer('independent-adapters-')
    const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
    for (const name of ['@focused-spec/format-markdown', '@focused-spec/format-gherkin', '@focused-spec/format-inline', '@focused-spec/format-registry', '@focused-spec/runner-vitest', '@cucumber/gherkin', 'mdast-util-from-markdown', 'vitest']) {
      await expect(stat(join(project, 'node_modules', name))).rejects.toThrow()
    }
    await put(join(project, '.focused-spec/config.yaml'), JSON.stringify({ version: 5,
      specifications: { formats: { markdown: { package: '@focused-spec/format-registry', options: { parser: { package: '@focused-spec/format-markdown' } } } }, documents: [{ match: 'specs/contract.md', scope: 'current', format: 'markdown' }] },
      runners: { vitest: { package: '@focused-spec/runner-vitest' } },
    }))
    await put(join(project, '.focused-spec/evidence.yaml'), 'scopes:\n  current:\n    consumer.adapters.work:\n      evidence: ["vitest::test/contract.spec.ts::consumer > rejects blocked account"]\n')
    await put(join(project, 'specs/contract.md'), '<!-- focused-spec:id=consumer.adapters.work -->\n#### Scenario: Blocked accounts are rejected\n')
    const invoke = () => spawnSync(process.execPath, [cli, 'run', '--root', project, '--json'], { cwd: project, encoding: 'utf8', timeout: 120_000,
      env: { ...process.env, npm_config_offline: 'true', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' },
    })
    const missing = invoke()
    expect(missing.status).toBe(1)
    expect(JSON.parse(missing.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('@focused-spec/format-registry') })]) })
    await installConsumerFramework(project, packedTarball, registryTarball, markdownTarball, vitestRunnerTarball)
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    await put(join(project, 'test/contract.spec.ts'), "import { describe, expect, it } from 'vitest'; import { authenticate } from '../auth.mjs'; describe('consumer', () => { it('rejects blocked account', () => expect(authenticate(true)).toBe(false)); });")
    const passed = invoke()
    expect(passed.status, passed.stdout + passed.stderr).toBe(0)
    expect(JSON.parse(passed.stdout)).toMatchObject({ success: true, scenarios: [{ id: 'consumer.adapters.work', status: 'PASS' }] })
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => true\n')
    const regressed = invoke()
    expect(regressed.status).toBe(1)
    expect(JSON.parse(regressed.stdout)).toMatchObject({ success: false, scenarios: [{ id: 'consumer.adapters.work', status: 'FAIL' }] })
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    const restored = invoke()
    expect(restored.status, restored.stdout + restored.stderr).toBe(0)
    expect(JSON.parse(restored.stdout)).toMatchObject({ success: true, scenarios: [{ id: 'consumer.adapters.work', status: 'PASS' }] })
  }, 300_000)

  it('executes independently packed inline and registry formats', async () => {
    const project = await createPackedConsumer('storage-formats-')
    const otherTarballs = ['formats/gherkin', 'runners/go', 'runners/pytest'].map(name => packPackage(join(repository, 'packages', name), root))
    await installConsumerFramework(project, packedTarball, markdownTarball, inlineTarball, registryTarball, vitestRunnerTarball, ...otherTarballs)
    const references = ['vitest::test/behavior.spec.ts::consumer > rejects blocked', 'vitest::test/behavior.spec.ts::consumer > permits active']
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    await put(join(project, 'test/behavior.spec.ts'), "import { describe, expect, it } from 'vitest'; import { authenticate } from '../auth.mjs'; describe('consumer', () => { it('rejects blocked', () => expect(authenticate(true)).toBe(false)); it('permits active', () => expect(authenticate(false)).toBe(true)); });")
    const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
    const invoke = () => spawnSync(process.execPath, [cli, 'run', '--root', project, '--json'], { cwd: project, encoding: 'utf8', timeout: 120000 })
    for (const representation of ['inline', 'registry'] as const) {
      const format = representation === 'inline'
        ? { package: '@focused-spec/format-inline' }
        : { package: '@focused-spec/format-registry', options: { parser: { package: '@focused-spec/format-markdown' }, files: ['evidence/auth.yaml'] } }
      await put(join(project, '.focused-spec/config.yaml'), JSON.stringify({ version: 5, specifications: { formats: { selected: format }, documents: [{ match: 'specs/auth.md', scope: 'current', format: 'selected' }] }, runners: { vitest: { package: '@focused-spec/runner-vitest' } } }))
      const source = representation === 'inline'
        ? ['#### Scenario: Account access', '- **ID**: `Auth-login`', ...references.map(ref => '- **EVIDENCE**: `' + ref + '`'), '- **WHEN** an account authenticates', '- **THEN** blocked access is rejected and active access remains permitted'].join('\n')
        : '<!-- focused-spec:id=Auth-login -->\n#### Scenario: Account access\n'
      await put(join(project, 'specs/auth.md'), source)
      if (representation === 'registry') await put(join(project, 'evidence/auth.yaml'), JSON.stringify({ scopes: { current: { 'Auth-login': { evidence: references } } } }))
      else await expect(stat(join(project, '.focused-spec/evidence.yaml'))).rejects.toThrow()
      const baseline = invoke()
      expect(baseline.status, baseline.stdout + baseline.stderr).toBe(0)
      expect(JSON.parse(baseline.stdout)).toMatchObject({ targetCount: 2, scenarios: [{ id: 'Auth-login', status: 'PASS', evidence: references.map(reference => ({ reference, status: 'PASS' })) }] })
      await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => true\n')
      const regressed = invoke()
      expect(regressed.status, regressed.stdout + regressed.stderr).toBe(1)
      expect(JSON.parse(regressed.stdout)).toMatchObject({ scenarios: [{ status: 'FAIL', evidence: [{ reference: references[0], status: 'FAIL' }, { reference: references[1], status: 'PASS' }] }] })
      await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
      const restored = invoke()
      expect(restored.status, restored.stdout + restored.stderr).toBe(0)
    }
  }, 300000)

  it('typechecks consumer formats against the storage-independent format API', async () => {
    const project = await createPackedConsumer('format-api-two-')
    await installConsumerFramework(project, packedTarball, vitestRunnerTarball)
    await put(join(project, 'format.ts'), [
      "import type { FormatPlugin } from 'focused-spec/format'",
      'export default { apiVersion: 2, parse({ source }) { return { items: [{ line: 1, name: source, nativeIds: ["native"] }], diagnostics: [] } },',
      'bind({ documents, projectRoot }) { if (!projectRoot || documents[0]?.items[0]?.nativeIds[0] !== "native") throw new Error("catalog not supplied"); return { enrollments: [{ document: 0, item: 0, id: "Consumer ID", evidence: ["vitest::test/auth.spec.ts::rejects blocked"], location: { path: "virtual-origin", line: 9 } }], diagnostics: [], sourceClaims: [] } }',
      '} satisfies FormatPlugin',
    ].join('\n'))
    await put(join(project, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, noEmit: true }, files: ['format.ts'] }))
    const typed = spawnSync(process.execPath, [resolve(repository, 'node_modules/typescript/bin/tsc'), '-p', join(project, 'tsconfig.json')], { cwd: project, encoding: 'utf8' })
    expect(typed.status, typed.stdout + typed.stderr).toBe(0)
    await put(join(project, '.focused-spec/config.yaml'), JSON.stringify({ version: 5, specifications: { formats: { custom: { module: './format.ts' } }, documents: [{ match: 'specs/native.custom', scope: 'current', format: 'custom' }] }, runners: { vitest: { package: '@focused-spec/runner-vitest' } } }))
    await put(join(project, 'specs/native.custom'), 'Blocked accounts cannot authenticate')
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    await put(join(project, 'test/auth.spec.ts'), "import { it, expect } from 'vitest'; import { authenticate } from '../auth.mjs'; it('rejects blocked', () => expect(authenticate(true)).toBe(false));")
    const invoke = () => spawnSync(process.execPath, [join(project, 'node_modules/focused-spec/dist/cli.js'), 'run', '--json', '--scenario', 'Consumer ID'], { cwd: project, encoding: 'utf8', timeout: 120000 })
    const baseline = invoke()
    expect(baseline.status, baseline.stdout + baseline.stderr).toBe(0)
    expect(JSON.parse(baseline.stdout)).toMatchObject({ scenarios: [{ id: 'Consumer ID', status: 'PASS' }] })
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => true\n')
    const regressed = invoke()
    expect(regressed.status, regressed.stdout + regressed.stderr).toBe(1)
    expect(JSON.parse(regressed.stdout)).toMatchObject({ scenarios: [{ id: 'Consumer ID', status: 'FAIL' }] })
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    const restored = invoke()
    expect(restored.status, restored.stdout + restored.stderr).toBe(0)
  }, 300000)

  it('executes selectors discovered from packed runner documentation', async () => {
    const project = await createPackedConsumer('runner-documentation-')
    const pytestTarball = packPackage(join(repository, 'packages/runners/pytest'), root)
    const goTarball = packPackage(join(repository, 'packages/runners/go'), root)
    await installConsumerFramework(project, packedTarball, registryTarball, markdownTarball, vitestRunnerTarball, pytestTarball, goTarball)
    const evidence: string[] = []
    for (const framework of ['vitest', 'pytest', 'go']) {
      const documentation = await readFile(join(project, `node_modules/@focused-spec/runner-${framework}/README.md`), 'utf8')
        .then(content => ({ content, error: undefined }), error => ({ content: '', error: error as Error }))
      expect(documentation.error, `public ${framework} contract is unavailable`).toBeUndefined()
      const example = documentation.content.match(new RegExp('^\\| `' + framework + '` \\| `([^`]+)` \\|$', 'mu'))?.[1]
      if (example === undefined) throw new Error(`No documented ${framework} example selector`)
      evidence.push(`${framework}::${example}`)
    }
    await put(join(project, '.focused-spec/config.yaml'), JSON.stringify({ version: 5,
      specifications: { formats: { markdown: { package: '@focused-spec/format-registry', options: { parser: { package: '@focused-spec/format-markdown' } } } }, documents: [{ match: 'specs/contract.md', scope: 'current', format: 'markdown' }] },
      runners: { vitest: { package: '@focused-spec/runner-vitest' }, pytest: { package: '@focused-spec/runner-pytest', options: { command: 'uv', commandArgs: ['run', '--with', 'pytest', 'python'] } }, go: { package: '@focused-spec/runner-go' } },
    }))
    await put(join(project, '.focused-spec/evidence.yaml'), JSON.stringify({ scopes: { current: { 'consumer.documentation.works': { evidence } } } }))
    await put(join(project, 'specs/contract.md'), '<!-- focused-spec:id=consumer.documentation.works -->\n#### Scenario: Documented selectors protect the real outcome\n')
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    await put(join(project, 'test/a.spec.ts'), "import { describe, expect, it } from 'vitest'; import { authenticate } from '../auth.mjs'; describe('outer', () => { describe('inner', () => { it('works', () => expect(authenticate(true)).toBe(false)); }); });")
    await put(join(project, 'tests/test_auth.py'), 'def test_blocked_account():\n    assert not authenticate(True)\n\ndef authenticate(blocked):\n    return not blocked\n')
    await put(join(project, 'go.mod'), 'module example.com/public-contracts\n\ngo 1.22\n')
    await put(join(project, 'auth/auth_test.go'), 'package auth\n\nimport "testing"\n\nfunc TestLogin(t *testing.T) { if authenticate(true) { t.Fatal("blocked account authenticated") } }\nfunc authenticate(blocked bool) bool { return !blocked }\n')
    const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
    const invoke = () => spawnSync(process.execPath, [cli, 'run', '--root', project, '--json'], { cwd: project, encoding: 'utf8', timeout: 120_000 })
    const passed = invoke()
    expect(passed.status, passed.stdout + passed.stderr).toBe(0)
    expect(JSON.parse(passed.stdout)).toMatchObject({ success: true, targetCount: 3, scenarios: [{ status: 'PASS' }] })
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => true\n')
    const regressed = invoke()
    expect(regressed.status).toBe(1)
    expect(JSON.parse(regressed.stdout)).toMatchObject({ success: false, scenarios: [{ status: 'FAIL', evidence: expect.arrayContaining([{ reference: evidence[0], status: 'FAIL', diagnostic: expect.stringContaining('expected true to be false') }]) }] })
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    const restored = invoke()
    expect(restored.status, restored.stdout + restored.stderr).toBe(0)
    expect(JSON.parse(restored.stdout)).toMatchObject({ success: true, scenarios: [{ status: 'PASS' }] })
  }, 300_000)

  it('installs the CLI without creating an agent skill or runner', () => {
    expect(installedEntries).not.toContain('.focused-spec')
    expect(installedEntries).not.toContain('.agents')
    expect(installedEntries).not.toContain('.omp')
    expect(installedEntries).not.toContain('focused-spec.yaml')
  })

  it('ships installer-readable skill metadata', async () => {
    await expectInstallerReadableSkill(consumer)
  })

  it('reports invoked identity from a packed unconfigured consumer', async () => {
    const project = await createPackedConsumer('version-identity-')
    try {
      await put(join(project, '.focused-spec/config.yaml'), 'invalid: [')
      const packageRoot = await realpath(join(project, 'node_modules/focused-spec'))
      const identity = packageIdentity(await readFile(join(packageRoot, 'package.json'), 'utf8'))
      const cli = join(packageRoot, 'dist/cli.js')
      const before = await integrationTree(project)
      const environment = { ...process.env, npm_config_offline: 'true', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' }

      const machine = spawnSync(process.execPath, [cli, 'version', '--json'], { cwd: project, encoding: 'utf8', env: environment })
      expect(machine.status, machine.stderr).toBe(0)
      expect(machine.stderr).toBe('')
      expect(JSON.parse(machine.stdout)).toEqual({
        package: identity,
        executable: await realpath(cli),
        runtime: { node: process.version },
        contracts: { guidance: 1, configuration: 5, format: 2, runner: 1 },
      })

      const text = spawnSync(process.execPath, [cli, '--version'], { cwd: project, encoding: 'utf8', env: environment })
      expect(text.status, text.stderr).toBe(0)
      expect(text.stderr).toBe('')
      expect(text.stdout).toBe(`${identity.name} ${identity.version}\n`)
      expect(await integrationTree(project)).toEqual(before)
    } finally {
      await rm(project, { recursive: true, force: true })
    }
  }, 300_000)

  it('lists and shows packed enrollment provenance without loading its runner', async () => {
    const project = await createPackedConsumer('inspection-provenance-')
    try {
      installPackage(project, packedTarball, registryTarball, markdownTarball)
      await put(join(project, '.focused-spec/config.yaml'), [
        'version: 5',
        'specifications:',
        '  formats: { markdown: { package: "@focused-spec/format-registry", options: { parser: { package: "@focused-spec/format-markdown" } } } }',
        '  documents:',
        '    - match: specs/**/*.md',
        '      format: markdown',
        '      scope: current',
        'runners:',
        '  consumer: { module: ./runner.mjs }',
      ].join('\n'))
      await put(join(project, '.focused-spec/evidence.yaml'), [
        'scopes:',
        '  current:',
        '    packed.inspects:',
        '      evidence:',
        '        - planned:consumer::future',
        '        - consumer::present',
      ].join('\n'))
      await put(join(project, 'specs/inspection.md'), [
        '<!-- focused-spec:id=packed.inspects -->',
        '#### Scenario: Packed inspection preserves provenance',
        '',
        'The packed CLI reports exact native and evidence sources.',
      ].join('\n'))
      await put(join(project, 'runner.mjs'), [
        "import { writeFileSync } from 'node:fs'",
        "writeFileSync(new URL('./runner-imported', import.meta.url), 'imported')",
        'export default { apiVersion: 1, resolve() { throw new Error("inspection must not resolve") }, run() { throw new Error("inspection must not execute") } }',
      ].join('\n'))
      const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
      const scenario = {
        scope: 'current',
        id: 'packed.inspects',
        name: 'Scenario: Packed inspection preserves provenance',
        source: { path: 'specs/inspection.md', line: 2 },
        evidence: [
          { reference: 'planned:consumer::future', source: { path: '.focused-spec/evidence.yaml', line: 5 } },
          { reference: 'consumer::present', source: { path: '.focused-spec/evidence.yaml', line: 6 } },
        ],
      }
      const before = await integrationTree(project)

      const listed = spawnSync(process.execPath, [cli, 'list', '--root', project, '--json'], { cwd: project, encoding: 'utf8' })
      expect(listed.status, listed.stderr || listed.stdout).toBe(0)
      expect(listed.stderr).toBe('')
      expect(JSON.parse(listed.stdout)).toEqual({ valid: true, selection: { scopes: { mode: 'all' } }, scenarios: [scenario] })

      const shown = spawnSync(process.execPath, [cli, 'show', 'packed.inspects', '--root', project, '--scope', 'current', '--json'], { cwd: project, encoding: 'utf8' })
      expect(shown.status, shown.stderr || shown.stdout).toBe(0)
      expect(shown.stderr).toBe('')
      expect(JSON.parse(shown.stdout)).toEqual({
        valid: true,
        selection: { scopes: { mode: 'selected', name: 'current' }, scenario: 'packed.inspects' },
        scenarios: [scenario],
      })
      expect(await lstat(join(project, 'runner-imported')).then(() => true, () => false)).toBe(false)
      expect(await integrationTree(project)).toEqual(before)
    } finally {
      await rm(project, { recursive: true, force: true })
    }
  }, 300_000)

  it('installs and executes the packed CLI from a consumer project', async () => {
    installPackage(consumer, packedTarball, registryTarball, markdownTarball)
    await put(join(consumer, '.focused-spec/config.yaml'), [
      'version: 5',
      'specifications:',
      '  formats: { markdown: { package: "@focused-spec/format-registry", options: { parser: { package: "@focused-spec/format-markdown" } } } }',
      '  documents:',
      '    - match: specs/**/*.md',
      '      format: markdown',
      '      scope: current',
      'runners:',
      '  consumer:',
      '    module: ./runner.ts',
    ].join('\n'))
    await put(join(consumer, '.focused-spec/evidence.yaml'), [
      'scopes:',
      '  current:',
      '    consumer.cli.works:',
      '      evidence: ["consumer::sample"]',
    ].join('\n'))
    await put(join(consumer, 'specs/example.md'), [
      '<!-- focused-spec:id=consumer.cli.works -->',
      '#### Scenario: Installed CLI checks evidence',
      '',
      'The installed CLI resolves one evidence target.',
    ].join('\n'))
    await put(join(consumer, 'runner.ts'), 'export default { apiVersion: 1, async resolve({ selectors }: { selectors: string[] }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run({ targets }: { targets: { targetId: string }[] }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "pass" })) } } }')
    const cli = join(consumer, 'node_modules/focused-spec/dist/cli.js')
    const validation = spawnSync(process.execPath, [cli, 'validate', '--root', consumer, '--json'], { encoding: 'utf8' })
    expect(validation.status).toBe(0)
    expect(JSON.parse(validation.stdout)).toMatchObject({ valid: true, validationScope: { scopes: { mode: 'all' } }, scenarios: 1, targets: 1 })
    const execution = spawnSync(process.execPath, [cli, 'run', '--root', consumer, '--json'], { encoding: 'utf8' })
    expect(execution.status).toBe(0)
    expect(JSON.parse(execution.stdout)).toMatchObject({ success: true, validationScope: { scopes: { mode: 'all' } }, executionSelection: { scopes: { mode: 'all' } }, scenarios: [{ id: 'consumer.cli.works', scope: 'current', status: 'PASS' }] })
  })

  it('serves complete runner guidance from the installed package', async () => {
    const guideConsumer = await createPackedConsumer('runner-guidance-')
    try {
      const entriesBefore = (await readdir(guideConsumer)).sort()
      expect(entriesBefore).not.toContain('.focused-spec')
      await expectInstalledGuide(guideConsumer, 'runners')
      expect((await readdir(guideConsumer)).sort()).toEqual(entriesBefore)
    } finally {
      await rm(guideConsumer, { recursive: true, force: true })
    }
  }, 300_000)

  it('serves integration guidance from core alone offline', async () => {
    const project = await createPackedConsumer('integration-guidance-')
    await put(join(project, 'guidance/integration.md'), '# Consumer instructions must not win')
    await put(join(project, '.focused-spec/config.yaml'), 'invalid: [')
    const paths = await readdir(project, { recursive: true })
    const before = await Promise.all(paths.map(async path => [path, (await stat(join(project, path))).isFile() ? await readFile(join(project, path), 'utf8') : null]))
    await expectInstalledGuide(project, 'integration')
    const result = spawnSync(process.execPath, [join(project, 'node_modules/focused-spec/dist/cli.js'), 'instructions', '--protocol', '1', '--topic', 'integration', '--json'], {
      cwd: project, encoding: 'utf8', env: { ...process.env, npm_config_offline: 'true', HTTPS_PROXY: 'http://127.0.0.1:1', HTTP_PROXY: 'http://127.0.0.1:1' },
    })
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).content).toBe(await readFile(join(project, 'node_modules/focused-spec/guidance/integration.md'), 'utf8'))
    await expect(stat(join(project, 'node_modules/@focused-spec'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readdir(project, { recursive: true })).toEqual(paths)
    expect(await Promise.all(paths.map(async path => [path, (await stat(join(project, path))).isFile() ? await readFile(join(project, path), 'utf8') : null]))).toEqual(before)
  }, 300_000)

  it('refreshes guidance after a compatible package replacement', async () => {
    const workspace = await mkdtemp(join(root, 'compatible-replacement-'))
    try {
      const sourcePackage = join(consumer, 'node_modules/focused-spec')
      const firstPackage = join(workspace, 'snapshot-one')
      const secondPackage = join(workspace, 'snapshot-two')
      await Promise.all([
        cp(sourcePackage, firstPackage, { recursive: true }),
        cp(sourcePackage, secondPackage, { recursive: true }),
      ])

      const originalWorkflow = await readFile(join(sourcePackage, 'guidance/workflow.md'), 'utf8')
      const firstWorkflow = `${originalWorkflow.trimEnd()}\n\n<!-- disposable compatible snapshot one -->\n`
      const secondWorkflow = `${originalWorkflow.trimEnd()}\n\n<!-- disposable compatible snapshot two -->\n`
      await Promise.all([
        writeSnapshotVersion(firstPackage, '0.0.0-compatible-snapshot.1'),
        writeSnapshotVersion(secondPackage, '0.0.0-compatible-snapshot.2'),
        writeFile(join(firstPackage, 'guidance/workflow.md'), firstWorkflow),
        writeFile(join(secondPackage, 'guidance/workflow.md'), secondWorkflow),
      ])

      const tarballs = join(workspace, 'tarballs')
      await mkdir(tarballs)
      const firstTarball = packPackage(firstPackage, tarballs)
      const secondTarball = packPackage(secondPackage, tarballs)
      const replacementConsumer = join(workspace, 'consumer')
      await mkdir(replacementConsumer)
      await writeFile(join(replacementConsumer, 'package.json'), '{"name":"replacement-consumer","private":true,"type":"module"}\n')

      installPackage(replacementConsumer, firstTarball)
      const installedLoader = await readFile(join(replacementConsumer, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8')
      const first = await expectInstalledGuide(replacementConsumer, 'workflow')
      expect(first).toEqual({ content: firstWorkflow, version: '0.0.0-compatible-snapshot.1' })

      installPackage(replacementConsumer, secondTarball)
      const second = await expectInstalledGuide(replacementConsumer, 'workflow')
      expect(second).toEqual({ content: secondWorkflow, version: '0.0.0-compatible-snapshot.2' })
      expect(second.content).not.toBe(first.content)
      expect(await readFile(join(replacementConsumer, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8')).toBe(installedLoader)
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  }, 300_000)

  it('rejects missing authoritative guidance without fallback', async () => {
    const incompleteConsumer = await createPackedConsumer('incomplete-guidance-')
    try {
      const fallback = '# stale consumer guidance must not be used\n'
      await Promise.all([
        put(join(incompleteConsumer, 'guidance/workflow.md'), fallback),
        put(join(incompleteConsumer, '.agents/skills/focused-spec/SKILL.md'), fallback),
      ])
      const packageRoot = join(incompleteConsumer, 'node_modules/focused-spec')
      await rm(join(packageRoot, 'guidance/workflow.md'))
      const cli = join(packageRoot, 'dist/cli.js')
      const result = spawnSync(process.execPath, [cli, 'instructions', '--protocol', '1', '--topic', 'workflow', '--json'], {
        cwd: incompleteConsumer,
        encoding: 'utf8',
      })
      expect(result.status).not.toBe(0)
      expect(result.stdout.trim()).toBe('')
      expect(result.stderr).toMatch(/incomplete installed focused-spec package/iu)
      expect(result.stderr).toMatch(/reinstall/iu)
      expect(result.stdout).not.toContain(fallback.trim())
    } finally {
      await rm(incompleteConsumer, { recursive: true, force: true })
    }
  }, 300_000)

  it('serves guidance from a source-independent packed installation', async () => {
    const isolatedConsumer = await createPackedConsumer('source-independent-')
    try {
      const cli = join(isolatedConsumer, 'node_modules/focused-spec/dist/cli.js')
      expect(relative(repository, cli).startsWith('..')).toBe(true)
      const entriesBefore = (await readdir(isolatedConsumer)).sort()
      expect(entriesBefore).not.toContain('.focused-spec')
      await expectInstalledGuide(isolatedConsumer, 'workflow')
      await expectInstalledGuide(isolatedConsumer, 'formats')
      await expectInstalledGuide(isolatedConsumer, 'runners')
      await expectInstallerReadableSkill(isolatedConsumer)
      expect((await readdir(isolatedConsumer)).sort()).toEqual(entriesBefore)
    } finally {
      await rm(isolatedConsumer, { recursive: true, force: true })
    }
  }, 300_000)

  it('reads composed plugin documentation through separate packed-consumer requests', async () => {
    const project = await createPackedConsumer('plugin-documentation-')
    try {
      installPackage(project, packedTarball, registryTarball, markdownTarball)
      await put(join(project, '.focused-spec/config.yaml'), JSON.stringify({ version: 5,
        specifications: { formats: { selected: { package: '@focused-spec/format-registry', options: { parser: { package: '@focused-spec/format-markdown' } } } },
          documents: [{ match: 'specs/**/*.md', scope: 'current', format: 'selected' }] }, runners: {},
      }))
      const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
      expect(relative(repository, cli).startsWith('..')).toBe(true)
      const before = await integrationTree(project)
      const entriesBefore = (await readdir(project)).sort()
      for (const [args, selection, name] of [
        [['--format', 'selected'], { kind: 'format', name: 'selected' }, '@focused-spec/format-registry'],
        [['--package', '@focused-spec/format-markdown'], { kind: 'package', name: '@focused-spec/format-markdown' }, '@focused-spec/format-markdown'],
      ] as const) {
        const packageRoot = await realpath(join(project, 'node_modules', name))
        const identity = packageIdentity(await readFile(join(packageRoot, 'package.json'), 'utf8'))
        const path = await realpath(join(packageRoot, 'README.md'))
        const content = await readFile(path, 'utf8')
        const response = spawnSync(process.execPath, [cli, 'plugin-docs', ...args, '--json'], { cwd: project, encoding: 'utf8',
          env: { ...process.env, npm_config_offline: 'true', HTTPS_PROXY: 'http://127.0.0.1:1' },
        })
        expect(response.status, response.stderr).toBe(0)
        expect(response.stderr).toBe('')
        expect(JSON.parse(response.stdout)).toEqual({ selection,
          plugin: { package: name, ...identity, root: packageRoot }, document: { path, content },
        })
        const text = spawnSync(process.execPath, [cli, 'plugin-docs', ...args], { cwd: project, encoding: 'utf8' })
        expect(text.status, text.stderr).toBe(0)
        expect(text.stdout).toContain(content)
        const provenance = text.stdout.slice(0, text.stdout.indexOf(content))
        expect(provenance).toContain(identity.name)
        expect(provenance).toContain(identity.version)
        expect(provenance).toContain(path)
      }
      expect(await integrationTree(project)).toEqual(before)
      expect((await readdir(project)).sort()).toEqual(entriesBefore)
    } finally {
      await rm(project, { recursive: true, force: true })
    }
  }, 300_000)

  it('typechecks a consumer plugin against focused-spec runner', async () => {
    await put(join(consumer, 'plugin.ts'), [
      "import type { RunnerPlugin } from 'focused-spec/runner'",
      "import type { FormatPlugin } from 'focused-spec/format'",
      'export default { apiVersion: 1, async resolve() { return { targets: [], errors: [] } }, async run() { return { results: [] } } } satisfies RunnerPlugin',
      'export const format = { apiVersion: 2, parse() { return { items: [], diagnostics: [] } } } satisfies FormatPlugin',
    ].join('\n'))
    await put(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: true }, files: ['plugin.ts'] }))
    const tsc = spawnSync(process.execPath, [resolve(repository, 'node_modules/typescript/bin/tsc'), '-p', join(consumer, 'tsconfig.json')], { cwd: consumer, encoding: 'utf8' })
    expect(tsc.status, tsc.stdout + tsc.stderr).toBe(0)
  })

  it('installs selected agent integrations offline from the packed package', async () => {
    const project = await createPackedConsumer('init-selected-')
    const result = initializeConsumer(project, 'oh-my-pi,claude')
    expect(result.status, result.stderr).toBe(0)
    const bundled = join(project, 'node_modules/focused-spec')
    const loader = await readFile(join(bundled, 'skills/focused-spec/SKILL.md'), 'utf8')
    for (const [directory, tool] of [['.omp', 'oh-my-pi'], ['.claude', 'claude']] as const) {
      const path = join(project, directory, 'skills/focused-spec/SKILL.md')
      expect(await readFile(path, 'utf8')).toBe(loader)
      expect((await lstat(path)).isSymbolicLink()).toBe(false)
      expect(await readFile(join(project, directory, 'commands/focused-spec.md'), 'utf8'))
        .toBe(await readFile(join(bundled, 'skills/commands', tool, 'focused-spec.md'), 'utf8'))
    }
    expect((await readdir(project)).sort()).toEqual(['.claude', '.omp', 'node_modules', 'package.json'])
  })

  it.skipIf(process.platform === 'win32')('installs from a packed consumer through the reviewed terminal picker', async () => {
    const project = await createPackedConsumer('init-packed-tty-')
    const home = await mkdtemp(join(root, 'init-packed-tty-home-'))
    const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
    const script = `import os, pty, select, sys
pid, master = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], [sys.argv[1], *sys.argv[2:]])
started, sent, confirmed = False, False, False
while True:
    ready, _, _ = select.select([master], [], [])
    if not ready: continue
    try: data = os.read(master, 65536)
    except OSError: break
    if not data: break
    os.write(1, data)
    if not started and b'to continue...' in data:
        os.write(master, b'\\r')
        started = True
    if started and not sent and b'Search:' in data:
        os.write(master, b'claude \\r')
        sent = True
    elif sent and not confirmed and b'Install these files? Y / N' in data:
        os.write(master, b'y')
        confirmed = True
_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
`
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, TERM: 'xterm-256color', npm_config_offline: 'true', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' }
    delete env.CI
    const result = spawnSync('python3', ['-c', script, process.execPath, cli, 'init', '--no-animation'], { cwd: project, env, encoding: 'utf8', timeout: 30_000 })
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('setup review')
    expect(result.stdout).toContain('New files:')
    expect(result.stdout).toContain('.claude/skills/focused-spec/SKILL.md')
    expect(result.stdout).not.toContain('INSTALL  ')
    expect(result.stdout).toContain('Setup Complete')
    expect(await readFile(join(project, '.claude/skills/focused-spec/SKILL.md'), 'utf8'))
      .toBe(await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8'))
    expect(await readdir(home)).toEqual([])
  }, 120_000)

  it('deduplicates Codex and shared agent destinations', async () => {
    const project = await createPackedConsumer('init-shared-')
    const result = initializeConsumer(project, 'amp,antigravity,codex,gsd,zed,agents,codex')
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ tools: ['amp', 'antigravity', 'codex', 'gsd', 'zed', 'agents'], files: [
      { path: '.agents/skills/focused-spec/SKILL.md', action: 'install', applied: true },
      { path: '.agents/workflows/focused-spec.md', action: 'install', applied: true },
    ], errors: [] })
    const bundled = join(project, 'node_modules/focused-spec')
    expect(await integrationTree(project)).toEqual(expectedTree({
      '.agents/skills/focused-spec/SKILL.md': await readFile(join(bundled, 'skills/focused-spec/SKILL.md'), 'utf8'),
      '.agents/workflows/focused-spec.md': await readFile(join(bundled, 'skills/commands/antigravity/focused-spec.md'), 'utf8'),
    }))
  })

  it('installs agent integration without manufacturing evidence setup', async () => {
    const project = await createPackedConsumer('init-only-')
    await put(join(project, '.focused-spec/config.yaml'), 'invalid: [')
    await put(join(project, 'AGENTS.md'), 'custom project instructions')
    const before = await readFile(join(project, '.focused-spec/config.yaml'), 'utf8')
    const result = spawnSync(process.execPath, [join(project, 'node_modules/focused-spec/dist/cli.js'), 'init', '--tools', 'claude'], { cwd: project, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    expect(await readFile(join(project, '.focused-spec/config.yaml'), 'utf8')).toBe(before)
    expect(await readFile(join(project, 'AGENTS.md'), 'utf8')).toBe('custom project instructions')
    expect(await readdir(join(project, '.focused-spec'))).toEqual(['config.yaml'])
    expect((await readdir(project)).sort()).toEqual(['.claude', '.focused-spec', 'AGENTS.md', 'node_modules', 'package.json'])
  })

  it('leaves identical agent integrations unchanged on reinitialization', async () => {
    const project = await createPackedConsumer('init-repeat-')
    expect(initializeConsumer(project, 'claude').status).toBe(0)
    const skill = join(project, '.claude/skills/focused-spec/SKILL.md')
    const before = await stat(skill)
    const tree = await integrationTree(project)
    const result = initializeConsumer(project, 'claude')
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).files).toEqual([
      { path: '.claude/skills/focused-spec/SKILL.md', action: 'unchanged', applied: false },
      { path: '.claude/commands/focused-spec.md', action: 'unchanged', applied: false },
    ])
    expect(await integrationTree(project)).toEqual(tree)
    expect((await stat(skill)).mtimeMs).toBe(before.mtimeMs)
    expect((await stat(skill)).ino).toBe(before.ino)
  })

  it('preserves custom integrations and aborts all writes on conflict', async () => {
    const project = await createPackedConsumer('init-conflict-')
    await put(join(project, '.claude/skills/focused-spec/SKILL.md'), 'custom skill')
    const before = await integrationTree(project)
    const result = initializeConsumer(project, 'oh-my-pi,claude')
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout).files.every((file: { applied: boolean }) => !file.applied)).toBe(true)
    expect(await integrationTree(project)).toEqual(before)
    expect(JSON.parse(result.stdout)).toMatchObject({
      files: expect.arrayContaining([expect.objectContaining({ path: '.claude/skills/focused-spec/SKILL.md', action: 'conflict', applied: false })]),
      errors: expect.arrayContaining([expect.objectContaining({ path: '.claude/skills/focused-spec/SKILL.md', message: expect.stringMatching(/\S/u) })]),
    })
  })

  it('replaces only explicitly selected integration files', async () => {
    const project = await createPackedConsumer('init-replace-')
    await put(join(project, '.claude/skills/focused-spec/SKILL.md'), 'custom skill')
    await put(join(project, '.claude/commands/focused-spec.md'), 'custom command')
    await put(join(project, '.claude/skills/focused-spec/custom.txt'), 'keep adjacent file')
    await put(join(project, '.omp/skills/focused-spec/SKILL.md'), 'keep other target')
    const result = initializeConsumer(project, 'claude', '--replace')
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).files).toEqual([
      { path: '.claude/skills/focused-spec/SKILL.md', action: 'replace', applied: true },
      { path: '.claude/commands/focused-spec.md', action: 'replace', applied: true },
    ])
    expect(await readFile(join(project, '.claude/skills/focused-spec/SKILL.md'), 'utf8')).toBe(await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8'))
    expect(await readFile(join(project, '.claude/skills/focused-spec/custom.txt'), 'utf8')).toBe('keep adjacent file')
    expect(await readFile(join(project, '.omp/skills/focused-spec/SKILL.md'), 'utf8')).toBe('keep other target')
  })

  it('previews installation and replacement without filesystem writes', async () => {
    const project = await createPackedConsumer('init-preview-')
    const fresh = initializeConsumer(project, 'oh-my-pi,claude', '--dry-run')
    expect(fresh.status, fresh.stderr).toBe(0)
    expect(await integrationTree(project)).toEqual({})
    await put(join(project, '.claude/skills/focused-spec/SKILL.md'), 'custom skill')
    const tree = await integrationTree(project)
    const conflict = initializeConsumer(project, 'oh-my-pi,claude', '--dry-run')
    expect(conflict.status).toBe(1)
    expect(await integrationTree(project)).toEqual(tree)
    const replace = initializeConsumer(project, 'oh-my-pi,claude', '--replace', '--dry-run')
    expect(replace.status, replace.stderr).toBe(0)
    expect(JSON.parse(replace.stdout).files).toContainEqual({ path: '.claude/skills/focused-spec/SKILL.md', action: 'replace', applied: false })
    expect(await integrationTree(project)).toEqual(tree)
  })

  it('rejects unsafe integration destinations without modifying either tree', async () => {
    const project = await createPackedConsumer('init-boundary-')
    const outside = await mkdtemp(join(root, 'outside-agent-'))
    await put(join(outside, 'sentinel'), 'outside content')
    await symlink(outside, join(project, '.claude'), 'dir')
    const symlinked = initializeConsumer(project, 'oh-my-pi,claude', '--replace')
    expect(symlinked.status).toBe(1)
    expect((await lstat(join(project, '.claude'))).isSymbolicLink()).toBe(true)
    expect(await readdir(outside)).toEqual(['sentinel'])
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('outside content')
    expect(await lstat(join(project, '.omp')).then(() => true, () => false)).toBe(false)
    await rm(join(project, '.claude'))
    await put(join(project, '.claude'), 'not a directory')
    expect(initializeConsumer(project, 'claude', '--replace').status).toBe(1)
    expect(await readFile(join(project, '.claude'), 'utf8')).toBe('not a directory')
    await rm(join(project, '.claude'))
    await mkdir(join(project, '.claude/skills/focused-spec/SKILL.md'), { recursive: true })
    expect(initializeConsumer(project, 'claude', '--replace').status).toBe(1)
    expect((await stat(join(project, '.claude/skills/focused-spec/SKILL.md'))).isDirectory()).toBe(true)
    await rm(join(project, '.claude'), { recursive: true })
    const alias = join(root, 'root-alias')
    await symlink(project, alias, 'dir')
    const canonical = initializeConsumer(project, 'codex', alias)
    expect(canonical.status, canonical.stderr).toBe(0)
    expect(JSON.parse(canonical.stdout).root).toBe(await realpath(project))
  })

  it('rejects incomplete bundled init assets before writing integrations', async () => {
    const project = await createPackedConsumer('init-assets-')
    const asset = join(project, 'node_modules/focused-spec/skills/commands/claude/focused-spec.md')
    const content = await readFile(asset, 'utf8')
    try {
      for (const action of ['empty', 'missing']) {
        if (action === 'empty') await writeFile(asset, '')
        else await rm(asset)
        const result = initializeConsumer(project, 'oh-my-pi,claude')
        expect(result.status).toBe(1)
        expect(JSON.parse(result.stdout)).toMatchObject({
          errors: expect.arrayContaining([expect.objectContaining({ path: '.claude/commands/focused-spec.md', message: expect.stringMatching(/\S/u) })]),
        })
        expect(await integrationTree(project)).toEqual({})
      }
    } finally { await writeFile(asset, content) }
  })

  it('installs every OpenSpec 1.14.1 agent target from the packed package', async () => {
    const installation = await createPackedConsumer('init-catalog-')
    const loader = await readFile(join(installation, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8')
    for (const target of agentTargets) {
      const project = await mkdtemp(join(root, `target-${target.id}-`))
      const home = await mkdtemp(join(root, 'catalog-home-'))
      const result = initializeConsumerInHome(installation, home, target.id, project)
      expect(result.status, `${target.id}: ${result.stderr}`).toBe(0)
      const projectFiles: Record<string, string> = {}
      const homeFiles: Record<string, string> = {}
      ;(target.home ? homeFiles : projectFiles)[target.skill] = loader
      if (target.command !== null) {
        const filename = target.command.slice(target.command.lastIndexOf('/') + 1)
        projectFiles[target.command] = await readFile(join(installation, 'node_modules/focused-spec/skills/commands', target.id, filename), 'utf8')
      }
      expect(await integrationTree(project), target.id).toEqual(expectedTree(projectFiles))
      expect(await integrationTree(home), target.id).toEqual(expectedTree(homeFiles))
      expect(JSON.parse(result.stdout)).toMatchObject({ root: await realpath(project), tools: [target.id], errors: [] })
    }
  }, 120_000)

  it('installs host-readable wrappers with native argument handling', async () => {
    const { project, home, invoke } = await initWorkspace('init-formats-')
    const result = invoke(agentTargets.map(target => target.id).join(','))
    expect(result.status, result.stderr).toBe(0)
    const request = 'Check account access for blocked users: keep the original task.'
    for (const target of agentTargets.filter(target => target.command !== null)) {
      const text = await readFile(join(project, target.command!), 'utf8')
      let prompt: string
      if (target.format === 'toml') {
        const parsed = spawnSync('python3', ['-c', 'import json,sys,tomllib; print(json.dumps(tomllib.loads(sys.stdin.read())))'], { input: text, encoding: 'utf8' })
        expect(parsed.status, `${target.id}: ${parsed.stderr}`).toBe(0)
        const command = JSON.parse(parsed.stdout)
        expect(command.description).toEqual(expect.any(String))
        expect(command.prompt).toEqual(expect.any(String))
        prompt = command.prompt
      } else if (target.format === 'yaml') {
        const header = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
        expect(header, target.id).not.toBeNull()
        const document = parseDocument(header![1]!)
        expect(document.errors, target.id).toEqual([])
        const metadata = document.toJS()
        expect(metadata, target.id).toMatchObject(target.metadata)
        expect(metadata.description, target.id).toEqual(expect.any(String))
        expect(metadata).not.toHaveProperty('allowed-tools')
        if (target.id === 'atomcode') expect(header![1]).toMatch(/^name: focused-spec\n/m)
        prompt = text.slice(header![0].length)
      } else {
        if (target.format === 'heading') expect(text).toMatch(/^# focused-spec\n/)
        else expect(text).not.toMatch(/^---\n/)
        prompt = text
      }
      expect(prompt, target.id).toMatch(/Load [^\n]*focused-spec[^\n]*skill/i)
      expect(text, target.id).not.toMatch(/opsx-|Bash\(openspec/)
      if (target.arguments !== null) {
        const expanded = prompt.replaceAll(target.arguments, request)
        expect(expanded, target.id).toContain(request)
        expect(expanded, target.id).not.toContain(target.arguments)
      } else expect(prompt, target.id).not.toMatch(/\$ARGUMENTS|\$@|\{\{args\}\}/)
    }
    expect(await integrationTree(home)).toEqual(expectedTree({ '.minimax/skills/focused-spec/SKILL.md': await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8') }))
    for (const [id, hint] of [['hermes', /skills\.external_dirs/], ['github-copilot', /IDE/], ['codex', /\$focused-spec/], ['kimi', /\/skill:focused-spec/], ['amazon-q', /@focused-spec/]] as const) {
      const output = spawnSync(process.execPath, [join(project, 'node_modules/focused-spec/dist/cli.js'), 'init', '--tools', id], { cwd: project, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } })
      expect(output.status, output.stderr).toBe(0)
      expect(output.stdout).toMatch(hint)
    }
  }, 120_000)

  it('normalizes Windsurf selection to Devin without legacy writes', async () => {
    const { project, invoke } = await initWorkspace('init-alias-')
    await put(join(project, '.windsurf/custom.md'), 'keep legacy content')
    const result = invoke(' windsurf,devin,windsurf ')
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ tools: ['devin'], files: [
      { path: '.devin/skills/focused-spec/SKILL.md', action: 'install', applied: true },
      { path: '.devin/workflows/focused-spec.md', action: 'install', applied: true },
    ], errors: [] })
    const bundled = join(project, 'node_modules/focused-spec')
    expect(await integrationTree(project)).toEqual(expectedTree({
      '.windsurf/custom.md': 'keep legacy content',
      '.devin/skills/focused-spec/SKILL.md': await readFile(join(bundled, 'skills/focused-spec/SKILL.md'), 'utf8'),
      '.devin/workflows/focused-spec.md': await readFile(join(bundled, 'skills/commands/devin/focused-spec.md'), 'utf8'),
    }))
  })

  it('installs MiniMax integration only into the explicitly selected home root', async () => {
    const { project, home, invoke } = await initWorkspace('init-minimax-')
    await put(join(home, '.minimax/config.json'), 'keep host settings')
    const homeBefore = await integrationTree(home)
    const projectOnly = initializeConsumerInHome(project, join(home, 'unavailable'), 'codex')
    expect(projectOnly.status, projectOnly.stderr).toBe(0)
    expect(await integrationTree(home)).toEqual(homeBefore)
    const projectBefore = await integrationTree(project)
    const result = invoke('minimax-code')
    expect(result.status, result.stderr).toBe(0)
    const loader = await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8')
    expect(await integrationTree(project)).toEqual(projectBefore)
    expect(await integrationTree(home)).toEqual(expectedTree({ '.minimax/config.json': 'keep host settings', '.minimax/skills/focused-spec/SKILL.md': loader }))
    await expectInstalledGuide(project, 'workflow')
  })

  it('previews mixed project and home integration without writes', async () => {
    const { project, home, invoke } = await initWorkspace('init-global-preview-')
    const globalPath = join(await realpath(home), '.minimax/skills/focused-spec/SKILL.md')
    const fresh = invoke('claude,minimax-code', '--dry-run')
    expect(fresh.status, fresh.stderr).toBe(0)
    expect(JSON.parse(fresh.stdout).files).toContainEqual({ path: globalPath, action: 'install', applied: false })
    expect(await integrationTree(project)).toEqual({})
    expect(await integrationTree(home)).toEqual({})
    await put(globalPath, 'custom home loader')
    const homeBefore = await integrationTree(home)
    expect(invoke('claude,minimax-code', '--dry-run').status).toBe(1)
    const replacement = invoke('claude,minimax-code', '--replace', '--dry-run')
    expect(replacement.status, replacement.stderr).toBe(0)
    expect(JSON.parse(replacement.stdout).files).toContainEqual({ path: globalPath, action: 'replace', applied: false })
    expect(await integrationTree(project)).toEqual({})
    expect(await integrationTree(home)).toEqual(homeBefore)
  })

  it('aborts project and home writes together on any integration conflict', async () => {
    for (const conflictingRoot of ['project', 'home']) {
      const { project, home, invoke } = await initWorkspace('init-global-conflict-')
      const path = conflictingRoot === 'home' ? join(home, '.minimax/skills/focused-spec/SKILL.md') : join(project, '.claude/skills/focused-spec/SKILL.md')
      await put(path, 'custom integration')
      const projectBefore = await integrationTree(project)
      const homeBefore = await integrationTree(home)
      const result = invoke('claude,minimax-code')
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).files.every((file: { applied: boolean }) => !file.applied)).toBe(true)
      expect(await integrationTree(project)).toEqual(projectBefore)
      expect(await integrationTree(home)).toEqual(homeBefore)
    }
  })

  it('replaces only selected MiniMax integration and preserves neighboring files', async () => {
    const { project, home, invoke } = await initWorkspace('init-global-replace-')
    const path = join(await realpath(home), '.minimax/skills/focused-spec/SKILL.md')
    await put(path, 'custom home loader')
    await put(join(home, '.minimax/skills/focused-spec/custom.txt'), 'keep neighbor')
    await put(join(home, '.minimax/config.json'), 'keep settings')
    await put(join(project, '.claude/skills/focused-spec/SKILL.md'), 'keep project integration')
    const projectBefore = await integrationTree(project)
    const result = invoke('minimax-code', '--replace')
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).files).toEqual([{ path, action: 'replace', applied: true }])
    expect(await integrationTree(project)).toEqual(projectBefore)
    expect(await integrationTree(home)).toEqual(expectedTree({
      '.minimax/skills/focused-spec/SKILL.md': await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8'),
      '.minimax/skills/focused-spec/custom.txt': 'keep neighbor', '.minimax/config.json': 'keep settings',
    }))
  })

  it('rejects unsafe home destinations without modifying either tree', async () => {
    const { project, home, invoke } = await initWorkspace('init-global-unsafe-')
    const outside = await mkdtemp(join(root, 'global-outside-'))
    await put(join(outside, 'sentinel'), 'outside content')
    const outsideBefore = await integrationTree(outside)
    for (const unsafe of ['symlink', 'file-ancestor', 'directory-destination', 'file-symlink']) {
      if (unsafe === 'symlink') await symlink(outside, join(home, '.minimax'), 'dir')
      else if (unsafe === 'file-ancestor') await put(join(home, '.minimax'), 'not a directory')
      else if (unsafe === 'directory-destination') await mkdir(join(home, '.minimax/skills/focused-spec/SKILL.md'), { recursive: true })
      else {
        await mkdir(join(home, '.minimax/skills/focused-spec'), { recursive: true })
        await symlink(join(outside, 'sentinel'), join(home, '.minimax/skills/focused-spec/SKILL.md'), 'file')
      }
      const homeBefore = await integrationTree(home)
      for (const options of [[], ['--replace']]) {
        const result = invoke('claude,minimax-code', ...options)
        expect(result.status, unsafe).toBe(1)
        expect(await integrationTree(project), unsafe).toEqual({})
        expect(await integrationTree(home), unsafe).toEqual(homeBefore)
        expect(await integrationTree(outside), unsafe).toEqual(outsideBefore)
      }
      await rm(join(home, '.minimax'), { recursive: true })
    }
    await put(join(home, 'file'), 'not a home directory')
    for (const invalid of [join(home, 'missing'), join(home, 'file')]) {
      const result = initializeConsumerInHome(project, invalid, 'claude,minimax-code')
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).errors).toContainEqual(expect.objectContaining({ path: join(invalid, '.minimax/skills/focused-spec/SKILL.md') }))
      expect(await integrationTree(project)).toEqual({})
    }
    expect(await integrationTree(home)).toEqual({ file: 'not a home directory' })
  })

  it('reports canonical home destinations and completed global writes', async () => {
    const { project, home } = await initWorkspace('init-global-json-')
    const alias = join(root, `home-alias-${Date.now()}`)
    await symlink(home, alias, 'dir')
    const invoke = (...options: string[]) => initializeConsumerInHome(project, alias, 'minimax-code', ...options)
    const path = join(await realpath(home), '.minimax/skills/focused-spec/SKILL.md')
    for (const [options, action, applied] of [[['--dry-run'], 'install', false], [[], 'install', true], [[], 'unchanged', false]] as const) {
      const result = invoke(...options)
      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({ root: await realpath(project), tools: ['minimax-code'], dryRun: options.some(option => option === '--dry-run'), files: [{ path, action, applied }], errors: [] })
    }
    await put(path, 'custom loader')
    const conflict = invoke()
    expect(conflict.status).toBe(1)
    expect(JSON.parse(conflict.stdout)).toMatchObject({ files: [{ path, action: 'conflict', applied: false }], errors: [expect.objectContaining({ path })] })
    if (process.platform !== 'win32' && process.getuid?.() !== 0) {
      await rm(path)
      const directory = dirname(path)
      await chmod(directory, 0o555)
      try {
        const partial = initializeConsumerInHome(project, home, 'claude,minimax-code')
        expect(partial.status).toBe(1)
        const report = JSON.parse(partial.stdout)
        expect(report.files).toContainEqual({ path: '.claude/skills/focused-spec/SKILL.md', action: 'install', applied: true })
        expect(report.files).toContainEqual({ path, action: 'install', applied: false })
        expect(report.errors).toContainEqual(expect.objectContaining({ path }))
        expect(await readFile(join(project, '.claude/skills/focused-spec/SKILL.md'), 'utf8')).toBe(await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8'))
      } finally { await chmod(directory, 0o755) }
    }
  })
})
