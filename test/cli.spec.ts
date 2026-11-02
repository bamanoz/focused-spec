import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { roots, cli, openSpecLayouts, baselineEntries, put, nativeScenario, inlineScenario, configure, configureInline, writeRegistry, fixture, emptyFixture, json } from './fixtures/cli-suite.js'


describe('focused-spec CLI', () => {
  it('discovers commands and native options without reading project state', async () => {
    const root = await emptyFixture()
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    for (const args of [['--help'], ['-h'], ['help']]) {
      const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toMatch(/^\s+validate\s/mu)
      expect(result.stdout).toMatch(/^\s+run\s/mu)
      expect(result.stdout).toMatch(/^\s+instructions\s/mu)
      expect(result.stdout).toMatch(/^\s+init\s/mu)
    }
    for (const command of ['validate', 'run']) {
      for (const args of [[command, '--help'], [command, '-h'], ['help', command]]) {
        const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
        expect(result.status).toBe(0)
        expect(result.stderr).toBe('')
      }
    }
  })

  it('rejects invalid invocations without treating them as successful help', async () => {
    const root = await emptyFixture()
    for (const args of [[], ['unknown'], ['help', 'unknown'], ['agent-guide'], ['agent-guide', '--help'], ['help', 'agent-guide'], ['transition'], ['transition', '--help'], ['help', 'transition'], ['transition', 'prepare', '--help'], ['transition', 'verify', '--help'], ['transition', 'prepare', 'plan.yaml', '--snapshot', 'snapshot.json'], ['transition', 'verify', 'snapshot.json', '--final'], ['run', '--unknown'], ['run', '--scope']]) {
      const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('--help')
    }
  })

  it('rejects malformed evidence alongside valid evidence before execution', async () => {
    const root = await fixture()
    await writeRegistry(root, [{ ...baselineEntries[0]!, evidence: ['fixture::current', 'invalid-reference'] }])
    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, executionStarted: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.current.passes', message: expect.stringContaining('invalid-reference') })]) })
  })

  it('runs inline ID and EVIDENCE without any registry file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-inline-run-'))
    roots.push(root)
    await configureInline(root)
    await put(root, 'specs/inline.md', inlineScenario('inline.execution', ['fixture::first::suffix', 'fixture::second'], 'Inline evidence executes'))
    await put(root, 'runner.ts', [
      "import { appendFile } from 'node:fs/promises'",
      "import { existsSync } from 'node:fs'",
      "import { join } from 'node:path'",
      'export default { apiVersion: 1,',
      '  async resolve({ projectRoot, selectors }) { await appendFile(join(projectRoot, "observed"), selectors.join("|") + "\\n"); return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run({ projectRoot, targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: target.targetId === "second" && existsSync(join(projectRoot, "fail-second")) ? "fail" : "pass" })) } },',
      '}',
    ].join('\n'))

    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--scenario', 'inline.execution', '--json'], { encoding: 'utf8' })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    expect(json(result.stdout)).toMatchObject({ success: true, targetCount: 2, scenarios: [{
      id: 'inline.execution', scope: 'current', status: 'PASS', evidence: [
        { reference: 'fixture::first::suffix', status: 'PASS' },
        { reference: 'fixture::second', status: 'PASS' },
      ],
    }] })
    expect(await readFile(join(root, 'observed'), 'utf8')).toBe('first::suffix|second\n')
    await expect(readFile(join(root, '.focused-spec/evidence.yaml'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    await put(root, 'fail-second', 'controlled regression')
    const failed = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--scenario', 'inline.execution', '--json'], { encoding: 'utf8' })
    expect(failed.status).toBe(1)
    expect(json(failed.stdout)).toMatchObject({ success: false, targetCount: 2, scenarios: [{
      id: 'inline.execution', status: 'FAIL', evidence: [
        { reference: 'fixture::first::suffix', status: 'PASS' },
        { reference: 'fixture::second', status: 'FAIL' },
      ],
    }] })
  })

  it('preserves opaque IDs through selection and results', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-opaque-ids-'))
    roots.push(root)
    await configureInline(root)
    const ids = ['auth-login', '123', 'INVALID', 'Case', 'case', 'Вход разрешён', 'path/looking id']
    await put(root, 'specs/opaque.md', ids.map((id, index) => inlineScenario(id, [`fixture::opaque-${index}`])).join('\n\n'))
    await put(root, 'runner.ts', [
      'export default { apiVersion: 1,',
      '  async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run({ targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))

    for (const id of ids) {
      const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--scenario', id, '--json'], { encoding: 'utf8' })
      expect(result.status, `${id}: ${result.stderr || result.stdout}`).toBe(0)
      expect(json(result.stdout)).toMatchObject({ scenarios: [{ id, scope: 'current', status: 'PASS' }] })
    }
  })

  it('isolates selected inline errors without inheriting evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-inline-selection-'))
    roots.push(root)
    await configureInline(root, [{ match: 'specs/{scope}.md' }])
    await put(root, 'specs/good.md', inlineScenario('inline.shared', ['fixture::good']))
    await put(root, 'specs/broken.md', [
      '#### Scenario: Invalid unrelated occurrence',
      '- **ID**: `inline.shared`',
      '- **EVIDENCE**: invalid-reference',
      '- **WHEN** broken input arrives',
      '- **THEN** no execution begins',
    ].join('\n'))
    await put(root, 'specs/missing.md', [
      '#### Scenario: Missing local evidence',
      '- **ID**: `inline.shared`',
      '- **WHEN** evidence is absent',
      '- **THEN** evidence is not inherited',
    ].join('\n'))
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run({ targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "pass" })) } } }')

    const selected = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'good', '--scenario', 'inline.shared', '--json'], { encoding: 'utf8' })
    expect(selected.status, selected.stderr || selected.stdout).toBe(0)
    expect(json(selected.stdout)).toMatchObject({ scenarios: [{ id: 'inline.shared', scope: 'good', status: 'PASS' }], targetCount: 1 })
    const missing = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'missing', '--json'], { encoding: 'utf8' })
    expect(missing.status).toBe(1)
    expect(json(missing.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'inline.shared' })]) })
    const full = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(full.status).toBe(1)
    expect(json(full.stdout)).toMatchObject({ valid: false })
  })

  it('rejects competing inline and external enrollments', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-competing-enrollment-'))
    roots.push(root)
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
    await put(root, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats:',
      '    inline: { package: "@focused-spec/format-inline" }',
      '    external:',
      '      package: "@focused-spec/format-registry"',
      '      options:',
      '        parser: { package: "@focused-spec/format-markdown" }',
      '        files: [".focused-spec/evidence.yaml"]',
      '  documents:',
      '    - { match: specs/inline.md, scope: current, format: inline }',
      '    - { match: registry-layout/**/*.md, scope: current, format: external }',
      'runners:',
      '  fixture: { module: ./runner.ts }',
    ].join('\n'))
    await put(root, 'specs/inline.md', inlineScenario('inline.competing', ['fixture::protected']))
    await writeRegistry(root, [{ scope: 'current', id: 'inline.competing', evidence: ['fixture::protected'] }])
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run() { throw new Error("must not execute") } }')

    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, executionStarted: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'inline.competing', message: expect.stringMatching(/enroll|bound|more than once|competing/iu) })]) })
  })

  it('validates inline planned evidence without loading runners', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-inline-planned-'))
    roots.push(root)
    await configureInline(root, undefined, ['runners:', '  unavailable: { module: ./missing-runner.ts }'])
    await put(root, 'specs/planned.md', inlineScenario('inline.planned', ['planned:unavailable::future']))

    const syntax = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'current', '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(syntax.status, syntax.stderr || syntax.stdout).toBe(0)
    expect(json(syntax.stdout)).toMatchObject({ valid: true, mode: 'syntax-only' })
    const ordinary = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'current', '--json'], { encoding: 'utf8' })
    expect(ordinary.status, ordinary.stderr || ordinary.stdout).toBe(0)
    expect(json(ordinary.stdout)).toMatchObject({ valid: true, scenarios: 1, plannedEvidence: 1, targets: 0 })
    for (const args of [['validate', '--strict'], ['run']] as const) {
      const rejected = spawnSync(process.execPath, [cli, ...args, '--root', root, '--scope', 'current', '--json'], { encoding: 'utf8' })
      expect(rejected.status).toBe(1)
      expect(json(rejected.stdout)).toMatchObject({ valid: false,
        violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'inline.planned', message: expect.stringMatching(/planned evidence is not allowed/iu) })]) })
    }
  })

  it('runs registry-backed native formats without core evidence configuration', async () => {
    const root = await fixture()
    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--json'], { encoding: 'utf8' })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    expect(json(result.stdout)).toMatchObject({ scenarios: [{ id: 'fixture.current.passes', scope: 'current', status: 'PASS' }] })
  })

  it('reports inline binding failures at their metadata lines', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-inline-provenance-'))
    roots.push(root)
    await configureInline(root, undefined, ['runners:', '  fixture:', '    module: ./missing-runner.mjs'])
    await put(root, 'specs/provenance.md', [
      '#### Scenario: Malformed second reference',
      '- **ID**: `inline.provenance`',
      '- **EVIDENCE**: `fixture::valid`',
      '- **EVIDENCE**: malformed-reference',
      '- **WHEN** both rows are validated',
      '- **THEN** the malformed row reports its own line',
    ].join('\n'))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([
      expect.objectContaining({ path: 'specs/provenance.md', line: 4, scenarioId: 'inline.provenance' }),
    ]) })
    expect((json(result.stdout).violations as { line?: number; scenarioId?: string }[])
      .some(violation => violation.scenarioId === 'inline.provenance' && violation.line === 3)).toBe(false)
  })

  it('reports all scenarios, planned evidence, and unique resolved targets', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/shared/spec.md', nativeScenario('fixture.current.shared', 'A second scenario shares executable evidence'))
    await writeRegistry(root, [
      ...baselineEntries,
      { scope: 'current', id: 'fixture.current.shared', evidence: ['fixture::current'] },
    ])

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({
      valid: true,
      validationScope: { scopes: { mode: 'all' } },
      scenarios: 3,
      plannedEvidence: 1,
      targets: 1,
    })
  })

  it('allows planned evidence only during non-strict validation', async () => {
    const root = await fixture()

    const ordinary = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    const strict = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--strict', '--json'], { encoding: 'utf8' })

    expect(ordinary.status).toBe(0)
    expect(json(ordinary.stdout)).toMatchObject({ valid: true, plannedEvidence: 1 })
    expect(strict.status).toBe(1)
    expect(json(strict.stdout)).toMatchObject({
      valid: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.future.planned', message: expect.stringContaining('planned evidence is not allowed') })]),
    })
  })

  it('preserves successful validation and execution for an empty registry', async () => {
    const root = await emptyFixture()

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({
      valid: true,
      validationScope: { scopes: { mode: 'all' } },
      scenarios: 0,
      plannedEvidence: 0,
      targets: 0,
    })
    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({ success: true, executionStarted: false, scenarios: [], targetCount: 0 })
  })

  it('runs a selected scenario despite unrelated entry binding and evidence failures', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
    await put(root, 'openspec/specs/current/spec.md', [
      nativeScenario('fixture.current.selected', 'Selected scenario'),
      nativeScenario('fixture.current.unresolved', 'Unresolved scenario'),
      nativeScenario('fixture.current.planned', 'Planned scenario'),
    ].join('\n\n'))
    await writeRegistry(root, [
      { scope: 'current', id: 'fixture.current.selected', evidence: ['fixture::selected'] },
      { scope: 'current', id: 'fixture.current.unresolved', evidence: ['fixture::broken'] },
      { scope: 'current', id: 'fixture.current.planned', evidence: ['planned:fixture::future'] },
      { scope: 'current', id: 'fixture.current.dangling', evidence: ['fixture::missing'] },
    ])
    await put(root, 'runner.ts', [
      'export default { apiVersion: 1,',
      '  async resolve(request) { return {',
      '    targets: request.selectors.filter(selector => selector !== "broken").map(selector => ({ selector, targetId: selector, displayName: selector })),',
      '    errors: request.selectors.filter(selector => selector === "broken").map(selector => ({ selector, message: "not found" })),',
      '  } },',
      '  async run(request) { return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))

    const selected = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scenario', 'fixture.current.selected', '--json'], { encoding: 'utf8' })
    const full = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(selected.status).toBe(0)
    expect(json(selected.stdout)).toMatchObject({ scenarios: [{ id: 'fixture.current.selected', status: 'PASS' }], targetCount: 1 })
    expect(full.status).toBe(1)
    expect(json(full.stdout)).toMatchObject({ valid: false, executionStarted: false })
  })

  it('validates binding without importing runner modules in syntax only mode', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.future.concrete'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.future.concrete', evidence: ['fixture::future'] },
    ])
    await rm(join(root, 'runner.ts'))

    const syntax = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--syntax-only', '--json'], { encoding: 'utf8' })
    const full = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })

    expect(syntax.status).toBe(0)
    expect(json(syntax.stdout)).toEqual({ valid: true, mode: 'syntax-only', validationScope: { scopes: { mode: 'selected', name: 'add' } } })
    expect(full.status).toBe(1)
  })

  it('rejects a missing evidence registry', async () => {
    const root = await fixture()
    await rm(join(root, '.focused-spec/evidence.yaml'))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/evidence\.yaml/iu) })]) })
  })

  it('rejects a dangling registry entry', async () => {
    const root = await fixture()
    await writeRegistry(root, [
      ...baselineEntries,
      { scope: 'current', id: 'fixture.missing.binding', evidence: ['fixture::missing'] },
    ])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({
      valid: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.missing.binding', message: expect.stringMatching(/(?:bind|matching|native)/iu) })]),
    })
  })

  it('rejects one marker ID bound to multiple native items', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
    await put(root, 'openspec/specs/current/spec.md', [
      nativeScenario('fixture.current.passes', 'First binding'),
      nativeScenario('fixture.current.passes', 'Second binding'),
    ].join('\n\n'))
    await writeRegistry(root, [baselineEntries[0]!])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/(?:unique|multiple|duplicate)/iu) })]) })
  })

  it('requires external native IDs to resolve uniquely', async () => {
    const root = await emptyFixture()
    await configure(root, [{ match: 'stories/**/*.md', scope: 'current' }], [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
    ])
    await put(root, 'stories/auth.md', [
      '# Authentication capabilities',
      '- **CAP-1**: First declaration',
      '- **CAP-1**: Duplicate declaration',
    ].join('\n'))
    await writeRegistry(root, [{
      scope: 'current',
      id: 'fixture.external.duplicate',
      evidence: ['fixture::external'],
      source: { path: 'stories/auth.md', nativeId: 'CAP-1' },
    }])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/(?:unique|multiple|duplicate)/iu) })]) })

    await put(root, 'stories/auth.md', [
      '# Authentication capabilities',
      '- **CAP-1**: Unique declaration',
    ].join('\n'))
    const unique = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(unique.status).toBe(0)
  })

  it('reports missing and malformed configuration', async () => {
    const root = await emptyFixture()
    await rm(join(root, '.focused-spec/config.yaml'))
    const missing = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(missing.status).toBe(1)
    expect(json(missing.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('cannot read configuration') })]) })

    await put(root, '.focused-spec/config.yaml', 'version: [\n')
    const malformed = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(malformed.status).toBe(1)
    expect(json(malformed.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('invalid YAML') })]) })
  })

  it('rejects selections containing only unmarked native content', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/native/specs/example/spec.md', '# Native design\n\nNo marker is declared here.\n')

    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'native', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, executionStarted: false })
    expect(json(result.stdout)).not.toHaveProperty('scenarios')
    await rm(join(root, 'openspec/specs'), { recursive: true })
    await rm(join(root, 'openspec/changes/add'), { recursive: true })
    await writeRegistry(root, [])
    const all = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(all.status).toBe(1)
    expect(json(all.stdout)).toMatchObject({ valid: false, executionStarted: false })
  })

  it('runs marked outcomes beside untouched native content', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
    await put(root, 'openspec/specs/current/spec.md', [
      '#### Scenario: Untouched native outcome',
      '',
      'This content is not enrolled.',
      '',
      nativeScenario('fixture.current.passes', 'Enrolled outcome'),
    ].join('\n'))
    await writeRegistry(root, [baselineEntries[0]!])

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({ scenarios: [{ id: 'fixture.current.passes', status: 'PASS' }], targetCount: 1 })
  })

  it('rejects runner timeouts that overflow the host timer', async () => {
    const root = await fixture()
    await configure(root, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
      '    timeoutMs: 2147482648',
    ])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('timeoutMs') })]) })
    expect(result.stderr).not.toContain('TimeoutOverflowWarning')
  })

  it('rejects invalid runner paths and non-JSON options', async () => {
    const root = await fixture()
    await configure(root, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ../outside.ts',
    ])
    const pathResult = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(pathResult.status).toBe(1)
    expect(json(pathResult.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('project root') })]) })

    await configure(root, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
      '    options: 1e999',
    ])
    const optionsResult = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(optionsResult.status).toBe(1)
    expect(json(optionsResult.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('JSON-compatible') })]) })
  })

  it('rejects invalid or missing selected scenarios before execution', async () => {
    const root = await fixture()
    const invalid = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.future.planned', '--json'], { encoding: 'utf8' })
    expect(invalid.status).toBe(1)
    expect(json(invalid.stdout)).toMatchObject({
      valid: false,
      executionStarted: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.future.planned', message: expect.stringContaining('planned evidence is not allowed') })]),
    })

    const missing = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.missing', '--json'], { encoding: 'utf8' })
    expect(missing.status).toBe(1)
    expect(json(missing.stdout)).toMatchObject({ valid: false, executionStarted: false })
  })

  it('rejects inherited Gherkin tags for the selected ID without blocking unrelated IDs', async () => {
    const root = await fixture()
    await configure(root, [{ match: 'features/**/*.feature', scope: 'current' }])
    await writeRegistry(root, [baselineEntries[0]!])
    const feature = 'Feature: Native login\n\n@focused.fixture.current.passes\nScenario: Selected login\n  When login is attempted\n  Then its outcome is checked\n'
    await put(root, 'features/auth.feature', '@focused.fixture.current.passes\n' + feature)
    const selectedArgs = [cli, 'run', '--root', root, '--scenario', 'fixture.current.passes', '--json']
    const inherited = spawnSync(process.execPath, selectedArgs, { encoding: 'utf8' })
    expect(inherited.status).toBe(1)
    expect(json(inherited.stdout)).toMatchObject({ valid: false, executionStarted: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.current.passes' })]) })
    await put(root, 'features/auth.feature', '@focused.fixture.other.item\n' + feature)
    const isolated = spawnSync(process.execPath, selectedArgs, { encoding: 'utf8' })
    expect(isolated.status).toBe(0)
    expect(json(isolated.stdout)).toMatchObject({ scenarios: [{ id: 'fixture.current.passes', status: 'PASS' }] })
    const full = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(full.status).toBe(1)
    expect(json(full.stdout)).toMatchObject({ valid: false, executionStarted: false })
  })

  it('preserves native run context independently of target provenance', async () => {
    const root = await fixture()
    await put(root, 'runner.ts', `export default {apiVersion:1,async resolve({selectors}){return {targets:selectors.map(selector=>({selector,targetId:selector,displayName:'Not the native name',source:{path:'tests/target.ts',line:91}})),errors:[]}},async run({targets}){return {results:targets.map(t=>({targetId:t.targetId,status:'pass'}))}}}`)
    const args = [cli,'run','--root',root,'--scope','current']
    const report = spawnSync(process.execPath,[...args,'--json'],{encoding:'utf8'})
    expect(report.status).toBe(0)
    expect(json(report.stdout)).toMatchObject({scenarios:[{id:'fixture.current.passes',name:'Scenario: Current evidence passes',source:{path:'openspec/specs/current/spec.md',line:2},evidence:[{reference:'fixture::current',status:'PASS'}]}]})
    const text = spawnSync(process.execPath,args,{encoding:'utf8'})
    expect(text.status).toBe(0)
    expect(text.stdout).toContain('Current evidence passes (openspec/specs/current/spec.md:2)')
    expect(text.stdout).not.toContain('tests/target.ts')
  })

  it('renders compact detailed and JSON events from the same execution contract', async () => {
    const root = await fixture()
    await configureInline(root)
    await put(root,'specs/events.md',inlineScenario('events',['fixture::passing','fixture::failing']))
    await put(root,'runner.ts',`import {appendFileSync} from 'node:fs';import {join} from 'node:path';export default {apiVersion:1,async resolve({selectors}){return {targets:selectors.map(selector=>({selector,targetId:selector,displayName:selector})),errors:[]}},async run({projectRoot,targets}){for(const t of targets)appendFileSync(join(projectRoot,'runs'),t.targetId+'\\n');return {results:targets.map(t=>({targetId:t.targetId,status:t.targetId==='passing'?'pass':'fail',events:[{kind:'custom.phase\\u001b',message:t.targetId+' detail\\u001b[31m\\n'},{kind:'custom.payload',message:'Result',data:{choice:t.targetId+'\\u001b'}}]}))}}}`)
    const outputs = [[],['--details'],['--json'],['--details','--json']].map(flags => spawnSync(process.execPath,[cli,'run','--root',root,...flags],{encoding:'utf8'}))
    expect(outputs.map(o=>o.status)).toEqual([1,1,1,1])
    const [compact,detailed,plainJson,detailJson] = outputs as [SpawnSyncReturns<string>,SpawnSyncReturns<string>,SpawnSyncReturns<string>,SpawnSyncReturns<string>]
    expect(compact.stdout).not.toContain('passing detail')
    expect(compact.stdout).toContain('failing detail\\u001b[31m\\u000a')
    expect(detailed.stdout).toContain('passing detail\\u001b[31m\\u000a')
    expect(detailed.stdout).toContain('failing detail\\u001b[31m\\u000a')
    expect(detailed.stdout).not.toContain('\u001b')
    expect(detailed.stdout).toContain('[custom.phase\\u001b] passing detail\\u001b[31m\\u000a')
    expect(detailed.stdout).toContain('[custom.payload] Result {"choice":"passing\\u001b"}')
    expect(json(plainJson.stdout)).toEqual(json(detailJson.stdout))
    expect(json(plainJson.stdout)).toMatchObject({success:false,targetCount:2,scenarios:[{status:'FAIL',evidence:[{status:'PASS',events:[{kind:'custom.phase\u001b',message:'passing detail\u001b[31m\n'},{kind:'custom.payload',message:'Result',data:{choice:'passing\u001b'}}]},{status:'FAIL',events:[{kind:'custom.phase\u001b',message:'failing detail\u001b[31m\n'},{kind:'custom.payload',message:'Result',data:{choice:'failing\u001b'}}]}]}]})
    expect((await readFile(join(root,'runs'),'utf8')).trim().split('\n').sort()).toEqual([...Array(4).fill('passing'),...Array(4).fill('failing')].sort())
  })

  it('does not execute unresolved evidence when details are requested', async () => {
    const root = await fixture()
    await put(root,'runner.ts',`import {writeFileSync} from 'node:fs';import {join} from 'node:path';export default {apiVersion:1,async resolve({selectors}){return {targets:[],errors:selectors.map(selector=>({selector,message:'not found'}))}},async run({projectRoot}){writeFileSync(join(projectRoot,'executed'),'yes');return {results:[]}}}`)
    const result = spawnSync(process.execPath,[cli,'run','--root',root,'--scope','current','--details','--json'],{encoding:'utf8'})
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({valid:false,executionStarted:false})
    expect(json(result.stdout)).not.toHaveProperty('scenarios')
    await expect(readFile(join(root,'executed'),'utf8')).rejects.toMatchObject({code:'ENOENT'})
    const invalid = spawnSync(process.execPath,[cli,'validate','--root',root,'--details','--json'],{encoding:'utf8'})
    expect(invalid.status).toBe(1)
    expect(json(invalid.stderr)).toMatchObject({error:{code:'invalid_arguments'}})
  })
})
