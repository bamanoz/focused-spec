import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EvalCase } from './types.ts'
import { runProcess } from './process.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const evalRoot = fileURLToPath(new URL('.', import.meta.url))
const OPEN_SPEC_VERSION = '1.6.0'

function runNpm(args: readonly string[], cwd: string, timeoutMs: number) {
  const npmExecPath = process.env.npm_execpath
  return npmExecPath === undefined
    ? runProcess(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, timeoutMs })
    : runProcess(process.execPath, [npmExecPath, ...args], { cwd, timeoutMs })
}

async function newestTarball(prefix: string): Promise<string | undefined> {
  const directory = join(repositoryRoot, '.eval-cache')
  let entries: string[]
  try {
    entries = await readdir(directory)
  } catch {
    return undefined
  }
  return entries.filter(entry => entry.startsWith(prefix) && entry.endsWith('.tgz')).sort().at(-1)
}

async function packDependencies(includeOpenSpec: boolean): Promise<{ focused: string; openspec?: string }> {
  const cache = join(repositoryRoot, '.eval-cache')
  await mkdir(cache, { recursive: true })
  const previousFocused = await newestTarball('focused-spec-')
  if (previousFocused !== undefined) await rm(join(cache, previousFocused), { force: true })
  const focusedPack = await runNpm(['pack', '--pack-destination', cache], repositoryRoot, 120_000)
  if (focusedPack.code !== 0) throw new Error(`focused-spec pack failed: ${focusedPack.stderr || focusedPack.stdout}`)
  const focusedName = focusedPack.stdout.trim().split(/\r?\n/u).at(-1)
  if (focusedName === undefined || focusedName === '') throw new Error('focused-spec pack did not report a tarball')
  if (!includeOpenSpec) return { focused: join(cache, focusedName) }

  let openspecName = await newestTarball('fission-ai-openspec-')
  if (openspecName === undefined) {
    const openspecPack = await runNpm(['pack', `@fission-ai/openspec@${OPEN_SPEC_VERSION}`, '--pack-destination', cache], repositoryRoot, 120_000)
    if (openspecPack.code !== 0) throw new Error(`OpenSpec pack failed: ${openspecPack.stderr || openspecPack.stdout}`)
    openspecName = openspecPack.stdout.trim().split(/\r?\n/u).at(-1)
  }
  if (openspecName === undefined || openspecName === '') throw new Error('OpenSpec pack did not report a tarball')
  return { focused: join(cache, focusedName), openspec: join(cache, openspecName) }
}

async function installSkills(workspace: string, skills: readonly string[], openspecSkillsDir: string): Promise<void> {
  const destination = join(workspace, '.omp', 'skills')
  await mkdir(destination, { recursive: true })
  for (const skill of new Set(skills)) {
    const source = skill === 'focused-spec'
      ? join(repositoryRoot, 'skills', 'focused-spec')
      : join(openspecSkillsDir, skill)
    await cp(source, join(destination, skill), { recursive: true })
  }
}

async function installPackages(workspace: string, includeOpenSpec: boolean): Promise<void> {
  const packages = await packDependencies(includeOpenSpec)
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

export interface ProvisionedWorkspace {
  readonly path: string
  cleanup(): Promise<void>
}

export async function provisionWorkspace(
  evalCase: EvalCase,
  openspecSkillsDir = process.env.OPEN_SPEC_SKILLS_DIR,
): Promise<ProvisionedWorkspace> {
  if (evalCase.source === 'openspec' && (openspecSkillsDir === undefined || openspecSkillsDir.trim() === '')) {
    throw new Error('OpenSpec evals require --openspec-skills <path> or OPEN_SPEC_SKILLS_DIR')
  }
  const workspace = await mkdtemp(join(tmpdir(), `focused-spec-eval-${evalCase.id}-`))
  await cp(join(evalRoot, 'fixtures', 'polyglot'), workspace, { recursive: true })
  if (evalCase.source === 'openspec') await cp(join(evalRoot, 'fixtures', 'openspec'), workspace, { recursive: true })
  if (evalCase.overlay !== undefined) await cp(join(evalRoot, evalCase.overlay), workspace, { recursive: true, force: true })
  const skills = evalCase.turns.flatMap(turn => [...turn.skills])
  await installSkills(workspace, skills, openspecSkillsDir ?? '')
  await installPackages(workspace, evalCase.source === 'openspec')
  return { path: workspace, cleanup: async () => rm(workspace, { recursive: true, force: true }) }
}

export async function readEvalPrompt(relativePath: string): Promise<string> {
  return readFile(join(evalRoot, relativePath), 'utf8')
}

export function evalRepositoryRoot(): string {
  return repositoryRoot
}
