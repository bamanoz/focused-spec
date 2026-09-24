import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import fg from 'fast-glob'
import { parseFocusedSpecDocument } from '../src/parser.ts'
import type { EvalCase, EvalGate } from './types.ts'
import { runProcess } from './process.ts'

const PROTECTED_PATHS = [
  'auth/auth.go',
  'auth/auth_test.go',
  'app/auth.py',
  'tests/functional/test_auth.py',
]

function gate(name: string, passed: boolean, detail: string): EvalGate {
  return { name, passed, detail }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function snapshotProtectedFiles(workspace: string): Promise<ReadonlyMap<string, string>> {
  const snapshots = new Map<string, string>()
  for (const path of PROTECTED_PATHS) snapshots.set(path, await readFile(join(workspace, path), 'utf8'))
  for (const path of await fg(['node_modules/focused-spec/**/*', '.omp/skills/**/*'], { cwd: workspace, onlyFiles: true })) {
    snapshots.set(path, await readFile(join(workspace, path), 'utf8'))
  }
  return snapshots
}

export async function judgeProposalCheckpoint(workspace: string, evalCase: EvalCase): Promise<EvalGate[]> {
  if (evalCase.changeName === undefined) return [gate('proposal-checkpoint', false, 'case has no change name')]
  const root = join(workspace, 'openspec', 'changes', evalCase.changeName)
  const required = ['proposal.md', 'design.md', 'tasks.md', '.openspec.yaml']
  const missing = []
  for (const path of required) if (!await exists(join(root, path))) missing.push(path)
  const specs = await fg(['specs/**/spec.md'], { cwd: root, onlyFiles: true })
  const implementationPaths = [join(workspace, '.focused-spec/config.yaml'), join(workspace, '.focused-spec')]
  const implementationStarted = (await Promise.all(implementationPaths.map(exists))).some(Boolean)
  const specSources = await Promise.all(specs.map(path => readFile(join(root, path), 'utf8')))
  const plannedCount = specSources.flatMap(source => source.match(/`planned:[^`]+`/gu) ?? []).length
  const selectorsPresent = evalCase.expectedSelectorFragments.every(fragment => specSources.some(source => source.includes(fragment)))
  const evidenceContractValid = plannedCount === evalCase.expectedEvidenceCount || (plannedCount === 0 && selectorsPresent)
  return [
    gate('proposal-artifacts', missing.length === 0 && specs.length > 0, missing.length === 0 ? `${specs.length} delta specs created` : `missing ${missing.join(', ')}`),
    gate('planning-boundary', !implementationStarted, implementationStarted ? 'runner/config implementation started during proposal turn' : 'no implementation files created'),
    gate('planned-evidence', evidenceContractValid, plannedCount === 0 && selectorsPresent ? 'proposal carries resolvable selectors directly' : `found ${plannedCount} planned evidence rows`),
  ]
}

async function focusedCommand(workspace: string, args: readonly string[]) {
  return runProcess(process.execPath, [join(workspace, 'node_modules', 'focused-spec', 'dist', 'cli.js'), ...args], {
    cwd: workspace,
    timeoutMs: 240_000,
  })
}

async function openspecCommand(workspace: string, args: readonly string[]) {
  return runProcess(process.execPath, [join(workspace, 'node_modules', '@fission-ai', 'openspec', 'bin', 'openspec.js'), ...args], {
    cwd: workspace,
    timeoutMs: 120_000,
  })
}

async function scenarioGate(workspace: string, evalCase: EvalCase): Promise<EvalGate> {
  const paths = await fg(['**/*.md', '!node_modules/**', '!README.md', '!**/SKILL.md'], { cwd: workspace, onlyFiles: true })
  const matches = []
  for (const path of paths) {
    const document = parseFocusedSpecDocument(path, await readFile(join(workspace, path), 'utf8'))
    matches.push(...document.scenarios.filter(scenario => scenario.ids.includes(evalCase.expectedScenarioId)))
  }
  if (matches.length !== 1) return gate('scenario-contract', false, `expected one ${evalCase.expectedScenarioId} owner, found ${matches.length}`)
  const scenario = matches[0]
  const evidence = scenario?.evidence ?? []
  const distinctRunners = new Set(evidence.map(value => value.replace(/^planned:/u, '').split('::')[0]))
  const selectorsPresent = evalCase.expectedSelectorFragments.every(fragment => evidence.some(value => value.includes(fragment)))
  const passed = evidence.length === evalCase.expectedEvidenceCount
    && distinctRunners.size === evalCase.expectedEvidenceCount
    && selectorsPresent
    && evidence.every(value => !value.startsWith('planned:'))
  return gate('scenario-contract', passed, `${evidence.length} evidence rows across ${distinctRunners.size} runners: ${evidence.join(', ')}`)
}

export async function integrityGate(workspace: string, snapshots: ReadonlyMap<string, string>, transcripts: readonly string[]): Promise<EvalGate> {
  const changed: string[] = []
  for (const [path, source] of snapshots) {
    try {
      if (await readFile(join(workspace, path), 'utf8') !== source) changed.push(path)
    } catch {
      changed.push(path)
    }
  }
  const inspectedImplementation = transcripts.some(output => /node_modules[\\/]focused-spec[\\/]dist[\\/][^\s"'`]+\.m?js|src[\\/](?:runner-client|runner-host|planner|executor)\.ts/u.test(output))
  const inspectedPackageReferences = transcripts.some(output => /(?:node_modules[\\/]focused-spec|[\\/]focused-spec)[\\/](?:README\.md|docs[\\/]|examples[\\/])/u.test(output))
  const runnerSources = await fg(['.focused-spec/**/*.{ts,mts,js,mjs}'], { cwd: workspace, onlyFiles: true })
  const shellTrue = (await Promise.all(runnerSources.map(path => readFile(join(workspace, path), 'utf8')))).some(source => /shell\s*:\s*true/u.test(source))
  const passed = changed.length === 0 && !inspectedImplementation && !inspectedPackageReferences && !shellTrue
  const details = [
    changed.length === 0 ? 'protected files unchanged' : `changed protected files: ${changed.join(', ')}`,
    inspectedImplementation ? 'agent transcript shows focused-spec implementation inspection' : 'no focused-spec implementation inspection observed',
    inspectedPackageReferences ? 'agent transcript shows focused-spec README/docs/examples inspection' : 'no focused-spec README/docs/examples inspection observed',
    shellTrue ? 'runner uses shell:true' : 'no shell:true runner execution',
  ]
  return gate('integrity', passed, details.join('; '))
}

