import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'

type GuideTopic = 'workflow' | 'runners'

interface PackageIdentity {
  readonly name: string
  readonly version: string
}

const repository = fileURLToPath(new URL('..', import.meta.url))
let root: string
let consumer: string
let installedEntries: string[]
let packedTarball: string

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

function installPackage(project: string, tarball: string): void {
  const install = spawnSync('npm', ['install', '--prefix', project, '--ignore-scripts', '--no-package-lock', '--no-save', tarball], {
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
  consumer = join(root, 'project')
  await mkdir(consumer)
  await writeFile(join(consumer, 'package.json'), '{"name":"consumer","private":true,"type":"module"}\n')
  packedTarball = packPackage(repository, root)
  installPackage(consumer, packedTarball)
  installedEntries = await readdir(consumer)
}, 300_000)

afterAll(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
})

describe('package distribution', () => {
  it('installs the CLI without creating an agent skill or runner', () => {
    expect(installedEntries).not.toContain('.focused-spec')
    expect(installedEntries).not.toContain('.agents')
    expect(installedEntries).not.toContain('.omp')
    expect(installedEntries).not.toContain('focused-spec.yaml')
  })

  it('ships installer-readable skill metadata', async () => {
    await expectInstallerReadableSkill(consumer)
  })

  it('installs and executes the packed CLI from a consumer project', async () => {
    await put(join(consumer, '.focused-spec/config.yaml'), [
      'version: 3',
      'specifications:',
      '  documents:',
      '    - match: specs/**/*.md',
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
      await expectInstalledGuide(isolatedConsumer, 'runners')
      await expectInstallerReadableSkill(isolatedConsumer)
      expect((await readdir(isolatedConsumer)).sort()).toEqual(entriesBefore)
    } finally {
      await rm(isolatedConsumer, { recursive: true, force: true })
    }
  }, 300_000)

  it('typechecks a consumer plugin against focused-spec runner', async () => {
    await put(join(consumer, 'plugin.ts'), [
      "import type { RunnerPlugin } from 'focused-spec/runner'",
      'export default { apiVersion: 1, async resolve() { return { targets: [], errors: [] } }, async run() { return { results: [] } } } satisfies RunnerPlugin',
    ].join('\n'))
    await put(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: true }, files: ['plugin.ts'] }))
    const tsc = spawnSync(process.execPath, [resolve(repository, 'node_modules/typescript/bin/tsc'), '-p', join(consumer, 'tsconfig.json')], { cwd: consumer, encoding: 'utf8' })
    expect(tsc.status, tsc.stdout + tsc.stderr).toBe(0)
  })
})
