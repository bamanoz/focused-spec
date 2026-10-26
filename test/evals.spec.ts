import { cp, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { glob } from 'glob'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentDriver, AgentRequest, AgentResult, EvalCase } from '../evals/types.ts'
import { runEval } from '../evals/harness.ts'
import { brownfieldGate, createGuidanceSession, guidanceActivationGate, integrityGate, judgeCompletedWorkspace, judgeProposalCheckpoint, judgeWorkingCheckpoint, mutationGate, registryPlacementGate, scenarioGate, skillActivationGate, snapshotProtectedFiles } from '../evals/judge.ts'
import { judgeEvidenceRepair } from '../evals/evidence-repair.ts'
import { specRevisionGate } from '../evals/spec-revision.ts'
import { evalCase } from '../evals/cases.ts'
import { provisionWorkspace } from '../evals/provision.ts'
import { runProcess } from '../evals/process.ts'
import { captureUpgradeBaseline, upgradeArtifactsGate, upgradePreservationGate } from '../evals/upgrade.ts'
import { executableBehaviorGates, executableSourceGate, inspectEstablishedComposition, integrationBoundaryGates, integrationFiles, integrationRoutingGate, selectedContractsGate } from '../evals/integration.ts'
import type { IntegrationBaseline } from '../evals/integration.ts'
import type { IntegrationCase } from '../evals/types.ts'

const roots: string[] = []
const repository = fileURLToPath(new URL('..', import.meta.url))
const WORKFLOW_GUIDANCE = '# Authoritative workflow\n\nFollow the installed package guidance.\n'

vi.mock('../evals/result.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../evals/result.ts')>()
  return {
    ...actual,
    async saveEvalResult(_directory: string, prefix: string, result: unknown) {
      const directory = await mkdtemp(join(tmpdir(), 'focused-eval-test-results-'))
      roots.push(directory)
      return actual.saveEvalResult(directory, prefix, result)
    },
  }
})
const change: EvalCase = {
  id: 'focused-test', description: 'deterministic gate fixture', source: 'openspec',
  changeName: 'add-auth', turns: [], prescribedScenarioId: 'auth.blocked',
  expectedEvidenceCount: 1, expectedSelectorFragments: ['target'],
}
const brownfieldChange: EvalCase = {
  ...change,
  id: 'openspec-brownfield',
  prescribedScenarioId: 'auth.login.blocked-account',
  expectedEvidenceCount: 2,
  expectedSelectorFragments: ['TestBlockedAccountWithValidCredentials', 'test_blocked_account_with_valid_credentials'],
}

async function put(root: string, path: string, source: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, source)
}

async function installFocusedPackage(root: string): Promise<void> {
  const packages = [
    ['core', 'focused-spec', ['guidance', 'skills']],
    ['formats/markdown', '@focused-spec/format-markdown', []],
    ['formats/inline', '@focused-spec/format-inline', []],
    ['formats/registry', '@focused-spec/format-registry', []],
    ['runners/go', '@focused-spec/runner-go', []],
    ['runners/pytest', '@focused-spec/runner-pytest', ['python']],
  ] as const
  await Promise.all(packages.map(async ([directory, name, assets]) => {
    const destination = join(root, 'node_modules', ...name.split('/'))
    await mkdir(destination, { recursive: true })
    await Promise.all([
      cp(join(repository, 'packages', directory, 'dist'), join(destination, 'dist'), { recursive: true }),
      cp(join(repository, 'packages', directory, 'package.json'), join(destination, 'package.json')),
      ...assets.map(asset => cp(join(repository, 'packages', directory, asset), join(destination, asset), { recursive: true })),
    ])
  }))
  for (const dependency of ['glob', 'minimatch', 'mdast-util-from-markdown', 'yaml']) {
    const link = join(root, 'node_modules', dependency)
    await mkdir(dirname(link), { recursive: true })
    await symlink(join(repository, 'node_modules', dependency), link, 'junction')
  }
}

function skillReadTranscript(options: { readonly complete?: boolean; readonly failed?: boolean; readonly path?: string } = {}): string {
  const callId = 'skill-read'
  const events: object[] = [{ type: 'tool_execution_start', toolName: 'read', toolCallId: callId,
    args: { path: options.path ?? 'skill://focused-spec' } }]
  if (options.complete !== false) events.push({ type: 'tool_execution_end', toolName: 'read', toolCallId: callId,
    isError: options.failed === true, result: { isError: options.failed === true, content: [{ type: 'text', text: 'loader' }] } })
  return events.map(event => JSON.stringify(event)).join('\n')
}

interface GuideTranscriptOptions {
  readonly command?: string
  readonly response?: unknown
  readonly rawOutput?: string
  readonly complete?: boolean
  readonly failed?: boolean
}

let guidanceCall = 0

function guidanceTranscript(workspace: string, options: GuideTranscriptOptions = {}): string {
  const callId = `workflow-guide-${guidanceCall++}`
  const cli = join(workspace, 'node_modules', 'focused-spec', 'dist', 'cli.js')
  const command = options.command ?? `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} instructions --protocol 1 --topic workflow --json`
  const response = options.response ?? {
    protocolVersion: 1,
    package: { name: 'focused-spec', version: '0.6.0' },
    topic: 'workflow',
    content: WORKFLOW_GUIDANCE,
  }
  const output = options.rawOutput ?? `${JSON.stringify(response)}\n\nWall time: 0.01 seconds`
  const events: object[] = [{ type: 'tool_execution_start', toolName: 'bash', toolCallId: callId, args: { command } }]
  if (options.complete !== false) events.push({ type: 'tool_execution_end', toolName: 'bash', toolCallId: callId,
    isError: options.failed === true, result: { isError: options.failed === true,
      content: [{ type: 'text', text: output }], details: { exitCode: options.failed === true ? 1 : 0 } } })
  return events.map(event => JSON.stringify(event)).join('\n')
}

interface ArtifactTranscriptOptions {
  readonly command?: string
  readonly artifact?: string
  readonly cliComplete?: boolean
  readonly cliFailed?: boolean
  readonly readComplete?: boolean
  readonly readFailed?: boolean
  readonly readBeforeCommand?: boolean
  readonly omitCommand?: boolean
  readonly response?: unknown
  readonly rawCliOutput?: string
  readonly rawArtifactOutput?: string
}

function artifactGuidanceTranscript(workspace: string, options: ArtifactTranscriptOptions = {}): string {
  const artifact = options.artifact ?? 'artifact://0'
  const linked = 'artifact://0'
  const cli = join(workspace, 'node_modules', 'focused-spec', 'dist', 'cli.js')
  const command = options.command ?? `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} instructions --protocol 1 --topic workflow --json`
  const response = options.response ?? {
    protocolVersion: 1,
    package: { name: 'focused-spec', version: '0.6.0' },
    topic: 'workflow',
    content: WORKFLOW_GUIDANCE,
  }
  const artifactOutput = options.rawArtifactOutput ?? JSON.stringify(response)
  const cliEvents: object[] = options.omitCommand === true ? [] : [
    { type: 'tool_execution_start', toolName: 'bash', toolCallId: 'artifact-cli', args: { command } },
    ...(options.cliComplete === false ? [] : [{ type: 'tool_execution_end', toolName: 'bash', toolCallId: 'artifact-cli',
      isError: options.cliFailed === true, result: { isError: options.cliFailed === true,
        content: [{ type: 'text', text: options.rawCliOutput ?? `{"protocolVersion":1,"package":{"name":"focused-spec","version":"0.6.0"},"topic":"workflow","content":"# Authoritative workflow…\n\n\nWall time: 0.36 seconds\n\n[Some lines truncated to 768 bytes. Read ${linked} for full output]` }],
        details: { exitCode: options.cliFailed === true ? 1 : 0 } } }]),
  ]
  const readEvents: object[] = [
    { type: 'tool_execution_start', toolName: 'read', toolCallId: 'artifact-read', args: { path: artifact } },
    ...(options.readComplete === false ? [] : [{ type: 'tool_execution_end', toolName: 'read', toolCallId: 'artifact-read',
      isError: options.readFailed === true, result: { isError: options.readFailed === true,
        content: [{ type: 'text', text: artifactOutput }] } }]),
  ]
  const events = options.readBeforeCommand === true ? [...readEvents, ...cliEvents] : [...cliEvents, ...readEvents]
  return events.map(event => JSON.stringify(event)).join('\n')
}

async function activationFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-eval-activation-'))
  roots.push(root)
  await Promise.all([
    put(root, 'node_modules/focused-spec/package.json', JSON.stringify({ name: 'focused-spec', version: '0.6.0' })),
    put(root, 'node_modules/focused-spec/dist/cli.js', '#!/usr/bin/env node\n'),
    put(root, 'node_modules/focused-spec/guidance/workflow.md', WORKFLOW_GUIDANCE),
  ])
  await mkdir(join(root, 'node_modules/.bin'), { recursive: true })
  await symlink('../focused-spec/dist/cli.js', join(root, 'node_modules/.bin/focused-spec'))
  return root
}

interface BrownfieldFixtureOptions {
  readonly mainEvidence?: readonly string[]
  readonly workingEvidence?: readonly string[]
}

const nativeBlockedScenario = [
  '#### Scenario: Blocked account with valid credentials',
  '- **WHEN** a blocked account supplies valid credentials to either authentication function',
  '- **THEN** authentication is rejected',
].join('\n')

const markedBlockedScenario = `<!-- focused-spec:id=auth.login.blocked-account -->\n${nativeBlockedScenario}`
const revisedBlockedSpec = [
  '# Account authentication', '', '<!-- focused-spec:id=auth.login.blocked-account -->',
  '#### Scenario: Blocked account with valid credentials',
  '- **WHEN** a blocked account supplies valid credentials',
  '- **THEN** authentication is rejected', '',
].join('\n')


function registry(mainScope: string, mainEvidence: readonly string[], workingEvidence: readonly string[]): string {
  const block = (scope: string, evidence: readonly string[]) => [
    `  ${scope}:`,
    '    auth.login.blocked-account:',
    '      evidence:',
    ...evidence.map(reference => `        - ${reference}`),
  ]
  return ['scopes:', ...block(mainScope, mainEvidence), ...block('add-auth', workingEvidence), ''].join('\n')
}

async function brownfieldFixture(options: BrownfieldFixtureOptions = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-eval-brownfield-'))
  roots.push(root)
  await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
  await installFocusedPackage(root)
  await put(root, '.focused-spec/config.yaml', [
    'version: 5',
    'specifications:',
    '  formats:',
    '    markdown:',
    "      package: '@focused-spec/format-registry'",
    '      options:',
    '        parser:',
    "          package: '@focused-spec/format-markdown'",
    '  documents:',
    '    - match: openspec/specs/**/spec.md',
    '      exclude:',
    '        - openspec/specs/excluded/**',
    '      scope: current',
    '      format: markdown',
    '    - match: openspec/changes/{scope}/specs/**/spec.md',
    '      exclude:',
    '        - openspec/changes/archive/**',
    '      format: markdown',
    'runners:',
    '  go:',
    "    package: '@focused-spec/runner-go'",
    '  pytest:',
    "    package: '@focused-spec/runner-pytest'",
    '    options:',
    '      command: uv',
    '      commandArgs: [run, --with, pytest, python]',
  ].join('\n'))
  const goTest = await readFile(join(root, 'auth/auth_test.go'), 'utf8')
  await put(root, 'auth/auth_test.go', goTest.replace('TestBlockedAccount', 'TestBlockedAccountWithValidCredentials'))
  const pytest = await readFile(join(root, 'tests/functional/test_auth.py'), 'utf8')
  await put(root, 'tests/functional/test_auth.py', pytest.replace('test_blocked_account', 'test_blocked_account_with_valid_credentials'))
  const overlay = join(repository, 'evals/cases/openspec-brownfield/overlay/openspec')
  const native = await readFile(join(overlay, 'specs/account-authentication/spec.md'), 'utf8')
  if (!native.includes(nativeBlockedScenario)) throw new Error('bare OpenSpec fixture lost its blocked-account scenario')
  await cp(join(overlay, 'changes/archive/2026-09-26-reject-blocked-accounts'),
    join(root, 'openspec/changes/archive/2026-09-26-reject-blocked-accounts'), { recursive: true })
  const expected = ['go::./auth::TestBlockedAccountWithValidCredentials', 'pytest::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials']
  const mainEvidence = options.mainEvidence ?? expected
  const workingEvidence = options.workingEvidence ?? expected
  await put(root, '.focused-spec/evidence.yaml', registry('current', mainEvidence, workingEvidence))
  await put(root, 'openspec/specs/account-authentication/spec.md', native.replace(nativeBlockedScenario, markedBlockedScenario))
  await put(root, 'openspec/changes/add-auth/specs/account-authentication/spec.md', [
    '## MODIFIED Requirements',
    '### Requirement: Account authentication respects blocked status',
    native.replace(nativeBlockedScenario, markedBlockedScenario),
  ].join('\n'))
  return root
}

async function boundaryFixture(packages: readonly string[], native: ReadonlyMap<string, string> = new Map(), config?: string): Promise<{ root: string; baseline: IntegrationBaseline }> {
  const root = await mkdtemp(join(tmpdir(), 'focused-eval-composition-'))
  roots.push(root)
  for (const name of packages) await put(root, `node_modules/${name}/package.json`, JSON.stringify({ name, version: '0.9.2' }))
  for (const [path, content] of native) await put(root, path, content)
  if (config !== undefined) await put(root, '.focused-spec/config.yaml', config)
  const candidates = new Map<string, ReadonlyMap<string, string>>()
  for (const name of packages) {
    const files = await glob('**/*', { cwd: join(root, 'node_modules', name), nodir: true })
    candidates.set(name, new Map(await Promise.all(files.map(async path => [path, createHash('sha256').update(await readFile(join(root, 'node_modules', name, path))).digest('hex')] as const))))
  }
  return { root, baseline: { files: await integrationFiles(root), protected: new Map(), candidates, native, packages: [...packages].sort(), establishedComposition: [...packages].sort(), ...(config === undefined ? {} : { config }) } }
}

async function bankFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-eval-bank-'))
  roots.push(root)
  await cp(join(repository, 'examples/scenarios/typescript'), root, { recursive: true, filter: path => !path.includes('node_modules') && !path.includes('.focused-spec') })
  const sdk = join(root, 'node_modules/@focused-spec/scenarios-typescript')
  await mkdir(sdk, { recursive: true })
  await cp(join(repository, 'packages/sdk/typescript/dist'), join(sdk, 'dist'), { recursive: true })
  await cp(join(repository, 'packages/sdk/typescript/package.json'), join(sdk, 'package.json'))
  return root
}

function configurationWrite(): string {
  return JSON.stringify({ type: 'tool_execution_start', toolName: 'write', toolCallId: 'configuration', args: { path: '.focused-spec/config.yaml', content: 'version: 5' } })
}

