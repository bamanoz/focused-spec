import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentDriver } from '../evals/types.ts'
import { runEval } from '../evals/harness.ts'
import { integrityGate, judgeProposalCheckpoint, scenarioGate, snapshotProtectedFiles } from '../evals/judge.ts'
import { roots, repository, change, put, installFocusedPackage, FakeDriver } from './fixtures/evals-suite.js'

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
  it('records a failed agent turn without running downstream judges', async () => {
    const result = await runEval({ caseId: 'files-source-bootstrap' }, new FakeDriver())
    expect(result.passed).toBe(false)
    expect(result.gates.find(gate => gate.name === 'agent-turn-1')).toMatchObject({ passed: false })
    expect(result.gates.some(gate => gate.name === 'focused-validation')).toBe(false)
    expect(result.diagnostic).toMatchObject({ status: 'unavailable' })
  }, 360_000)

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
  }, 360_000)

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
  }, 360_000)

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
})
