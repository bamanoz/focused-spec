import { access, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { glob } from 'glob'
import { discoverDocuments, loadConfig } from '../packages/core/dist/index.js'
import type { EvalCase, EvalGate } from './types.ts'
import { runProcess } from './process.ts'
import { judgeEvidenceRepair } from './evidence-repair.ts'
import { evalRepositoryRoot } from './provision.ts'
import { upgradeSensitivityGate } from './upgrade.ts'
import { parseTrustedNativeDocument } from './native-parse.ts'
import { specRevisionGate } from './spec-revision.ts'
import { loadConfiguredRegistries } from './evidence.ts'

const PROTECTED_PATHS = [
  'auth/auth.go',
  'auth/auth_test.go',
  'app/auth.py',
  'tests/functional/test_auth.py',
]

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

type ObjectValue = Record<string, unknown>

function object(value: unknown): value is ObjectValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function withoutRegistryFiles(config: unknown): unknown {
  if (!object(config)) return config
  const clone = structuredClone(config)
  if (!object(clone.specifications) || !object(clone.specifications.formats)) return clone
  for (const format of Object.values(clone.specifications.formats)) {
    if (!object(format) || format.package !== '@focused-spec/format-registry' || !object(format.options)) continue
    delete format.options.files
  }
  return clone
}

function hasExecutableInlineEvidence(source: string): boolean {
  let fenced = false
  for (const line of source.split(/\r?\n/u)) {
    if (/^\s*```/u.test(line)) { fenced = !fenced; continue }
    if (fenced || /^(?:\s{4,}|\s*>)/u.test(line)) continue
    if (/^\s*- \*\*EVIDENCE\*\*:\s*`[^`]+`\s*$/u.test(line)) return true
  }
  return false
}

function transcriptEvents(transcript: string): ObjectValue[] {
  const events: ObjectValue[] = []
  for (const line of transcript.split('\n')) {
    try {
      const value: unknown = JSON.parse(line)
      if (object(value)) events.push(value)
    } catch {
      // Only structured tool events establish activation.
    }
  }
  return events
}

function successfulToolCompletion(event: ObjectValue): boolean {
  if (event.isError === true || !object(event.result) || event.result.isError === true) return false
  const details = event.result.details
  return !object(details) || typeof details.exitCode !== 'number' || details.exitCode === 0
}

function isFocusedSkillPath(path: string): boolean {
  return path === 'skill://focused-spec'
    || /^skill:\/\/focused-spec:(?:raw|-?\d+(?:[-+]\d*)?(?:,\d+(?:[-+]\d*)?)*)$/u.test(path)
}

function gate(name: string, passed: boolean, detail: string): EvalGate {
  return { name, passed, detail }
}

export function skillActivationGate(transcript: string): EvalGate {
  const starts = new Set<string>()
  let loaded = false
  for (const event of transcriptEvents(transcript)) {
    if (event.type === 'tool_execution_start' && event.toolName === 'read' && typeof event.toolCallId === 'string'
      && object(event.args) && typeof event.args.path === 'string' && isFocusedSkillPath(event.args.path)) {
      starts.add(event.toolCallId)
      continue
    }
    if (event.type === 'tool_execution_end' && event.toolName === 'read' && typeof event.toolCallId === 'string'
      && starts.has(event.toolCallId) && successfulToolCompletion(event)) {
      loaded = true
      break
    }
  }
  return gate('focused-skill-loaded', loaded, loaded ? 'agent completed reading skill://focused-spec' : 'agent did not complete reading skill://focused-spec')
}

function shellTokens(command: string): string[] | undefined {
  const tokens: string[] = []
  let token = ''
  let quote: '"' | "'" | undefined
  let escaped = false
  const finish = () => {
    if (token !== '') tokens.push(token)
    token = ''
  }
  for (const character of command) {
    if (escaped) {
      token += character
      escaped = false
      continue
    }
    if (quote === '"' && character === '\\') {
      escaped = true
      continue
    }
    if (quote !== undefined) {
      if (character === quote) quote = undefined
      else token += character
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (/\s/u.test(character)) {
      finish()
      continue
    }
    if (';&|<>()\n'.includes(character)) return undefined
    if (character === '\\') {
      escaped = true
      continue
    }
    token += character
  }
  if (quote !== undefined || escaped) return undefined
  finish()
  return tokens
}

function isPath(path: string, expected: string, workspace: string): boolean {
  return !path.includes('\0') && resolve(workspace, path) === expected
}

export function localCommandArguments(command: string, workspace: string): string[] | undefined {
  const tokens = shellTokens(command)
  if (tokens === undefined) return undefined
  const localBin = join(workspace, 'node_modules', '.bin', 'focused-spec')
  const localDist = join(workspace, 'node_modules', 'focused-spec', 'dist', 'cli.js')
  let offset: number
  if (tokens[0] !== undefined && (isPath(tokens[0], localBin, workspace) || isPath(tokens[0], `${localBin}.cmd`, workspace))) {
    offset = 1
  } else if (tokens[0] !== undefined && tokens[1] !== undefined
    && /^(?:node|node\.exe)$/u.test(basename(tokens[0])) && isPath(tokens[1], localDist, workspace)) {
    offset = 2
  } else {
    return undefined
  }
  return tokens.slice(offset)
}

function isLocalGuideCommand(command: string, workspace: string, expectedTopic: string): boolean {
  const args = localCommandArguments(command, workspace)
  if (args === undefined) return false
  if (args[0] !== 'instructions') return false
  let protocol: string | undefined
  let topic: string | undefined
  let json = false
  for (let index = 1; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--protocol' && protocol === undefined && args[index + 1] !== undefined) protocol = args[++index]
    else if (argument === '--topic' && topic === undefined && args[index + 1] !== undefined) topic = args[++index]
    else if (argument === '--json' && !json) json = true
    else return false
  }
  return protocol === '1' && topic === expectedTopic && json
}

function toolText(event: ObjectValue): string | undefined {
  if (!object(event.result)) return undefined
  const content = event.result.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return undefined
  const parts: string[] = []
  for (const part of content) {
    if (!object(part) || part.type !== 'text' || typeof part.text !== 'string') return undefined
    parts.push(part.text)
  }
  return parts.join('\n')
}

interface PackageIdentity {
  readonly name: 'focused-spec'
  readonly version: string
  readonly workflow: string
}

async function installedPackageIdentity(workspace: string, topic: string): Promise<PackageIdentity | undefined> {
  try {
    const [metadata, workflow] = await Promise.all([
      readFile(join(workspace, 'node_modules', 'focused-spec', 'package.json'), 'utf8'),
      readFile(join(workspace, 'node_modules', 'focused-spec', 'guidance', `${topic}.md`), 'utf8'),
    ])
    const value: unknown = JSON.parse(metadata)
    if (!object(value) || value.name !== 'focused-spec' || typeof value.version !== 'string' || value.version.trim() === ''
      || workflow.trim() === '') return undefined
    return { name: 'focused-spec', version: value.version, workflow }
  } catch {
    return undefined
  }
}

function validGuideResponse(output: string, identity: PackageIdentity, topic: string): boolean {
  const text = output.trim().replace(/\n\nWall time: [^\n]+$/u, '').trim()
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return false
  }
  if (!object(value) || Object.keys(value).sort().join(',') !== 'content,package,protocolVersion,topic'
    || value.protocolVersion !== 1 || value.topic !== topic || value.content !== identity.workflow
    || !object(value.package) || Object.keys(value.package).sort().join(',') !== 'name,version') return false
  return value.package.name === identity.name && value.package.version === identity.version
}

function stepHasLocalGuidance(transcript: string, workspace: string, identity: PackageIdentity, topic: string): boolean {
  const commands = new Set<string>()
  const artifacts = new Set<string>()
  const reads = new Set<string>()
  for (const event of transcriptEvents(transcript)) {
    if (typeof event.toolCallId !== 'string') continue
    if (event.type === 'tool_execution_start' && object(event.args)) {
      if (event.toolName === 'bash' && typeof event.args.command === 'string'
        && isLocalGuideCommand(event.args.command, workspace, topic)) {
        commands.add(event.toolCallId)
      } else if (event.toolName === 'read' && typeof event.args.path === 'string') {
        const artifact = event.args.path.match(/^(artifact:\/\/[A-Za-z0-9_-]+)(?::|$)/u)?.[1]
        if (artifact !== undefined && artifacts.has(artifact)) reads.add(event.toolCallId)
      }
      continue
    }
    if (event.type !== 'tool_execution_end') continue
    if (event.toolName === 'bash' && commands.delete(event.toolCallId) && successfulToolCompletion(event)) {
      const output = toolText(event)
      if (output === undefined) continue
      if (validGuideResponse(output, identity, topic)) return true
      const artifact = output.match(/\n\[[^\n]*Read (artifact:\/\/[A-Za-z0-9_-]+) for full output\]$/u)?.[1]
      if (artifact !== undefined) artifacts.add(artifact)
    } else if (event.toolName === 'read' && reads.delete(event.toolCallId) && successfulToolCompletion(event)) {
      const output = toolText(event)
      if (output !== undefined && validGuideResponse(output, identity, topic)) return true
    }
  }
  return false
}

export async function guidanceActivationGate(workspace: string, workflowSteps: readonly string[], topic = 'workflow'): Promise<EvalGate> {
  const identity = await installedPackageIdentity(workspace, topic)
  if (identity === undefined) return gate(`focused-${topic}-acquired`, false, `project-local focused-spec package metadata or ${topic} guidance is missing or invalid`)
  const failedStep = workflowSteps.findIndex(transcript => !stepHasLocalGuidance(transcript, workspace, identity, topic))
  const passed = workflowSteps.length > 0 && failedStep === -1
  return gate(`focused-${topic}-acquired`, passed, passed
    ? `completed valid project-local ${topic} guidance for ${workflowSteps.length} workflow step${workflowSteps.length === 1 ? '' : 's'}`
    : `workflow step ${failedStep === -1 ? 1 : failedStep + 1} did not complete valid project-local ${topic} guidance`)
}

export async function snapshotProtectedFiles(workspace: string, editablePaths: readonly string[] = []): Promise<ReadonlyMap<string, string>> {
  const snapshots = new Map<string, string>()
  const paths = new Set([...PROTECTED_PATHS, ...await glob(['app/**/*', 'auth/**/*', 'tests/**/*', 'specs/**/*', '.focused-spec/**/*'], { cwd: workspace, nodir: true, dot: true, follow: true, nocase: false })])
  for (const path of paths) {
    if (!editablePaths.includes(path)) snapshots.set(path, await readFile(join(workspace, path), 'utf8'))
  }
  for (const path of await glob('openspec/changes/archive/2026-09-26-reject-blocked-accounts/**/*', { cwd: workspace, nodir: true, dot: true, follow: true, nocase: false })) {
    snapshots.set(path, await readFile(join(workspace, path), 'utf8'))
  }
  for (const path of await glob(['node_modules/focused-spec/**/*', 'node_modules/@focused-spec/**/*', '.omp/skills/**/*'], { cwd: workspace, nodir: true, follow: true, nocase: false })) {
    snapshots.set(path, await readFile(join(workspace, path), 'utf8'))
  }
  return snapshots
}

export async function snapshotProposalFiles(workspace: string): Promise<ReadonlyMap<string, string>> {
  const snapshots = new Map<string, string>()
  const paths = await glob('**/*', {
    cwd: workspace, nodir: true, dot: true, follow: false,
    ignore: ['**/node_modules/**', '.git/**', '.omp-eval-sessions/**', '.omp-regeneration-sessions/**', '.pytest_cache/**', '**/__pycache__/**', '.home/**', '.omp/**']
  })
  for (const path of paths) {
    if (path.startsWith('openspec/') && /\.(?:md|ya?ml|feature)$/u.test(path)) continue
    snapshots.set(path, (await readFile(join(workspace, path))).toString('base64'))
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
function configuredMainScope(config: { readonly specifications: { readonly documents: readonly { readonly match: string; readonly scope?: string }[] } }): string | undefined {
  return config.specifications.documents.find(layout => layout.scope !== undefined && layout.match.startsWith('openspec/specs/'))?.scope
}

async function configuredWorkingScope(workspace: string, evalCase: EvalCase): Promise<string | undefined> {
  if (evalCase.changeName === undefined) return 'current'
  const loaded = await loadConfig(workspace)
  if (loaded.config === undefined) return undefined
  const discovery = await discoverDocuments(workspace, loaded.config)
  const prefix = `openspec/changes/${evalCase.changeName}/specs/`
  const scopes = [...discovery.scopes].filter(([, documents]) => documents.some(document => document.path.startsWith(prefix)))
  return scopes.length === 1 ? scopes[0]?.[0] : undefined
}

export interface IdentityCheckpoint {
  readonly gates: readonly EvalGate[]
  readonly selectedScenarioId?: string
}

export async function judgeProposalCheckpoint(workspace: string, evalCase: EvalCase, proposalBefore?: ReadonlyMap<string, string>): Promise<IdentityCheckpoint> {
  if (evalCase.changeName === undefined) return { gates: [gate('proposal-checkpoint', false, 'case has no change name')] }
  const root = join(workspace, 'openspec', 'changes', evalCase.changeName)
  const required = ['proposal.md', 'design.md', 'tasks.md', '.openspec.yaml']
  const missing = []
  for (const path of required) if (!await exists(join(root, path))) missing.push(path)
  const specs = await glob(['specs/**/spec.md'], { cwd: root, nodir: true, follow: true, nocase: false })
  const implementationPaths = [join(workspace, '.focused-spec')]
  const proposalAfter = proposalBefore === undefined ? undefined : await snapshotProposalFiles(workspace)
  const productChanges = proposalBefore === undefined || proposalAfter === undefined ? []
    : [...new Set([...proposalBefore.keys(), ...proposalAfter.keys()])].filter(path => proposalBefore.get(path) !== proposalAfter.get(path))
  const specSources = await Promise.all(specs.map(path => readFile(join(root, path), 'utf8')))
  const executableInline = specSources.some(hasExecutableInlineEvidence)
  const implementationStarted = (proposalBefore === undefined && (await Promise.all(implementationPaths.map(exists))).some(Boolean))
    || productChanges.length > 0 || executableInline
  const nativeDocuments = await Promise.all(specs.map(async relativePath => {
    const path = `openspec/changes/${evalCase.changeName}/${relativePath}`
    return parseTrustedNativeDocument('markdown', path, await readFile(join(root, relativePath), 'utf8'), evalCase.changeName!, workspace)
  }))
  const violations = nativeDocuments.flatMap(document => document.violations)
  const marked = nativeDocuments.flatMap(document => document.items.filter(item => item.markerId !== undefined))
  const unsupportedRows = specSources.some(source => /\*\*REVISES\*\*|planned:/u.test(source))
  const selectedScenarioId = marked.length === 1 ? marked[0]?.markerId : undefined
  const prescribedIdentityValid = evalCase.prescribedScenarioId === undefined
    || selectedScenarioId === evalCase.prescribedScenarioId
  const nativePlanValid = violations.length === 0 && selectedScenarioId !== undefined
    && prescribedIdentityValid && !unsupportedRows
  const expectedIdentity = evalCase.prescribedScenarioId === undefined
    ? 'one valid native marker'
    : `one valid native marker ${evalCase.prescribedScenarioId}`
  const gates = [
    gate('proposal-artifacts', missing.length === 0 && specs.length > 0, missing.length === 0 ? `${specs.length} delta specs created` : `missing ${missing.join(', ')}`),
    gate('planning-boundary', !implementationStarted, implementationStarted
      ? `configuration, executable registry/inline evidence, or product implementation started during proposal turn${productChanges.length === 0 ? '' : `: ${productChanges.join(', ')}`}`
      : 'no focused-spec executable integration or product implementation files created'),
    gate('planned-evidence', nativePlanValid, nativePlanValid
      ? `native item ${selectedScenarioId} marked; intended evidence integration correctly deferred to apply`
      : `expected ${expectedIdentity}; found ${marked.map(item => item.markerId).join(', ') || 'none'}${unsupportedRows ? '; unsupported REVISES or executable planned row found' : ''}`),
  ]
  return {
    gates,
    ...(gates.every(item => item.passed) && selectedScenarioId !== undefined ? { selectedScenarioId } : {}),
  }
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

interface ScenarioCheckpoint {
  readonly gate: EvalGate
  readonly selectedScenarioId?: string
}

async function judgeScenarioCheckpoint(
  workspace: string,
  evalCase: EvalCase,
  scopeOverride?: string,
  selectedScenarioId?: string,
): Promise<ScenarioCheckpoint> {
  const publicationLifecycle = evalCase.id === 'openspec-brownfield' || evalCase.lifecycle === 'inline-publication'
  const requestedScope = scopeOverride ?? (publicationLifecycle ? undefined : await configuredWorkingScope(workspace, evalCase))
  const loaded = await loadConfig(workspace)
  if (loaded.config === undefined) {
    return { gate: gate('scenario-contract', false, loaded.violations.map(violation => `${violation.path}: ${violation.message}`).join('\n')) }
  }
  const selectedScope = requestedScope ?? (publicationLifecycle ? configuredMainScope(loaded.config) : undefined)
  if (selectedScope === undefined && !publicationLifecycle) {
    return { gate: gate('scenario-contract', false, 'named change has no unique configured working scope') }
  }
  const discovery = await discoverDocuments(workspace, loaded.config, selectedScope)
  if (discovery.violations.length > 0) {
    return { gate: gate('scenario-contract', false, discovery.violations.map(violation => `${violation.path}: ${violation.message}`).join('\n')) }
  }
  const scope = selectedScope ?? [...discovery.scopes].find(([, documents]) =>
    documents.some(document => document.path === 'openspec/specs/account-authentication/spec.md'))?.[0]
  if (scope === undefined) return { gate: gate('scenario-contract', false, 'expected configured main document openspec/specs/account-authentication/spec.md') }
  const documents = discovery.scopes.get(scope) ?? []
  const bindings = documents.flatMap(document => document.scenarios)
  const requiredScenarioId = selectedScenarioId ?? evalCase.prescribedScenarioId
  const scenario = bindings.length === 1 ? bindings[0] : undefined
  if (scenario === undefined || (requiredScenarioId !== undefined && scenario.id !== requiredScenarioId)) {
    const expected = requiredScenarioId === undefined ? 'one valid native binding' : `one valid native binding ${requiredScenarioId}`
    return { gate: gate('scenario-contract', false,
      `expected ${expected} in scope ${scope}; found ${bindings.map(binding => binding.id).join(', ') || 'none'}`) }
  }
  const publishedSelection = publicationLifecycle
    && (scopeOverride === undefined || scopeOverride === configuredMainScope(loaded.config))
  if (publishedSelection && scenario.path !== 'openspec/specs/account-authentication/spec.md') {
    return { gate: gate('scenario-contract', false, `expected ${scenario.id} in openspec/specs/account-authentication/spec.md, found ${scenario.path}`) }
  }
  if (evalCase.changeName !== undefined && !publishedSelection
    && !scenario.path.startsWith(`openspec/changes/${evalCase.changeName}/specs/`)) {
    return { gate: gate('scenario-contract', false, `selected item is outside the named change: ${scenario.path}`) }
  }
  const evidence = scenario.evidence
  const distinctRunners = new Set(evidence.map(value => value.replace(/^planned:/u, '').split('::')[0]))
  const selectorsPresent = expectedSelectorsPresent(evidence, evalCase)
  const passed = expectedEvidenceCountValid(evidence.length, evalCase)
    && distinctRunners.size === evidence.length
    && selectorsPresent
    && evidence.every(value => !value.startsWith('planned:'))
  return {
    gate: gate('scenario-contract', passed, `${evidence.length} normalized evidence references across ${distinctRunners.size} runners: ${evidence.join(', ')}`),
    ...(passed ? { selectedScenarioId: scenario.id } : {}),
  }
}

export async function scenarioGate(
  workspace: string,
  evalCase: EvalCase,
  scopeOverride?: string,
  selectedScenarioId?: string,
): Promise<EvalGate> {
  return (await judgeScenarioCheckpoint(workspace, evalCase, scopeOverride, selectedScenarioId)).gate
}

function inspectionCommands(command: string, workspace: string): string[] {
  const commands: string[] = []
  let start = 0
  let quote: '"' | "'" | undefined
  for (let index = 0; index < command.length; index++) {
    const character = command[index]
    if (character === '\\' && quote !== "'") {
      index++
    } else if (quote !== undefined) {
      if (character === quote) quote = undefined
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character !== undefined && ';&|\n'.includes(character)) {
      commands.push(command.slice(start, index))
      start = index + 1
    }
  }
  commands.push(command.slice(start))
  const cli = join(workspace, 'node_modules', 'focused-spec', 'dist', 'cli.js')
  return commands.map(part => {
    const tokens = shellTokens(part)
    return tokens !== undefined && tokens[0] !== undefined && tokens[1] !== undefined
      && /^(?:node|node\.exe)$/u.test(basename(tokens[0])) && isPath(tokens[1], cli, workspace)
      ? tokens.slice(2).join(' ') : part
  })
}

function inspectionTargets(workspace: string, transcripts: readonly string[]): string[] {
  const targets: string[] = []
  for (const transcript of transcripts) {
    for (const event of transcriptEvents(transcript)) {
      if (event.type !== 'tool_execution_start' || !object(event.args)) continue
      if ((event.toolName === 'read' || event.toolName === 'grep') && typeof event.args.path === 'string') targets.push(event.args.path)
      if (event.toolName === 'bash' && typeof event.args.command === 'string') {
        targets.push(...inspectionCommands(event.args.command, workspace))
      }
    }
  }
  return targets
}

export function inspectsImplementation(workspace: string, transcripts: readonly string[]): boolean {
  return inspectionTargets(workspace, transcripts).some(target => {
    if (/src[\\/](?:runner-client|runner-host|planner|executor)\.ts/u.test(target)) return true
    for (const match of target.matchAll(/node_modules[\\/](?:focused-spec|@focused-spec[\\/][^\\/\s"'`]+)[\\/](?:dist|src|examples)(?=$|[\\/:\s"'`])(?:[\\/]([^\s"'`:]*))?/gu)) {
      const path = match[1] ?? ''
      if (/\.d\.[cm]?ts$/u.test(path)) continue
      if (path === '' || path.endsWith('/') || !/\.[^./\\]+$/u.test(path)
        || /\.(?:[cm]?js|[cm]?ts|tsx|jsx|py|go)$/u.test(path)) return true
    }
    return false
  })
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
  const targets = inspectionTargets(workspace, transcripts)
  const inspectedImplementation = inspectsImplementation(workspace, transcripts)
  const inspectedPackageReferences = targets.some(target => /(?:node_modules[\\/]focused-spec|[\\/]focused-spec)[\\/](?:README\.md|docs[\\/])/u.test(target))
  const runnerSources = await glob(['.focused-spec/**/*.{ts,mts,js,mjs}'], { cwd: workspace, nodir: true, follow: true, nocase: false })
  const shellTrue = (await Promise.all(runnerSources.map(path => readFile(join(workspace, path), 'utf8')))).some(source => /shell\s*:\s*true/u.test(source))
  const passed = changed.length === 0 && !inspectedImplementation && !shellTrue
  const details = [
    changed.length === 0 ? 'protected files unchanged' : `changed protected files: ${changed.join(', ')}`,
    inspectedImplementation ? 'agent transcript shows focused-spec implementation inspection' : 'no focused-spec implementation inspection observed',
    inspectedPackageReferences ? 'agent transcript shows public focused-spec README/docs inspection (permitted)' : 'no public focused-spec README/docs inspection observed',
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

export async function mutationGate(
  workspace: string,
  evalCase: EvalCase,
  scope?: string,
  selectedScenarioId = evalCase.prescribedScenarioId,
): Promise<EvalGate> {
  const goPath = join(workspace, 'auth', 'auth.go')
  const pythonPath = join(workspace, 'app', 'auth.py')
  const goSource = await readFile(goPath, 'utf8')
  const pythonSource = await readFile(pythonPath, 'utf8')
  const brownfieldProduct = evalCase.id === 'openspec-brownfield' || evalCase.lifecycle === 'inline-publication'
  const goMutated = brownfieldProduct
    ? goSource.replace('return !blocked && credentialsValid', 'return credentialsValid')
    : goSource.replace('return credentialsValid && !blocked', 'return credentialsValid')
  const pythonMutated = brownfieldProduct
    ? pythonSource.replace('return not blocked and credentials_valid', 'return credentials_valid')
    : pythonSource.replace('return credentials_valid and not blocked', 'return credentials_valid')
  const loaded = await loadConfig(workspace)
  if (loaded.config === undefined) return gate('mutation-sensitivity', false, loaded.violations.map(item => item.message).join('; '))
  const selectedScope = scope ?? await configuredWorkingScope(workspace, evalCase)
  if (selectedScope === undefined) return gate('mutation-sensitivity', false, 'no unique configured scope was selected')
  const discovery = await discoverDocuments(workspace, loaded.config, selectedScope, selectedScenarioId)
  const matches = [...discovery.scopes.values()].flat().flatMap(document => document.scenarios)
    .filter(scenario => scenario.scope === selectedScope && (selectedScenarioId === undefined || scenario.id === selectedScenarioId))
  const scenario = discovery.violations.length === 0 && matches.length === 1 ? matches[0] : undefined
  if (scenario === undefined) return gate('mutation-sensitivity', false, 'no unique valid scenario identity was selected')
  const id = scenario.id
  const evidence = [...scenario.evidence]
  const goReferences = evidence.filter(reference => /(?:::|\/)TestBlockedAccount(?:WithValidCredentials)?$/u.test(reference))
  const pythonReferences = evidence.filter(reference => /::tests\/functional\/test_auth\.py::test_blocked_account(?:_with_valid_credentials)?$/u.test(reference))
  const checkGo = goReferences.length === 1
  const checkPython = pythonReferences.length === 1
  if (!expectedEvidenceCountValid(evidence.length, evalCase) || !expectedSelectorsPresent(evidence, evalCase)
    || evidence.length !== Number(checkGo) + Number(checkPython)
    || (evalCase.id !== 'full-skill-routing' && (!checkGo || !checkPython))) {
    return gate('mutation-sensitivity', false, 'selected normalized evidence is not supported by independent product tests')
  }
  if ((checkGo && goMutated === goSource) || (checkPython && pythonMutated === pythonSource)) {
    return gate('mutation-sensitivity', false, 'fixture mutation target was not found')
  }
  const args = ['run', '--scope', selectedScope, '--scenario', id, '--json']
  const exactResult = (stdout: string, status: 'PASS' | 'FAIL', references: readonly string[]): boolean => {
    let payload: unknown
    try { payload = JSON.parse(stdout) } catch { return false }
    if (!object(payload) || payload.executionStarted !== true || !Array.isArray(payload.scenarios)) return false
    const selected = payload.scenarios.filter((value: unknown) => object(value) && value.scope === selectedScope && value.id === id)
    const result: unknown = selected.length === 1 ? selected[0] : undefined
    if (!object(result) || result.status !== status || !Array.isArray(result.evidence) || result.evidence.length !== evidence.length) return false
    const rows: unknown[] = result.evidence
    return evidence.every(reference => rows.filter(item => object(item) && item.reference === reference).length === 1)
      && rows.every(item => object(item) && (item.status === 'PASS' || item.status === 'FAIL'))
      && references.every(reference => rows.some(item => object(item) && item.reference === reference && item.status === status))
  }
  try {
    const baseline = await focusedCommand(workspace, args)
    if (baseline.code !== 0 || !exactResult(baseline.stdout, 'PASS', evidence)) {
      return gate('mutation-sensitivity', false, 'selected evidence did not execute and pass before regression')
    }
    const outcomes: string[] = []
    let passed = true
    for (const [name, path, original, mutated, references] of [
      ['Go', goPath, goSource, goMutated, goReferences],
      ['Python', pythonPath, pythonSource, pythonMutated, pythonReferences],
    ] as const) {
      if (references.length === 0) continue
      await writeFile(path, mutated)
      let rejected = false
      try {
        const run = await focusedCommand(workspace, args)
        rejected = run.code !== null && run.code !== 0 && exactResult(run.stdout, 'FAIL', references)
      } finally {
        await writeFile(path, original)
      }
      const restored = await focusedCommand(workspace, args)
      const restorationPassed = restored.code === 0 && exactResult(restored.stdout, 'PASS', evidence)
      passed &&= rejected && restorationPassed
      outcomes.push(`${name}: selected FAIL=${rejected}, restored PASS=${restorationPassed}`)
    }
    return gate('mutation-sensitivity', passed, outcomes.join('; '))
  } catch (error) {
    return gate('mutation-sensitivity', false, `mutation execution failed: ${String(error)}`)
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
interface EvidenceCheckpoint {
  readonly scope: string
  readonly id: string
  readonly evidence: readonly string[]
  readonly representation: 'registry' | 'inline'
  readonly source?: { readonly path: string; readonly nativeId: string }
}

async function normalizedEvidenceCheckpoint(workspace: string, scope: string, id: string): Promise<{
  readonly checkpoint?: EvidenceCheckpoint
  readonly source?: string
  readonly violations: readonly { readonly path: string; readonly message: string }[]
}> {
  const loaded = await loadConfig(workspace)
  if (loaded.config === undefined) return { violations: loaded.violations }
  const discovery = await discoverDocuments(workspace, loaded.config, scope, id)
  if (discovery.violations.length > 0) return { violations: discovery.violations }
  const scenarios = [...discovery.scopes.values()].flat().flatMap(document => document.scenarios)
    .filter(scenario => scenario.scope === scope && scenario.id === id)
  const scenario = scenarios.length === 1 ? scenarios[0] : undefined
  if (scenario === undefined) return { violations: [{ path: '.focused-spec/config.yaml', message: `expected one normalized occurrence ${scope}/${id}; found ${scenarios.length}` }] }
  const source = await readFile(join(workspace, scenario.path), 'utf8')
  const registry = await loadConfiguredRegistries(workspace, loaded.config, scope, id)
  const entries = registry.entries.filter(entry => entry.scope === scope && entry.id === id)
  if (registry.violations.length > 0 || entries.length > 1) return { source, violations: registry.violations }
  const entry = entries[0]
  if (entry !== undefined) {
    const exact = entry.evidence.length === scenario.evidence.length
      && entry.evidence.every(reference => scenario.evidence.includes(reference))
    return exact ? { source, violations: [], checkpoint: {
      scope,
      id,
      evidence: scenario.evidence,
      representation: 'registry',
      ...(entry.source === undefined ? {} : { source: entry.source }),
    } } : { source, violations: [{ path: entry.registryPath, message: 'registry evidence differs from normalized scenario evidence' }] }
  }
  const lines = source.split(/\r?\n/u)
  const idRows = lines.filter(line => line === `- **ID**: \`${id}\``)
  const evidenceRows = scenario.evidence.filter(reference => lines.includes(`- **EVIDENCE**: \`${reference}\``))
  if (idRows.length !== 1 || evidenceRows.length !== scenario.evidence.length) {
    return { source, violations: [{ path: scenario.path, message: 'normalized evidence lacks exact inline ID or EVIDENCE rows' }] }
  }
  return { source, violations: [], checkpoint: { scope, id, evidence: scenario.evidence, representation: 'inline' } }
}

export interface WorkingEvidenceCheckpoint {
  readonly gates: readonly EvalGate[]
  readonly selectedScenarioId?: string
  readonly scope?: string
  readonly evidence?: EvidenceCheckpoint
  readonly source?: string
}

export async function judgeWorkingCheckpoint(
  workspace: string,
  evalCase: EvalCase,
  selectedScenarioId?: string,
): Promise<WorkingEvidenceCheckpoint> {
  const scope = await configuredWorkingScope(workspace, evalCase)
  if (scope === undefined || evalCase.changeName === undefined) return { gates: [gate('working-evidence', false, 'named change has no unique configured working scope')] }
  const contract = await judgeScenarioCheckpoint(workspace, evalCase, scope, selectedScenarioId)
  const scenarioId = contract.selectedScenarioId
  const strict = await focusedCommand(workspace, ['validate', '--strict', '--scope', scope])
  const run = scenarioId === undefined
    ? undefined
    : await focusedCommand(workspace, ['run', '--scope', scope, '--scenario', scenarioId, '--json'])
  const matches = run?.code === 0 ? passedScenarios(run.stdout).filter(result => result.scope === scope && result.id === scenarioId) : []
  const selected = scenarioId === undefined
    ? { violations: [] as readonly { readonly path: string; readonly message: string }[] }
    : await normalizedEvidenceCheckpoint(workspace, scope, scenarioId)
  const evidenceMatchesRun = selected.checkpoint !== undefined && matches.length === 1
    && matches[0]!.evidence.length === selected.checkpoint.evidence.length
    && selected.checkpoint.evidence.every(reference => matches[0]!.evidence.includes(reference))
  const representationMatches = evalCase.evidenceStorage === undefined
    || selected.checkpoint?.representation === evalCase.evidenceStorage
  const snapshotValid = selected.violations.length === 0 && evidenceMatchesRun && representationMatches
  const gates = [
    gate('working-validation', strict.code === 0, (strict.stdout || strict.stderr).trim()),
    gate('working-execution', run?.code === 0 && contract.gate.passed && snapshotValid,
      contract.gate.passed && snapshotValid && run !== undefined
        ? (run.stdout || run.stderr).trim()
        : [contract.gate.detail, ...selected.violations.map(item => item.message), representationMatches ? '' : `expected ${evalCase.evidenceStorage} evidence`].filter(Boolean).join('; ')),
  ]
  return {
    gates,
    scope,
    ...(gates.every(item => item.passed) && scenarioId !== undefined ? { selectedScenarioId: scenarioId } : {}),
    ...(selected.checkpoint === undefined ? {} : { evidence: selected.checkpoint }),
    ...(selected.source === undefined ? {} : { source: selected.source }),
  }
}

export async function brownfieldGate(
  workspace: string,
  evalCase: EvalCase,
  checkpoint?: WorkingEvidenceCheckpoint,
  selectedScenarioId = checkpoint?.selectedScenarioId ?? evalCase.prescribedScenarioId,
): Promise<EvalGate[]> {
  const changeName = evalCase.changeName
  if (changeName === undefined) return [gate('brownfield-contract', false, 'case has no working scope')]
  if (selectedScenarioId === undefined) return [gate('brownfield-contract', false, 'no scenario identity was selected')]
  const expectedId = selectedScenarioId
  const mainPath = 'openspec/specs/account-authentication/spec.md'
  const workingPath = `openspec/changes/${changeName}/specs/account-authentication/spec.md`
  const archivePath = 'openspec/changes/archive/2026-09-26-reject-blocked-accounts/specs/account-authentication/spec.md'
  if (!await exists(join(workspace, archivePath))) {
    return [gate('native-history-preservation', false, `archived native source is missing: ${archivePath}`)]
  }
  const loaded = await loadConfig(workspace)
  if (loaded.config === undefined) return [gate('brownfield-contract', false, loaded.violations.map(violation => violation.message).join('\n'))]
  const mainScope = configuredMainScope(loaded.config)
  if (mainScope === undefined) return [gate('brownfield-contract', false, 'main document has no fixed configured scope')]
  const discovery = await discoverDocuments(workspace, loaded.config, mainScope, expectedId)
  if (discovery.violations.length > 0) return [gate('brownfield-contract', false, discovery.violations.map(violation => violation.message).join('\n'))]
  const main = (discovery.scopes.get(mainScope) ?? []).find(document => document.path === mainPath)
  if (main === undefined) return [gate('brownfield-contract', false, `main document is not selected: ${mainPath}`)]
  const allWorking = await discoverDocuments(workspace, loaded.config)
  const workingScopes = [...allWorking.scopes].filter(([, documents]) => documents.some(document => document.path === workingPath))
  if (workingScopes.length > 1) return [gate('brownfield-contract', false, 'named change has no unique configured working scope')]
  const workingScope = workingScopes[0]?.[0]
  const retainedWorkingScope = workingScope ?? checkpoint?.scope ?? checkpoint?.evidence?.scope
  const workingDiscovery = workingScope === undefined ? undefined : await discoverDocuments(workspace, loaded.config, workingScope)
  if (workingDiscovery !== undefined && workingDiscovery.violations.length > 0) {
    return [gate('brownfield-contract', false, workingDiscovery.violations.map(violation => violation.message).join('\n'))]
  }
  const workingDocument = workingScope === undefined ? undefined : workingDiscovery?.scopes.get(workingScope)?.find(document => document.path === workingPath)
  if (workingDocument !== undefined && workingDocument.scenarios.length > 0
    && (workingDocument.scenarios.length !== 1 || workingDocument.scenarios[0]?.id !== expectedId)) {
    return [gate('brownfield-contract', false, 'live working binding changed its checkpointed identity')]
  }
  const workingBindingActive = workingDocument?.scenarios.some(scenario => scenario.id === expectedId) === true
  const workingSelected = !workingBindingActive
    ? checkpoint?.evidence
    : (await normalizedEvidenceCheckpoint(workspace, workingScope!, expectedId)).checkpoint
  const workingSource = workingBindingActive
    ? await readFile(join(workspace, workingPath), 'utf8')
    : checkpoint?.source
  if (workingSource === undefined || workingSelected === undefined) {
    return [gate('brownfield-contract', false, 'working identity and normalized evidence were not independently checkpointed before discovery ended')]
  }
  const historyPath = evalCase.lifecycle === 'inline-publication' ? 'openspec/specs/authentication-history/spec.md' : mainPath
  const [mainSource, archiveSource, historySource] = await Promise.all([
    readFile(join(workspace, mainPath), 'utf8'),
    readFile(join(workspace, archivePath), 'utf8'),
    readFile(join(workspace, historyPath), 'utf8'),
  ])
  const originalScenarios = [...archiveSource.matchAll(/^#### Scenario: (.+)\n(- \*\*WHEN\*\* [^\n]+\n- \*\*THEN\*\* [^\n]+)/gmu)]
  const originalOutcome = originalScenarios.find(match => match[1] === 'Blocked account with valid credentials')?.[2]
  const historical = originalScenarios.filter(match => match[1] !== 'Blocked account with valid credentials').map(match => match[0])
  const preservedHistorical = historical.filter(scenario => historySource.includes(scenario)).length
  const mainOccurrences = main.scenarios.filter(scenario => scenario.id === expectedId)
  const mainScenario = mainOccurrences.length === 1 ? mainOccurrences[0] : undefined
  const mainEvidence = mainScenario?.evidence ?? []
  const mainSelected = await normalizedEvidenceCheckpoint(workspace, main.scope, expectedId)
  const expectedRepresentation = evalCase.evidenceStorage ?? 'registry'
  const representationValid = mainSelected.checkpoint?.representation === expectedRepresentation
    && workingSelected.representation === expectedRepresentation
  const exactMainIdentity = expectedRepresentation === 'inline'
    ? mainSource.split(/\r?\n/u).filter(line => line === `- **ID**: \`${expectedId}\``).length === 1
      && !mainSource.includes('focused-spec:id=')
    : parseTrustedNativeDocument('markdown', mainPath, mainSource, main.scope, workspace).items
      .filter(item => item.markerId === expectedId).length === 1
  const exactWorkingIdentity = expectedRepresentation === 'inline'
    ? workingSource.split(/\r?\n/u).filter(line => line === `- **ID**: \`${expectedId}\``).length === 1
      && !workingSource.includes('focused-spec:id=')
    : parseTrustedNativeDocument('markdown', workingPath, workingSource, retainedWorkingScope ?? changeName, workspace).items
      .filter(item => item.markerId === expectedId).length === 1
  const historicalPreserved = historical.length === 3 && preservedHistorical === historical.length
    && !archiveSource.includes('focused-spec:id=') && !/\*\*(?:ID|EVIDENCE)\*\*/u.test(archiveSource)
    && (evalCase.lifecycle !== 'inline-publication' || !/\*\*(?:ID|EVIDENCE)\*\*/u.test(historySource))
  const requiredRevisionTerms = evalCase.expectedRevisionTerms ?? []
  const mainOutcomeValid = evalCase.lifecycle === 'inline-publication'
    ? requiredRevisionTerms.length > 0 && requiredRevisionTerms.every(term => mainSource.toLocaleLowerCase().includes(term.toLocaleLowerCase()))
    : originalOutcome !== undefined && mainSource.includes(originalOutcome)
  const workingOutcomeValid = evalCase.lifecycle === 'inline-publication'
    ? requiredRevisionTerms.length > 0 && requiredRevisionTerms.every(term => workingSource.toLocaleLowerCase().includes(term.toLocaleLowerCase()))
    : originalOutcome !== undefined && workingSource.includes(originalOutcome)
  const mainContractValid = originalOutcome !== undefined
    && mainOutcomeValid
    && workingOutcomeValid
    && exactMainIdentity
    && (evalCase.lifecycle === 'inline-publication' || mainScenario?.name === 'Scenario: Blocked account with valid credentials')
    && mainSelected.violations.length === 0
    && mainSelected.checkpoint !== undefined
    && representationValid
    && mainEvidence.length === evalCase.expectedEvidenceCount
    && mainSelected.checkpoint.evidence.length === mainEvidence.length
    && mainSelected.checkpoint.evidence.every(reference => mainEvidence.includes(reference))
    && evalCase.expectedSelectorFragments.every(fragment => mainEvidence.some(reference => reference.includes(fragment)))
  const workingContractValid = originalOutcome !== undefined
    && workingOutcomeValid
    && exactWorkingIdentity
    && workingSelected.scope === retainedWorkingScope
    && workingSelected.id === expectedId
    && workingSelected.evidence.length === mainEvidence.length
    && workingSelected.evidence.every(reference => mainEvidence.includes(reference))

  const mainRun = await focusedCommand(workspace, ['run', '--scope', main.scope, '--scenario', expectedId, '--json'])
  const mainResults = mainRun.code === 0 ? passedScenarios(mainRun.stdout) : []
  const mainPass = mainContractValid ? matchingPassedScenario(mainResults, main.scope, expectedId, mainEvidence) : undefined
  let workingPassed = checkpoint?.gates.every(item => item.passed) === true && workingContractValid
  if (checkpoint === undefined && workingDocument !== undefined && workingContractValid) {
    const workingRun = await focusedCommand(workspace, ['run', '--scope', workingSelected.scope, '--scenario', expectedId, '--json'])
    const workingResults = workingRun.code === 0 ? passedScenarios(workingRun.stdout) : []
    workingPassed = matchingPassedScenario(workingResults, workingSelected.scope, expectedId, workingSelected.evidence) !== undefined
  }

  const source = join(workspace, 'openspec', 'changes', changeName)
  const hidden = join(workspace, 'openspec', '.focused-spec-eval-hidden')
  const workingPresent = await exists(source)
  if (workingPresent) await rename(source, hidden)
  let afterTransition
  try {
    afterTransition = await focusedCommand(workspace, ['run', '--scope', main.scope, '--scenario', expectedId, '--json'])
  } finally {
    if (workingPresent) await rename(hidden, source)
  }
  const transitionedResults = afterTransition.code === 0 ? passedScenarios(afterTransition.stdout) : []
  const transitionedPass = matchingPassedScenario(transitionedResults, main.scope, expectedId, mainEvidence)
  const evidenceStable = mainPass !== undefined && workingPassed && transitionedPass !== undefined
  return [
    gate('native-history-preservation', historicalPreserved,
      `${preservedHistorical}/${historical.length} unmarked historical native scenarios preserved directly`),
    gate('main-scope-evidence', mainContractValid && mainPass !== undefined, mainRun.code === 0
      ? `main scope=${main.scope}; occurrence count=${mainOccurrences.length}; expected ${evalCase.expectedEvidenceCount} explicit ${expectedRepresentation} references; observed ${mainPass?.evidence.length ?? 0} passing evidence`
      : mainRun.stdout.trim() || mainRun.stderr.trim()),
    gate('transition-stable-evidence', evidenceStable, afterTransition.code === 0
      ? `working document absent; checkpointed ${changeName} ${expectedRepresentation} evidence ${workingPassed ? 'PASS and unchanged' : 'missing or altered'}; explicit ${main.scope} ${expectedRepresentation} evidence ${transitionedPass === undefined ? 'missing or altered' : 'PASS with unchanged evidence'}`
      : afterTransition.stdout.trim() || afterTransition.stderr.trim()),
  ]
}

export async function registryPlacementGate(workspace: string, evalCase: EvalCase, selectedScenarioId?: string): Promise<EvalGate> {
  const baselineRoot = join(evalRepositoryRoot(), 'evals', evalCase.overlay ?? '')
  const [before, after] = await Promise.all([loadConfig(baselineRoot), loadConfig(workspace)])
  if (before.config === undefined || after.config === undefined || selectedScenarioId === undefined) {
    return gate('registry-placement', false, 'valid baseline, configured registry and selected native identity required')
  }
  const [original, registry] = await Promise.all([
    loadConfiguredRegistries(baselineRoot, before.config),
    loadConfiguredRegistries(workspace, after.config),
  ])
  const unchangedConfiguration = JSON.stringify(withoutRegistryFiles(before.config))
    === JSON.stringify(withoutRegistryFiles(after.config))
  const retained = original.entries.every(entry => registry.entries.some(actual => actual.scope === entry.scope
    && actual.id === entry.id && actual.registryPath === entry.registryPath
    && JSON.stringify(actual.evidence) === JSON.stringify(entry.evidence)
    && JSON.stringify(actual.source) === JSON.stringify(entry.source)))
  const selected = registry.entries.filter(entry => entry.scope === 'current' && entry.id === selectedScenarioId)
  const target = selected.length === 1 ? selected[0] : undefined
  const addedFiles = registry.files.filter(path => !original.files.includes(path))
  const placement = evalCase.registryPlacement === 'reuse'
    ? target?.registryPath === '.focused-spec/evidence/auth.yaml' && addedFiles.length === 0
    : target !== undefined && addedFiles.length === 1 && addedFiles[0] === target.registryPath
      && target.registryPath.startsWith('.focused-spec/evidence/')
  const monolithAbsent = !await exists(join(workspace, '.focused-spec/evidence.yaml'))
  const allFilesRetained = original.files.every(path => registry.files.includes(path))
  const passed = original.violations.length === 0 && registry.violations.length === 0 && unchangedConfiguration
    && retained && allFilesRetained && placement && monolithAbsent
  return gate('registry-placement', passed, `mode=${evalCase.registryPlacement}; target=${target?.registryPath ?? 'missing'}; original registrations retained=${retained}; original sources retained=${allFilesRetained}; other configuration unchanged=${unchangedConfiguration}; no monolith=${monolithAbsent}; new sources=${addedFiles.join(', ') || 'none'}`)
}

export async function judgeCompletedWorkspace(
  workspace: string,
  evalCase: EvalCase,
  snapshots: ReadonlyMap<string, string>,
  transcripts: readonly string[],
  checkpoint?: WorkingEvidenceCheckpoint,
  selectedScenarioId = checkpoint?.selectedScenarioId ?? evalCase.prescribedScenarioId,
): Promise<EvalGate[]> {
  const gates: EvalGate[] = []
  let scope = evalCase.changeName === undefined ? undefined : await configuredWorkingScope(workspace, evalCase)
  const publicationLifecycle = evalCase.id === 'openspec-brownfield' || evalCase.lifecycle === 'inline-publication'
  if (publicationLifecycle) {
    const loaded = await loadConfig(workspace)
    if (loaded.config !== undefined) {
      scope = configuredMainScope(loaded.config)
    }
  }
  const selectionAvailable = evalCase.changeName === undefined || scope !== undefined
  const strictArgs = ['validate', '--strict', ...(scope === undefined ? [] : ['--scope', scope])]
  const strict = selectionAvailable ? await focusedCommand(workspace, strictArgs) : undefined
  gates.push(gate('focused-validation', strict?.code === 0, strict === undefined ? 'named change has no unique configured working scope'
    : strict.code === 0 ? strict.stdout.trim() : (strict.stderr || strict.stdout).trim()))

  const runArgs = ['run', ...(scope === undefined ? [] : ['--scope', scope])]
  const run = selectionAvailable ? await focusedCommand(workspace, runArgs) : undefined
  gates.push(gate('focused-execution', run?.code === 0, run === undefined ? 'named change has no unique configured working scope'
    : run.code === 0 ? run.stdout.trim() : (run.stderr || run.stdout).trim()))

  if (evalCase.changeName !== undefined) {
    const paths = await glob([
      `openspec/changes/${evalCase.changeName}/tasks.md`,
      `openspec/changes/archive/*-${evalCase.changeName}/tasks.md`,
    ], { cwd: workspace, nodir: true, follow: true, nocase: false })
    const taskPath = paths.length === 1 ? paths[0] : undefined
    const archived = taskPath?.startsWith('openspec/changes/archive/') === true
    const openSpec = await openspecCommand(workspace, archived
      ? ['validate', '--specs', '--strict', '--no-interactive']
      : ['validate', evalCase.changeName, '--strict', '--no-interactive'])
    gates.push(gate('openspec-validation', openSpec.code === 0 && taskPath !== undefined, openSpec.code === 0 ? openSpec.stdout.trim() : (openSpec.stderr || openSpec.stdout).trim()))
    const tasks = taskPath === undefined ? undefined : await readFile(join(workspace, taskPath), 'utf8')
    const incomplete = tasks?.match(/^- \[ \]/gmu)?.length ?? 0
    gates.push(gate('openspec-tasks', tasks !== undefined && incomplete === 0, tasks === undefined ? 'completed change tasks missing or ambiguous' : `${incomplete} incomplete tasks`))
  }

  const scenario = evalCase.id === 'project-upgrade' ? undefined : await judgeScenarioCheckpoint(workspace, evalCase, scope, selectedScenarioId)
  if (scenario !== undefined) gates.push(scenario.gate)
  gates.push(await behaviorGate(workspace))
  gates.push(await integrityGate(workspace, snapshots, transcripts))
  const effectiveScenarioId = scenario?.selectedScenarioId ?? selectedScenarioId
  if (evalCase.registryPlacement !== undefined) gates.push(await registryPlacementGate(workspace, evalCase, effectiveScenarioId))
  if (evalCase.id === 'spec-evidence-revision') gates.push(await specRevisionGate(workspace, evalCase))
  if (evalCase.id === 'vacuous-evidence') gates.push(...await judgeEvidenceRepair(workspace, transcripts))
  else if (evalCase.id === 'project-upgrade' && strict?.code === 0 && run?.code === 0) gates.push(await upgradeSensitivityGate(workspace))
  else if (strict?.code === 0 && run?.code === 0) gates.push(await mutationGate(workspace, evalCase, scope, effectiveScenarioId))
  else gates.push(gate('mutation-sensitivity', false, 'focused validation or execution failed'))
  if (publicationLifecycle) {
    gates.push(...await brownfieldGate(workspace, evalCase, checkpoint, effectiveScenarioId))
  }
  return gates
}
