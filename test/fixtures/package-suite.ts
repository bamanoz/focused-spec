import { spawnSync } from 'node:child_process'
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect } from 'vitest'
import { parseDocument } from 'yaml'

type GuideTopic = 'workflow' | 'review' | 'author-revise' | 'upgrade' | 'verify' | 'integration' | 'formats' | 'runners'

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

export const agentTargets: AgentTarget[] = JSON.parse(await readFile(new URL('./agent-targets.json', import.meta.url), 'utf8'))

export const repository = fileURLToPath(new URL('../..', import.meta.url))

export let root: string

export let consumer: string

export let installedEntries: string[]

export let packedTarball: string

export let markdownTarball: string

export let vitestRunnerTarball: string

export let inlineTarball: string

export let registryTarball: string

export async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

export function packageIdentity(text: string): PackageIdentity {
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

export function packPackage(packageRoot: string, destination: string): string {
  const pack = spawnSync('npm', ['pack', '--ignore-scripts', '--pack-destination', destination, '--json'], {
    cwd: packageRoot,
    encoding: 'utf8',
    timeout: 120_000,
  })
  if (pack.status !== 0) throw new Error(`npm pack failed: ${pack.stderr}`)
  return join(destination, packedFilename(pack.stdout))
}

export function installPackage(project: string, ...tarballs: readonly string[]): void {
  const install = spawnSync('npm', ['install', '--prefix', project, '--ignore-scripts', '--no-save', '--prefer-offline', '--no-audit', '--no-fund', ...tarballs], {
    encoding: 'utf8',
    timeout: 180_000,
  })
  if (install.status !== 0) throw new Error(`consumer install failed: ${install.stderr}`)
}

export async function createPackedConsumer(prefix: string): Promise<string> {
  const project = await mkdtemp(join(root, prefix))
  await writeFile(join(project, 'package.json'), '{"name":"consumer","private":true,"type":"module"}\n')
  installPackage(project, packedTarball)
  return project
}

export async function installConsumerFramework(project: string, ...tarballs: readonly string[]): Promise<void> {
  const manifest: Record<string, unknown> = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
  const lock: { packages: Record<string, { link?: boolean }> } = JSON.parse(await readFile(join(repository, 'package-lock.json'), 'utf8'))
  // Reuse the verified external graph, never checkout workspace links or floating optional peers.
  const packages = Object.fromEntries(Object.entries(lock.packages).filter(([path, metadata]) => path.startsWith('node_modules/') && !metadata.link))
  await writeFile(join(project, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, requires: true, packages: { '': manifest, ...packages } }))
  const vitestVersion = packageIdentity(await readFile(join(repository, 'node_modules/vitest/package.json'), 'utf8')).version
  installPackage(project, ...tarballs, `vitest@${vitestVersion}`)
}

export function initializeConsumer(project: string, tools: string, ...options: string[]) {
  return initializeConsumerInHome(project, join(root, 'home'), tools, ...options)
}

export function initializeConsumerInHome(project: string, home: string, tools: string, ...options: string[]) {
  return spawnSync(process.execPath, [join(project, 'node_modules/focused-spec/dist/cli.js'), 'init', '--tools', tools, '--json', ...options], {
    cwd: project, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, HOME: home, USERPROFILE: home, npm_config_offline: 'true', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' },
  })
}

export async function integrationTree(project: string): Promise<Record<string, string>> {
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

export function expectedTree(files: Record<string, string>): Record<string, string> {
  const tree: Record<string, string> = {}
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/')
    for (let count = 1; count < parts.length; count++) tree[parts.slice(0, count).join('/')] = 'directory'
    tree[path] = content
  }
  return tree
}

export async function initWorkspace(prefix: string) {
  const project = await createPackedConsumer(prefix)
  const home = await mkdtemp(join(root, 'home-'))
  return { project, home, invoke: (tools: string, ...options: string[]) => initializeConsumerInHome(project, home, tools, ...options) }
}

export async function writeSnapshotVersion(packageRoot: string, version: string): Promise<void> {
  const packagePath = join(packageRoot, 'package.json')
  const metadata: unknown = JSON.parse(await readFile(packagePath, 'utf8'))
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('snapshot package metadata is not an object')
  }
  await writeFile(packagePath, `${JSON.stringify({ ...metadata, version }, null, 2)}\n`)
}

export async function expectInstalledGuide(project: string, topic: GuideTopic): Promise<{ readonly content: string, readonly version: string }> {
  const packageRoot = join(project, 'node_modules/focused-spec')
  const identity = packageIdentity(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  expect(identity.name).toBe('focused-spec')
  const operation = await readFile(join(packageRoot, 'guidance', `${topic}.md`), 'utf8')
  const content = ['review', 'author-revise', 'upgrade', 'verify'].includes(topic)
    ? `## Workflow router\n\n${(await readFile(join(packageRoot, 'guidance/workflow.md'), 'utf8')).trimEnd()}\n\n\n## ${topic} guidance\n\n${operation.trimEnd()}\n`
    : operation
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

export async function expectInstallerReadableSkill(project: string): Promise<void> {
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
