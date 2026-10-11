import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EvalCase } from './types.ts'
import { runProcess } from './process.ts'
import { captureUpgradeBaseline, LEGACY_VERSION, serveUpgradeCandidate } from './upgrade.ts'
import type { UpgradeBaseline } from './upgrade.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const evalRoot = fileURLToPath(new URL('.', import.meta.url))
const OPEN_SPEC_VERSION = '1.6.0'

function runNpm(args: readonly string[], cwd: string, timeoutMs: number) {
  const npmExecPath = process.env.npm_execpath
  return npmExecPath === undefined
    ? runProcess(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, timeoutMs })
    : runProcess(process.execPath, [npmExecPath, ...args], { cwd, timeoutMs })
}

async function packDependencies(includeOpenSpec: boolean, cache: string): Promise<{ focused: string; openspec?: string }> {
  const focusedPack = await runNpm(['pack', '--ignore-scripts', '--pack-destination', cache], repositoryRoot, 120_000)
  if (focusedPack.code !== 0) throw new Error(`focused-spec pack failed: ${focusedPack.stderr || focusedPack.stdout}`)
  const focusedName = focusedPack.stdout.trim().split(/\r?\n/u).at(-1)
  if (focusedName === undefined || focusedName === '') throw new Error('focused-spec pack did not report a tarball')
  if (!includeOpenSpec) return { focused: join(cache, focusedName) }

  const openspecPack = await runNpm(['pack', `@fission-ai/openspec@${OPEN_SPEC_VERSION}`, '--ignore-scripts', '--prefer-offline', '--pack-destination', cache], repositoryRoot, 120_000)
  if (openspecPack.code !== 0) throw new Error(`OpenSpec pack failed: ${openspecPack.stderr || openspecPack.stdout}`)
  const openspecName = openspecPack.stdout.trim().split(/\r?\n/u).at(-1)
  if (openspecName === undefined || openspecName === '') throw new Error('OpenSpec pack did not report a tarball')
  return { focused: join(cache, focusedName), openspec: join(cache, openspecName) }
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

async function installPackages(workspace: string, includeOpenSpec: boolean, cache: string): Promise<void> {
  const packages = await packDependencies(includeOpenSpec, cache)
  const packagePath = join(workspace, 'package.json')
  const manifest = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown>
  manifest.devDependencies = {
    'focused-spec': `file:${packages.focused}`,
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
  const candidate = await runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', reference, packages.focused], repositoryRoot, 180_000)
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
  const metadata = JSON.parse(await readFile(join(candidateRoot, 'package.json'), 'utf8')) as Record<string, unknown>
  await rm(reference, { recursive: true, force: true })
  const registry = await serveUpgradeCandidate(packages.focused, metadata)
  try { await writeFile(join(workspace, '.npmrc'), `registry=${registry.url}/\n`) }
  catch (error) { await registry.close(); throw error }
  return { baseline, close: registry.close }
}

export interface ProvisionedWorkspace {
  readonly path: string
  readonly upgrade?: UpgradeBaseline
  finish(): Promise<void>
  cleanup(): Promise<void>
}

export async function provisionWorkspace(
  evalCase: EvalCase,
  openspecSkillsDir = process.env.OPEN_SPEC_SKILLS_DIR,
): Promise<ProvisionedWorkspace> {
  if (evalCase.source === 'openspec' && (openspecSkillsDir === undefined || openspecSkillsDir.trim() === '')) {
    throw new Error('OpenSpec evals require --openspec-skills <path> or OPEN_SPEC_SKILLS_DIR')
  }
  const directory = await mkdtemp(join(tmpdir(), `focused-spec-eval-${evalCase.id}-`))
  const workspace = join(directory, 'workspace')
  const cache = join(directory, 'packages')
  let upgrade: Awaited<ReturnType<typeof prepareUpgrade>> | undefined
  const finish = async () => { await upgrade?.close(); upgrade = undefined }
  const cleanup = async () => { await finish(); await rm(directory, { recursive: true, force: true }) }
  try {
    await mkdir(cache)
    await cp(join(evalRoot, 'fixtures', 'polyglot'), workspace, { recursive: true })
    if (evalCase.source === 'openspec') await cp(join(evalRoot, 'fixtures', 'openspec'), workspace, { recursive: true })
    if (evalCase.overlay !== undefined) await cp(join(evalRoot, evalCase.overlay), workspace, { recursive: true, force: true })
    const skills = evalCase.turns.flatMap(turn => [...turn.skills])
    if (evalCase.id === 'project-upgrade') upgrade = await prepareUpgrade(workspace, cache)
    else await installPackages(workspace, evalCase.source === 'openspec', cache)
    await installSkills(workspace, skills, openspecSkillsDir ?? '')
    return { path: workspace, cleanup, finish, ...(upgrade === undefined ? {} : { upgrade: upgrade.baseline }) }
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
