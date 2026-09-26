import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentDriver, AgentRequest, AgentResult, EvalCase } from '../evals/types.ts'
import { runEval } from '../evals/harness.ts'
import { brownfieldGate, integrityGate, judgeProposalCheckpoint, mutationGate, snapshotProtectedFiles } from '../evals/judge.ts'

const roots: string[] = []
const repository = fileURLToPath(new URL('..', import.meta.url))
const change: EvalCase = {
  id: 'focused-test', description: 'deterministic gate fixture', source: 'openspec',
  changeName: 'add-auth', turns: [], expectedScenarioId: 'auth.blocked',
  expectedEvidenceCount: 1, expectedSelectorFragments: ['target'],
}
const brownfieldChange: EvalCase = {
  ...change,
  id: 'openspec-brownfield',
  expectedScenarioId: 'auth.login.blocked-account',
  expectedEvidenceCount: 2,
  expectedSelectorFragments: ['TestBlockedAccountWithValidCredentials', 'test_blocked_account_with_valid_credentials'],
}

async function put(root: string, path: string, source: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, source)
}

interface BrownfieldFixtureOptions {
  readonly mainEvidence?: readonly string[]
  readonly mainRevision?: string
  readonly workingEvidence?: readonly string[]
  readonly workingRevision?: string | null
}

const nativeBlockedScenario = [
  '#### Scenario: Blocked account with valid credentials',
  '- **WHEN** a blocked account supplies valid credentials to either authentication function',
  '- **THEN** authentication is rejected',
].join('\n')

function focusedScenario(evidence: readonly string[], revision?: string): string {
  return nativeBlockedScenario.replace('\n- **WHEN**', [
    '\n- **ID**: `auth.login.blocked-account`',
    ...(revision === undefined ? [] : [`\n- **REVISES**: ${revision}`]),
    ...evidence.map(reference => `\n- **EVIDENCE**: \`${reference}\``),
    '\n- **WHEN**',
  ].join(''))
}

