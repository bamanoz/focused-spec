import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { glob } from 'glob'
import { discoverDocuments, loadConfig } from '../packages/core/dist/index.js'
import { readCatalog } from '@focused-spec/format-scenarios-typescript/catalog'
import { guidanceActivationGate, inspectsImplementation, localCommandArguments, mutationGate } from './judge.ts'
import { runProcess } from './process.ts'
import { serveUpgradeCandidate } from './upgrade.ts'
import type { EvalCase, EvalGate, IntegrationCase } from './types.ts'

const repository = fileURLToPath(new URL('..', import.meta.url))
const packageDirectories = ['core', 'sdk/typescript', 'formats/markdown', 'formats/gherkin', 'formats/inline', 'formats/registry', 'formats/scenarios-typescript', 'formats/scenarios-go', 'runners/vitest', 'runners/go', 'runners/pytest', 'runners/scenarios-typescript', 'runners/scenarios-go']
const digest = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex')
const gate = (name: string, passed: boolean, detail: string): EvalGate => ({ name, passed, detail })
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const codeSource = (choice: IntegrationCase): boolean => choice.source === 'typescript' || choice.source === 'go'
const cliPath = (workspace: string): string => join(workspace, 'node_modules/focused-spec/dist/cli.js')
const GO_SCENARIOS_MODULE = 'github.com/bamanoz/focused-spec/packages/sdk/go'
const focused = (workspace: string, args: string[]) => runProcess(process.execPath, [cliPath(workspace), ...args, '--json'], { cwd: workspace, timeoutMs: 240_000 })
async function put(workspace: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(workspace, path)), { recursive: true })
  await writeFile(join(workspace, path), content)
}
async function text(workspace: string, path: string): Promise<string | undefined> {
  try { return await readFile(join(workspace, path), 'utf8') } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}
export async function integrationFiles(workspace: string): Promise<Map<string, string>> {
  const files = await glob('**/*', { cwd: workspace, dot: true, nodir: true, follow: false, ignore: ['node_modules/**', '.git/**', '.dependencies/**', '**/__pycache__/**', '.pytest_cache/**', '**/.cache/**'] })
  return new Map(await Promise.all(files.sort().map(async path => [path, digest(await readFile(join(workspace, path)))] as const)))
}
export interface IntegrationBaseline {
  readonly files: ReadonlyMap<string, string>
  readonly protected: ReadonlyMap<string, string>
  readonly candidates: ReadonlyMap<string, ReadonlyMap<string, string>>
  readonly native: ReadonlyMap<string, string>
  readonly config?: string
  readonly packages: readonly string[]
  readonly establishedComposition: readonly string[]
}
async function packageFiles(root: string): Promise<Map<string, string>> {
  return new Map(await Promise.all((await glob('**/*', { cwd: root, dot: true, nodir: true, follow: false })).map(async path => [path, digest(await readFile(join(root, path)))] as const)))
}
async function installedPackages(workspace: string): Promise<string[]> {
  const manifests = await glob(['node_modules/focused-spec/package.json', 'node_modules/@focused-spec/*/package.json'], { cwd: workspace, nodir: true })
  return (await Promise.all(manifests.map(async path => String(JSON.parse(await readFile(join(workspace, path), 'utf8')).name)))).sort()
}
function goDirectiveEntries(source: string, directive: 'require' | 'replace'): string[][] {
  const entries: string[][] = []
  let block = false
  for (const raw of source.split('\n')) {
    const line = raw.replace(/\/\/.*$/u, '').trim()
    if (line === `${directive} (`) { block = true; continue }
    if (block && line === ')') { block = false; continue }
    const entry = block ? line : line.startsWith(`${directive} `) ? line.slice(directive.length + 1).trim() : ''
    if (entry !== '') entries.push(entry.split(/\s+/u))
  }
  return entries
}