function contractTranscript(command: string, result: string, options: { complete?: boolean; failed?: boolean } = {}): string {
  const events: object[] = [{ type: 'tool_execution_start', toolName: 'bash', toolCallId: 'contract', args: { command } }]
  if (options.complete !== false) events.push({ type: 'tool_execution_end', toolName: 'bash', toolCallId: 'contract', isError: options.failed === true,
    result: { content: [{ type: 'text', text: result }], details: { exitCode: options.failed === true ? 1 : 0 } } })
  return events.map(event => JSON.stringify(event)).join('\n')
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})
class FakeDriver implements AgentDriver {
  async run(request: AgentRequest): Promise<AgentResult> {
    return {
      success: false,
      output: `fake agent rejected ${request.skills.join(',')}`,
      exitCode: 17,
      durationMs: 1,
    }
  }
}

describe('agent eval harness', () => {
  const checkpointRetirement = 'retains executed checkpoints after working identity and registry retire in place'
  let retirementFixture: { root: string; checkpoint: Awaited<ReturnType<typeof judgeWorkingCheckpoint>> }
  beforeEach(async ({ task }) => {
    if (task.name !== checkpointRetirement) return
    const root = await brownfieldFixture()
    const checkpoint = await judgeWorkingCheckpoint(root, brownfieldChange)
    expect(checkpoint.gates.filter(gate => !gate.passed)).toEqual([])
    retirementFixture = { root, checkpoint }
  })

  it('rejects unauthorized conversion of an existing integration', async () => {
    const choice: IntegrationCase = { source: 'inline', mode: 'revise', cli: true }
    const packages = ['focused-spec', '@focused-spec/format-inline', '@focused-spec/runner-go', '@focused-spec/runner-pytest']
    const config = JSON.stringify({ version: 5, specifications: { formats: { inline: { package: '@focused-spec/format-inline' } } } })
    const { root, baseline } = await boundaryFixture(packages, new Map([['specs/auth.md', '#### Scenario: Blocked\n- **ID**: `Opaque / Auth`\n- **EVIDENCE**: `go::target`\n- **WHEN** blocked\n- **THEN** rejected\n']]), config)
    expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-preserve-existing')).toMatchObject({ passed: true })
    await put(root, '.focused-spec/config.yaml', config.replace('format-inline', 'format-registry'))
    expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-preserve-existing')).toMatchObject({ passed: false })
    await put(root, '.focused-spec/config.yaml', config)
    await put(root, 'node_modules/@focused-spec/format-registry/package.json', '{"name":"@focused-spec/format-registry","version":"0.9.2"}')
    expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-preserve-existing')).toMatchObject({ passed: false })
  })

  it('requires completed local integration guidance for composition selection', async () => {
    const root = await activationFixture()
    const baseline: IntegrationBaseline = { files: await integrationFiles(root), protected: new Map(), candidates: new Map(), native: new Map(), packages: ['focused-spec'], establishedComposition: ['focused-spec'] }
    const choice: IntegrationCase = { source: 'typescript', mode: 'integrate', cli: false }
    const content = '# Integration\n\nInspect the project before selecting capabilities.\n'
    await put(root, 'node_modules/focused-spec/guidance/integration.md', content)
    const command = `${JSON.stringify(process.execPath)} ${JSON.stringify(join(root, 'node_modules/focused-spec/dist/cli.js'))} instructions --protocol 1 --topic integration --json`
    const response = { protocolVersion: 1, package: { name: 'focused-spec', version: '0.6.0' }, topic: 'integration', content }
    const accepted = guidanceTranscript(root, { command, response })
    expect(await integrationRoutingGate(root, [guidanceTranscript(root, {
      command: 'focused-spec instructions --protocol 1 --topic integration --json', response,
    })], choice, baseline)).toMatchObject({ passed: true })
    expect(await integrationRoutingGate(root, [accepted + '\n' + configurationWrite()], choice, baseline)).toMatchObject({ passed: true })
    const hydration = JSON.stringify({ type: 'tool_execution_start', toolName: 'bash', toolCallId: 'hydrate', args: { command: 'npm install' } })
    expect(await integrationRoutingGate(root, [hydration + '\n' + accepted], choice, baseline)).toMatchObject({ passed: true })
    const install = JSON.stringify({ type: 'tool_execution_start', toolName: 'bash', toolCallId: 'select-sdk', args: { command: 'npm install --save-dev @focused-spec/scenarios-typescript' } })
    expect(await integrationRoutingGate(root, [install + '\n' + accepted], choice, baseline)).toMatchObject({ passed: false })
    expect(await integrationRoutingGate(root, [accepted + '\n' + install], choice, baseline)).toMatchObject({ passed: true })
    await put(root, 'package.json', JSON.stringify({ devDependencies: { '@focused-spec/scenarios-typescript': '0.10.1' } }))
    await put(root, 'package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: { '': { devDependencies: { '@focused-spec/scenarios-typescript': '0.10.1' } } } }))
    expect(await integrationRoutingGate(root, [hydration + '\n' + accepted + '\n' + configurationWrite()], choice, baseline)).toMatchObject({ passed: true })
    for (const transcript of [
      guidanceTranscript(root, { command, response, complete: false }),
      guidanceTranscript(root, { command, response, failed: true }),
      guidanceTranscript(root, { command, response: { ...response, topic: 'workflow' } }),
      guidanceTranscript(root, { command, response: { ...response, package: { name: 'focused-spec', version: '0.5.0' } } }),
      guidanceTranscript(root, { command, response: { ...response, content: content.slice(0, 12) } }),
      configurationWrite() + '\n' + accepted,
    ]) expect(await integrationRoutingGate(root, [transcript], choice, baseline)).toMatchObject({ passed: false })
    const recovered = artifactGuidanceTranscript(root, { response }).replace('--topic workflow', '--topic integration')
    expect(await integrationRoutingGate(root, [recovered], choice, baseline)).toMatchObject({ passed: true })
  })

  it('distinguishes retained SDK composition from first selection', async () => {
    const project = await mkdtemp(join(tmpdir(), 'focused-eval-established-go-'))
    roots.push(project)
    await cp(join(repository, 'examples/scenarios/go'), project, { recursive: true, filter: path => !path.includes('node_modules') && !path.includes('.focused-spec') })
    await cp(join(repository, 'packages/sdk/go'), join(project, '.dependencies/scenarios-go'), { recursive: true })
    await put(project, 'go.mod', (await readFile(join(project, 'go.mod'), 'utf8')).replace('../../../packages/sdk/go', './.dependencies/scenarios-go'))
    const establishedComposition = await inspectEstablishedComposition(project, ['focused-spec'])
    const sdk = 'github.com/bamanoz/focused-spec/packages/sdk/go'
    expect(establishedComposition).toEqual(['focused-spec', sdk])

    const root = await activationFixture()
    const baseline: IntegrationBaseline = { files: await integrationFiles(root), protected: new Map(), candidates: new Map(), native: new Map(), packages: ['focused-spec'], establishedComposition }
    expect(await integrationRoutingGate(root, [], { source: 'go', mode: 'integrate', cli: false }, baseline)).toMatchObject({ passed: true })
    const absent = { ...baseline, establishedComposition: ['focused-spec'] }
    expect(await integrationRoutingGate(root, [], { source: 'go', mode: 'integrate', cli: false }, absent)).toMatchObject({ passed: false })
    expect(await integrationRoutingGate(root, [], { source: 'typescript', mode: 'integrate', cli: false }, absent)).toMatchObject({ passed: false })
    expect(await integrationRoutingGate(root, [], { source: 'go', mode: 'integrate', cli: true }, baseline)).toMatchObject({ passed: false })
    expect(await integrationRoutingGate(root, [], { source: 'go', mode: 'recommend', cli: false }, baseline)).toMatchObject({ passed: false })
  })

  it('treats an existing executable SDK suite as dependency repair rather than first SDK selection', async () => {
    const root = await activationFixture()
    const path = 'specifications/account.scenarios.mjs'
    await put(root, path, await readFile(join(repository, 'examples/scenarios/typescript', path), 'utf8'))
    const baseline: IntegrationBaseline = {
      files: await integrationFiles(root), protected: new Map(), candidates: new Map(), native: new Map(),
      packages: ['focused-spec'], establishedComposition: await inspectEstablishedComposition(root, ['focused-spec']),
    }
    const choice: IntegrationCase = { source: 'typescript', mode: 'author', cli: false }
    expect(await integrationRoutingGate(root, [], choice, baseline)).toMatchObject({ passed: true })
    expect(await integrationRoutingGate(root, [], { ...choice, cli: true }, baseline)).toMatchObject({ passed: false })

    await put(root, path, "// import { defineSuite } from '@focused-spec/scenarios-typescript';\nexport default {};\n")
    const unselected = { ...baseline, establishedComposition: await inspectEstablishedComposition(root, ['focused-spec']) }
    expect(await integrationRoutingGate(root, [], choice, unselected)).toMatchObject({ passed: false })
    expect(await integrationRoutingGate(root, [], choice, baseline)).toMatchObject({ passed: true })
  })

  it('rejects replacement of native acceptance items during integration', async () => {
    for (const source of ['openspec', 'spec-kit'] as const) {
      const path = source === 'openspec' ? 'openspec/specs/auth/spec.md' : 'specs/001-auth/spec.md'
      const native = source === 'openspec' ? '#### Scenario: Blocked account\n- **WHEN** valid credentials belong to a blocked account\n- **THEN** login is rejected\n'
        : '1. **Given** blocked status and valid credentials, **When** login is attempted, **Then** it is rejected.\n'
      const { root, baseline } = await boundaryFixture(['focused-spec'], new Map([[path, native]]))
      const choice: IntegrationCase = { source, mode: 'integrate', cli: true }
      await put(root, path, `<!-- focused-spec:id=Auth / Blocked -->\n${native}`)
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-native-source')).toMatchObject({ passed: true })
      await put(root, path, '#### Scenario: Blocked\n- **ID**: `replacement`\n- **EVIDENCE**: `go::target`\n- **WHEN** blocked\n- **THEN** rejected\n')
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-native-source')).toMatchObject({ passed: false })
    }
  })

  it('judges standalone compositions against the requested canonical source', async () => {
    const variants: readonly [IntegrationCase['source'], boolean, readonly string[]][] = [
      ['inline', true, ['focused-spec', '@focused-spec/format-inline', '@focused-spec/runner-go', '@focused-spec/runner-pytest']],
      ['typescript', false, ['focused-spec', '@focused-spec/scenarios-typescript']],
      ['typescript', true, ['focused-spec', '@focused-spec/scenarios-typescript', '@focused-spec/format-scenarios-typescript', '@focused-spec/runner-scenarios-typescript']],
      ['go', false, ['focused-spec']],
      ['go', true, ['focused-spec', '@focused-spec/format-scenarios-go', '@focused-spec/runner-scenarios-go']],
    ]
    for (const [source, cli, packages] of variants) {
      const choice: IntegrationCase = { source, cli, mode: 'integrate' }
      const { root, baseline } = await boundaryFixture(packages)
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-composition')).toMatchObject({ passed: true })
      await put(root, 'node_modules/@focused-spec/format-gherkin/package.json', '{"name":"@focused-spec/format-gherkin","version":"0.9.2"}')
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-composition')).toMatchObject({ passed: false })
      await rm(join(root, 'node_modules/@focused-spec/format-gherkin'), { recursive: true })
      if (!cli) {
        await put(root, '.focused-spec/config.yaml', 'version: 5\n')
        expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-composition')).toMatchObject({ passed: false })
      }
    }
  })

  it('rejects configuration writes during recommendation or installation only', async () => {
    for (const mode of ['recommend', 'install'] as const) {
      const { root, baseline } = await boundaryFixture(['focused-spec'])
      const choice: IntegrationCase = { source: 'inline', cli: false, mode }
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-phase-boundary')).toMatchObject({ passed: true })
      await put(root, '.omp/skills/focused-spec/SKILL.md', 'loader')
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-phase-boundary')).toMatchObject({ passed: mode === 'install' })
      await put(root, '.focused-spec/config.yaml', 'version: 5\n')
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-phase-boundary')).toMatchObject({ passed: false })
      await rm(join(root, '.focused-spec'), { recursive: true })
      await put(root, 'node_modules/@focused-spec/format-inline/package.json', '{"name":"@focused-spec/format-inline","version":"0.9.2"}')
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-phase-boundary')).toMatchObject({ passed: false })
    }
  })

  it('requires selected installed contracts before integration configuration', async () => {
    const root = await activationFixture()
    await installFocusedPackage(root)
    const names = ['@focused-spec/format-registry', '@focused-spec/format-markdown']
    const transcripts: string[] = []
    for (const name of names) {
      await put(root, `node_modules/${name}/README.md`, `# ${name}\n\nInstalled public authoring contract.\n`)
      const args = [join(root, 'node_modules/focused-spec/dist/cli.js'), 'plugin-docs', '--package', name, '--root', root, '--json']
      const result = await runProcess(process.execPath, args, { cwd: root, timeoutMs: 10_000 })
      expect(result.code, result.stderr).toBe(0)
      const command = [process.execPath, ...args].map(value => JSON.stringify(value)).join(' ')
      transcripts.push(contractTranscript(command, result.stdout))
      expect(await selectedContractsGate(root, [transcripts[0]!], names)).toMatchObject({ passed: false })
    }
    const complete = transcripts.join('\n')
    expect(await selectedContractsGate(root, [complete + '\n' + configurationWrite()], names)).toMatchObject({ passed: true })
    expect(await selectedContractsGate(root, [transcripts[0]! + '\n' + configurationWrite() + '\n' + transcripts[1]!], names)).toMatchObject({ passed: false })
    const altered = complete.replace('Installed public authoring contract.', 'stale contract')
    expect(await selectedContractsGate(root, [altered], names)).toMatchObject({ passed: false })
    expect(await selectedContractsGate(root, [complete.replaceAll('"exitCode":0', '"exitCode":1')], names)).toMatchObject({ passed: false })
    expect(await selectedContractsGate(root, [complete.split('\n').filter(line => JSON.parse(line).type !== 'tool_execution_end').join('\n')], names)).toMatchObject({ passed: false })
  })

  it('accepts complete selected contract artifact recovery before configuration writes', async () => {
    const root = await activationFixture()
    await installFocusedPackage(root)
    await put(root, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats:',
      '    inline:',
      "      package: '@focused-spec/format-inline'",
      '  documents:',
      '    - match: specs/**/*.md',
      '      scope: current',
      '      format: inline',
      'runners:',
      '  go:',
      "    package: '@focused-spec/runner-go'",
      '  pytest:',
      "    package: '@focused-spec/runner-pytest'",
    ].join('\n'))
    const selections = [
      { kind: 'format', selector: 'inline', name: '@focused-spec/format-inline', source: 'formats/inline', footer: 'raw', chain: false },
      { kind: 'runner', selector: 'go', name: '@focused-spec/runner-go', source: 'runners/go', footer: 'read', chain: false },
      { kind: 'runner', selector: 'pytest', name: '@focused-spec/runner-pytest', source: 'runners/pytest', footer: 'read', chain: true },
    ] as const
    type RecordedToolEvent = {
      type: 'tool_execution_start' | 'tool_execution_end'
      toolName: 'bash' | 'read'
      toolCallId: string
      args?: { command?: string; path?: string }
      isError?: boolean
      result?: { isError?: boolean; content: { type: 'text'; text: string }[]; details?: { exitCode: number } }
    }
    const recoveryEvents: RecordedToolEvent[] = []
    const responses = new Map<string, string>()
    for (const selection of selections) {
      await cp(join(repository, 'packages', selection.source, 'README.md'), join(root, 'node_modules', selection.name, 'README.md'))
      const args = ['plugin-docs', `--${selection.kind}`, selection.selector, '--root', root, '--json']
      const result = await runProcess(process.execPath, [join(root, 'node_modules/focused-spec/dist/cli.js'), ...args], { cwd: root, timeoutMs: 10_000 })
      expect(result.code, result.stderr).toBe(0)
      responses.set(selection.name, result.stdout)
      const commandId = `${selection.selector}-command`
      const firstArtifact = `artifact://${selection.selector}-preview`
      const finalArtifact = selection.chain ? `artifact://${selection.selector}-full` : firstArtifact
      const footer = selection.footer === 'raw'
        ? `[raw output: ${firstArtifact}]`
        : `[Some lines truncated to 768 bytes. Read ${firstArtifact} for full output]`
      recoveryEvents.push(
        { type: 'tool_execution_start', toolName: 'bash', toolCallId: commandId,
          args: { command: `focused-spec ${args.slice(0, -3).join(' ')} --root . --json` } },
        { type: 'tool_execution_end', toolName: 'bash', toolCallId: commandId,
          result: { content: [{ type: 'text', text: `{ "selection": "${selection.selector}", … }\n\n${footer}\n\nWall time: 0.12 seconds` }], details: { exitCode: 0 } } },
      )
      if (selection.chain) recoveryEvents.push(
        { type: 'tool_execution_start', toolName: 'read', toolCallId: `${selection.selector}-preview`, args: { path: firstArtifact } },
        { type: 'tool_execution_end', toolName: 'read', toolCallId: `${selection.selector}-preview`,
          result: { content: [{ type: 'text', text: `{ "selection": "${selection.selector}", … }\n\n[raw output: ${finalArtifact}]\n\nWall time: 0.04 seconds` }] } },
      )
      recoveryEvents.push(
        { type: 'tool_execution_start', toolName: 'read', toolCallId: `${selection.selector}-document`, args: { path: finalArtifact } },
        { type: 'tool_execution_end', toolName: 'read', toolCallId: `${selection.selector}-document`,
          result: { content: [{ type: 'text', text: `${result.stdout}\n\nWall time: 0.03 seconds` }] } },
      )
    }
    const names = selections.map(selection => selection.name)
    const writeEvent = JSON.parse(configurationWrite()) as Record<string, unknown>
    const complete = recoveryEvents.map(event => JSON.stringify(event)).join('\n')
    expect(await selectedContractsGate(root, [`${complete}\n${configurationWrite()}`], names)).toMatchObject({ passed: true })

    const pytestRead = recoveryEvents.findIndex(event => event.type === 'tool_execution_start' && event.toolCallId === 'pytest-document')
    const premature = [...recoveryEvents.slice(0, pytestRead), writeEvent, ...recoveryEvents.slice(pytestRead)]
    const wrong = recoveryEvents.map(event => event.type === 'tool_execution_start' && event.toolCallId === 'inline-document'
      ? { ...event, args: { path: 'artifact://unlinked' } }
      : event)
    const unfinished = recoveryEvents.filter(event => !(event.type === 'tool_execution_end' && event.toolCallId === 'go-document'))
    const failed = recoveryEvents.map(event => event.type === 'tool_execution_end' && event.toolCallId === 'go-document'
      ? { ...event, isError: true, result: { ...event.result!, isError: true, details: { exitCode: 1 } } }
      : event)
    const staleResponse = JSON.parse(responses.get('@focused-spec/runner-pytest')!) as { document: { content: string } }
    staleResponse.document.content = 'stale installed contract'
    const stale = recoveryEvents.map(event => event.type === 'tool_execution_end' && event.toolCallId === 'pytest-document'
      ? { ...event, result: { content: [{ type: 'text' as const, text: JSON.stringify(staleResponse) }] } }
      : event)
    for (const rejected of [premature, wrong, unfinished, failed, stale]) {
      expect(await selectedContractsGate(root, [rejected.map(event => JSON.stringify(event)).join('\n')], names)).toMatchObject({ passed: false })
    }
  })

  it('rejects duplicate behavioral sources beside executable scenarios', async () => {
    const root = await bankFixture()
    const choice: IntegrationCase = { source: 'typescript', mode: 'author', cli: false }
    expect(await executableSourceGate(root, choice)).toMatchObject({ passed: true })
    await put(root, 'specs/account.md', '#### Scenario: Withdraw entire balance\n- **THEN** withdrawal is allowed\n')
    expect(await executableSourceGate(root, choice)).toMatchObject({ passed: false })
    await rm(join(root, 'specs'), { recursive: true })
    await put(root, '.focused-spec/evidence/bank.yaml', 'scopes: {}\n')
    expect(await executableSourceGate(root, choice)).toMatchObject({ passed: false })
  })

  it('rejects executable evidence disconnected from the mutated application', async () => {
    const root = await bankFixture()
    const choice: IntegrationCase = { source: 'typescript', mode: 'author', cli: false }
    const path = 'specifications/account.driver.mjs'
    const original = await readFile(join(root, path), 'utf8')
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: true })
    await put(root, path, "import suite from './account.scenarios.mjs';\nexport default {given: x=>x, when: (_subject, command)=>structuredClone(suite.scenarios.find(item=>JSON.stringify(item.when)===JSON.stringify(command)).expect)};\n")
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, path, "export default {given: history=>history, when: (_subject, command)=>[{type:'MoneyWithdrawn', cents:command.cents}]};\n")
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, path, original)
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: true })
  })

  it('rejects observations that conceal the claimed application regression', async () => {
    const root = await bankFixture()
    const choice: IntegrationCase = { source: 'typescript', mode: 'author', cli: false }
    const suitePath = 'specifications/account.scenarios.mjs', driverPath = 'specifications/account.driver.mjs'
    const suite = await readFile(join(root, suitePath), 'utf8'), driver = await readFile(join(root, driverPath), 'utf8')
    await put(root, suitePath, "import {defineSuite} from '@focused-spec/scenarios-typescript';\nimport {Account} from '../src/account.mjs';\nconst given=[{type:'AccountOpened'},{type:'MoneyDeposited',cents:5000}], when={type:'WithdrawMoney',cents:5000};\nexport default defineSuite({driver:'./account.driver.mjs',scenarios:[{id:'account.withdraw.entire-balance',name:'Withdrawing the entire balance is allowed',given,when,expect:Account.from(given).handle(when)}]});\n")
    const derived = await executableBehaviorGates(root, choice)
    expect(derived.find(gate => gate.name === 'executable-independent-expectation')).toMatchObject({ passed: false })
    expect(derived.find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, suitePath, suite.replaceAll("expect: [{ type: 'MoneyWithdrawn', cents: 5000 }]", 'expect: []'))
    await put(root, driverPath, "import {Account} from '../src/account.mjs';\nexport default {given: history=>Account.from(history), when: (account, command)=>{account.handle(command); return []}};\n")
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, suitePath, suite); await put(root, driverPath, driver)
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: true })
  })

  it('rejects diagnostic success when selected behavioral comparison fails', async () => {
    const root = await bankFixture()
    const choice: IntegrationCase = { source: 'typescript', mode: 'author', cli: false }
    const path = 'specifications/account.driver.mjs', original = await readFile(join(root, path), 'utf8')
    await put(root, path, "import {Account} from '../src/account.mjs';\nexport default {given: history=>Account.from(history), when: (account, command, context)=>{context.explain('Withdrawal allowed and codec roundtrip passed'); account.handle(command); return []}};\n")
    const diagnostic = await executableBehaviorGates(root, choice)
    expect(diagnostic.find(gate => gate.name === 'executable-native-execution')).toMatchObject({ passed: false })
    expect(diagnostic.find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, path, "export default {given: value=>value, when: ()=>{throw new Error('runner setup failed')}};\n")
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, path, original)
    const wrapper = await readFile(join(root, 'test/account.node.mjs'), 'utf8')
    await put(root, 'test/account.node.mjs', wrapper.replace('test(scenario.name,', 'test.skip(scenario.name,'))
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, 'test/account.node.mjs', wrapper)
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: true })
  })

  it('rejects lost scope-local evidence and tampered upgrade artifacts', async () => {
    const selected = evalCase('project-upgrade')!
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-upgrade-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await cp(join(repository, 'evals', selected.overlay!), root, { recursive: true })
    await installFocusedPackage(root)
    const candidate = join(root, 'node_modules/focused-spec')
    const baseline = await captureUpgradeBaseline(root, candidate)
    await cp(join(candidate, 'skills/focused-spec'), join(root, '.omp/skills/focused-spec'), { recursive: true })
    await put(root, '.omp/commands/focused-spec.md', await readFile(join(candidate, 'skills/commands/oh-my-pi/focused-spec.md'), 'utf8'))
    for (const [path, source] of baseline.documents) {
      const migrated = source.replace(/go-unit::/gu, 'go::')
        .replace(/pytest-functional::/gu, 'pytest::')
        .replace(/^- \*\*REVISES\*\*:.*\n/gmu, '')
      await put(root, path, migrated)
    }
    const migratedConfig = [
      'version: 5',
      'specifications:',
      '  formats:',
      '    inline:',
      "      package: '@focused-spec/format-inline'",
      '  documents:',
      '    - match: specs/**/*.md',
      '      scope: current',
      '      exclude: [specs/archive/**]',
      '      format: inline',
      '    - match: changes/{scope}/spec.md',
      '      exclude: [changes/archive/**]',
      '      format: inline',
      'runners:',
      '  go:',
      "    package: '@focused-spec/runner-go'",
      '    timeoutMs: 120000',
      '  pytest:',
      "    package: '@focused-spec/runner-pytest'",
      '    timeoutMs: 120000',
      '    options:',
      '      command: uv',
      '      commandArgs: [run, --with, pytest, python]',
      'execution:',
      '  maxConcurrentGroups: 1',
    ].join('\n')
    await put(root, '.focused-spec/config.yaml', migratedConfig)
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as Record<string, unknown>
    manifest.devDependencies = {
      'focused-spec': '0.9.1',
      '@focused-spec/format-inline': '0.9.1',
      '@focused-spec/runner-go': '0.9.1',
      '@focused-spec/runner-pytest': '0.9.1',
    }
    await put(root, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`)
    const preservedUpgrade = await upgradePreservationGate(root, baseline)
    expect(preservedUpgrade, preservedUpgrade.detail).toMatchObject({ passed: true })
    expect(await upgradeArtifactsGate(root, baseline)).toMatchObject({ passed: true })

    const readme = await readFile(join(root, 'README.md'), 'utf8')
    await put(root, 'README.md', `${readme}\nUse the updated project-local focused-spec CLI to validate and run evidence.\n`)
    expect(await upgradePreservationGate(root, baseline)).toMatchObject({ passed: true })
    await put(root, 'README.md', '# Replacement overview\n')
    expect(await upgradePreservationGate(root, baseline)).toMatchObject({ passed: false })
    await put(root, 'README.md', readme)

    const refresh = await readFile(join(root, 'changes/refresh/spec.md'), 'utf8')
    await rm(join(root, 'changes/refresh/spec.md'))
    const validButLost = await runProcess(process.execPath, [join(candidate, 'dist/cli.js'), 'validate', '--syntax-only', '--json'], { cwd: root, timeoutMs: 30_000 })
    expect(validButLost.code, validButLost.stderr || validButLost.stdout).toBe(0)
    expect(await upgradePreservationGate(root, baseline)).toMatchObject({ passed: false })
    await put(root, 'changes/refresh/spec.md', refresh.replace('auth.login.blocked-account', 'auth.login.active-account'))
    expect(await upgradePreservationGate(root, baseline)).toMatchObject({ passed: false })
    await put(root, 'changes/refresh/spec.md', refresh)
    const native = await readFile(join(root, 'specs/account-authentication.md'), 'utf8')
    await put(root, 'specs/account-authentication.md', native.replace('- **EVIDENCE**: `pytest::tests/functional/test_auth.py::test_blocked_account`\n', ''))
    expect(await upgradePreservationGate(root, baseline)).toMatchObject({ passed: false })
    await put(root, 'specs/account-authentication.md', native.replace('authentication is rejected', 'authentication succeeds'))
    expect(await upgradePreservationGate(root, baseline)).toMatchObject({ passed: false })
    await put(root, 'specs/account-authentication.md', native)
    await put(root, '.focused-spec/config.yaml', migratedConfig.replace('maxConcurrentGroups: 1', 'maxConcurrentGroups: 2'))
    expect(await upgradePreservationGate(root, baseline)).toMatchObject({ passed: false })
    await put(root, '.focused-spec/config.yaml', migratedConfig)
    const cliSource = await readFile(join(candidate, 'dist/cli.js'), 'utf8')
    await put(root, 'node_modules/focused-spec/dist/cli.js', cliSource + '\n// tampered\n')
    expect(await upgradeArtifactsGate(root, baseline)).toMatchObject({ passed: false })
    await put(root, 'node_modules/focused-spec/dist/cli.js', cliSource)
    await put(root, '.omp/skills/focused-spec/references/runners.md', 'stale legacy procedure')
    expect(await upgradeArtifactsGate(root, baseline)).toMatchObject({ passed: false })
    await rm(join(root, '.omp/skills/focused-spec/references'), { recursive: true })
    expect(await upgradeArtifactsGate(root, baseline)).toMatchObject({ passed: true })
    expect(await upgradePreservationGate(root, baseline)).toMatchObject({ passed: true })
  })

  it('accepts an inline upgrade retaining compatible runner IDs and rejects selector loss', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-retained-runners-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await cp(join(repository, 'evals/cases/project-upgrade/overlay'), root, { recursive: true })
    await installFocusedPackage(root)
    const candidate = join(root, 'node_modules/focused-spec')
    const baseline = await captureUpgradeBaseline(root, candidate)
    await cp(join(candidate, 'skills/focused-spec'), join(root, '.omp/skills/focused-spec'), { recursive: true })
    await put(root, '.omp/commands/focused-spec.md', await readFile(join(candidate, 'skills/commands/oh-my-pi/focused-spec.md'), 'utf8'))
    const configPath = '.focused-spec/config.yaml'
    const legacy = await readFile(join(root, configPath), 'utf8')
    await put(root, configPath, legacy.replace('version: 2', 'version: 5')
      .replace('specifications:\n', "specifications:\n  formats:\n    inline: { package: '@focused-spec/format-inline' }\n")
      .replace(/(    - match: [^\n]+\n)/gu, '$1      format: inline\n'))
    for (const [path, source] of baseline.documents) await put(root, path, source.replace(/^- \*\*REVISES\*\*:.*\n/gmu, ''))
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as Record<string, unknown>
    manifest.devDependencies = { 'focused-spec': '0.9.1', '@focused-spec/format-inline': '0.9.1' }
    await put(root, 'package.json', JSON.stringify(manifest))
    await rm(join(root, 'node_modules/@focused-spec/runner-go'), { recursive: true })
    await rm(join(root, 'node_modules/@focused-spec/runner-pytest'), { recursive: true })
    const preserved = await upgradePreservationGate(root, baseline)
    expect(preserved.passed, preserved.detail).toBe(true)
    expect((await upgradeArtifactsGate(root, baseline)).passed).toBe(true)
    const path = 'changes/refresh/spec.md'
    const source = await readFile(join(root, path), 'utf8')
    await put(root, path, source.replace('TestBlockedAccount', 'TestValidActiveAccount'))
    expect((await upgradePreservationGate(root, baseline)).passed).toBe(false)
  })
  it('rejects domain reorganization and loss of existing registrations despite valid new evidence', async () => {
    const selected = evalCase('registry-shards-reuse')!
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-shards-'))
    roots.push(root)
    await cp(join(repository, 'evals', selected.overlay!), root, { recursive: true })
    const path = '.focused-spec/evidence/auth.yaml'
    const initial = await readFile(join(root, path), 'utf8')
    const entry = '  current:\n    auth.login.blocked:\n      evidence:\n        - go::./auth::TestBlockedAccount\n        - pytest::tests/functional/test_auth.py::test_blocked_account\n'
    await put(root, path, initial + entry)
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: true })
    await put(root, path, `scopes:\n${entry}`)
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: false })
    await put(root, path, initial)
    await put(root, '.focused-spec/evidence/blocked.yaml', `scopes:\n${entry}`)
    const config = await readFile(join(root, '.focused-spec/config.yaml'), 'utf8')
    await put(root, '.focused-spec/config.yaml', config.replace('          - .focused-spec/evidence/auth.yaml', '          - .focused-spec/evidence/auth.yaml\n          - .focused-spec/evidence/blocked.yaml'))
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: false })
  })

  it('requires explicit new-domain composition and protects unrelated infrastructure', async () => {
    const selected = evalCase('registry-shards-new-boundary')!
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-new-shard-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await cp(join(repository, 'evals', selected.overlay!), root, { recursive: true })
    const protectedFiles = await snapshotProtectedFiles(root, selected.editablePaths)
    const config = await readFile(join(root, '.focused-spec/config.yaml'), 'utf8')
    const entry = 'scopes:\n  current:\n    auth.login.blocked:\n      evidence:\n        - go::./auth::TestBlockedAccount\n        - pytest::tests/functional/test_auth.py::test_blocked_account\n'
    await put(root, '.focused-spec/evidence/login.yaml', entry)
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: false })
    await put(root, '.focused-spec/config.yaml', config.replace('          - .focused-spec/evidence/notifications.yaml', '          - .focused-spec/evidence/notifications.yaml\n          - .focused-spec/evidence/login.yaml'))
    const composedPlacement = await registryPlacementGate(root, selected, 'auth.login.blocked')
    expect(composedPlacement, composedPlacement.detail).toMatchObject({ passed: true })
    await put(root, '.focused-spec/evidence.yaml', entry)
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: false })
    await rm(join(root, '.focused-spec/evidence.yaml'))
    await put(root, 'app/notifications.py', 'def should_deliver(enabled):\n    return True\n')
    expect(await integrityGate(root, protectedFiles, [])).toMatchObject({ passed: false })
    await put(root, '.focused-spec/config.yaml', config.replace('          - .focused-spec/evidence/notifications.yaml', '          - .focused-spec/evidence/notifications.yaml\n          - .focused-spec/evidence/login.yaml').replace('@focused-spec/runner-go', '@focused-spec/fabricated'))
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: false })
  })

  it('provisions parallel workspaces without rebuilding shared distribution', async () => {
    const selected = evalCase('files-source-bootstrap')!
    const distribution = join(repository, 'packages/core/dist/cli.js')
    const before = await stat(distribution)
    const workspaces = await Promise.all([provisionWorkspace(selected), provisionWorkspace(selected)])
    try {
      const results = await Promise.all(workspaces.map(workspace => runProcess(process.execPath,
        [join(workspace.path, 'node_modules/focused-spec/dist/cli.js'), '--help'], { cwd: workspace.path, timeoutMs: 30_000 })))
      expect(results.map(result => result.code)).toEqual([0, 0])
      expect((await stat(distribution)).mtimeMs).toBe(before.mtimeMs)
      await workspaces[0]!.cleanup()
      const survivor = workspaces[1]!
      const result = await runProcess(process.execPath, [join(survivor.path, 'node_modules/focused-spec/dist/cli.js'), '--help'], { cwd: survivor.path, timeoutMs: 30_000 })
      expect(result.code).toBe(0)
    } finally {
      await Promise.all(workspaces.map(workspace => workspace.cleanup()))
    }
  }, 120_000)

  it('judges working evidence before sync removes its discovery', async () => {
    const root = await brownfieldFixture()
    const checkpoint = await judgeWorkingCheckpoint(root, brownfieldChange)
    expect(checkpoint.gates.map(gate => gate.passed)).toEqual([true, true])
    const configPath = join(root, '.focused-spec/config.yaml')
    const config = (await readFile(configPath, 'utf8')).replace('scope: current', 'scope: published')
      .replace('    - match: openspec/changes/{scope}/specs/**/spec.md\n      exclude:\n        - openspec/changes/archive/**\n      format: markdown\n', '')
    await put(root, '.focused-spec/config.yaml', config)
    const registryPath = join(root, '.focused-spec/evidence.yaml')
    await put(root, '.focused-spec/evidence.yaml', (await readFile(registryPath, 'utf8')).replace('  current:', '  published:'))
    const gates = await brownfieldGate(root, brownfieldChange, checkpoint)
    expect(gates.map(gate => gate.passed), JSON.stringify(gates)).toEqual([true, true, true])
    await rm(join(root, 'openspec/changes/add-auth'), { recursive: true, force: true })
    expect((await brownfieldGate(root, brownfieldChange, checkpoint)).map(gate => gate.passed)).toEqual([true, true, true])
    expect(await brownfieldGate(root, brownfieldChange)).toEqual([expect.objectContaining({ name: 'brownfield-contract', passed: false })])
    await put(root, '.focused-spec/evidence.yaml', (await readFile(registryPath, 'utf8')).replace('go::./auth', 'go::./changed'))
    expect((await brownfieldGate(root, brownfieldChange, checkpoint)).find(gate => gate.name === 'transition-stable-evidence')).toMatchObject({ passed: false })
    await rm(join(root, 'openspec/changes/archive/2026-09-26-reject-blocked-accounts'), { recursive: true, force: true })
    expect(await brownfieldGate(root, brownfieldChange, checkpoint)).toEqual([
      expect.objectContaining({ name: 'native-history-preservation', passed: false, detail: expect.stringContaining('missing') }),
    ])
  }, 60_000)

  it('checkpoints and publishes the configured working scope rather than the change name', async () => {
    const root = await brownfieldFixture()
    const configPath = join(root, '.focused-spec/config.yaml')
    const config = (await readFile(configPath, 'utf8')).replace('openspec/changes/{scope}/specs/**/spec.md', 'openspec/changes/add-auth/specs/**/spec.md')
      .replace('        - openspec/changes/archive/**\n      format: markdown', '        - openspec/changes/archive/**\n      scope: working\n      format: markdown')
    await put(root, '.focused-spec/config.yaml', config)
    await put(root, '.focused-spec/evidence.yaml', (await readFile(join(root, '.focused-spec/evidence.yaml'), 'utf8')).replace('  add-auth:', '  working:'))
    const checkpoint = await judgeWorkingCheckpoint(root, brownfieldChange)
    expect(checkpoint.gates.map(item => item.passed)).toEqual([true, true])
    expect(checkpoint.evidence).toMatchObject({ scope: 'working', id: 'auth.login.blocked-account', representation: 'registry' })
    const liveGates = await brownfieldGate(root, brownfieldChange, checkpoint)
    expect(liveGates.map(item => item.passed), JSON.stringify(liveGates)).toEqual([true, true, true])
    await put(root, '.focused-spec/config.yaml', config.replace('    - match: openspec/changes/add-auth/specs/**/spec.md\n      exclude:\n        - openspec/changes/archive/**\n      scope: working\n      format: markdown\n', ''))
    await rm(join(root, 'openspec/changes/add-auth'), { recursive: true })
    const retiredGates = await brownfieldGate(root, brownfieldChange, checkpoint)
    expect(retiredGates.map(item => item.passed), JSON.stringify(retiredGates)).toEqual([true, true, true])
  }, 60_000)

  it('preserves inline evidence through revision and publication', async () => {
    const selected = evalCase('inline-lifecycle')!
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-inline-lifecycle-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await cp(join(repository, 'evals', selected.overlay!), root, { recursive: true, force: true })
    await installFocusedPackage(root)
    await put(root, '.focused-spec/config.yaml', [
      'version: 5', 'specifications:', '  formats:', '    inline:',
      "      package: '@focused-spec/format-inline'", '  documents:',
      '    - match: openspec/specs/account-authentication/spec.md', '      scope: current', '      format: inline',
      '    - match: openspec/changes/revise-inline-blocked-account/specs/**/spec.md',
      '      scope: working', '      format: inline', 'runners:',
      '  go:', "    package: '@focused-spec/runner-go'", '  pytest:',
      "    package: '@focused-spec/runner-pytest'", '    options:',
      '      command: uv', '      commandArgs: [run, --with, pytest, python]',
    ].join('\n'))
    const id = selected.prescribedScenarioId!
    const evidence = [
      'go::./auth::TestBlockedAccountWithValidCredentials',
      'pytest::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials',
    ]
    const metadata = [`- **ID**: \`${id}\``, ...evidence.map(reference => `- **EVIDENCE**: \`${reference}\``)].join('\n')
    const workingPath = 'openspec/changes/revise-inline-blocked-account/specs/account-authentication/spec.md'
    const working = await readFile(join(root, workingPath), 'utf8')
    await put(root, workingPath, working.replace('#### Scenario: Administrative block overrides valid credentials\n', `#### Scenario: Administrative block overrides valid credentials\n${metadata}\n`))
    const checkpoint = await judgeWorkingCheckpoint(root, selected)
    expect(checkpoint.gates.every(gate => gate.passed), JSON.stringify(checkpoint.gates)).toBe(true)
    expect(checkpoint.evidence).toMatchObject({ scope: 'working', id, evidence, representation: 'inline' })

    const mainPath = 'openspec/specs/account-authentication/spec.md'
    const main = await readFile(join(root, mainPath), 'utf8')
    const original = [
      '#### Scenario: Blocked account with valid credentials',
      `- **ID**: \`${id}\``,
      ...evidence.map(reference => `- **EVIDENCE**: \`${reference}\``),
      '- **WHEN** a blocked account supplies valid credentials to either authentication function',
      '- **THEN** authentication is rejected',
    ].join('\n')
    const revised = [
      '#### Scenario: Administrative block overrides valid credentials', metadata,
      '- **WHEN** an administratively blocked account supplies otherwise valid credentials to either authentication function',
      '- **THEN** authentication is rejected before an authenticated session can be created',
    ].join('\n')
    await put(root, mainPath, main.replace(original, revised))
    await rm(join(root, 'openspec/changes/revise-inline-blocked-account'), { recursive: true, force: true })
    await put(root, '.focused-spec/config.yaml', (await readFile(join(root, '.focused-spec/config.yaml'), 'utf8'))
      .replace("    - match: openspec/changes/revise-inline-blocked-account/specs/**/spec.md\n      scope: working\n      format: inline\n", ''))
    const completedScenario = await scenarioGate(root, selected, 'current', id)
    const sensitivity = await mutationGate(root, selected, 'current', id)
    const native = await runProcess('openspec', ['validate', '--specs', '--strict', '--no-interactive'], { cwd: root, timeoutMs: 30_000 })
    expect({ scenario: completedScenario.passed, mutation: sensitivity.passed, native: native.code },
      JSON.stringify({ completedScenario, sensitivity, native })).toEqual({ scenario: true, mutation: true, native: 0 })


    const gates = await brownfieldGate(root, selected, checkpoint, id)
    expect(gates.map(gate => ({ name: gate.name, passed: gate.passed }))).toEqual([
      { name: 'native-history-preservation', passed: true },
      { name: 'main-scope-evidence', passed: true },
      { name: 'transition-stable-evidence', passed: true },
    ])
  }, 120_000)

  it('rejects ambiguous configured working scopes and a changed checkpoint identity', async () => {
    const root = await brownfieldFixture()
    const config = await readFile(join(root, '.focused-spec/config.yaml'), 'utf8')
    const explicit = '    - match: openspec/changes/add-auth/specs/**/spec.md\n      scope: working\n      format: markdown\n'
    await put(root, '.focused-spec/config.yaml', config.replace('runners:', `${explicit}runners:`))
    expect((await judgeWorkingCheckpoint(root, brownfieldChange)).gates.some(item => !item.passed)).toBe(true)
    await put(root, '.focused-spec/config.yaml', config)
    expect((await judgeWorkingCheckpoint(root, brownfieldChange, 'different.identity')).gates.some(item => !item.passed)).toBe(true)
  }, 60_000)

  it('stops before sync when working evidence fails', async () => {
    let turns = 0
    const driver: AgentDriver = {
      async run(request) {
        turns += 1
        await put(request.workspace, '.focused-spec/config.yaml', [
          'version: 5', 'specifications:', '  formats:', '    markdown:',
          "      package: '@focused-spec/format-registry'", '      options:', '        parser:',
          "          package: '@focused-spec/format-markdown'", '  documents:',
          '    - match: openspec/changes/{scope}/specs/**/spec.md',
          '      exclude: [openspec/changes/archive/**]', '      format: markdown', 'runners:',
          "  go: { package: '@focused-spec/runner-go' }",
          "  pytest: { package: '@focused-spec/runner-pytest', options: { command: uv, commandArgs: [run, --with, pytest, python] } }",
        ].join('\n'))
        await put(request.workspace, '.focused-spec/evidence.yaml', [
          'scopes:', '  link-blocked-auth-evidence:', '    auth.login.blocked-account:', '      evidence:',
          '        - go::./auth::TestBlockedAccountWithValidCredentials',
          '        - pytest::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials',
        ].join('\n'))
        await put(request.workspace, 'app/auth.py', 'def authenticate(blocked: bool, credentials_valid: bool) -> bool:\n    return credentials_valid\n')
        const workflow = await readFile(join(request.workspace, 'node_modules/focused-spec/guidance/workflow.md'), 'utf8')
        const metadata = JSON.parse(await readFile(join(request.workspace, 'node_modules/focused-spec/package.json'), 'utf8')) as { name: string; version: string }
        const response = { protocolVersion: 1, package: { name: metadata.name, version: metadata.version }, topic: 'workflow', content: workflow }
        return { success: true, output: `${skillReadTranscript()}\n${guidanceTranscript(request.workspace, { response })}`, exitCode: 0, durationMs: 1 }
      },
    }
    const result = await runEval({ caseId: 'openspec-brownfield', openspecSkillsDir: join(repository, '.omp/skills') }, driver)
    expect(turns).toBe(1)
    expect(result.passed).toBe(false)
    expect(result.gates.find(gate => gate.name === 'working-execution')).toMatchObject({ passed: false })
    expect(result.gates.some(gate => gate.name === 'main-scope-evidence')).toBe(false)
  }, 120_000)

  it('recognizes SDK dependency repair without requiring integration reading while rejecting false-green evidence', async () => {
    const driver = (repair: boolean): AgentDriver => ({
      async run(request) {
        const packages = await glob('../packages/focused-spec-scenarios-typescript-*.tgz', { cwd: request.workspace, absolute: true })
        if (packages.length !== 1) throw new Error('expected one independently packed scenario SDK')
        const installed = await runProcess('npm', ['install', '--prefer-offline', '--save-dev', '--ignore-scripts', '--no-audit', '--no-fund', packages[0]!], { cwd: request.workspace, timeoutMs: 120_000 })
        if (installed.code !== 0) throw new Error(installed.stderr)
        if (repair) await cp(join(repository, 'examples/scenarios/typescript/specifications/account.driver.mjs'), join(request.workspace, 'specifications/account.driver.mjs'))
        const content = await readFile(join(request.workspace, 'node_modules/focused-spec/guidance/workflow.md'), 'utf8')
        const metadata = JSON.parse(await readFile(join(request.workspace, 'node_modules/focused-spec/package.json'), 'utf8')) as { name: string; version: string }
        const response = { protocolVersion: 1, package: { name: metadata.name, version: metadata.version }, topic: 'workflow', content }
        return { success: true, output: `${skillReadTranscript()}\n${guidanceTranscript(request.workspace, { response })}`, exitCode: 0, durationMs: 1 }
      },
    })
    const repaired = await runEval({ caseId: 'executable-authoring-sdk' }, driver(true))
    expect(repaired.gates.filter(gate => !gate.passed)).toEqual([])
    expect(repaired.passed).toBe(true)
    expect(repaired.observations).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'focused-integration-acquired', passed: true })]))
    const falseGreen = await runEval({ caseId: 'executable-authoring-sdk' }, driver(false))
    expect(falseGreen.passed).toBe(false)
    expect(falseGreen.gates.find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    expect(falseGreen.observations).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'focused-integration-acquired', passed: true })]))
  }, 180_000)

  it('records a failed agent turn without running downstream judges', async () => {
    const result = await runEval({ caseId: 'files-source-bootstrap' }, new FakeDriver())
    expect(result.passed).toBe(false)
    expect(result.gates.find(gate => gate.name === 'agent-turn-1')).toMatchObject({ passed: false })
    expect(result.gates.some(gate => gate.name === 'focused-validation')).toBe(false)
    expect(result.diagnostic).toMatchObject({ status: 'unavailable' })
  }, 30_000)

  it('keeps post-failure recommendations outside scored agent turns', async () => {
    const driver: AgentDriver = {
      async run(request) {
        if (request.resume !== undefined) {
          if (await readFile(request.resume, 'utf8') !== 'the failed authoring session') throw new Error('wrong authoring session')
          const answers = [
            'Clarify the verification boundary; do not relabel the failed turn.',
            'Those todos belong to the terminated scored task, not the current research interview.',
          ]
          return { success: true, output: answers.map(text => JSON.stringify({ type: 'message_end',
            message: { role: 'assistant', content: [{ type: 'text', text }] } })).join('\n'), exitCode: 0, durationMs: 2 }
        }
        if (request.sessionDir === undefined) throw new Error('missing authoring session')
        await put(request.sessionDir, 'authoring.jsonl', 'the failed authoring session')
        return { success: false, output: '', exitCode: 17, durationMs: 1 }
      },
    }
    const result = await runEval({ caseId: 'files-source-bootstrap' }, driver)
    expect(result.passed).toBe(false)
    expect(result.turns).toMatchObject([{ success: false, exitCode: 17 }])
    expect(result.turns).toHaveLength(1)
    expect(result.gates.find(gate => gate.name === 'agent-turn-1')).toMatchObject({ passed: false })
    expect(result.gates.some(gate => gate.name === 'focused-validation')).toBe(false)
    expect(result.diagnostic).toMatchObject({ status: 'answered', answer: expect.stringContaining('verification boundary') })
  }, 30_000)

  it('retains the failed score when the research interview cannot complete', async () => {
    const driver: AgentDriver = {
      async run(request) {
        if (request.resume !== undefined) throw new Error('research transport unavailable')
        if (request.sessionDir === undefined) throw new Error('missing authoring session')
        await put(request.sessionDir, 'authoring.jsonl', 'the failed authoring session')
        return { success: false, output: '', exitCode: 17, durationMs: 1 }
      },
    }
    const result = await runEval({ caseId: 'files-source-bootstrap' }, driver)
    expect(result.passed).toBe(false)
    expect(result.turns).toMatchObject([{ success: false, exitCode: 17 }])
    expect(result.gates.find(gate => gate.name === 'agent-turn-1')).toMatchObject({ passed: false })
    expect(result.diagnostic).toMatchObject({ status: 'unavailable', detail: expect.stringContaining('research transport unavailable') })
  }, 30_000)

  it('rejects agent turns that never load the focused-spec skill', () => {
    expect(skillActivationGate(skillReadTranscript({ path: 'skill://openspec-propose' }))).toMatchObject({ passed: false })
    expect(skillActivationGate(skillReadTranscript({ path: 'skill://focused-spec/references/runners.md' }))).toMatchObject({ passed: false })
    expect(skillActivationGate(skillReadTranscript({ complete: false }))).toMatchObject({ passed: false })
    expect(skillActivationGate(skillReadTranscript({ failed: true }))).toMatchObject({ passed: false })
    expect(skillActivationGate(skillReadTranscript())).toMatchObject({ passed: true })
  })

  it('requires completed local workflow guidance after loader activation', async () => {
    const root = await activationFixture()
    expect(skillActivationGate(skillReadTranscript())).toMatchObject({ passed: true })
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { complete: false })])).toMatchObject({ passed: false })
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { failed: true })])).toMatchObject({ passed: false })
    expect(await guidanceActivationGate(root, [guidanceTranscript(root)])).toMatchObject({
      name: 'focused-workflow-acquired', passed: true,
    })
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root)])).toMatchObject({ passed: true })
    const rawCliOutput = '{"protocolVersion":1,"content":"# Workflow…[+5931]\n[raw output: artifact://0]\n\n\nWall time: 0.21 seconds'
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root, { rawCliOutput })])).toMatchObject({ passed: true })
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root, { rawCliOutput, readComplete: false })])).toMatchObject({ passed: false })
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root, { rawCliOutput, artifact: 'artifact://1' })])).toMatchObject({ passed: false })
    for (const transcript of [
      artifactGuidanceTranscript(root, { artifact: 'artifact://1' }),
      artifactGuidanceTranscript(root, { readBeforeCommand: true }),
      artifactGuidanceTranscript(root, { cliComplete: false }),
      artifactGuidanceTranscript(root, { cliFailed: true }),
      artifactGuidanceTranscript(root, { readComplete: false }),
      artifactGuidanceTranscript(root, { readFailed: true }),
      artifactGuidanceTranscript(root, { omitCommand: true }),
      artifactGuidanceTranscript(root, { rawArtifactOutput: '{"protocolVersion":1}' }),
      artifactGuidanceTranscript(root, { response: { protocolVersion: 1, package: { name: 'focused-spec', version: '0.6.0' },
        topic: 'workflow', content: '# Wrong workflow' } }),
    ]) expect(await guidanceActivationGate(root, [transcript])).toMatchObject({ passed: false })
  })

  it('resolves guidance with the evaluated driver executable search path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-driver-path-'))
    roots.push(root)
    await installFocusedPackage(root)
    await mkdir(join(root, 'node_modules/.bin'), { recursive: true })
    await symlink('../focused-spec/dist/cli.js', join(root, 'node_modules/.bin/focused-spec'))
    const args = ['instructions', '--protocol', '1', '--topic', 'workflow', '--json']
    const result = await runProcess('focused-spec', args, { cwd: root, timeoutMs: 30_000,
      env: { ...process.env, PATH: `${join(root, 'node_modules/.bin')}${delimiter}${process.env.PATH ?? ''}` } })
    expect(result.code).toBe(0)
    const response: unknown = JSON.parse(result.stdout)
    const command = `focused-spec ${args.join(' ')}`
    const transcript = artifactGuidanceTranscript(root, { response, command })
    expect(await guidanceActivationGate(root, [transcript])).toMatchObject({ passed: true })
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root, { response, command, artifact: 'artifact://1' })])).toMatchObject({ passed: false })
    const localNpx = `npx --no-install focused-spec ${args.join(' ')}`
    const npmResult = await runProcess('npx', ['--no-install', 'focused-spec', ...args], {
      cwd: root, timeoutMs: 30_000, env: { ...process.env, npm_config_offline: 'true' },
    })
    expect(npmResult.code, npmResult.stderr).toBe(0)
    const npmResponse: unknown = JSON.parse(npmResult.stdout)
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root, { response: npmResponse, command: localNpx })])).toMatchObject({ passed: true })
    for (const command of [localNpx.replace('--no-install ', ''), localNpx.replace('focused-spec ', 'focused-spec@latest '), `${localNpx} && echo done`]) {
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, { response: npmResponse, command })])).toMatchObject({ passed: false })
    }
    await rm(join(root, 'node_modules/.bin/focused-spec'))
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { response: npmResponse, command: localNpx })])).toMatchObject({ passed: false })
  })

  it('rejects chained guidance until a standalone request completes', async () => {
    const root = await activationFixture()
    const cli = `${JSON.stringify(process.execPath)} ${JSON.stringify(join(root, 'node_modules/focused-spec/dist/cli.js'))}`
    const combined = artifactGuidanceTranscript(root, { command: `${cli} --version && ${cli} instructions --protocol 1 --topic workflow --json` })
    expect(await guidanceActivationGate(root, [combined])).toMatchObject({ passed: false })
    expect(await guidanceActivationGate(root, [combined + '\n' + guidanceTranscript(root)])).toMatchObject({ passed: true })
  })

  it('accepts guidance from the selected installed CLI', async () => {
    const root = await activationFixture()
    const external = await activationFixture()
    const cli = join(external, 'node_modules/focused-spec/dist/cli.js')
    const version = '8.0.0'
    const content = '# Selected external workflow\n'
    await put(external, 'node_modules/focused-spec/package.json', JSON.stringify({ name: 'focused-spec', version }))
    await put(external, 'node_modules/focused-spec/guidance/workflow.md', content)
    const response = { protocolVersion: 1, package: { name: 'focused-spec', version }, topic: 'workflow', content }
    const args = 'instructions --protocol 1 --topic workflow --json'
    const direct = `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} ${args}`
    const bin = `${JSON.stringify(join(external, 'node_modules/.bin/focused-spec'))} ${args}`
    for (const command of [direct, bin]) {
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command, response })])).toMatchObject({ passed: true })
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command })])).toMatchObject({ passed: false })
    }
    await rm(join(root, 'node_modules/.bin/focused-spec'))
    const originalPath = process.env.PATH
    try {
      const binDirectory = join(external, 'node_modules/.bin')
      process.env.PATH = binDirectory
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: `focused-spec ${args}`, response })])).toMatchObject({ passed: true })
      await symlink(process.execPath, join(root, 'node_modules/.bin/focused-spec'))
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: `focused-spec ${args}`, response })])).toMatchObject({ passed: false })
    } finally {
      if (originalPath === undefined) delete process.env.PATH
      else process.env.PATH = originalPath
    }
    await rm(join(root, 'node_modules'), { recursive: true })
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: direct, response })])).toMatchObject({ passed: true })
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: direct, response, failed: true })])).toMatchObject({ passed: false })
  })

  it('rejects absent or legacy local guidance activation', async () => {
    const root = await activationFixture()
    expect(await guidanceActivationGate(root, [skillReadTranscript()])).toMatchObject({ passed: false })
    const cli = join(root, 'node_modules', 'focused-spec', 'dist', 'cli.js')
    const help = `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} --help`
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: help,
      rawOutput: 'Usage: focused-spec <command> [options]' })])).toMatchObject({ passed: false })
    await rm(join(root, 'node_modules', 'focused-spec', 'package.json'))
    expect(await guidanceActivationGate(root, [guidanceTranscript(root)])).toMatchObject({ passed: false })
  })

  it('rejects completed but unusable guidance responses', async () => {
    const root = await activationFixture()
    const valid = {
      protocolVersion: 1,
      package: { name: 'focused-spec', version: '0.6.0' },
      topic: 'workflow',
      content: WORKFLOW_GUIDANCE,
    }
    const invalid: GuideTranscriptOptions[] = [
      { rawOutput: '{not json}' },
      { response: { ...valid, protocolVersion: 2 } },
      { response: { ...valid, topic: 'runners' } },
      { response: { ...valid, package: { ...valid.package, name: 'other' } } },
      { response: { ...valid, package: { ...valid.package, version: '9.9.9' } } },
      { response: { ...valid, content: '  ' } },
      { response: { ...valid, extra: true } },
      { command: `${join(root, 'node_modules', '.bin', 'focused-spec')} agent-guide --protocol 1 --topic workflow --json` },
      { command: `${join(root, 'node_modules', '.bin', 'focused-spec')} instructions --help`,
        rawOutput: 'Usage: focused-spec instructions [options]' },
      { command: `${join(root, 'node_modules', '.bin', 'focused-spec')} instructions --protocol 1 --topic runners --json`,
        response: { ...valid, topic: 'runners' } },
    ]
    for (const options of invalid) {
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, options)]), JSON.stringify(options)).toMatchObject({ passed: false })
    }
  })

  it('reuses unchanged guidance across a resumed approval dialogue', async () => {
    const root = await activationFixture()
    const sessionDir = join(root, '.authoring')
    const session = createGuidanceSession(root)
    const acquired = artifactGuidanceTranscript(root)
    await session.record({ sessionDir }, acquired)
    expect(session.verdict()).toMatchObject({ passed: true })
    await session.record({ sessionDir, resume: join(sessionDir, 'session.jsonl') }, '')
    expect(session.verdict()).toMatchObject({ passed: true })
    expect(session.observations).toEqual([expect.objectContaining({ name: 'focused-workflow-reacquired', passed: false,
      detail: expect.stringContaining('reuse allowed') })])
    await session.record({ sessionDir, resume: join(sessionDir, 'session.jsonl') }, acquired)
    expect(session.verdict()).toMatchObject({ passed: true })
    expect(session.observations[1]).toMatchObject({ passed: false })
    await session.record({ sessionDir, resume: join(sessionDir, 'session.jsonl') }, guidanceTranscript(root))
    expect(session.verdict()).toMatchObject({ passed: true })
    expect(session.observations[2]).toMatchObject({ passed: true })
  })

  it('invalidates retained guidance without retroactively rejecting an acquired version', async () => {
    for (const mutation of ['version', 'content', 'canonical', 'shadowed', 'missing'] as const) {
      const root = await activationFixture()
      const replacement = await activationFixture()
      const sessionDir = join(root, '.authoring')
      const initial = { sessionDir }
      const resumed = { sessionDir, resume: join(sessionDir, 'session.jsonl') }
      const args = 'instructions --protocol 1 --topic workflow --json'
      const command = mutation === 'shadowed' ? `focused-spec ${args}` : `${JSON.stringify(join(root, 'node_modules/.bin/focused-spec'))} ${args}`
      const old = guidanceTranscript(root, { command })
      const stale = createGuidanceSession(root)
      const refreshed = createGuidanceSession(root)
      await stale.record(initial, old)
      await refreshed.record(initial, old)
      const acquiredVerdict = refreshed.verdict()
      let version = '0.6.0'
      let content = WORKFLOW_GUIDANCE
      if (mutation === 'version') {
        version = '0.7.0'
        await put(root, 'node_modules/focused-spec/package.json', JSON.stringify({ name: 'focused-spec', version }))
      } else if (mutation === 'content') {
        content = '# Replacement workflow with unchanged version\n'
        await put(root, 'node_modules/focused-spec/guidance/workflow.md', content)
      } else if (mutation === 'canonical' || mutation === 'shadowed') {
        await rm(join(root, 'node_modules/.bin/focused-spec'))
        await symlink(join(replacement, 'node_modules/focused-spec/dist/cli.js'), join(root, 'node_modules/.bin/focused-spec'))
      } else {
        await rm(join(root, 'node_modules/focused-spec/package.json'))
      }
      await stale.record(resumed, '')
      expect(stale.verdict(), mutation).toMatchObject({ passed: false })
      expect(stale.observations[0], mutation).toMatchObject({ passed: false, detail: expect.stringContaining('invalidated') })
      expect(acquiredVerdict, mutation).toMatchObject({ passed: true })
      if (mutation === 'missing') await put(root, 'node_modules/focused-spec/package.json', JSON.stringify({ name: 'focused-spec', version }))
      await refreshed.record(resumed, guidanceTranscript(root, { command, response: {
        protocolVersion: 1, package: { name: 'focused-spec', version }, topic: 'workflow', content,
      } }))
      expect(refreshed.verdict(), mutation).toMatchObject({ passed: true })
      await refreshed.record(resumed, '')
      expect(refreshed.verdict(), mutation).toMatchObject({ passed: true })
    }
  })

  it('does not repair missing initial acquisition with a later read', async () => {
    const root = await activationFixture()
    const sessionDir = join(root, '.authoring')
    for (const first of ['', guidanceTranscript(root, { failed: true }), guidanceTranscript(root, { complete: false }),
      guidanceTranscript(root, { rawOutput: '{broken}' }), artifactGuidanceTranscript(root, { readComplete: false }),
      artifactGuidanceTranscript(root, { artifact: 'artifact://wrong' }), artifactGuidanceTranscript(root, { omitCommand: true })]) {
      const session = createGuidanceSession(root)
      await session.record({ sessionDir }, first)
      expect(session.verdict()).toMatchObject({ passed: false })
      await session.record({ sessionDir, resume: join(sessionDir, 'session.jsonl') }, guidanceTranscript(root))
      expect(session.verdict()).toMatchObject({ passed: false, detail: expect.stringContaining('execution 1') })
    }
  })

  it('requires independent acquisition for a fresh execution context', async () => {
    const root = await activationFixture()
    const sessionDir = join(root, '.authoring')
    for (const context of [{ sessionDir }, { sessionDir: join(root, '.publication'), resume: join(root, '.publication/session.jsonl') },
      { sessionDir, resume: join(sessionDir, 'different.jsonl') }, { resume: join(sessionDir, 'session.jsonl') },
      { sessionDir, resume: join(root, '.regeneration/session.jsonl') }]) {
      const session = createGuidanceSession(root)
      await session.record({ sessionDir }, guidanceTranscript(root))
      await session.record({ sessionDir, resume: join(sessionDir, 'session.jsonl') }, '')
      expect(session.verdict()).toMatchObject({ passed: true })
      await session.record(context, '')
      expect(session.verdict()).toMatchObject({ passed: false, detail: expect.stringContaining('fresh execution context') })
      const fresh = createGuidanceSession(root)
      await fresh.record(context, guidanceTranscript(root))
      expect(fresh.verdict()).toMatchObject({ passed: true })
    }
    const publication = createGuidanceSession(root)
    await publication.record({ sessionDir: join(root, '.publication') }, '')
    expect(publication.verdict()).toMatchObject({ passed: false })
  })

  it('rejects SDK-only BDD turns without skill and local workflow activation', async () => {
    for (const missing of ['focused-skill-loaded', 'focused-workflow-acquired'] as const) {
      const driver: AgentDriver = {
        async run(request) {
          const workflow = await runProcess(process.execPath, [join(request.workspace, 'node_modules/focused-spec/dist/cli.js'),
            'instructions', '--protocol', '1', '--topic', 'workflow', '--json'], { cwd: request.workspace, timeoutMs: 10_000 })
          expect(workflow.code, workflow.stderr).toBe(0)
          const output = [
            ...(missing === 'focused-skill-loaded' ? [] : [skillReadTranscript()]),
            guidanceTranscript(request.workspace, { rawOutput: workflow.stdout, complete: missing !== 'focused-workflow-acquired' }),
          ].join('\n')
          return { success: true, output, exitCode: 0, durationMs: 1 }
        },
      }
      const result = await runEval({ caseId: 'integration-standalone-typescript-sdk' }, driver)
      expect(result.gates.find(gate => gate.name === 'agent-turn-1')).toMatchObject({ passed: true })
      expect(result.passed).toBe(false)
      expect(result.gates.find(gate => gate.name === missing)).toMatchObject({ passed: false })
      expect(result.gates.some(gate => ['integration-composition', 'executable-application-sensitivity'].includes(gate.name))).toBe(false)
    }
  }, 60_000)

  it('stops an OpenSpec turn before judging artifacts if the agent skipped the skill', async () => {
    const driver: AgentDriver = {
      async run() {
        return { success: true, output: skillReadTranscript({ path: 'skill://openspec-propose' }), exitCode: 0, durationMs: 1 }
      },
    }
    const result = await runEval({ caseId: 'full-skill-routing', openspecSkillsDir: join(repository, '.omp/skills') }, driver)
    expect(result.passed).toBe(false)
    expect(result.gates.find(gate => gate.name === 'focused-skill-loaded')).toMatchObject({ passed: false })
    expect(result.gates.some(gate => ['proposal-artifacts', 'planning-boundary', 'planned-evidence', 'focused-validation'].includes(gate.name))).toBe(false)
  }, 30_000)

  it('exposes every competing skill without replacing candidate guidance and fails skipped activation', async () => {
    const source = await mkdtemp(join(tmpdir(), 'focused-eval-competing-'))
    roots.push(source)
    const document = '---\nname: diagnose\ndescription: Diagnose application failures.\n---\n\nRead references first.\n'
    await put(source, 'diagnose/SKILL.md', document)
    await put(source, 'diagnose/references/details.txt', 'diagnostic reference\n')
    await put(source, 'focused-spec/SKILL.md', 'untrusted replacement')
    let invoked = false
    const result = await runEval({ caseId: 'blind-skill-activation', openspecSkillsDir: join(repository, '.omp/skills'), competingSkillsDir: source }, {
      async run(request) {
        if (request.tools === '') return { success: true, output: '', exitCode: 0, durationMs: 0 }
        invoked = true
        expect(request.skills).toContain('diagnose')
        expect(request.skills).toContain('focused-spec')
        expect(request.skills).toContain('openspec-propose')
        expect(request.prompt).not.toMatch(/focused-spec|evidence/iu)
        expect(await readFile(join(request.workspace, '.omp/skills/diagnose/references/details.txt'), 'utf8')).toBe('diagnostic reference\n')
        expect(await readFile(join(request.workspace, '.omp/skills/focused-spec/SKILL.md'), 'utf8')).toBe(await readFile(join(request.workspace, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8'))
        return { success: true, output: skillReadTranscript({ path: 'skill://openspec-propose' }), exitCode: 0, durationMs: 1 }
      },
    })
    expect(invoked).toBe(true)
    expect(result.passed).toBe(false)
    expect(result.gates.find(gate => gate.name === 'focused-skill-loaded')).toMatchObject({ passed: false })
    expect(result.skillInventory?.find(skill => skill.name === 'diagnose')?.files).toEqual({
      'SKILL.md': createHash('sha256').update(document).digest('hex'),
      'references/details.txt': createHash('sha256').update('diagnostic reference\n').digest('hex'),
    })
  }, 30_000)

  it('refuses blind activation with an empty competing catalog rather than silently running the baseline', async () => {
    const source = await mkdtemp(join(tmpdir(), 'focused-eval-no-competing-'))
    roots.push(source)
    await expect(provisionWorkspace(evalCase('blind-skill-activation')!, join(repository, '.omp/skills'), source))
      .rejects.toThrow('at least one additional skill')
  }, 30_000)
  it('rejects a proposal that creates configuration or a planned evidence registry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-proposal-'))
    roots.push(root)
    for (const file of ['proposal.md', 'design.md', 'tasks.md', '.openspec.yaml']) {
      await put(root, `openspec/changes/add-auth/${file}`, 'planning artifact')
    }
    await put(root, 'openspec/changes/add-auth/specs/auth/spec.md', [
      '## ADDED Requirements', '### Requirement: Auth', '<!-- focused-spec:id=auth.blocked -->',
      '#### Scenario: Blocked', '- **WHEN** blocked', '- **THEN** rejected',
    ].join('\n'))
    await put(root, '.focused-spec/config.yaml', 'version: 4\n')
    const checkpoint = await judgeProposalCheckpoint(root, change)
    expect(checkpoint.gates.find(gate => gate.name === 'proposal-artifacts')).toMatchObject({ passed: true })
    expect(checkpoint.gates.find(gate => gate.name === 'planning-boundary')).toMatchObject({ passed: false, detail: expect.stringContaining('implementation started') })
    await rm(join(root, '.focused-spec/config.yaml'))
    await put(root, '.focused-spec/evidence.yaml', 'scopes:\n  add-auth:\n    auth.blocked:\n      evidence: [planned:project-tests::target]\n')
    expect((await judgeProposalCheckpoint(root, change)).gates.find(gate => gate.name === 'planning-boundary')).toMatchObject({ passed: false })
  })

  it('rejects planning-time inline evidence integration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-inline-proposal-'))
    roots.push(root)
    for (const file of ['proposal.md', 'design.md', 'tasks.md', '.openspec.yaml']) {
      await put(root, `openspec/changes/add-auth/${file}`, 'planning artifact')
    }
    await put(root, 'openspec/changes/add-auth/specs/auth/spec.md', [
      '## ADDED Requirements', '### Requirement: Auth', '<!-- focused-spec:id=auth.blocked -->',
      '#### Scenario: Blocked', '- **ID**: `Opaque/Auth 账户`',
      '- **EVIDENCE**: `planned:project-tests::target`', '- **WHEN** blocked', '- **THEN** rejected',
    ].join('\n'))
    const checkpoint = await judgeProposalCheckpoint(root, change)
    expect(checkpoint.gates.find(gate => gate.name === 'proposal-artifacts')).toMatchObject({ passed: true })
    expect(checkpoint.gates.find(gate => gate.name === 'planning-boundary')).toMatchObject({ passed: false })
  })

  it('accepts a newly authored valid identity when the task prescribes none', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-routing-'))
    roots.push(root)
    const { prescribedScenarioId: _, ...selected } = change
    for (const file of ['proposal.md', 'design.md', 'tasks.md', '.openspec.yaml']) {
      await put(root, `openspec/changes/add-auth/${file}`, 'planning artifact')
    }
    await put(root, 'openspec/changes/add-auth/specs/auth/spec.md', [
      '## ADDED Requirements', '### Requirement: Auth', '<!-- focused-spec:id=account.authentication.blocked -->',
      '#### Scenario: Blocked', '- **WHEN** blocked', '- **THEN** rejected',
    ].join('\n'))

    const checkpoint = await judgeProposalCheckpoint(root, selected)

    expect(checkpoint.gates.find(gate => gate.name === 'planned-evidence')).toMatchObject({ passed: true })
    expect(checkpoint.selectedScenarioId).toBe('account.authentication.blocked')

    await put(root, 'openspec/changes/add-auth/specs/auth/spec.md', [
      '## ADDED Requirements', '### Requirement: Auth',
      '#### Scenario: Blocked', '- **WHEN** blocked', '- **THEN** rejected',
    ].join('\n'))
    expect((await judgeProposalCheckpoint(root, selected)).gates.find(gate => gate.name === 'planned-evidence')).toMatchObject({ passed: false })

    await put(root, 'openspec/changes/add-auth/specs/auth/spec.md', [
      '## ADDED Requirements', '### Requirement: Auth', '<!-- focused-spec:id=account.authentication.blocked -->',
      '#### Scenario: Blocked', '- **WHEN** blocked', '- **THEN** rejected',
      '- **EVIDENCE**: `planned:project-tests::target`',
    ].join('\n'))
    expect((await judgeProposalCheckpoint(root, selected)).gates.find(gate => gate.name === 'planned-evidence')).toMatchObject({ passed: false })
  })

  it('rejects a renamed, ambiguous, missing, or invalid identity after selection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-routing-'))
    roots.push(root)
    await installFocusedPackage(root)
    const { changeName: _, prescribedScenarioId: __, ...selected } = change
    await put(root, '.focused-spec/config.yaml', [
      'version: 5', 'specifications:', '  formats:', '    markdown:',
      "      package: '@focused-spec/format-registry'", '      options:', '        parser:',
      "          package: '@focused-spec/format-markdown'", '  documents:',
      '    - match: specs/**/*.md', '      scope: current', '      format: markdown',
      'runners:', '  go:', "    package: '@focused-spec/runner-go'",
    ].join('\n'))
    const scenario = (id: string, name = 'Blocked') => [
      `<!-- focused-spec:id=${id} -->`, `#### Scenario: ${name}`, '- **WHEN** blocked', '- **THEN** rejected',
    ].join('\n')
    const registry = (...ids: string[]) => [
      'scopes:', '  current:',
      ...ids.flatMap(id => [`    ${id}:`, '      evidence:', '        - go::target']),
    ].join('\n')
    const frozenId = 'account.authentication.blocked'
    await put(root, 'specs/auth.md', scenario(frozenId))
    await put(root, '.focused-spec/evidence.yaml', registry(frozenId))
    expect(await scenarioGate(root, selected, 'current', frozenId)).toMatchObject({ passed: true })

    const renamedId = 'account.authentication.denied'
    await put(root, 'specs/auth.md', scenario(renamedId))
    await put(root, '.focused-spec/evidence.yaml', registry(renamedId))
    expect(await scenarioGate(root, selected, 'current', frozenId)).toMatchObject({ passed: false })

    await put(root, 'specs/auth.md', `${scenario(frozenId)}\n\n${scenario(renamedId, 'Denied')}`)
    await put(root, '.focused-spec/evidence.yaml', registry(frozenId, renamedId))
    expect(await scenarioGate(root, selected, 'current', frozenId)).toMatchObject({ passed: false })

    const emptyRegistry = 'scopes:\n  current: {}\n'
    await put(root, 'specs/auth.md', '<!-- focused-spec:id=account.authentication.blocked -->\n#### Scenario: Blocked\n- **WHEN** blocked\n- **THEN** rejected')
    await put(root, '.focused-spec/evidence.yaml', emptyRegistry)
    expect(await scenarioGate(root, selected, 'current', frozenId)).toMatchObject({ passed: false })

    await put(root, 'specs/auth.md', '#### Scenario: Blocked\n- **WHEN** blocked\n- **THEN** rejected')
    expect(await scenarioGate(root, selected, 'current', frozenId)).toMatchObject({ passed: false })
  })

  it('executes the named change in its configured scope and rejects ambiguous or foreign bindings', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-configured-scope-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await installFocusedPackage(root)
    const selected = evalCase('full-skill-routing')!
    const id = 'account.access.blocked'
    const path = 'openspec/changes/reject-blocked-login/specs/auth/spec.md'
    const config = (match: string, extra = '') => [
      'version: 5', 'specifications:', '  formats:', '    markdown:',
      "      package: '@focused-spec/format-registry'", '      options:', '        parser:',
      "          package: '@focused-spec/format-markdown'", '  documents:',
      `    - match: ${match}`, '      scope: current', '      format: markdown', extra,
      'runners:', '  go:', "    package: '@focused-spec/runner-go'",
    ].filter(Boolean).join('\n')
    await put(root, '.focused-spec/config.yaml', config('openspec/changes/reject-blocked-login/specs/**/*.md'))
    await put(root, path, `<!-- focused-spec:id=${id} -->\n#### Scenario: Blocked account\n- **WHEN** a blocked account has valid credentials\n- **THEN** authentication is rejected\n`)
    await put(root, '.focused-spec/evidence.yaml', `scopes:\n  current:\n    ${id}:\n      evidence: [go::auth/auth_test.go::TestBlockedAccount]\n`)

    const gates = await judgeCompletedWorkspace(root, selected, new Map(), [], undefined, id)
    expect(gates.find(gate => gate.name === 'focused-validation')).toMatchObject({ passed: true, detail: expect.stringContaining('selected scope current') })
    expect(gates.find(gate => gate.name === 'focused-execution')).toMatchObject({ passed: true, detail: expect.stringContaining('go::auth/auth_test.go::TestBlockedAccount') })
    expect(gates.find(gate => gate.name === 'scenario-contract'), JSON.stringify(gates)).toMatchObject({ passed: true })
    expect(gates.find(gate => gate.name === 'mutation-sensitivity')).toMatchObject({ passed: true })
    expect(await scenarioGate(root, selected, undefined, 'changed.identity')).toMatchObject({ passed: false })
    await put(root, '.focused-spec/config.yaml', config('openspec/changes/reject-blocked-login/specs/**/*.md', '    - match: openspec/changes/reject-blocked-login/specs/**/*.md\n      scope: second\n      format: markdown'))
    expect(await scenarioGate(root, selected, undefined, id)).toMatchObject({ passed: false })
    await put(root, 'openspec/changes/other/specs/auth/spec.md', await readFile(join(root, path), 'utf8'))
    await put(root, '.focused-spec/config.yaml', config('openspec/changes/other/specs/**/*.md'))
    expect(await scenarioGate(root, selected, undefined, id)).toMatchObject({ passed: false })
    await put(root, path, '#### Scenario: Unmarked planning item\n')
    await put(root, '.focused-spec/config.yaml', config('openspec/changes/*/specs/**/*.md'))
    expect(await scenarioGate(root, selected, undefined, id)).toMatchObject({ passed: false })
  }, 120_000)

  it('rejects replacement of a prescribed identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-routing-'))
    roots.push(root)
    await installFocusedPackage(root)
    for (const file of ['proposal.md', 'design.md', 'tasks.md', '.openspec.yaml']) {
      await put(root, `openspec/changes/add-auth/${file}`, 'planning artifact')
    }
    await put(root, 'openspec/changes/add-auth/specs/auth/spec.md', [
      '## ADDED Requirements', '### Requirement: Auth', '<!-- focused-spec:id=account.authentication.blocked -->',
      '#### Scenario: Blocked', '- **WHEN** blocked', '- **THEN** rejected',
    ].join('\n'))

    const checkpoint = await judgeProposalCheckpoint(root, change)

    expect(checkpoint.gates.find(gate => gate.name === 'planned-evidence')).toMatchObject({ passed: false })
    expect(checkpoint.selectedScenarioId).toBeUndefined()
    await put(root, '.focused-spec/config.yaml', [
      'version: 5', 'specifications:', '  formats:', '    markdown:',
      "      package: '@focused-spec/format-registry'", '      options:', '        parser:',
      "          package: '@focused-spec/format-markdown'", '  documents:',
      '    - match: specs/**/*.md', '      scope: current', '      format: markdown',
      'runners:', '  go:', "    package: '@focused-spec/runner-go'",
    ].join('\n'))
    await put(root, 'specs/auth.md', [
      '<!-- focused-spec:id=account.authentication.blocked -->', '#### Scenario: Blocked',
      '- **WHEN** blocked', '- **THEN** rejected',
    ].join('\n'))
    await put(root, '.focused-spec/evidence.yaml', [
      'scopes:', '  current:', '    account.authentication.blocked:', '      evidence:',
      '        - go::target',
    ].join('\n'))
    expect(await scenarioGate(root, change, 'current')).toMatchObject({ passed: false })
  })

  it('allows public package documentation while rejecting implementation inspection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-public-docs-'))
    roots.push(root)
    const transcript = (toolName: string, args: object) => JSON.stringify({ type: 'tool_execution_start', toolName, args })
    for (const [toolName, args] of [
      ['grep', { path: 'node_modules/focused-spec/README.md', pattern: 'results|run\\(|RunnerPlugin|resolve\\(' }],
      ['read', { path: 'node_modules/focused-spec/docs/reference/runner-api.md' }],
      ['read', { path: 'node_modules/focused-spec/dist/runner-api.d.ts:raw' }],
    ] as const) {
      expect(await integrityGate(root, new Map(), [transcript(toolName, args)])).toMatchObject({ passed: true })
    }
    for (const path of ['node_modules/focused-spec/dist/cli.js', 'node_modules/focused-spec/src/registry.ts', 'node_modules/focused-spec/examples/openspec/.focused-spec/runners/go-test.ts']) {
      expect(await integrityGate(root, new Map(), [transcript('read', { path })])).toMatchObject({ passed: false })
    }
  })

  it('rejects implementation directory searches while allowing public declarations and CLI execution', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-audit-inspection-'))
    roots.push(root)
    const event = (toolName: string, args: object) => JSON.stringify({ type: 'tool_execution_start', toolName, args })
    for (const path of ['node_modules/focused-spec/dist', 'node_modules/focused-spec/src/', 'node_modules/@focused-spec/runner-go/dist']) {
      expect(await integrityGate(root, new Map(), [event('grep', { path, pattern: 'resolve' })]), path).toMatchObject({ passed: false })
    }
    for (const path of ['node_modules/focused-spec/docs', 'node_modules/focused-spec/README.md', 'node_modules/focused-spec/dist/runner-api.d.ts']) {
      expect(await integrityGate(root, new Map(), [event('read', { path })]), path).toMatchObject({ passed: true })
    }
    expect(await integrityGate(root, new Map(), [event('bash', { command: 'node node_modules/focused-spec/dist/cli.js run --json' })])).toMatchObject({ passed: true })
  })

  it('distinguishes variable-root CLI execution from implementation reads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-variable-cli-'))
    roots.push(root)
    const event = (command: string) => JSON.stringify({ type: 'tool_execution_start', toolName: 'bash', args: { command } })
    const cli = '"$workspace/node_modules/focused-spec/dist/cli.js"'
    expect(await integrityGate(root, new Map(), [event(`workspace=$(pwd); node ${cli} run --root "$tmp"`)])).toMatchObject({ passed: true })
    expect(await integrityGate(root, new Map(), [event(`node ${cli} run; cat ${cli}`)])).toMatchObject({ passed: false })
    expect(await integrityGate(root, new Map(), [event(`cat ${cli}`)])).toMatchObject({ passed: false })
    expect(await integrityGate(root, new Map(), [event('(cd "$probe/project" && node node_modules/focused-spec/dist/cli.js run --scope current)')])).toMatchObject({ passed: true })
    expect(await integrityGate(root, new Map(), [event('(cd "$probe/project" && node node_modules/focused-spec/dist/cli.js run); (cat node_modules/focused-spec/dist/cli.js)')])).toMatchObject({ passed: false })
  })

  it('rejects protected test and package changes in an evaluated workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-integrity-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await put(root, 'node_modules/focused-spec/dist/cli.js', 'export default 1\n')
    const snapshots = await snapshotProtectedFiles(root)
    const transcript = (toolName: string, args: object) => JSON.stringify({ type: 'tool_execution_start', toolName, args })
    const cli = 'node_modules/focused-spec/dist/cli.js'
    expect(await integrityGate(root, snapshots, [transcript('bash', {
      command: `node ${cli} --help && node ${cli} instructions --protocol 1 --topic workflow --json`,
    })])).toMatchObject({ passed: true })
    for (const [toolName, args] of [
      ['read', { path: cli }],
      ['grep', { path: cli, pattern: '.' }],
      ['bash', { command: `cat ${cli}` }],
      ['bash', { command: `node ${cli} --help && cat ${cli}` }],
      ['bash', { command: `node -e 'require("fs").readFileSync("${cli}", "utf8")'` }],
      ['bash', { command: `node -p 'require.resolve("focused-spec")' && cat ${cli}` }],
    ] as const) {
      expect(await integrityGate(root, snapshots, [transcript(toolName, args)])).toMatchObject({ passed: false })
    }
    await put(root, 'auth/auth_test.go', 'package auth\n')
    await put(root, 'node_modules/focused-spec/dist/cli.js', 'export default 2\n')
    const gate = await integrityGate(root, snapshots, [])
    expect(gate).toMatchObject({ name: 'integrity', passed: false, detail: expect.stringContaining('auth/auth_test.go') })
    expect(gate.detail).toContain('node_modules/focused-spec/dist/cli.js')
  })

  it('rejects stale green evidence after native revision and accepts synchronized sensitive evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-spec-revision-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await cp(join(repository, 'evals/cases/spec-evidence-revision/overlay'), root, { recursive: true, force: true })
    await installFocusedPackage(root)
    const selected = evalCase('spec-evidence-revision')!
    const cli = join(root, 'node_modules/focused-spec/dist/cli.js')
    await put(root, 'specs/account-authentication.md', revisedBlockedSpec)
    const oldGreen = await runProcess(process.execPath, [cli, 'run', '--json'], { cwd: root, timeoutMs: 120_000 })
    expect(JSON.parse(oldGreen.stdout)).toMatchObject({ success: true, targetCount: 4 })
    expect(await scenarioGate(root, selected)).toMatchObject({ passed: false })
    const staleSensitivity = await mutationGate(root, { ...selected,
      expectedSelectorFragments: ['TestBlockedAccount', 'test_blocked_account'],
    })
    expect(staleSensitivity, staleSensitivity.detail).toMatchObject({ passed: false })
    const originalRegistry = await readFile(join(root, '.focused-spec/evidence/auth.yaml'), 'utf8')
    const revisedRegistry = originalRegistry.replace('::TestBlockedAccount\n', '::TestBlockedAccountWithValidCredentials\n')
      .replace('::test_blocked_account\n', '::test_blocked_account_with_valid_credentials\n')
    await put(root, '.focused-spec/evidence/auth.yaml', revisedRegistry)
    const reconciled = await specRevisionGate(root, selected)
    expect(reconciled, reconciled.detail).toMatchObject({ passed: true })
    expect(await scenarioGate(root, selected)).toMatchObject({ passed: true })
    const sensitive = await mutationGate(root, selected)
    expect(sensitive, sensitive.detail).toMatchObject({ passed: true })
    const synchronized = await runProcess(process.execPath, [cli, 'run', '--json'], { cwd: root, timeoutMs: 120_000 })
    expect(JSON.parse(synchronized.stdout)).toMatchObject({ success: true, targetCount: 4 })
  }, 60_000)

  it('rejects unchanged native behavior and loss of an independent registry entry during revision', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-spec-ownership-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await cp(join(repository, 'evals/cases/spec-evidence-revision/overlay'), root, { recursive: true, force: true })
    await installFocusedPackage(root)
    const selected = evalCase('spec-evidence-revision')!
    expect(await specRevisionGate(root, selected)).toMatchObject({ passed: false })
    await put(root, 'specs/account-authentication.md', revisedBlockedSpec)
    const owned = await specRevisionGate(root, selected)
    expect(owned, owned.detail).toMatchObject({ passed: true })
    const registry = await readFile(join(root, '.focused-spec/evidence/auth.yaml'), 'utf8')
    await put(root, '.focused-spec/evidence/auth.yaml', registry.split('  auth-baseline:')[0]!)
    expect(await specRevisionGate(root, selected)).toMatchObject({ passed: false })
  })

  it('reconciles the bound paragraph or list item without borrowing behavior from another item', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-paragraph-revision-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await cp(join(repository, 'evals/cases/spec-evidence-revision/overlay'), root, { recursive: true })
    await installFocusedPackage(root)
    const selected = evalCase('spec-evidence-revision')!
    const path = 'specs/account-authentication.md'
    const marker = '<!-- focused-spec:id=auth.login.blocked-account -->'
    const outcome = 'A blocked account must be denied login even when its credentials are valid.'
    await put(root, path, `# Account authentication\n\n${outcome} ${marker}\n`)
    expect((await specRevisionGate(root, selected)).passed).toBe(true)
    await put(root, path, `# Account authentication\n\n${marker}\n- ${outcome}\n`)
    expect((await specRevisionGate(root, selected)).passed).toBe(true)
    await put(root, path, `# Account authentication\n\nA login attempt is processed. ${marker}\n\n${outcome}\n`)
    expect((await specRevisionGate(root, selected)).passed).toBe(false)
    await put(root, path, `# Account authentication\n\n${outcome} ${marker}\n`)
    const evidence = await readFile(join(root, '.focused-spec/evidence/auth.yaml'), 'utf8')
    await put(root, '.focused-spec/evidence/auth.yaml', evidence.replace('        - go::./auth::TestBlockedAccount\n', '        - go::./auth::TestBlockedAccountWithValidCredentials\n')
      .replace('        - pytest::tests/functional/test_auth.py::test_blocked_account\n', '        - pytest::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials\n'))
    expect((await scenarioGate(root, selected)).passed).toBe(true)
    const exact = await readFile(join(root, '.focused-spec/evidence/auth.yaml'), 'utf8')
    await put(root, '.focused-spec/evidence/auth.yaml', exact.replace('      evidence:\n', '      evidence:\n        - go::./auth::TestBlockedAccount\n        - pytest::tests/functional/test_auth.py::test_blocked_account\n'))
    expect((await scenarioGate(root, selected)).passed).toBe(false)
  })

  it('rejects vacuous evidence even after product repair and requires an agent sensitivity probe', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-vacuous-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await cp(join(repository, 'evals/cases/vacuous-evidence/overlay'), root, { recursive: true, force: true })
    await installFocusedPackage(root)
    const editable = ['app/auth.py', 'tests/functional/test_auth.py']
    const snapshots = await snapshotProtectedFiles(root, editable)
    await put(root, 'app/auth.py', 'def authenticate(blocked: bool, credentials_valid: bool) -> bool:\n    return credentials_valid and not blocked\n')
    const source = await readFile(join(root, 'app/auth.py'), 'utf8')
    const vacuous = await judgeEvidenceRepair(root, [])
    expect(vacuous.find(gate => gate.name === 'authentication-contract')).toMatchObject({ passed: true })
    expect(vacuous.find(gate => gate.name === 'repaired-evidence-sensitivity')).toMatchObject({ passed: false })
    await put(root, 'tests/functional/test_auth.py', 'from app.auth import authenticate\n\ndef test_blocked_account() -> None:\n    assert authenticate(blocked=True, credentials_valid=True) is False\n')
    const repaired = await judgeEvidenceRepair(root, [])
    expect(repaired.find(gate => gate.name === 'repaired-evidence-sensitivity'), JSON.stringify(repaired)).toMatchObject({ passed: true })
    expect(repaired.find(gate => gate.name === 'agent-sensitivity-probe')).toMatchObject({ passed: false })
    expect(await readFile(join(root, 'app/auth.py'), 'utf8')).toBe(source)
    expect(await integrityGate(root, snapshots, [])).toMatchObject({ passed: true })
    await put(root, 'tests/functional/test_existing_auth.py', '')
    expect(await integrityGate(root, snapshots, [])).toMatchObject({ passed: false })
  }, 120_000)

  it('rejects applied evidence that misses a controlled product regression', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-mutation-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await installFocusedPackage(root)
    await put(root, '.focused-spec/config.yaml', [
      'version: 5', 'specifications:', '  formats:', '    markdown:',
      "      package: '@focused-spec/format-registry'", '      options:', '        parser:',
      "          package: '@focused-spec/format-markdown'", '  documents:',
      '    - match: specs/**/*.md', '      scope: current', '      format: markdown',
      'runners:', "  go: { package: '@focused-spec/runner-go' }", "  pytest: { package: '@focused-spec/runner-pytest' }",
    ].join('\n'))
    await put(root, 'specs/auth.md', '<!-- focused-spec:id=auth.blocked -->\n#### Scenario: Blocked\n- **WHEN** blocked\n- **THEN** rejected\n')
    await put(root, '.focused-spec/evidence.yaml', 'scopes:\n  current:\n    auth.blocked:\n      evidence: [go::./auth::TestBlockedAccount, pytest::tests/functional/test_auth.py::test_blocked_account]\n')
    await put(root, 'node_modules/focused-spec/dist/cli.js', 'process.exit(0)\n')
    const goBefore = await readFile(join(root, 'auth/auth.go'), 'utf8')
    const pythonBefore = await readFile(join(root, 'app/auth.py'), 'utf8')
    const { changeName: _, ...withoutChange } = change
    const gate = await mutationGate(root, { ...withoutChange, expectedEvidenceCount: 2, expectedSelectorFragments: ['TestBlockedAccount', 'test_blocked_account'] })
    expect(gate).toMatchObject({ name: 'mutation-sensitivity', passed: false })
    expect(await readFile(join(root, 'auth/auth.go'), 'utf8')).toBe(goBefore)
    expect(await readFile(join(root, 'app/auth.py'), 'utf8')).toBe(pythonBefore)
  })

  it.each(['selected ERROR', 'unrelated FAIL', 'validation error', 'signal termination', 'failed restoration', 'selected FAIL then restored PASS'])
    ('requires selected behavioral failure and restored pass: %s', async mode => {
      const root = await mkdtemp(join(tmpdir(), 'focused-audit-mutation-'))
      roots.push(root)
      await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
      const beforeGo = await readFile(join(root, 'auth/auth.go'), 'utf8')
      const beforePython = await readFile(join(root, 'app/auth.py'), 'utf8')
      const references = ['go::./auth::TestBlockedAccount', 'pytest::tests/functional/test_auth.py::test_blocked_account']
      await installFocusedPackage(root)
      await put(root, '.focused-spec/config.yaml', [
        'version: 5', 'specifications:', '  formats:', '    markdown:',
        "      package: '@focused-spec/format-registry'", '      options:', '        parser:',
        "          package: '@focused-spec/format-markdown'", '  documents:',
        '    - match: openspec/changes/add-auth/specs/**/*.md', '      scope: add-auth', '      format: markdown',
        'runners:', "  go: { package: '@focused-spec/runner-go' }", "  pytest: { package: '@focused-spec/runner-pytest' }",
      ].join('\n'))
      await put(root, 'openspec/changes/add-auth/specs/auth/spec.md', '<!-- focused-spec:id=auth.blocked -->\n#### Scenario: Blocked\n- **WHEN** a blocked account has valid credentials\n- **THEN** authentication is rejected\n')
      await put(root, '.focused-spec/evidence.yaml', `scopes:\n  add-auth:\n    auth.blocked:\n      evidence:\n${references.map(reference => `        - ${reference}`).join('\n')}\n`)
      await put(root, 'node_modules/focused-spec/dist/cli.js', [
        "import fs from 'node:fs'",
        `const mode = ${JSON.stringify(mode)}`,
        `const references = ${JSON.stringify(references)}`,
        "const mutated = !fs.readFileSync('auth/auth.go', 'utf8').includes('return credentialsValid && !blocked') || !fs.readFileSync('app/auth.py', 'utf8').includes('return credentials_valid and not blocked')",
        "const restored = !mutated && fs.existsSync('.audit-mutation-seen')",
        "if (mutated) fs.writeFileSync('.audit-mutation-seen', 'seen')",
        "if (mutated && mode === 'signal termination') process.kill(process.pid, 'SIGTERM')",
        "const status = mutated ? (mode === 'selected ERROR' ? 'ERROR' : mode === 'unrelated FAIL' ? 'PASS' : 'FAIL') : restored && mode === 'failed restoration' ? 'FAIL' : 'PASS'",
        "const evidence = references.map(reference => ({ reference, status }))",
        "const unrelatedFailure = mutated && mode === 'unrelated FAIL'",
        "const validationError = mutated && mode === 'validation error'",
        "const scenarios = [{ scope: 'add-auth', id: 'auth.blocked', status, evidence }]",
        "if (unrelatedFailure) scenarios.push({ scope: 'add-auth', id: 'auth.unrelated', status: 'FAIL', evidence: [{ reference: 'go::./other::TestUnrelated', status: 'FAIL' }] })",
        "const success = status === 'PASS' && !unrelatedFailure && !validationError",
        "console.log(JSON.stringify({ success, executionStarted: !validationError, scenarios }))",
        "process.exit(success ? 0 : 1)",
      ].join('\n'))
      const result = await mutationGate(root, { ...change, expectedEvidenceCount: 2, expectedSelectorFragments: ['TestBlockedAccount', 'test_blocked_account'] })
      expect(await readFile(join(root, 'auth/auth.go'), 'utf8')).toBe(beforeGo)
      expect(await readFile(join(root, 'app/auth.py'), 'utf8')).toBe(beforePython)
      expect(result.passed).toBe(mode === 'selected FAIL then restored PASS')
    })

  it('retains checkpointed scope-local evidence after a working document leaves discovery', async () => {
    const root = await brownfieldFixture()
    const checkpoint = await judgeWorkingCheckpoint(root, brownfieldChange)
    expect(checkpoint.gates.every(gate => gate.passed)).toBe(true)
    const configPath = join(root, '.focused-spec/config.yaml')
    await put(root, '.focused-spec/config.yaml', (await readFile(configPath, 'utf8')).replace('scope: current', 'scope: published')
      .replace('    - match: openspec/changes/{scope}/specs/**/spec.md\n      exclude:\n        - openspec/changes/archive/**\n      format: markdown\n', ''))
    const registryPath = join(root, '.focused-spec/evidence.yaml')
    await put(root, '.focused-spec/evidence.yaml', (await readFile(registryPath, 'utf8')).replace('  current:', '  published:'))
    const gates = await brownfieldGate(root, brownfieldChange, checkpoint)

    expect(gates.map(gate => ({ name: gate.name, passed: gate.passed })), JSON.stringify(gates)).toEqual([
      { name: 'native-history-preservation', passed: true },
      { name: 'main-scope-evidence', passed: true },
      { name: 'transition-stable-evidence', passed: true },
    ])
    await put(root, 'app/auth.py', 'def authenticate(blocked: bool, credentials_valid: bool) -> bool:\n    return credentials_valid\n')
    const regression = await brownfieldGate(root, brownfieldChange, checkpoint)
    expect(regression.find(gate => gate.name === 'main-scope-evidence')).toMatchObject({ passed: false })
    expect(regression.find(gate => gate.name === 'transition-stable-evidence')).toMatchObject({ passed: false })
  }, 60_000)

  it(checkpointRetirement, async () => {
    const { root, checkpoint } = retirementFixture
    const path = 'openspec/changes/add-auth/specs/account-authentication/spec.md'
    await put(root, path, (await readFile(join(root, path), 'utf8')).replace('<!-- focused-spec:id=auth.login.blocked-account -->\n', ''))
    await put(root, '.focused-spec/evidence.yaml', JSON.stringify({ scopes: { current: {
      'auth.login.blocked-account': { evidence: checkpoint.evidence!.evidence },
    } } }))
    const retired = await brownfieldGate(root, brownfieldChange, checkpoint)
    expect(retired.map(gate => ({ name: gate.name, passed: gate.passed })), JSON.stringify(retired)).toEqual([
      { name: 'native-history-preservation', passed: true },
      { name: 'main-scope-evidence', passed: true },
      { name: 'transition-stable-evidence', passed: true },
    ])
    expect(await brownfieldGate(root, brownfieldChange)).toEqual([
      expect.objectContaining({ name: 'brownfield-contract', passed: false }),
    ])
  })

  it('judges the selected scope when another scope has the same ID', async () => {
    const root = await brownfieldFixture()
    const configPath = join(root, '.focused-spec/config.yaml')
    await put(root, '.focused-spec/config.yaml', (await readFile(configPath, 'utf8')).replace('scope: current', 'scope: published'))
    const registryPath = join(root, '.focused-spec/evidence.yaml')
    await put(root, '.focused-spec/evidence.yaml', (await readFile(registryPath, 'utf8')).replace('  current:', '  published:'))
    const selectedScope = await scenarioGate(root, brownfieldChange)
    expect(selectedScope, selectedScope.detail).toMatchObject({ passed: true })

    await put(root, 'openspec/specs/excluded/duplicate/spec.md', markedBlockedScenario)
    expect(await scenarioGate(root, brownfieldChange)).toMatchObject({ passed: true })

    await put(root, 'openspec/specs/duplicate/spec.md', markedBlockedScenario)
    expect(await scenarioGate(root, brownfieldChange)).toMatchObject({ passed: false })
  })

  it('detects lost or altered evidence across document transitions', async () => {
    const missingEvidence = ['go::./auth::TestBlockedAccountWithValidCredentials']
    const missing = await brownfieldFixture({ mainEvidence: missingEvidence, workingEvidence: missingEvidence })
    const redirectedEvidence = ['go::redirected-one', 'pytest::redirected-two']
    const redirected = await brownfieldFixture({
      mainEvidence: redirectedEvidence,
      workingEvidence: redirectedEvidence,
    })
    const altered = await brownfieldFixture({
      workingEvidence: ['go::changed', 'pytest::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials'],
    })
    const outcomes = await Promise.all([
      brownfieldGate(missing, brownfieldChange),
      brownfieldGate(redirected, brownfieldChange),
      brownfieldGate(altered, brownfieldChange),
    ])

    expect(outcomes.map(gates => gates.find(gate => gate.name === 'transition-stable-evidence')?.passed)).toEqual([
      false,
      false,
      false,
    ])
    expect(outcomes[1]?.find(gate => gate.name === 'main-scope-evidence')).toMatchObject({ passed: false })
    expect(outcomes[2]?.find(gate => gate.name === 'transition-stable-evidence')).toMatchObject({ passed: false })
  })
})
