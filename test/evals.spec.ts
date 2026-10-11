import { cp, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentDriver, AgentRequest, AgentResult, EvalCase } from '../evals/types.ts'
import { runEval } from '../evals/harness.ts'
import { brownfieldGate, guidanceActivationGate, integrityGate, judgeCompletedWorkspace, judgeProposalCheckpoint, judgeWorkingCheckpoint, mutationGate, registryPlacementGate, scenarioGate, skillActivationGate, snapshotProtectedFiles } from '../evals/judge.ts'
import { judgeEvidenceRepair } from '../evals/evidence-repair.ts'
import { evalCase } from '../evals/cases.ts'
import { provisionWorkspace } from '../evals/provision.ts'
import { runProcess } from '../evals/process.ts'

const roots: string[] = []
const repository = fileURLToPath(new URL('..', import.meta.url))
const WORKFLOW_GUIDANCE = '# Authoritative workflow\n\nFollow the installed package guidance.\n'
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
  const destination = join(root, 'node_modules/focused-spec')
  await mkdir(destination, { recursive: true })
  await Promise.all([
    cp(join(repository, 'dist'), join(destination, 'dist'), { recursive: true }),
    cp(join(repository, 'guidance'), join(destination, 'guidance'), { recursive: true }),
    cp(join(repository, 'skills'), join(destination, 'skills'), { recursive: true }),
    cp(join(repository, 'package.json'), join(destination, 'package.json')),
  ])
  for (const dependency of ['@cucumber/gherkin', '@cucumber/messages', 'fast-glob', 'mdast-util-from-markdown', 'yaml']) {
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

function guidanceTranscript(workspace: string, options: GuideTranscriptOptions = {}): string {
  const callId = 'workflow-guide'
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
  readonly artifact?: string
  readonly cliComplete?: boolean
  readonly cliFailed?: boolean
  readonly readComplete?: boolean
  readonly readFailed?: boolean
  readonly readBeforeCommand?: boolean
  readonly omitCommand?: boolean
  readonly response?: unknown
  readonly rawArtifactOutput?: string
}

function artifactGuidanceTranscript(workspace: string, options: ArtifactTranscriptOptions = {}): string {
  const artifact = options.artifact ?? 'artifact://0'
  const linked = 'artifact://0'
  const cli = join(workspace, 'node_modules', 'focused-spec', 'dist', 'cli.js')
  const command = `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} instructions --protocol 1 --topic workflow --json`
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
        content: [{ type: 'text', text: `{"protocolVersion":1,"package":{"name":"focused-spec","version":"0.6.0"},"topic":"workflow","content":"# Authoritative workflow…\n\n\nWall time: 0.36 seconds\n\n[Some lines truncated to 768 bytes. Read ${linked} for full output]` }],
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
    put(root, 'node_modules/focused-spec/guidance/workflow.md', WORKFLOW_GUIDANCE),
  ])
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
  await installFocusedPackage(root)
  await put(root, 'package.json', '{"private":true,"type":"module"}\n')
  await put(root, '.focused-spec/config.yaml', [
    'version: 3',
    'specifications:',
    '  documents:',
    '    - match: openspec/specs/**/spec.md',
    '      exclude:',
    '        - openspec/specs/excluded/**',
    '      scope: current',
    '    - match: openspec/changes/{scope}/specs/**/spec.md',
    '      exclude:',
    '        - openspec/changes/archive/**',
    'runners:',
    '  go-unit:',
    '    module: ./runner.js',
    '  pytest-functional:',
    '    module: ./runner.js',
  ].join('\n'))
  await put(root, 'blocked-account.txt', 'rejected')
  await put(root, 'runner.js', [
    "import { readFile } from 'node:fs/promises'",
    "import { join } from 'node:path'",
    'export default {',
    '  apiVersion: 1,',
    '  async resolve({ selectors }) {',
    '    return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] }',
    '  },',
    '  async run({ projectRoot, targets }) {',
    "    const behavior = await readFile(join(projectRoot, 'blocked-account.txt'), 'utf8')",
    "    return { results: targets.map(target => ({ targetId: target.targetId, status: behavior === 'rejected' && ['./auth::TestBlockedAccountWithValidCredentials', 'tests/functional/test_auth.py::test_blocked_account_with_valid_credentials'].includes(target.selector) ? 'pass' : 'fail' })) }",
    '  },',
    '}',
  ].join('\n'))
  const overlay = join(repository, 'evals/cases/openspec-brownfield/overlay/openspec')
  const native = await readFile(join(overlay, 'specs/account-authentication/spec.md'), 'utf8')
  if (!native.includes(nativeBlockedScenario)) throw new Error('bare OpenSpec fixture lost its blocked-account scenario')
  await cp(join(overlay, 'changes/archive/2026-09-26-reject-blocked-accounts'),
    join(root, 'openspec/changes/archive/2026-09-26-reject-blocked-accounts'), { recursive: true })
  const expected = ['go-unit::./auth::TestBlockedAccountWithValidCredentials', 'pytest-functional::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials']
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
  it('rejects domain reorganization and loss of existing registrations despite valid new evidence', async () => {
    const selected = evalCase('registry-shards-reuse')!
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-shards-'))
    roots.push(root)
    await cp(join(repository, 'evals', selected.overlay!), root, { recursive: true })
    const path = '.focused-spec/evidence/auth.yaml'
    const initial = await readFile(join(root, path), 'utf8')
    const entry = '  current:\n    auth.login.blocked:\n      evidence:\n        - go-unit::./auth::TestBlockedAccount\n        - pytest-functional::tests/functional/test_auth.py::test_blocked_account\n'
    await put(root, path, initial + entry)
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: true })
    await put(root, path, `scopes:\n${entry}`)
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: false })
    await put(root, path, initial)
    await put(root, '.focused-spec/evidence/blocked.yaml', `scopes:\n${entry}`)
    const config = await readFile(join(root, '.focused-spec/config.yaml'), 'utf8')
    await put(root, '.focused-spec/config.yaml', config.replace('runners:', '    - .focused-spec/evidence/blocked.yaml\nrunners:'))
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
    const entry = 'scopes:\n  current:\n    auth.login.blocked:\n      evidence:\n        - go-unit::./auth::TestBlockedAccount\n        - pytest-functional::tests/functional/test_auth.py::test_blocked_account\n'
    await put(root, '.focused-spec/evidence/login.yaml', entry)
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: false })
    await put(root, '.focused-spec/config.yaml', config.replace('runners:', '    - .focused-spec/evidence/login.yaml\nrunners:'))
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: true })
    await put(root, '.focused-spec/evidence.yaml', entry)
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: false })
    await rm(join(root, '.focused-spec/evidence.yaml'))
    await put(root, 'app/notifications.py', 'def should_deliver(enabled):\n    return True\n')
    expect(await integrityGate(root, protectedFiles, [])).toMatchObject({ passed: false })
    await put(root, '.focused-spec/config.yaml', config.replace('runners:', '    - .focused-spec/evidence/login.yaml\nrunners:').replace('runners/go-test.ts', 'runners/fabricated.ts'))
    expect(await registryPlacementGate(root, selected, 'auth.login.blocked')).toMatchObject({ passed: false })
  })

  it('provisions parallel workspaces without rebuilding shared distribution', async () => {
    const selected = evalCase('files-source-bootstrap')!
    const distribution = join(repository, 'dist/cli.js')
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
      .replace('    - match: openspec/changes/{scope}/specs/**/spec.md\n      exclude:\n        - openspec/changes/archive/**\n', '')
    await put(root, '.focused-spec/config.yaml', config)
    const registryPath = join(root, '.focused-spec/evidence.yaml')
    await put(root, '.focused-spec/evidence.yaml', (await readFile(registryPath, 'utf8')).replace('  current:', '  published:'))
    const gates = await brownfieldGate(root, brownfieldChange, checkpoint)
    expect(gates.map(gate => gate.passed)).toEqual([true, true, true])
    await rm(join(root, 'openspec/changes/add-auth'), { recursive: true, force: true })
    expect((await brownfieldGate(root, brownfieldChange, checkpoint)).map(gate => gate.passed)).toEqual([true, true, true])
    expect(await brownfieldGate(root, brownfieldChange)).toEqual([expect.objectContaining({ name: 'brownfield-contract', passed: false })])
    await put(root, '.focused-spec/evidence.yaml', (await readFile(registryPath, 'utf8')).replace('go-unit::./auth', 'go-unit::./changed'))
    expect((await brownfieldGate(root, brownfieldChange, checkpoint)).find(gate => gate.name === 'transition-stable-evidence')).toMatchObject({ passed: false })
    await rm(join(root, 'openspec/changes/archive/2026-09-26-reject-blocked-accounts'), { recursive: true, force: true })
    expect(await brownfieldGate(root, brownfieldChange, checkpoint)).toEqual([
      expect.objectContaining({ name: 'native-history-preservation', passed: false, detail: expect.stringContaining('missing') }),
    ])
  })

  it('stops before sync when working evidence fails', async () => {
    let turns = 0
    const driver: AgentDriver = {
      async run(request) {
        turns += 1
        await put(request.workspace, '.focused-spec/config.yaml', [
          'version: 3', 'specifications:', '  documents:', '    - match: openspec/changes/{scope}/specs/**/spec.md',
          '      exclude: [openspec/changes/archive/**]', 'runners:',
          '  go-unit: { module: ./runner.js }', '  pytest-functional: { module: ./runner.js }',
        ].join('\n'))
        await put(request.workspace, '.focused-spec/evidence.yaml', [
          'scopes:', '  link-blocked-auth-evidence:', '    auth.login.blocked-account:', '      evidence:',
          '        - go-unit::./auth::TestBlockedAccountWithValidCredentials',
          '        - pytest-functional::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials',
        ].join('\n'))
        await put(request.workspace, 'runner.js', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run({ targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "fail" })) } } }\n')
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
          return { success: true, output: JSON.stringify({ type: 'message_end', message: { role: 'assistant',
            content: [{ type: 'text', text: 'Clarify the verification boundary; do not relabel the failed turn.' }] } }), exitCode: 0, durationMs: 2 }
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

  it('rejects global guidance in place of the project installation', async () => {
    const root = await activationFixture()
    const args = 'instructions --protocol 1 --topic workflow --json'
    for (const command of [`focused-spec ${args}`, `/usr/local/bin/focused-spec ${args}`,
      `${join(root, '..', 'other', 'node_modules', '.bin', 'focused-spec')} ${args}`]) {
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command })]), command).toMatchObject({ passed: false })
    }
    const local = `${join(root, 'node_modules', '.bin', 'focused-spec')} ${args}`
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: local })])).toMatchObject({ passed: true })
  })

  it('rejects absent or legacy local guidance activation', async () => {
    const root = await activationFixture()
    expect(await guidanceActivationGate(root, [skillReadTranscript()])).toMatchObject({ passed: false })
    const cli = join(root, 'node_modules', 'focused-spec', 'dist', 'cli.js')
    const help = `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} --help`
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: help,
      rawOutput: 'Usage: focused-spec <command> [options]' })])).toMatchObject({ passed: false })
    await rm(join(root, 'node_modules', 'focused-spec', 'package.json'))
    expect(await guidanceActivationGate(root, [guidanceTranscript(root)])).toMatchObject({
      passed: false, detail: 'project-local focused-spec package metadata or workflow guidance is missing or invalid',
    })
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

  it('requires fresh guidance for a subsequent workflow step', async () => {
    const root = await activationFixture()
    const first = guidanceTranscript(root)
    expect(await guidanceActivationGate(root, [first, guidanceTranscript(root, { complete: false })])).toMatchObject({ passed: false,
      detail: expect.stringContaining('workflow step 2') })
    expect(await guidanceActivationGate(root, [first, guidanceTranscript(root)])).toMatchObject({ passed: true })
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root),
      artifactGuidanceTranscript(root, { omitCommand: true })])).toMatchObject({ passed: false,
      detail: expect.stringContaining('workflow step 2') })

    const updatedWorkflow = '# Updated authoritative workflow\n\nFollow the replacement package.\n'
    await Promise.all([
      put(root, 'node_modules/focused-spec/package.json', JSON.stringify({ name: 'focused-spec', version: '0.7.0' })),
      put(root, 'node_modules/focused-spec/guidance/workflow.md', updatedWorkflow),
    ])
    const updated = guidanceTranscript(root, { response: {
      protocolVersion: 1,
      package: { name: 'focused-spec', version: '0.7.0' },
      topic: 'workflow',
      content: updatedWorkflow,
    } })
    expect(await guidanceActivationGate(root, [updated])).toMatchObject({ passed: true })
    expect(await guidanceActivationGate(root, [first])).toMatchObject({ passed: false })
  })

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
    await put(root, '.focused-spec/config.yaml', 'version: 3\n')
    const checkpoint = await judgeProposalCheckpoint(root, change)
    expect(checkpoint.gates.find(gate => gate.name === 'proposal-artifacts')).toMatchObject({ passed: true })
    expect(checkpoint.gates.find(gate => gate.name === 'planning-boundary')).toMatchObject({ passed: false, detail: expect.stringContaining('implementation started') })
    await rm(join(root, '.focused-spec/config.yaml'))
    await put(root, '.focused-spec/evidence.yaml', 'scopes:\n  add-auth:\n    auth.blocked:\n      evidence: [planned:project-tests::target]\n')
    expect((await judgeProposalCheckpoint(root, change)).gates.find(gate => gate.name === 'planning-boundary')).toMatchObject({ passed: false })
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
    const { changeName: _, prescribedScenarioId: __, ...selected } = change
    await put(root, '.focused-spec/config.yaml', [
      'version: 3', 'specifications:', '  documents:', '    - match: specs/**/*.md', '      scope: current',
      'runners:', '  project-tests:', '    module: ./runner.js',
    ].join('\n'))
    const scenario = (id: string, name = 'Blocked') => [
      `<!-- focused-spec:id=${id} -->`, `#### Scenario: ${name}`, '- **WHEN** blocked', '- **THEN** rejected',
    ].join('\n')
    const registry = (...ids: string[]) => [
      'scopes:', '  current:',
      ...ids.flatMap(id => [`    ${id}:`, '      evidence:', '        - project-tests::target']),
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
    await put(root, 'specs/auth.md', '<!-- focused-spec:id=INVALID -->\n#### Scenario: Blocked\n- **WHEN** blocked\n- **THEN** rejected')
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
      'version: 3', 'specifications:', '  documents:', `    - match: ${match}`, '      scope: current',
      extra, 'runners:', '  go-tests: { module: ./runner.mjs }',
    ].filter(Boolean).join('\n')
    await put(root, '.focused-spec/config.yaml', config('openspec/changes/reject-blocked-login/specs/**/*.md'))
    await put(root, path, `<!-- focused-spec:id=${id} -->\n#### Scenario: Blocked account\n- **WHEN** a blocked account has valid credentials\n- **THEN** authentication is rejected\n`)
    await put(root, '.focused-spec/evidence.yaml', `scopes:\n  current:\n    ${id}:\n      evidence: [go-tests::auth/auth_test.go::TestBlockedAccount]\n`)
    await put(root, 'runner.mjs', [
      "import { execFileSync } from 'node:child_process'",
      'export default { apiVersion: 1,',
      'async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      'async run({ cwd, targets }) {',
      '  let output;',
      '  try { output = execFileSync("go", ["test", "-json", "./auth", "-run", "^TestBlockedAccount$", "-count=1"], { cwd, encoding: "utf8" }) }',
      '  catch (error) { output = error.stdout }',
      '  const events = output.trim().split("\\n").map(line => JSON.parse(line)).filter(event => event.Test === "TestBlockedAccount");',
      '  const ran = events.some(event => event.Action === "run");',
      '  const terminal = events.filter(event => ["pass", "fail", "skip"].includes(event.Action));',
      '  return { results: targets.map(target => ({ targetId: target.targetId, status: ran && terminal.length === 1 && terminal[0].Action === "pass" ? "pass" : "fail", diagnostic: output })) }',
      '} }',
    ].join('\n'))

    const gates = await judgeCompletedWorkspace(root, selected, new Map(), [], undefined, id)
    expect(gates.find(gate => gate.name === 'focused-validation')).toMatchObject({ passed: true, detail: expect.stringContaining('selected scope current') })
    expect(gates.find(gate => gate.name === 'focused-execution')).toMatchObject({ passed: true, detail: expect.stringContaining('go-tests::auth/auth_test.go::TestBlockedAccount') })
    expect(gates.find(gate => gate.name === 'scenario-contract')).toMatchObject({ passed: true })
    expect(gates.find(gate => gate.name === 'mutation-sensitivity')).toMatchObject({ passed: true })
    expect(await scenarioGate(root, selected, undefined, 'changed.identity')).toMatchObject({ passed: false })
    await put(root, '.focused-spec/config.yaml', config('openspec/changes/reject-blocked-login/specs/**/*.md', '    - match: openspec/changes/reject-blocked-login/specs/**/*.md\n      scope: second'))
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
      'version: 3', 'specifications:', '  documents:', '    - match: specs/**/*.md', '      scope: current',
      'runners:', '  project-tests:', '    module: ./runner.js',
    ].join('\n'))
    await put(root, 'specs/auth.md', [
      '<!-- focused-spec:id=account.authentication.blocked -->', '#### Scenario: Blocked',
      '- **WHEN** blocked', '- **THEN** rejected',
    ].join('\n'))
    await put(root, '.focused-spec/evidence.yaml', [
      'scopes:', '  current:', '    account.authentication.blocked:', '      evidence:',
      '        - project-tests::target',
    ].join('\n'))
    expect(await scenarioGate(root, change, 'current')).toMatchObject({ passed: false })
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
    await put(root, 'node_modules/focused-spec/dist/cli.js', 'process.exit(0)\n')
    const goBefore = await readFile(join(root, 'auth/auth.go'), 'utf8')
    const pythonBefore = await readFile(join(root, 'app/auth.py'), 'utf8')
    const { changeName: _, ...withoutChange } = change
    const gate = await mutationGate(root, withoutChange)
    expect(gate).toMatchObject({ name: 'mutation-sensitivity', passed: false, detail: 'mutation results: go=0 python=0' })
    expect(await readFile(join(root, 'auth/auth.go'), 'utf8')).toBe(goBefore)
    expect(await readFile(join(root, 'app/auth.py'), 'utf8')).toBe(pythonBefore)
  })

  it('retains checkpointed scope-local evidence after a working document leaves discovery', async () => {
    const root = await brownfieldFixture()
    const checkpoint = await judgeWorkingCheckpoint(root, brownfieldChange)
    expect(checkpoint.gates.every(gate => gate.passed)).toBe(true)
    const configPath = join(root, '.focused-spec/config.yaml')
    await put(root, '.focused-spec/config.yaml', (await readFile(configPath, 'utf8')).replace('scope: current', 'scope: published')
      .replace('    - match: openspec/changes/{scope}/specs/**/spec.md\n      exclude:\n        - openspec/changes/archive/**\n', ''))
    const registryPath = join(root, '.focused-spec/evidence.yaml')
    await put(root, '.focused-spec/evidence.yaml', (await readFile(registryPath, 'utf8')).replace('  current:', '  published:'))
    const gates = await brownfieldGate(root, brownfieldChange, checkpoint)

    expect(gates.map(gate => ({ name: gate.name, passed: gate.passed }))).toEqual([
      { name: 'native-history-preservation', passed: true },
      { name: 'main-scope-evidence', passed: true },
      { name: 'transition-stable-evidence', passed: true },
    ])
    await put(root, 'blocked-account.txt', 'allowed')
    const regression = await brownfieldGate(root, brownfieldChange, checkpoint)
    expect(regression.find(gate => gate.name === 'main-scope-evidence')).toMatchObject({ passed: false })
    expect(regression.find(gate => gate.name === 'transition-stable-evidence')).toMatchObject({ passed: false })
  })

  it('retains executed checkpoints after working identity and registry retire in place', async () => {
    const root = await brownfieldFixture()
    const checkpoint = await judgeWorkingCheckpoint(root, brownfieldChange)
    expect(checkpoint.gates.every(gate => gate.passed)).toBe(true)
    const path = 'openspec/changes/add-auth/specs/account-authentication/spec.md'
    await put(root, path, (await readFile(join(root, path), 'utf8')).replace('<!-- focused-spec:id=auth.login.blocked-account -->\n', ''))
    await put(root, '.focused-spec/evidence.yaml', JSON.stringify({ scopes: { current: {
      'auth.login.blocked-account': { evidence: checkpoint.registry!.evidence },
    } } }))
    expect((await brownfieldGate(root, brownfieldChange, checkpoint)).map(gate => ({ name: gate.name, passed: gate.passed }))).toEqual([
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
    expect(await scenarioGate(root, brownfieldChange)).toMatchObject({ passed: true })

    await put(root, 'openspec/specs/excluded/duplicate/spec.md', markedBlockedScenario)
    expect(await scenarioGate(root, brownfieldChange)).toMatchObject({ passed: true })

    await put(root, 'openspec/specs/duplicate/spec.md', markedBlockedScenario)
    expect(await scenarioGate(root, brownfieldChange)).toMatchObject({ passed: false })
  })

  it('detects lost or altered evidence across document transitions', async () => {
    const missingEvidence = ['go-unit::./auth::TestBlockedAccountWithValidCredentials']
    const missing = await brownfieldFixture({ mainEvidence: missingEvidence, workingEvidence: missingEvidence })
    const redirectedEvidence = ['go-unit::redirected-one', 'pytest-functional::redirected-two']
    const redirected = await brownfieldFixture({
      mainEvidence: redirectedEvidence,
      workingEvidence: redirectedEvidence,
    })
    const altered = await brownfieldFixture({
      workingEvidence: ['go-unit::changed', 'pytest-functional::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials'],
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
