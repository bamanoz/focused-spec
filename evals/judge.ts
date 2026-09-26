import { access, readFile, rename, writeFile } from 'node:fs/promises'
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
  for (const path of await fg('openspec/changes/archive/2026-09-26-reject-blocked-accounts/**/*', { cwd: workspace, onlyFiles: true, dot: true })) {
    snapshots.set(path, await readFile(join(workspace, path), 'utf8'))
  }
  for (const path of await fg(['node_modules/focused-spec/**/*', '.omp/skills/**/*'], { cwd: workspace, onlyFiles: true })) {
    snapshots.set(path, await readFile(join(workspace, path), 'utf8'))
  }
  return snapshots
}

function expectedSelectorsPresent(evidence: readonly string[], evalCase: EvalCase): boolean {
  const alternatives = evalCase.expectedSelectorAlternatives
  return evalCase.expectedSelectorFragments.every(fragment => evidence.some(reference => reference.includes(fragment)))
    && (alternatives === undefined
      || (evidence.length > 0 && evidence.every(reference => alternatives.some(suffix => reference.endsWith(suffix)))))
}

function expectedEvidenceCountValid(count: number, evalCase: EvalCase): boolean {
  return count >= evalCase.expectedEvidenceCount && count <= (evalCase.maximumEvidenceCount ?? evalCase.expectedEvidenceCount)
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
  const references = specSources.flatMap(source => [...source.matchAll(/^- \*\*EVIDENCE\*\*: `([^`]+)`/gmu)].map(match => match[1] ?? ''))
  const plannedCount = references.filter(reference => reference.startsWith('planned:')).length
  const selectorsPresent = expectedSelectorsPresent(references, evalCase)
  const evidenceContractValid = (expectedEvidenceCountValid(plannedCount, evalCase) || (plannedCount === 0 && expectedEvidenceCountValid(references.length, evalCase))) && selectorsPresent
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
    if (evalCase.id === 'openspec-brownfield' && path !== 'openspec/specs/account-authentication/spec.md') continue
    const document = parseFocusedSpecDocument(path, await readFile(join(workspace, path), 'utf8'), evalCase.changeName ?? 'current')
    matches.push(...document.scenarios.filter(scenario => scenario.ids.includes(evalCase.expectedScenarioId)))
  }
  if (matches.length !== 1) return gate('scenario-contract', false, `expected one ${evalCase.expectedScenarioId} owner, found ${matches.length}`)
  const scenario = matches[0]
  const evidence = scenario?.evidence ?? []
  const distinctRunners = new Set(evidence.map(value => value.replace(/^planned:/u, '').split('::')[0]))
  const selectorsPresent = expectedSelectorsPresent(evidence, evalCase)
  const passed = expectedEvidenceCountValid(evidence.length, evalCase)
    && distinctRunners.size === evidence.length
    && selectorsPresent
    && evidence.every(value => !value.startsWith('planned:'))
  return gate('scenario-contract', passed, `${evidence.length} evidence rows across ${distinctRunners.size} runners: ${evidence.join(', ')}`)
}

function inspectionTargets(transcripts: readonly string[]): string[] {
  const targets: string[] = []
  for (const transcript of transcripts) {
    for (const line of transcript.split('\n')) {
      let event: { type?: string; toolName?: string; args?: { path?: string; command?: string } }
      try {
        event = JSON.parse(line) as typeof event
      } catch {
        continue
      }
      if (event.type !== 'tool_execution_start') continue
      if (event.toolName === 'read' && event.args?.path !== undefined) targets.push(event.args.path)
      if (event.toolName === 'bash' && event.args?.command !== undefined && !event.args.command.includes('require.resolve(')) {
        targets.push(event.args.command)
      }
    }
  }
  return targets
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
  const targets = inspectionTargets(transcripts)
  const inspectedImplementation = targets.some(target => /node_modules[\\/]focused-spec[\\/]dist[\\/][^\s"'`]+\.m?js|src[\\/](?:runner-client|runner-host|planner|executor)\.ts/u.test(target))
  const inspectedPackageReferences = targets.some(target => /(?:node_modules[\\/]focused-spec|[\\/]focused-spec)[\\/](?:README\.md|docs[\\/]|examples[\\/])/u.test(target))
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
  const goMutated = evalCase.id === 'openspec-brownfield'
    ? goSource.replace('return !blocked && credentialsValid', 'return credentialsValid')
    : goSource.replace('return credentialsValid && !blocked', 'return credentialsValid')
  const pythonMutated = evalCase.id === 'openspec-brownfield'
    ? pythonSource.replace('return not blocked and credentials_valid', 'return credentials_valid')
    : pythonSource.replace('return credentials_valid and not blocked', 'return credentials_valid')
  let checkGo = true
  let checkPython = true
  if (evalCase.id === 'full-skill-routing') {
    const specPaths = await fg(`openspec/changes/${evalCase.changeName}/specs/**/spec.md`, { cwd: workspace, onlyFiles: true })
    const matches = (await Promise.all(specPaths.map(async path => parseFocusedSpecDocument(
      path, await readFile(join(workspace, path), 'utf8'), evalCase.changeName ?? 'current',
    ).scenarios))).flat().filter(scenario => scenario.ids.includes(evalCase.expectedScenarioId))
    const evidence = matches.length === 1 ? matches[0]?.evidence ?? [] : []
    checkGo = evidence.some(reference => reference.endsWith('::./auth::TestBlockedAccount'))
    checkPython = evidence.some(reference => reference.endsWith('::tests/functional/test_auth.py::test_blocked_account'))
    if (!expectedEvidenceCountValid(evidence.length, evalCase) || evidence.length !== Number(checkGo) + Number(checkPython)) {
      return gate('mutation-sensitivity', false, 'selected evidence is not supported independent product tests')
    }
  }
  if ((checkGo && goMutated === goSource) || (checkPython && pythonMutated === pythonSource)) {
    return gate('mutation-sensitivity', false, 'fixture mutation target was not found')
  }
  const args = ['run', ...(evalCase.changeName === undefined ? [] : ['--scope', evalCase.changeName])]
  try {
    let goCode: number | null | undefined
    if (checkGo) {
      await writeFile(goPath, goMutated)
      goCode = (await focusedCommand(workspace, args)).code
      await writeFile(goPath, goSource)
    }
    let pythonCode: number | null | undefined
    if (checkPython) {
      await writeFile(pythonPath, pythonMutated)
      pythonCode = (await focusedCommand(workspace, args)).code
    }
    const passed = (!checkGo || goCode !== 0) && (!checkPython || pythonCode !== 0)
    const selected = [checkGo ? 'Go' : '', checkPython ? 'Python' : ''].filter(Boolean).join(' and ')
    return gate('mutation-sensitivity', passed, passed
      ? `focused evidence rejected ${selected} regression${checkGo && checkPython ? 's' : ''}`
      : `mutation results: go=${String(goCode ?? 'not selected')} python=${String(pythonCode ?? 'not selected')}`)
  } finally {
    await writeFile(goPath, goSource)
    await writeFile(pythonPath, pythonSource)
  }
}
interface PassedScenario {
  readonly scope: string
  readonly id: string
  readonly evidence: readonly string[]
}