async function brownfieldFixture(options: BrownfieldFixtureOptions = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-eval-brownfield-'))
  roots.push(root)
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await symlink(repository, join(root, 'node_modules/focused-spec'), 'junction')
  await put(root, 'package.json', '{"private":true,"type":"module"}\n')
  await put(root, '.focused-spec/config.yaml', [
    'version: 2',
    'specifications:',
    '  documents:',
    '    - match: openspec/specs/**/spec.md',
    '      scope: current',
    '    - match: openspec/changes/{scope}/specs/**/spec.md',
    'runners:',
    '  fixture:',
    '    module: ./runner.js',
  ].join('\n'))
  await put(root, 'blocked-account.txt', 'rejected')
  await put(root, 'runner.js', [
    "import { appendFile, readFile } from 'node:fs/promises'",
    "import { join } from 'node:path'",
    'export default {',
    '  apiVersion: 1,',
    '  async resolve({ selectors }) {',
    '    return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] }',
    '  },',
    '  async run({ projectRoot, targets }) {',
    "    const behavior = await readFile(join(projectRoot, 'blocked-account.txt'), 'utf8')",
    "    await appendFile(join(projectRoot, 'runner-invocations'), 'x')",
    "    return { results: targets.map(target => ({ targetId: target.targetId, status: behavior === 'rejected' && ['./auth::TestBlockedAccountWithValidCredentials', 'tests/functional/test_auth.py::test_blocked_account_with_valid_credentials'].includes(target.selector) ? 'pass' : 'fail' })) }",
    '  },',
    '}',
  ].join('\n'))
  const overlay = join(repository, 'evals/cases/openspec-brownfield/overlay/openspec')
  const native = await readFile(join(overlay, 'specs/account-authentication/spec.md'), 'utf8')
  if (!native.includes(nativeBlockedScenario)) throw new Error('bare OpenSpec fixture lost its blocked-account scenario')
  await cp(join(overlay, 'changes/archive/2026-09-26-reject-blocked-accounts'),
    join(root, 'openspec/changes/archive/2026-09-26-reject-blocked-accounts'), { recursive: true })
  const expected = ['fixture::./auth::TestBlockedAccountWithValidCredentials', 'fixture::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials']
  await put(root, 'openspec/specs/account-authentication/spec.md', native.replace(nativeBlockedScenario,
    focusedScenario(options.mainEvidence ?? expected, options.mainRevision)))
  await put(root, 'openspec/changes/add-auth/specs/account-authentication/spec.md', [
    '## MODIFIED Requirements',
    '### Requirement: Account authentication respects blocked status',
    native.replace(nativeBlockedScenario,
      focusedScenario(options.workingEvidence ?? expected, options.workingRevision === undefined ? 'current' : options.workingRevision ?? undefined)),
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
  it('records a failed agent turn without running downstream judges', async () => {
    const result = await runEval({ caseId: 'files-source-bootstrap' }, new FakeDriver())
    expect(result.passed).toBe(false)
    expect(result.gates).toEqual([{ name: 'agent-turn-1', passed: false, detail: 'exit=17 durationMs=1' }])
  }, 30_000)
  it('rejects a proposal that creates runner or product implementation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-proposal-'))
    roots.push(root)
    for (const file of ['proposal.md', 'design.md', 'tasks.md', '.openspec.yaml']) {
      await put(root, `openspec/changes/add-auth/${file}`, 'planning artifact')
    }
    await put(root, 'openspec/changes/add-auth/specs/auth/spec.md', [
      '## ADDED Requirements', '### Requirement: Auth', '#### Scenario: Blocked',
      '- **ID**: `auth.blocked`', '- **EVIDENCE**: `planned:go-unit::target`',
      '- **WHEN** blocked', '- **THEN** rejected',
    ].join('\n'))
    await put(root, '.focused-spec/config.yaml', 'version: 1\n')
    const gates = await judgeProposalCheckpoint(root, change)
    expect(gates.find(gate => gate.name === 'proposal-artifacts')).toMatchObject({ passed: true })
    expect(gates.find(gate => gate.name === 'planning-boundary')).toMatchObject({ passed: false, detail: expect.stringContaining('implementation started') })
  })

  it('accepts either exact test during planning but rejects unrelated evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-routing-'))
    roots.push(root)
    const selected: EvalCase = {
      ...change,
      id: 'full-skill-routing',
      maximumEvidenceCount: 2,
      expectedScenarioId: 'auth.login.blocked-account',
      expectedSelectorFragments: [],
      expectedSelectorAlternatives: ['::./auth::TestBlockedAccount', '::tests/functional/test_auth.py::test_blocked_account'],
    }
    for (const file of ['proposal.md', 'design.md', 'tasks.md', '.openspec.yaml']) {
      await put(root, `openspec/changes/add-auth/${file}`, 'planning artifact')
    }
    const spec = 'openspec/changes/add-auth/specs/auth/spec.md'
    const scenario = (selector: string) => [
      '## ADDED Requirements', '### Requirement: Auth', '#### Scenario: Blocked',
      '- **ID**: `auth.login.blocked-account`', `- **EVIDENCE**: \`planned:tests::${selector}\``,
      '- **WHEN** blocked', '- **THEN** rejected',
    ].join('\n')
    for (const selector of ['./auth::TestBlockedAccount', 'tests/functional/test_auth.py::test_blocked_account']) {
      await put(root, spec, scenario(selector))
      expect((await judgeProposalCheckpoint(root, selected)).find(gate => gate.name === 'planned-evidence')).toMatchObject({ passed: true })
    }
    await put(root, spec, scenario('./auth::TestBlockedAccount').replace('- **WHEN** blocked',
      '- **EVIDENCE**: `planned:python::tests/functional/test_auth.py::test_blocked_account`\n- **WHEN** blocked'))
    expect((await judgeProposalCheckpoint(root, selected)).find(gate => gate.name === 'planned-evidence')).toMatchObject({ passed: true })
    await put(root, spec, scenario('test_unrelated'))
    expect((await judgeProposalCheckpoint(root, selected)).find(gate => gate.name === 'planned-evidence')).toMatchObject({ passed: false })
  })

  it('rejects protected test and package changes in an evaluated workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-integrity-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await put(root, 'node_modules/focused-spec/dist/cli.js', 'export default 1\n')
    const snapshots = await snapshotProtectedFiles(root)
    await put(root, 'auth/auth_test.go', 'package auth\n')
    await put(root, 'node_modules/focused-spec/dist/cli.js', 'export default 2\n')
    const gate = await integrityGate(root, snapshots, [])
    expect(gate).toMatchObject({ name: 'integrity', passed: false, detail: expect.stringContaining('auth/auth_test.go') })
    expect(gate.detail).toContain('node_modules/focused-spec/dist/cli.js')
  })

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

  it('preserves legacy outcomes while enrolling one changed outcome', async () => {
    const root = await brownfieldFixture()
    const gates = await brownfieldGate(root, brownfieldChange)

    expect(gates).toEqual([
      { name: 'legacy-preservation', passed: true, detail: '3/3 native scenarios preserved and 3 remain unenrolled' },
      { name: 'main-scope-evidence', passed: true, detail: 'main owner scope=current; owner count=1; expected 2 evidence; observed 2 passing evidence' },
      { name: 'transition-stable-evidence', passed: true, detail: 'working document absent; ownership valid; main owner PASS with unchanged evidence' },
    ])
    expect(await readFile(join(root, 'runner-invocations'), 'utf8')).toBe('xx')
    await put(root, 'blocked-account.txt', 'allowed')
    const regression = await brownfieldGate(root, brownfieldChange)
    expect(regression.find(gate => gate.name === 'main-scope-evidence')).toMatchObject({ passed: false })
    expect(regression.find(gate => gate.name === 'transition-stable-evidence')).toMatchObject({ passed: false })
  })

  it('rejects an orphan revision after a working document leaves discovery', async () => {
    const root = await brownfieldFixture({ mainRevision: 'add-auth', workingRevision: null })
    const gates = await brownfieldGate(root, brownfieldChange)

    expect(gates.find(gate => gate.name === 'transition-stable-evidence')).toMatchObject({
      passed: false,
      detail: expect.stringContaining('requires an existing same-ID scenario'),
    })
  })

  it('detects lost or altered evidence across document transitions', async () => {
    const missingEvidence = ['fixture::./auth::TestBlockedAccountWithValidCredentials']
    const missing = await brownfieldFixture({ mainEvidence: missingEvidence, workingEvidence: missingEvidence })
    const redirectedEvidence = ['fixture::redirected-one', 'fixture::redirected-two']
    const redirected = await brownfieldFixture({
      mainEvidence: redirectedEvidence,
      workingEvidence: redirectedEvidence,
    })
    const altered = await brownfieldFixture({
      workingEvidence: ['fixture::changed', 'fixture::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials'],
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
    expect(outcomes[2]?.find(gate => gate.name === 'transition-stable-evidence')).toMatchObject({
      passed: false,
      detail: expect.stringContaining('ownership invalid'),
    })
  })
})
