import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { glob } from 'glob'
import { parse } from 'yaml'
import type { EvalCase, EvalResult } from './types.ts'
import { runProcess } from './process.ts'
import { captureUpgradeBaseline, LEGACY_VERSION, serveUpgradeCandidate } from './upgrade.ts'
import type { UpgradeBaseline } from './upgrade.ts'
import { prepareIntegration } from './integration.ts'
import type { IntegrationBaseline } from './integration.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const evalRoot = fileURLToPath(new URL('.', import.meta.url))
const OPEN_SPEC_VERSION = '1.6.0'

function runNpm(args: readonly string[], cwd: string, timeoutMs: number) {
  const npmExecPath = process.env.npm_execpath
  return npmExecPath === undefined
    ? runProcess(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, timeoutMs })
    : runProcess(process.execPath, [npmExecPath, ...args], { cwd, timeoutMs })
}

interface PackedDependencies {
  readonly focused: string
  readonly markdown: string
  readonly inline: string
  readonly registry: string
  readonly go: string
  readonly pytest: string
  readonly openspec?: string
}

async function packLocalPackage(packageRoot: string, cache: string): Promise<string> {
  const packed = await runNpm(['pack', '--ignore-scripts', '--pack-destination', cache], packageRoot, 120_000)
  if (packed.code !== 0) throw new Error(`npm pack failed for ${packageRoot}: ${packed.stderr || packed.stdout}`)
  const name = packed.stdout.trim().split(/\r?\n/u).at(-1)
  if (name === undefined || name === '') throw new Error(`npm pack did not report a tarball for ${packageRoot}`)
  return join(cache, name)
}

async function packDependencies(includeOpenSpec: boolean, cache: string): Promise<PackedDependencies> {
  const [focused, markdown, inline, registry, go, pytest] = await Promise.all([
    packLocalPackage(join(repositoryRoot, 'packages/core'), cache),
    packLocalPackage(join(repositoryRoot, 'packages/formats/markdown'), cache),
    packLocalPackage(join(repositoryRoot, 'packages/formats/inline'), cache),
    packLocalPackage(join(repositoryRoot, 'packages/formats/registry'), cache),
    packLocalPackage(join(repositoryRoot, 'packages/runners/go'), cache),
    packLocalPackage(join(repositoryRoot, 'packages/runners/pytest'), cache),
  ])
  if (!includeOpenSpec) return { focused, markdown, inline, registry, go, pytest }
  const openspecPack = await runNpm(['pack', `@fission-ai/openspec@${OPEN_SPEC_VERSION}`, '--ignore-scripts', '--prefer-offline', '--pack-destination', cache], repositoryRoot, 120_000)
  if (openspecPack.code !== 0) throw new Error(`OpenSpec pack failed: ${openspecPack.stderr || openspecPack.stdout}`)
  const openspecName = openspecPack.stdout.trim().split(/\r?\n/u).at(-1)
  if (openspecName === undefined || openspecName === '') throw new Error('OpenSpec pack did not report a tarball')
  return { focused, markdown, inline, registry, go, pytest, openspec: join(cache, openspecName) }
}

async function installSkills(workspace: string, skills: readonly string[], openspecSkillsDir: string): Promise<void> {
  const destination = join(workspace, '.omp', 'skills')
  await mkdir(destination, { recursive: true })
  for (const skill of new Set(skills)) {
    const source = skill === 'focused-spec'
      ? join(workspace, 'node_modules', 'focused-spec', 'skills', 'focused-spec')
      : join(openspecSkillsDir, skill)
    await cp(source, join(destination, skill), { recursive: true })
  }
}