function passedScenarios(output: string): PassedScenario[] {
  let payload: unknown
  try {
    payload = JSON.parse(output)
  } catch {
    return []
  }
  if (payload === null || typeof payload !== 'object' || !('scenarios' in payload) || !Array.isArray(payload.scenarios)) return []
  return payload.scenarios.flatMap((value: unknown) => {
    if (value === null || typeof value !== 'object' || !('scope' in value) || !('id' in value) || !('status' in value) || !('evidence' in value)) return []
    if (typeof value.scope !== 'string' || typeof value.id !== 'string' || value.status !== 'PASS' || !Array.isArray(value.evidence)) return []
    const evidence = value.evidence.flatMap((item: unknown) => {
      if (item === null || typeof item !== 'object' || !('reference' in item) || !('status' in item)) return []
      return typeof item.reference === 'string' && item.status === 'PASS' ? [item.reference] : []
    })
    if (evidence.length !== value.evidence.length) return []
    return [{ scope: value.scope, id: value.id, evidence }]
  })
}

function matchingPassedScenario(
  results: readonly PassedScenario[],
  scope: string,
  id: string,
  expectedEvidence: readonly string[],
): PassedScenario | undefined {
  return results.find(result => result.scope === scope
    && result.id === id
    && result.evidence.length === expectedEvidence.length
    && expectedEvidence.every(reference => result.evidence.includes(reference)))
}