export async function inspectEstablishedComposition(workspace: string, packages: readonly string[]): Promise<string[]> {
  const established = new Set(packages)
  const goMod = await text(workspace, 'go.mod')
  if (goMod === undefined || !goDirectiveEntries(goMod, 'require').some(entry => entry[0] === GO_SCENARIOS_MODULE)) return [...established].sort()
  const replacement = goDirectiveEntries(goMod, 'replace').find(entry => entry[0] === GO_SCENARIOS_MODULE)
  const separator = replacement?.indexOf('=>') ?? -1
  const target = separator < 0 ? undefined : replacement?.[separator + 1]
  if (target === undefined || (!target.startsWith('.') && !target.startsWith('/'))) return [...established].sort()
  const dependencyRoot = resolve(workspace, target)
  const dependencyManifest = await text(dependencyRoot, 'go.mod')
  if (!dependencyManifest?.split('\n').some(line => line.trim() === `module ${GO_SCENARIOS_MODULE}`)) return [...established].sort()
  const importsModule = async (pattern: string): Promise<boolean> => {
    const paths = await glob(pattern, { cwd: workspace, nodir: true, ignore: ['.dependencies/**'] })
    return (await Promise.all(paths.map(path => text(workspace, path)))).some(source => source?.includes(`"${GO_SCENARIOS_MODULE}"`))
  }
  if (await importsModule('**/*.scenarios.go') && await importsModule('**/*_test.go')) established.add(GO_SCENARIOS_MODULE)
  return [...established].sort()
}
function composition(choice: IntegrationCase): string[] {
  if (choice.mode === 'recommend' || choice.mode === 'install') return ['focused-spec']
  if (choice.source === 'typescript') return ['focused-spec', '@focused-spec/scenarios-typescript', ...(choice.cli ? ['@focused-spec/format-scenarios-typescript', '@focused-spec/runner-scenarios-typescript'] : [])].sort()
  if (choice.source === 'go') return ['focused-spec', ...(choice.cli ? ['@focused-spec/format-scenarios-go', '@focused-spec/runner-scenarios-go'] : [])].sort()
  return ['focused-spec', '@focused-spec/runner-go', '@focused-spec/runner-pytest', ...(choice.source === 'inline' ? ['@focused-spec/format-inline'] : ['@focused-spec/format-markdown', '@focused-spec/format-registry'])].sort()
}
const references = ['go::./auth::TestBlockedAccount', 'pytest::tests/functional/test_auth.py::test_blocked_account']
function inlineConfiguration(): string {
  return JSON.stringify({ version: 5, specifications: { formats: { inline: { package: '@focused-spec/format-inline' } }, documents: [{ match: 'specs/**/*.md', scope: 'current', format: 'inline' }] }, runners: { go: { package: '@focused-spec/runner-go' }, pytest: { package: '@focused-spec/runner-pytest', options: { command: 'uv', commandArgs: ['run', '--with', 'pytest', 'python'] } } } })
}
export async function prepareIntegration(workspace: string, cache: string, choice: IntegrationCase, pack: (root: string, cache: string) => Promise<string>): Promise<{ baseline: IntegrationBaseline; close(): Promise<void> }> {
  const candidates = await Promise.all(packageDirectories.map(async directory => {
    const root = join(repository, 'packages', directory)
    const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as Record<string, unknown>
    return { name: String(metadata.name), metadata, tarball: await pack(root, cache) }
  }))
  const reference = join(cache, 'integration-reference')
  await mkdir(reference)
  await put(reference, 'package.json', '{"private":true}')
  const installed = await runProcess('npm', ['install', '--prefer-offline', '--ignore-scripts', '--no-audit', '--no-fund', ...candidates.map(item => item.tarball)], { cwd: reference, timeoutMs: 180_000 })
  if (installed.code !== 0) throw new Error(`integration candidate installation failed: ${installed.stderr}`)
  const artifacts = new Map(await Promise.all(candidates.map(async item => [item.name, await packageFiles(join(reference, 'node_modules', item.name))] as const)))
  const isCode = codeSource(choice)
  if (isCode) {
    // Replace only this new fixture's polyglot scaffold, never a user's tree.
    await rm(workspace, { recursive: true, force: true })
    await cp(join(repository, 'examples/scenarios', choice.source), workspace, { recursive: true, filter: path => !path.includes('node_modules') && !path.includes('.focused-spec') && !path.endsWith('package-lock.json') })
    if (choice.source === 'go') {
      await cp(join(repository, 'packages/sdk/go'), join(workspace, '.dependencies/scenarios-go'), { recursive: true })
      await put(workspace, 'go.mod', (await readFile(join(workspace, 'go.mod'), 'utf8')).replace('../../../packages/sdk/go', './.dependencies/scenarios-go'))
    }
  }
  await put(workspace, 'package.json', JSON.stringify({ name: 'integration-consumer', private: true, type: 'module', scripts: choice.source === 'typescript' ? { test: 'node --test test/account.node.mjs', start: 'node demo.mjs' } : {} }))
  const native = new Map<string, string>()
  if (choice.source === 'openspec' || choice.source === 'spec-kit') {
    const path = choice.source === 'openspec' ? 'openspec/specs/auth/spec.md' : 'specs/001-auth/spec.md'
    const content = choice.source === 'openspec'
      ? '# Authentication\n\n### Requirement: Administrative blocks take precedence\nBlocked accounts SHALL be rejected even when credentials are valid.\n\n#### Scenario: Blocked account submits valid credentials\n- **WHEN** a blocked account submits valid credentials\n- **THEN** authentication is rejected\n'
      : '# Feature Specification: Authentication\n\n## User Scenarios & Testing\n\n### User Story 1 - Reject blocked accounts\n\n**Acceptance Scenarios**:\n\n1. **Given** a blocked account and valid credentials, **When** it authenticates, **Then** authentication is rejected.\n'
    await put(workspace, path, content); native.set(path, content)
  }
  if (choice.source === 'inline' && choice.mode === 'revise') {
    await put(workspace, '.focused-spec/config.yaml', inlineConfiguration())
    const path = 'specs/auth.md'
    const content = `# Authentication\n\n#### Scenario: Blocked account with valid credentials\n- **ID**: \`Auth / Blocked\`\n${references.map(value => `- **EVIDENCE**: \`${value}\``).join('\n')}\n- **WHEN** a blocked account submits valid credentials\n- **THEN** authentication is rejected\n`
    await put(workspace, path, content); native.set(path, content)
  }
  if (isCode) {
    const path = choice.source === 'typescript' ? 'specifications/account.scenarios.mjs' : 'specifications/account.scenarios.go'
    native.set(path, await readFile(join(workspace, path), 'utf8'))
    if (choice.mode === 'author') {
      // A plausible false-green driver must be repaired against the real application.
      if (choice.source === 'typescript') await put(workspace, 'specifications/account.driver.mjs', "import suite from './account.scenarios.mjs';\nexport default { given: value => value, when: (_subject, command) => structuredClone(suite.scenarios.find(item => JSON.stringify(item.when) === JSON.stringify(command)).expect) };\n")
    }
    if (choice.mode === 'revise' && choice.cli) {
      await cp(join(repository, 'examples/scenarios', choice.source, '.focused-spec'), join(workspace, '.focused-spec'), { recursive: true })
    }
  }
  const initial = choice.mode === 'revise' ? composition(choice) : ['focused-spec']
  const coreInstall = await runProcess('npm', ['install', '--prefer-offline', '--save-dev', '--ignore-scripts', '--no-audit', '--no-fund', ...candidates.filter(item => initial.includes(item.name)).map(item => item.tarball)], { cwd: workspace, timeoutMs: 180_000 })
  if (coreInstall.code !== 0) throw new Error(`integration fixture install failed: ${coreInstall.stderr}`)
  const registry = await serveUpgradeCandidate(candidates)
  try {
    await put(workspace, '.npmrc', `@focused-spec:registry=${registry.url}/\n`)
    await cp(join(workspace, 'node_modules/focused-spec/skills/focused-spec'), join(workspace, '.omp/skills/focused-spec'), { recursive: true })
    const files = await integrationFiles(workspace)
    const protectedPaths = await glob(isCode ? [choice.source === 'typescript' ? 'src/**/*' : 'bank/**/*', '.dependencies/**/*', '.omp/skills/**/*'] : ['app/**/*', 'auth/**/*', 'tests/**/*', 'go.mod', '.omp/skills/**/*'], { cwd: workspace, nodir: true, dot: true })
    const protectedFiles = new Map(await Promise.all(protectedPaths.map(async path => [path, digest(await readFile(join(workspace, path)))] as const)))
    const config = await text(workspace, '.focused-spec/config.yaml')
    const packages = await installedPackages(workspace)
    return { baseline: { files, protected: protectedFiles, candidates: artifacts, native, packages, establishedComposition: await inspectEstablishedComposition(workspace, packages), ...(config === undefined ? {} : { config }) }, close: registry.close }
  } catch (error) { await registry.close(); throw error }
}

function stripEnrollment(value: string): string {
  return value.replace(/<!--\s*focused-spec:id=[^>]+-->\s*/gu, '').replace(/^- \*\*(?:ID|EVIDENCE)\*\*:.*\n/gmu, '').trim()
}
export async function integrationBoundaryGates(workspace: string, choice: IntegrationCase, baseline: IntegrationBaseline): Promise<EvalGate[]> {
  const files = await integrationFiles(workspace)
  const changes = [...new Set([...baseline.files.keys(), ...files.keys()])].filter(path => baseline.files.get(path) !== files.get(path))
  const boundaryOnly = choice.mode === 'recommend' || choice.mode === 'install'
  const actualPackages = await installedPackages(workspace)
  const expectedPackages = choice.mode === 'revise' ? [...baseline.packages] : composition(choice)
  const config = await text(workspace, '.focused-spec/config.yaml')
  const unauthorized = choice.mode === 'install' ? changes.filter(path => path !== '.omp/commands/focused-spec.md' && !path.startsWith('.omp/skills/focused-spec/')) : changes
  const boundary = !boundaryOnly || unauthorized.length === 0 && isDeepStrictEqual(actualPackages, baseline.packages)
  const preserved = choice.mode !== 'revise' || config === baseline.config && isDeepStrictEqual(actualPackages, baseline.packages)
  const nativeChanges: string[] = []
  for (const [path, before] of baseline.native) {
    const after = await text(workspace, path)
    if (after === undefined || (codeSource(choice) ? choice.mode !== 'author' && after !== before : stripEnrollment(after) !== stripEnrollment(before))) nativeChanges.push(path)
  }
  const protectedChanges: string[] = []
  for (const [path, hash] of baseline.protected) if (digest(await readFile(join(workspace, path)).catch(() => Buffer.alloc(0))) !== hash) protectedChanges.push(path)
  const alteredPackages: string[] = []
  for (const name of actualPackages) {
    const expected = baseline.candidates.get(name)
    if (expected === undefined || !isDeepStrictEqual(await packageFiles(join(workspace, 'node_modules', name)), expected)) alteredPackages.push(name)
  }
  return [
    gate('integration-phase-boundary', boundary, boundary ? 'authorized side effects only' : `unauthorized changes: ${changes.join(', ')}; packages=${actualPackages.join(',')}`),
    gate('integration-preserve-existing', preserved, preserved ? 'existing composition retained' : 'existing configuration or packages replaced'),
    gate('integration-native-source', nativeChanges.length === 0, nativeChanges.length === 0 ? 'canonical native source retained' : `replaced native sources: ${nativeChanges.join(', ')}`),
    gate('integration-composition', isDeepStrictEqual(actualPackages, expectedPackages) && (boundaryOnly || choice.cli ? true : config === undefined), `installed=${actualPackages.join(', ')}; expected=${expectedPackages.join(', ')}`),
    gate('integration-integrity', protectedChanges.length === 0 && alteredPackages.length === 0, `changed product/SDK=${protectedChanges.join(',')}; altered candidate packages=${alteredPackages.join(',')}`),
  ]
}

interface ToolEvent { type?: string; toolName?: string; toolCallId?: string; args?: Record<string, unknown>; result?: { isError?: boolean; content?: { type: string; text?: string }[]; details?: { exitCode?: number } }; isError?: boolean }
function events(transcripts: readonly string[]): ToolEvent[] {
  return transcripts.flatMap(transcript => transcript.split('\n').flatMap(line => {
    try { const value: unknown = JSON.parse(line); return object(value) ? [value as ToolEvent] : [] } catch { return [] }
  }))
}
function output(event: ToolEvent): string { return event.result?.content?.map(part => part.text ?? '').join('\n') ?? '' }
function successful(event: ToolEvent): boolean { return event.isError !== true && event.result !== undefined && event.result.isError !== true && (event.result.details?.exitCode ?? 0) === 0 }
function parseOutput(value: string): unknown {
  try { return JSON.parse(value.trim().replace(/(?:\n+Wall time: [^\n]+)+$/u, '').trim()) } catch { return undefined }
}
function linkedArtifact(value: string): string | undefined {
  const display = value.trim().replace(/(?:\n+Wall time: [^\n]+)+$/u, '').trim()
  return display.match(/\n\[[^\n]*Read (artifact:\/\/[A-Za-z0-9_-]+) for full output\]$/u)?.[1]
    ?? display.match(/\n\[raw output: (artifact:\/\/[A-Za-z0-9_-]+)\]$/u)?.[1]
}
function configWrite(event: ToolEvent): boolean {
  if (event.type !== 'tool_execution_start') return false
  return ['write', 'edit'].includes(event.toolName ?? '') && /\.focused-spec[\\/]config\.ya?ml/u.test(JSON.stringify(event.args))
    || event.toolName === 'bash' && /(?:>|tee|writeFile|write_text|cp\s|mv\s).*?\.focused-spec\/config\.ya?ml/u.test(String(event.args?.command))
}
export async function selectedContractsGate(workspace: string, transcripts: readonly string[], required: readonly string[]): Promise<EvalGate> {
  const starts = new Map<string, { name: string; toolName: 'bash' | 'read' }>(), artifacts = new Map<string, string>(), acquired = new Set<string>()
  const missingBeforeWrite = new Set<string>()
  const validate = async (name: string, value: unknown): Promise<boolean> => {
    if (!object(value) || !object(value.selection) || !['package', 'format', 'runner'].includes(String(value.selection.kind)) || !object(value.plugin) || !object(value.document)) return false
    if (value.selection.kind === 'package' && value.selection.name !== name) return false
    if (value.selection.kind !== 'package') {
      const loaded = await loadConfig(workspace)
      const registrations = value.selection.kind === 'format' ? loaded.config?.specifications.formats : loaded.config?.runners
      if (registrations?.[String(value.selection.name)]?.package !== name) return false
    }
    try {
      const root = await realpath(join(workspace, 'node_modules', name))
      const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { name: string; version: string; focusedSpec?: { documentation?: string } }
      const path = await realpath(join(root, metadata.focusedSpec?.documentation ?? 'README.md'))
      return value.plugin.package === name && value.plugin.name === metadata.name && value.plugin.version === metadata.version && value.plugin.root === root
        && value.document.path === path && value.document.content === await readFile(path, 'utf8') && String(value.document.content).trim() !== ''
    } catch { return false }
  }
  for (const event of events(transcripts)) {
    if (configWrite(event)) for (const name of required) if (!acquired.has(name)) missingBeforeWrite.add(name)
    if (event.type === 'tool_execution_start' && event.toolCallId !== undefined) {
      if (event.toolName === 'bash') {
        const command = String(event.args?.command ?? '')
        const localCommand = command.replace(/^focused-spec(?=\s|$)/u, JSON.stringify(join(workspace, 'node_modules', '.bin', 'focused-spec')))
        const args = localCommandArguments(localCommand, workspace)
        if (args?.[0] === 'plugin-docs' && args.includes('--json')) {
          const selector = args.findIndex(value => ['--package', '--format', '--runner'].includes(value))
          const value = args[selector + 1]
          let name = value
          if (args[selector] !== '--package') {
            const loaded = await loadConfig(workspace)
            const registrations = args[selector] === '--format' ? loaded.config?.specifications.formats : loaded.config?.runners
            name = value === undefined ? undefined : registrations?.[value]?.package
          }
          if (name !== undefined && required.includes(name)) starts.set(event.toolCallId, { name, toolName: 'bash' })
        }
      } else if (event.toolName === 'read') {
        const artifact = String(event.args?.path ?? '').match(/^(artifact:\/\/[\w-]+)(?::|$)/u)?.[1]
        const name = artifact === undefined ? undefined : artifacts.get(artifact)
        if (name !== undefined) starts.set(event.toolCallId, { name, toolName: 'read' })
      }
    }
    if (event.type !== 'tool_execution_end' || event.toolCallId === undefined) continue
    const start = starts.get(event.toolCallId)
    starts.delete(event.toolCallId)
    if (start === undefined || event.toolName !== start.toolName || !successful(event)) continue
    const result = output(event)
    if (await validate(start.name, parseOutput(result))) acquired.add(start.name)
    else {
      const artifact = linkedArtifact(result)
      const previous = artifact === undefined ? undefined : artifacts.get(artifact)
      if (artifact !== undefined && (previous === undefined || previous === start.name)) artifacts.set(artifact, start.name)
    }
  }
  const missing = required.filter(name => !acquired.has(name))
  return gate('integration-selected-contracts', missing.length === 0 && missingBeforeWrite.size === 0, `missing installed contracts=${missing.join(',')}; premature writes=${[...missingBeforeWrite].join(',')}`)
}
export async function integrationRoutingGate(workspace: string, transcripts: readonly string[], choice: IntegrationCase, baseline: IntegrationBaseline): Promise<EvalGate> {
  const required = choice.source === 'typescript'
    ? ['@focused-spec/scenarios-typescript', ...(choice.cli ? ['@focused-spec/format-scenarios-typescript', '@focused-spec/runner-scenarios-typescript'] : [])]
    : choice.source === 'go'
      ? [GO_SCENARIOS_MODULE, ...(choice.cli ? ['@focused-spec/format-scenarios-go', '@focused-spec/runner-scenarios-go'] : [])]
      : composition(choice).filter(name => name !== 'focused-spec')
  const missing = required.filter(name => !baseline.establishedComposition.includes(name))
  if (choice.mode !== 'recommend' && missing.length === 0) return gate('focused-integration-acquired', true, `established compatible composition retained: ${required.join(',')}`)
  const beforeWrites: string[] = []
  for (const transcript of transcripts) {
    const entries = transcript.split('\n')
    const index = entries.findIndex(line => {
      try {
        const event = JSON.parse(line) as ToolEvent
        if (configWrite(event)) return true
        if (event.type !== 'tool_execution_start') return false
        if (['write', 'edit'].includes(event.toolName ?? '') && /package\.json/u.test(JSON.stringify(event.args))) return true
        return event.toolName === 'bash' && /(?:npm|pnpm|yarn|bun)\s+(?:install|add)\b[^\n]*@focused-spec\//u.test(String(event.args?.command))
      } catch { return false }
    })
    beforeWrites.push(index < 0 ? transcript : entries.slice(0, index).join('\n'))
  }
  return guidanceActivationGate(workspace, beforeWrites, 'integration')
}
export async function executableSourceGate(workspace: string, choice: IntegrationCase): Promise<EvalGate> {
  const duplicates = await glob(['specs/**/*', 'openspec/**/*.md', '.focused-spec/evidence*.{yaml,yml}', '.focused-spec/evidence/**/*.{yaml,yml}'], { cwd: workspace, nodir: true, dot: true })
  const suites = await glob(choice.source === 'go' ? '**/*.scenarios.go' : '**/*.scenarios.{mjs,js,ts,mts}', { cwd: workspace, nodir: true, ignore: ['node_modules/**', '.dependencies/**'] })
  return gate('executable-single-source', duplicates.length === 0 && suites.length === 1, `native suites=${suites.join(',')}; competing sources=${duplicates.join(',')}`)
}
export async function executableBehaviorGates(workspace: string, choice: IntegrationCase): Promise<EvalGate[]> {
  const isGo = choice.source === 'go'
  const productPath = isGo ? 'bank/account.go' : 'src/account.mjs'
  const before = await readFile(join(workspace, productPath), 'utf8')
  const expression = isGo ? 'command.Cents > a.balance' : 'command.cents > this.#balance'
  const replacement = isGo ? 'command.Cents >= a.balance' : 'command.cents >= this.#balance'
  if (!before.includes(expression)) return [gate('executable-application-sensitivity', false, 'independent application mutation target missing')]
  const run = () => isGo
    ? runProcess('go', ['test', './specifications', '-count=1', '-json', '-run', '^TestAccountScenarios/Withdrawing_the_entire_balance_is_allowed$'], { cwd: workspace, timeoutMs: 120_000 })
    : runProcess(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=^Withdrawing the entire balance is allowed$', 'test/account.node.mjs'], { cwd: workspace, timeoutMs: 120_000 })
  let canonical = true
  if (!isGo) {
    try {
      const catalog = readCatalog('specifications/account.scenarios.mjs', await readFile(join(workspace, 'specifications/account.scenarios.mjs'), 'utf8'))
      const selected = catalog.scenarios.filter(item => item.scenario.name === 'Withdrawing the entire balance is allowed')
      canonical = selected.length === 1 && isDeepStrictEqual(selected[0]?.scenario.given, [{ type: 'AccountOpened' }, { type: 'MoneyDeposited', cents: 5000 }])
        && selected[0]?.scenario.id === 'account.withdraw.entire-balance'
        && isDeepStrictEqual(selected[0]?.scenario.when, { type: 'WithdrawMoney', cents: 5000 }) && isDeepStrictEqual(selected[0]?.scenario.expect, [{ type: 'MoneyWithdrawn', cents: 5000 }])
    } catch { canonical = false }
  }
  const selectedCli = () => focused(workspace, ['run', '--scenario', 'account.withdraw.entire-balance'])
  const exactCli = (result: Awaited<ReturnType<typeof focused>>, status: 'PASS' | 'FAIL'): boolean => {
    const value = parseOutput(result.stdout)
    if (!object(value) || value.executionStarted !== true || !Array.isArray(value.scenarios) || value.scenarios.length !== 1) return false
    const scenario: unknown = value.scenarios[0]
    return object(scenario) && scenario.id === 'account.withdraw.entire-balance' && scenario.status === status
      && Array.isArray(scenario.evidence) && scenario.evidence.length === 1 && scenario.evidence.every(item => object(item) && item.status === status)
      && (status === 'PASS' ? result.code === 0 : result.code === 1 && /(?:ERR_ASSERTION|expected[\s\S]*actual|deep(?:ly)?[ -]equal)/iu.test(JSON.stringify(scenario)))
  }
  const full = await (isGo ? runProcess('go', ['test', './...', '-count=1'], { cwd: workspace, timeoutMs: 120_000 })
    : runProcess(process.execPath, ['--test', 'test/account.node.mjs'], { cwd: workspace, timeoutMs: 120_000 }))
  const initialCli = choice.cli ? await selectedCli() : undefined
  const initial = await run()
  let mutated: Awaited<ReturnType<typeof run>> | undefined
  let mutatedCli: Awaited<ReturnType<typeof focused>> | undefined
  try {
    await writeFile(join(workspace, productPath), before.replace(expression, replacement))
    mutated = await run()
    if (choice.cli) mutatedCli = await selectedCli()
  } finally { await writeFile(join(workspace, productPath), before) }
  const restored = await run()
  const restoredCli = choice.cli ? await selectedCli() : undefined
  const selectedRan = (stdout: string, status: 'pass' | 'fail'): boolean => {
    if (isGo) {
      const rows = stdout.split('\n').flatMap(line => { try { return [JSON.parse(line) as { Action?: string; Test?: string; Output?: string }] } catch { return [] } })
      const selected = rows.filter(row => row.Test === 'TestAccountScenarios/Withdrawing_the_entire_balance_is_allowed')
      return selected.some(row => row.Action === status) && (status === 'pass' || selected.some(row => /expected[\s\S]*actual/u.test(row.Output ?? '')))
    }
    const block = stdout.split(/(?=# Subtest: )/u).find(part => part.startsWith('# Subtest: Withdrawing the entire balance is allowed\n')) ?? ''
    return status === 'pass' ? /^ok \d+ - Withdrawing the entire balance is allowed$/mu.test(block)
      : /^not ok \d+ - Withdrawing the entire balance is allowed$/mu.test(block) && /code: 'ERR_ASSERTION'/u.test(block)
  }
  const passed = canonical && initial.code === 0 && selectedRan(initial.stdout, 'pass') && mutated?.code === 1 && selectedRan(mutated.stdout + mutated.stderr, 'fail')
    && restored.code === 0 && selectedRan(restored.stdout, 'pass')
  const cliPassed = !choice.cli || initialCli !== undefined && mutatedCli !== undefined && restoredCli !== undefined
    && exactCli(initialCli, 'PASS') && exactCli(mutatedCli, 'FAIL') && exactCli(restoredCli, 'PASS')
  return [gate('executable-native-execution', full.code === 0, full.stdout + full.stderr),
    gate('executable-independent-expectation', canonical, canonical ? 'claimed boundary retains independent expected observation' : 'claimed boundary changed or expectation is not independently authored'),
    gate('executable-application-sensitivity', passed && cliPassed, `ordinary selected application PASS=${String(initial.code)} → assertion FAIL=${String(mutated?.code)} → restored PASS=${String(restored.code)}; CLI=${cliPassed}; ${mutated?.stdout.slice(-1800) ?? ''}`)]
}
export async function judgeIntegrationWorkspace(workspace: string, evalCase: EvalCase, baseline: IntegrationBaseline, transcripts: readonly string[]): Promise<EvalGate[]> {
  const choice = evalCase.integration!
  const gates = await integrationBoundaryGates(workspace, choice, baseline)
  gates.push(gate('integration-no-implementation-inspection', !inspectsImplementation(workspace, transcripts), 'public contracts only; implementation inspection is not permitted'))
  if (choice.mode === 'recommend' || choice.mode === 'install') return gates
  const selected = composition(choice).filter(name => name !== 'focused-spec' && name !== '@focused-spec/scenarios-typescript')
  if (choice.cli) gates.push(await selectedContractsGate(workspace, transcripts, selected))
  if (codeSource(choice)) {
    gates.push(await executableSourceGate(workspace, choice), ...await executableBehaviorGates(workspace, choice))
  }
  if (choice.cli) {
    const loaded = await loadConfig(workspace)
    const discovery = loaded.config === undefined ? undefined : await discoverDocuments(workspace, loaded.config)
    const occurrences = discovery === undefined ? [] : [...discovery.scopes.values()].flat().flatMap(document => document.scenarios)
    const shape = loaded.config !== undefined && discovery?.violations.length === 0 && occurrences.length > 0
    gates.push(gate('integration-enrollment', shape, `normalized occurrences=${occurrences.length}; ${JSON.stringify(discovery?.violations ?? loaded.violations)}`))
    const strict = await focused(workspace, ['validate', '--strict'])
    const run = await focused(workspace, ['run'])
    gates.push(gate('focused-validation', strict.code === 0 && shape, strict.stdout + strict.stderr), gate('focused-execution', run.code === 0 && shape, run.stdout + run.stderr))
    if (!codeSource(choice) && occurrences.length === 1) gates.push(await mutationGate(workspace, { ...evalCase, prescribedScenarioId: occurrences[0]!.id, expectedEvidenceCount: 2, expectedSelectorFragments: ['TestBlockedAccount', 'test_blocked_account'] }, occurrences[0]!.scope, occurrences[0]!.id))
  }
  return gates
}