async function behaviorGate(workspace: string): Promise<EvalGate> {
  const go = await runProcess('go', ['test', './...'], { cwd: workspace, timeoutMs: 120_000 })
  const pytest = await runProcess('uv', ['run', '--with', 'pytest', 'python', '-m', 'pytest', '-q'], { cwd: workspace, timeoutMs: 180_000 })
  const passed = go.code === 0 && pytest.code === 0
  return gate('product-behavior', passed, `go=${String(go.code)} pytest=${String(pytest.code)}`)
}

export async function mutationGate(workspace: string, evalCase: EvalCase): Promise<EvalGate> {
  const goPath = join(workspace, 'auth', 'auth.go')
  const pythonPath = join(workspace, 'app', 'auth.py')
  const goSource = await readFile(goPath, 'utf8')
  const pythonSource = await readFile(pythonPath, 'utf8')
  const goMutated = goSource.replace('return credentialsValid && !blocked', 'return credentialsValid')
  const pythonMutated = pythonSource.replace('return credentials_valid and not blocked', 'return credentials_valid')
  if (goMutated === goSource || pythonMutated === pythonSource) return gate('mutation-sensitivity', false, 'fixture mutation target was not found')
  const args = ['run', ...(evalCase.changeName === undefined ? [] : ['--scope', evalCase.changeName])]
  try {
    await writeFile(goPath, goMutated)
    const goResult = await focusedCommand(workspace, args)
    await writeFile(goPath, goSource)

    await writeFile(pythonPath, pythonMutated)
    const pythonResult = await focusedCommand(workspace, args)
    const passed = goResult.code !== 0 && pythonResult.code !== 0
    return gate(
      'mutation-sensitivity',
      passed,
      passed
        ? 'focused evidence independently rejected Go and Python regressions'
        : `mutation results: go=${String(goResult.code)} python=${String(pythonResult.code)}`,
    )
  } finally {
    await writeFile(goPath, goSource)
    await writeFile(pythonPath, pythonSource)
  }
}

export async function judgeCompletedWorkspace(
  workspace: string,
  evalCase: EvalCase,
  snapshots: ReadonlyMap<string, string>,
  transcripts: readonly string[],
): Promise<EvalGate[]> {
  const gates: EvalGate[] = []
  const strictArgs = ['validate', '--strict', ...(evalCase.changeName === undefined ? [] : ['--scope', evalCase.changeName])]
  const strict = await focusedCommand(workspace, strictArgs)
  gates.push(gate('focused-validation', strict.code === 0, strict.code === 0 ? strict.stdout.trim() : (strict.stderr || strict.stdout).trim()))

  const runArgs = ['run', ...(evalCase.changeName === undefined ? [] : ['--scope', evalCase.changeName])]
  const run = await focusedCommand(workspace, runArgs)
  gates.push(gate('focused-execution', run.code === 0, run.code === 0 ? run.stdout.trim() : (run.stderr || run.stdout).trim()))

  if (evalCase.changeName !== undefined) {
    const openSpec = await openspecCommand(workspace, ['validate', evalCase.changeName, '--strict', '--no-interactive'])
    gates.push(gate('openspec-validation', openSpec.code === 0, openSpec.code === 0 ? openSpec.stdout.trim() : (openSpec.stderr || openSpec.stdout).trim()))
    const tasks = await readFile(join(workspace, 'openspec', 'changes', evalCase.changeName, 'tasks.md'), 'utf8').catch(() => '')
    const incomplete = tasks.match(/^- \[ \]/gmu)?.length ?? 0
    gates.push(gate('openspec-tasks', incomplete === 0, `${incomplete} incomplete tasks`))
  }

  gates.push(await scenarioGate(workspace, evalCase))
  gates.push(await behaviorGate(workspace))
  gates.push(await integrityGate(workspace, snapshots, transcripts))
  if (strict.code === 0 && run.code === 0) gates.push(await mutationGate(workspace, evalCase))
  else gates.push(gate('mutation-sensitivity', false, 'baseline focused validation or execution failed'))
  return gates
}