export async function brownfieldGate(workspace: string, evalCase: EvalCase): Promise<EvalGate[]> {
  const changeName = evalCase.changeName
  if (changeName === undefined) return [gate('brownfield-contract', false, 'case has no working scope')]
  const mainPath = 'openspec/specs/account-authentication/spec.md'
  const workingPath = `openspec/changes/${changeName}/specs/account-authentication/spec.md`
  const archivePath = 'openspec/changes/archive/2026-09-26-reject-blocked-accounts/specs/account-authentication/spec.md'
  const [mainSource, workingSource, archiveSource] = await Promise.all([
    readFile(join(workspace, mainPath), 'utf8'),
    readFile(join(workspace, workingPath), 'utf8'),
    readFile(join(workspace, archivePath), 'utf8'),
  ])
  const main = parseFocusedSpecDocument(mainPath, mainSource, 'current')
  const working = parseFocusedSpecDocument(workingPath, workingSource, changeName)
  const originalScenarios = [...archiveSource.matchAll(/^#### Scenario: (.+)\n(- \*\*WHEN\*\* [^\n]+\n- \*\*THEN\*\* [^\n]+)/gmu)]
  const originalOutcome = originalScenarios.find(match => match[1] === 'Blocked account with valid credentials')?.[2]
  const legacy = originalScenarios.filter(match => match[1] !== 'Blocked account with valid credentials')
    .map(match => match[0])
  const preservedLegacy = legacy.filter(scenario => mainSource.includes(scenario)).length
  const legacyPreserved = legacy.length === 3 && preservedLegacy === legacy.length && main.unenrolledScenarios === legacy.length
  const expectedId = evalCase.expectedScenarioId
  const mainOccurrences = main.scenarios.filter(scenario => scenario.ids.includes(expectedId))
  const workingOccurrences = working.scenarios.filter(scenario => scenario.ids.includes(expectedId))
  const mainOwner = mainOccurrences.length === 1 ? mainOccurrences[0] : undefined
  const workingRevision = workingOccurrences.length === 1 ? workingOccurrences[0] : undefined
  const expectedEvidence = mainOwner?.evidence ?? []
  const mainContractValid = originalOutcome !== undefined
    && mainSource.includes(originalOutcome)
    && workingSource.includes(originalOutcome)
    && mainOwner !== undefined
    && mainOwner.name === 'Blocked account with valid credentials'
    && mainOwner.whenCount === 1
    && mainOwner.thenCount === 1
    && mainOwner.ids.length === 1
    && mainOwner.revisions.length === 0
    && mainOwner.malformedIdLines.length === 0
    && mainOwner.malformedEvidenceLines.length === 0
    && expectedEvidence.length === evalCase.expectedEvidenceCount
    && evalCase.expectedSelectorFragments.every(fragment => expectedEvidence.some(reference => reference.includes(fragment)))
  const all = await focusedCommand(workspace, ['run', '--json'])
  const results = all.code === 0 ? passedScenarios(all.stdout) : []
  const mainPasses = mainContractValid
    ? results.filter(result => result.scope !== changeName
      && result.id === expectedId
      && result.evidence.length === expectedEvidence.length
      && expectedEvidence.every(reference => result.evidence.includes(reference)))
    : []
  const mainPass = mainPasses.length === 1 ? mainPasses[0] : undefined
  const transitionContractValid = mainPass !== undefined
    && workingRevision !== undefined
    && workingRevision.ids.length === 1
    && workingRevision.revisions.length === 1
    && workingRevision.revisions[0] === mainPass.scope
    && workingRevision.evidence.length === expectedEvidence.length
    && expectedEvidence.every(reference => workingRevision.evidence.includes(reference))

  const source = join(workspace, 'openspec', 'changes', changeName)
  const hidden = join(workspace, 'openspec', '.focused-spec-eval-hidden')
  await rename(source, hidden)
  let afterTransition
  try {
    afterTransition = await focusedCommand(workspace, ['run', '--json'])
  } finally {
    await rename(hidden, source)
  }
  const transitionedResults = afterTransition.code === 0 ? passedScenarios(afterTransition.stdout) : []
  const transitionedPass = mainPass === undefined
    ? undefined
    : matchingPassedScenario(transitionedResults, mainPass.scope, expectedId, expectedEvidence)
  const evidenceStable = transitionContractValid && mainPass !== undefined && transitionedPass !== undefined
  return [
    gate('legacy-preservation', legacyPreserved, `${preservedLegacy}/${legacy.length} native scenarios preserved and ${main.unenrolledScenarios} remain unenrolled`),
    gate('main-scope-evidence', mainContractValid && mainPass !== undefined, all.code === 0
      ? `main owner scope=${mainPass?.scope ?? 'missing'}; owner count=${mainOccurrences.length}; expected ${evalCase.expectedEvidenceCount} evidence; observed ${mainPass?.evidence.length ?? 0} passing evidence`
      : all.stdout.trim() || all.stderr.trim()),
    gate('transition-stable-evidence', evidenceStable, afterTransition.code === 0
      ? `working document absent; ownership ${transitionContractValid ? 'valid' : 'invalid'}; main owner ${transitionedPass === undefined ? 'missing or altered' : 'PASS with unchanged evidence'}`
      : afterTransition.stdout.trim() || afterTransition.stderr.trim()),
  ]
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
  else gates.push(gate('mutation-sensitivity', false, 'focused validation or execution failed'))
  if (evalCase.id === 'openspec-brownfield') {
    gates.push(...await brownfieldGate(workspace, evalCase))
  }
  return gates
}
