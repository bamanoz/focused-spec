import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { glob } from 'glob'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentDriver } from '../evals/types.ts'
import { runEval } from '../evals/harness.ts'
import { brownfieldGate, integrityGate, judgeCompletedWorkspace, judgeWorkingCheckpoint, mutationGate, registryPlacementGate, scenarioGate, snapshotProtectedFiles } from '../evals/judge.ts'
import { judgeEvidenceRepair } from '../evals/evidence-repair.ts'
import { specRevisionGate } from '../evals/spec-revision.ts'
import { evalCase } from '../evals/cases.ts'
import { provisionWorkspace } from '../evals/provision.ts'
import { runProcess } from '../evals/process.ts'
import { captureUpgradeBaseline, upgradeArtifactsGate, upgradePreservationGate } from '../evals/upgrade.ts'
import { roots, repository, change, brownfieldChange, put, installFocusedPackage, skillReadTranscript, guidanceTranscript, markedBlockedScenario, revisedBlockedSpec, registry, brownfieldFixture, openSpecSkillsFixture } from './fixtures/evals-suite.js'

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
describe('agent eval harness', () => {
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

  const checkpointRetirement = 'retains executed checkpoints after working identity and registry retire in place'

  let retirementFixture: { root: string; checkpoint: Awaited<ReturnType<typeof judgeWorkingCheckpoint>> }

  beforeEach(async ({ task }) => {
    if (task.name !== checkpointRetirement) return
    const root = await brownfieldFixture()
    const checkpoint = await judgeWorkingCheckpoint(root, brownfieldChange)
    expect(checkpoint.gates.filter(gate => !gate.passed)).toEqual([])
    retirementFixture = { root, checkpoint }
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
    const result = await runEval({ caseId: 'openspec-brownfield', openspecSkillsDir: await openSpecSkillsFixture() }, driver)
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