async function installCompetingSkills(workspace: string, source: string, selected: readonly string[]): Promise<NonNullable<EvalResult['skillInventory']>> {
  const paths = (await glob('*/SKILL.md', { cwd: source, nodir: true, follow: true })).sort()
  const destination = join(workspace, '.omp', 'skills')
  const names = new Set(selected)
  for (const path of paths) {
    const name = path.split('/')[0]!
    if (names.has(name)) continue // Candidate and selected host skills retain their independently installed bytes.
    const document = await readFile(join(source, path), 'utf8')
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(document)
    const metadata = frontmatter === null ? undefined : parse(frontmatter[1]!) as { name?: unknown; description?: unknown } | null
    if (metadata?.name !== name || typeof metadata.description !== 'string' || metadata.description.trim() === '') {
      throw new Error(`invalid competing skill metadata: ${path}`)
    }
    await cp(join(source, name), join(destination, name), { recursive: true })
    names.add(name)
  }
  if (names.size === new Set(selected).size) throw new Error('competing skills directory must contain at least one additional skill')
  return Promise.all([...names].sort().map(async name => {
    const directory = join(destination, name)
    const files: Record<string, string> = {}
    for (const path of (await glob('**/*', { cwd: directory, nodir: true, dot: true, follow: true })).sort()) {
      files[path] = createHash('sha256').update(await readFile(join(directory, path))).digest('hex')
    }
    return { name, files }
  }))
}

async function installPackages(workspace: string, includeOpenSpec: boolean, cache: string): Promise<void> {
  const packages = await packDependencies(includeOpenSpec, cache)
  const packagePath = join(workspace, 'package.json')
  const manifest = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown>
  manifest.devDependencies = {
    'focused-spec': `file:${packages.focused}`,
    '@focused-spec/format-markdown': `file:${packages.markdown}`,
    '@focused-spec/format-inline': `file:${packages.inline}`,
    '@focused-spec/format-registry': `file:${packages.registry}`,
    '@focused-spec/runner-go': `file:${packages.go}`,
    '@focused-spec/runner-pytest': `file:${packages.pytest}`,
    ...(includeOpenSpec ? { '@fission-ai/openspec': `file:${packages.openspec!}` } : {}),
  }
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`)
  const install = await runNpm(['install', '--ignore-scripts', '--prefer-offline'], workspace, 180_000)
  if (install.code !== 0) throw new Error(`fixture npm install failed: ${install.stderr || install.stdout}`)
}

async function prepareUpgrade(workspace: string, cache: string): Promise<{ baseline: UpgradeBaseline; close(): Promise<void> }> {
  const packages = await packDependencies(false, cache)
  const reference = join(cache, 'reference')
  await mkdir(reference)
  await writeFile(join(reference, 'package.json'), '{"private":true}')
  const archives = [packages.focused, packages.inline, packages.registry, packages.markdown, packages.go, packages.pytest]
  const candidate = await runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', reference, ...archives], repositoryRoot, 180_000)
  if (candidate.code !== 0) throw new Error(`candidate reference install failed: ${candidate.stderr || candidate.stdout}`)
  const legacy = await runNpm(['install', '--save-dev', '--ignore-scripts', '--no-audit', '--no-fund', `focused-spec@${LEGACY_VERSION}`, 'yaml@2.8.1'], workspace, 180_000)
  if (legacy.code !== 0) throw new Error(`legacy install failed: ${legacy.stderr || legacy.stdout}`)
  const cli = join(workspace, 'node_modules/focused-spec/dist/cli.js')
  for (const args of [['validate', '--strict', '--json'], ['run', '--json']]) {
    const result = await runProcess(process.execPath, [cli, ...args], { cwd: workspace, timeoutMs: 240_000 })
    if (result.code !== 0) throw new Error(`legacy baseline ${args[0]} failed: ${result.stderr || result.stdout}`)
    const payload = JSON.parse(result.stdout) as { scenarios: number | { status: string }[] }
    if (typeof payload.scenarios === 'number' ? payload.scenarios !== 3 : payload.scenarios.length !== 3 || payload.scenarios.some(item => item.status !== 'PASS')) {
      throw new Error(`legacy baseline lost expected occurrences: ${result.stdout}`)
    }
  }
  const candidateRoot = join(reference, 'node_modules/focused-spec')
  const baseline = await captureUpgradeBaseline(workspace, candidateRoot)
  const workspacePackages = [
    ['focused-spec', 'core', packages.focused],
    ['@focused-spec/format-markdown', 'formats/markdown', packages.markdown],
    ['@focused-spec/format-inline', 'formats/inline', packages.inline],
    ['@focused-spec/format-registry', 'formats/registry', packages.registry],
    ['@focused-spec/runner-go', 'runners/go', packages.go],
    ['@focused-spec/runner-pytest', 'runners/pytest', packages.pytest],
  ] as const
  const candidates = await Promise.all(workspacePackages.map(async ([name, directory, tarball]) => ({
    name,
    tarball,
    metadata: JSON.parse(await readFile(join(repositoryRoot, 'packages', directory, 'package.json'), 'utf8')) as Record<string, unknown>,
  })))
  await rm(reference, { recursive: true, force: true })
  const registry = await serveUpgradeCandidate(candidates)
  try { await writeFile(join(workspace, '.npmrc'), `registry=${registry.url}/\n`) }
  catch (error) { await registry.close(); throw error }
  return { baseline, close: registry.close }
}

export interface ProvisionedWorkspace {
  readonly path: string
  readonly upgrade?: UpgradeBaseline
  readonly integration?: IntegrationBaseline
  readonly skillInventory?: NonNullable<EvalResult['skillInventory']>
  finish(): Promise<void>
  cleanup(): Promise<void>
}

export async function provisionWorkspace(
  evalCase: EvalCase,
  openspecSkillsDir = process.env.OPEN_SPEC_SKILLS_DIR,
  competingSkillsDir = process.env.COMPETING_SKILLS_DIR,
): Promise<ProvisionedWorkspace> {
  if (evalCase.source === 'openspec' && (openspecSkillsDir === undefined || openspecSkillsDir.trim() === '')) {
    throw new Error('OpenSpec evals require --openspec-skills <path> or OPEN_SPEC_SKILLS_DIR')
  }
  if (evalCase.skillDiscovery === 'competing' && (competingSkillsDir === undefined || competingSkillsDir.trim() === '')) {
    throw new Error('blind activation eval requires --competing-skills <path> or COMPETING_SKILLS_DIR')
  }
  const directory = await mkdtemp(join(tmpdir(), `focused-spec-eval-${evalCase.id}-`))
  const workspace = join(directory, 'workspace')
  const cache = join(directory, 'packages')
  let upgrade: Awaited<ReturnType<typeof prepareUpgrade>> | undefined
  let integration: Awaited<ReturnType<typeof prepareIntegration>> | undefined
  const finish = async () => { await upgrade?.close(); upgrade = undefined; await integration?.close(); integration = undefined }
  const cleanup = async () => { await finish(); await rm(directory, { recursive: true, force: true }) }
  try {
    await mkdir(cache)
    await cp(join(evalRoot, 'fixtures', 'polyglot'), workspace, { recursive: true })
    if (evalCase.source === 'openspec') await cp(join(evalRoot, 'fixtures', 'openspec'), workspace, { recursive: true })
    if (evalCase.overlay !== undefined) await cp(join(evalRoot, evalCase.overlay), workspace, { recursive: true, force: true })
    const skills = evalCase.turns.flatMap(turn => [...turn.skills])
    if (evalCase.id === 'project-upgrade') upgrade = await prepareUpgrade(workspace, cache)
    else if (evalCase.integration !== undefined) integration = await prepareIntegration(workspace, cache, evalCase.integration, packLocalPackage)
    else await installPackages(workspace, evalCase.source === 'openspec', cache)
    await installSkills(workspace, skills, openspecSkillsDir ?? '')
    const skillInventory = evalCase.skillDiscovery === 'competing'
      ? await installCompetingSkills(workspace, competingSkillsDir!, skills) : undefined
    return { path: workspace, cleanup, finish, ...(skillInventory === undefined ? {} : { skillInventory }), ...(upgrade === undefined ? {} : { upgrade: upgrade.baseline }), ...(integration === undefined ? {} : { integration: integration.baseline }) }
  } catch (error) {
    await cleanup()
    throw error
  }
}

export async function readEvalPrompt(relativePath: string): Promise<string> {
  return readFile(join(evalRoot, relativePath), 'utf8')
}

export function evalRepositoryRoot(): string {
  return repositoryRoot
}
