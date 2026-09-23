import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))

async function put(root: string, path: string, content: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, content)
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-cli-'))
  roots.push(root)
  await put(root, '.focused-spec/config.yaml', [
    'version: 1',
    'specifications:',
    '  source: openspec',
    'runners:',
    '  fixture:',
    '    module: ./runner.ts',
  ].join('\n'))
  await put(root, 'openspec/specs/current/spec.md', [
    '### Requirement: Current behavior',
    '#### Scenario: Current evidence passes',
    '- **ID**: `fixture.current.passes`',
    '- **EVIDENCE**: `fixture::current`',
    '- **WHEN** current evidence runs',
    '- **THEN** the current behavior passes',
  ].join('\n'))
  await put(root, 'openspec/changes/add/specs/new/spec.md', [
    '## ADDED Requirements',
    '### Requirement: New behavior',
    '#### Scenario: Future evidence is planned',
    '- **ID**: `fixture.future.planned`',
    '- **EVIDENCE**: `planned:fixture::future`',
    '- **WHEN** the change is planned',
    '- **THEN** its evidence remains explicitly unresolved',
  ].join('\n'))
  await put(root, 'runner.ts', [
    'export default {',
    '  apiVersion: 1,',
    '  async resolve(request) { return { targets: request.selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
    '  async run(request) { return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
    '}',
  ].join('\n'))
  return root
}

function json(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>
}

async function emptyFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-cli-empty-'))
  roots.push(root)
  await put(root, '.focused-spec/config.yaml', [
    'version: 1',
    'specifications:',
    '  source: files',
    '  paths:',
    '    - specs/**/*.md',
    'runners: {}',
  ].join('\n'))
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('focused-spec CLI', () => {
  it('reports all scenarios, planned evidence, and unique resolved targets', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/shared/spec.md', [
      '### Requirement: Shared target',
      '#### Scenario: A second scenario shares executable evidence',
      '- **ID**: `fixture.current.shared`',
      '- **EVIDENCE**: `fixture::current`',
      '- **WHEN** the shared evidence runs',
      '- **THEN** the second scenario uses the same resolved target',
    ].join('\n'))

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({ valid: true, scenarios: 3, plannedEvidence: 1, targets: 1 })

    const text = spawnSync(process.execPath, [cli, 'validate', '--root', root], { encoding: 'utf8' })
    expect(text.status).toBe(0)
    expect(text.stdout).toContain('3 scenarios')
    expect(text.stdout).toContain('1 planned evidence')
    expect(text.stdout).toContain('1 unique targets')
  })
  it('rejects duplicate IDs introduced by separate active changes', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/other/specs/new/spec.md', [
      '## ADDED Requirements',
      '### Requirement: Conflicting behavior',
      '#### Scenario: Reuses the planned ID',
      '- **ID**: `fixture.future.planned`',
      '- **EVIDENCE**: `planned:fixture::other`',
      '- **WHEN** the other change is planned',
      '- **THEN** another outcome is promised',
    ].join('\n'))

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(1)
    expect(json(validate.stdout)).toMatchObject({
      valid: false,
      violations: [expect.objectContaining({ scenarioId: 'fixture.future.planned', message: expect.stringContaining('duplicate stable ID') })],
    })
  })

  it('rejects malformed evidence rows rather than passing on the remaining evidence', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/current/spec.md', [
      '### Requirement: Current behavior',
      '#### Scenario: Both evidence rows are required',
      '- **ID**: `fixture.current.passes`',
      '- **EVIDENCE**: `fixture::current`',
      '- **EVIDENCE**: fixture::missing-backticks',
      '- **WHEN** current evidence runs',
      '- **THEN** the current behavior passes',
    ].join('\n'))

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(1)
    expect(json(run.stdout)).toMatchObject({
      valid: false,
      executionStarted: false,
      violations: [expect.objectContaining({ scenarioId: 'fixture.current.passes', line: 5, message: expect.stringContaining('malformed EVIDENCE row') })],
    })
  })

  it('rejects runner timeouts that overflow the host timer', async () => {
    const root = await fixture()
    const config = [
      'version: 1',
      'specifications:',
      '  source: openspec',
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
      '    timeoutMs: 2147482647',
    ]
    await put(root, '.focused-spec/config.yaml', config.join('\n'))
    const allowed = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(allowed.status).toBe(0)

    await put(root, '.focused-spec/config.yaml', config.with(6, '    timeoutMs: 2147482648').join('\n'))

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(1)
    expect(json(validate.stdout)).toMatchObject({
      valid: false,
      violations: [expect.objectContaining({ message: expect.stringContaining('timeoutMs must be') })],
    })
    expect(validate.stderr).not.toContain('TimeoutOverflowWarning')
  })

  it('counts an all-planned change without inventing executable targets', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/specs'), { recursive: true })

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--change', 'add', '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({ valid: true, scenarios: 1, plannedEvidence: 1, targets: 0 })

    const strict = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--change', 'add', '--strict', '--json'], { encoding: 'utf8' })
    expect(strict.status).toBe(1)
  })

  it('preserves successful validation when no specifications match', async () => {
    const root = await emptyFixture()
    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({ valid: true, scenarios: 0, plannedEvidence: 0, targets: 0 })
    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({ success: true, executionStarted: false, scenarios: [], targetCount: 0 })
  })

  it('separates run validation scope from current execution selection', async () => {
    const root = await fixture()
    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      executionStarted: true,
      validationScope: { current: true, changes: { mode: 'all-active' } },
      executionSelection: { source: 'current' },
      scenarios: [{ id: 'fixture.current.passes', status: 'PASS' }],
      targetCount: 1,
    })

    const text = spawnSync(process.execPath, [cli, 'run', '--root', root], { encoding: 'utf8' })
    expect(text.stdout).toMatch(/^validation scope:/m)
    expect(text.stdout).toMatch(/^execution selection:/m)
  })

  it('reports selected change and scenario execution independently of validation scope', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', [
      '## ADDED Requirements',
      '### Requirement: New behavior',
      '#### Scenario: Future evidence executes',
      '- **ID**: `fixture.future.executes`',
      '- **EVIDENCE**: `fixture::future`',
      '- **WHEN** the selected change evidence runs',
      '- **THEN** the selected change behavior passes',
    ].join('\n'))

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--change', 'add', '--scenario', 'fixture.future.executes', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      executionStarted: true,
      validationScope: { current: true, changes: { mode: 'selected', name: 'add' } },
      executionSelection: { source: 'change', change: 'add', scenario: 'fixture.future.executes' },
      scenarios: [{ id: 'fixture.future.executes', status: 'PASS' }],
      targetCount: 1,
    })
  })

  it('attributes an unselected scenario error to validation before execution', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/current/spec.md', [
      '### Requirement: Current behavior',
      '#### Scenario: Selected evidence would pass',
      '- **ID**: `fixture.current.selected`',
      '- **EVIDENCE**: `fixture::selected`',
      '- **WHEN** selected evidence runs',
      '- **THEN** the selected behavior passes',
      '#### Scenario: Unselected evidence is invalid',
      '- **ID**: `fixture.current.unselected`',
      '- **EVIDENCE**: `fixture::broken`',
      '- **WHEN** unselected evidence is validated',
      '- **THEN** its resolution error prevents execution',
    ].join('\n'))
    await put(root, 'runner.ts', [
      'export default {',
      '  apiVersion: 1,',
      '  async resolve(request) { return {',
      '    targets: request.selectors.filter(selector => selector !== "broken").map(selector => ({ selector, targetId: selector, displayName: selector })),',
      '    errors: request.selectors.filter(selector => selector === "broken").map(selector => ({ selector, message: "not found" })),',
      '  } },',
      '  async run(request) { return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scenario', 'fixture.current.selected', '--json'], { encoding: 'utf8' })
    const output = json(run.stdout)

    expect(run.status).toBe(1)
    expect(output).toMatchObject({
      valid: false,
      executionStarted: false,
      validationScope: { current: true, changes: { mode: 'all-active' } },
      executionSelection: { source: 'current', scenario: 'fixture.current.selected' },
      violations: [{ scenarioId: 'fixture.current.unselected' }],
    })
    expect(output).not.toHaveProperty('success')

    const text = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scenario', 'fixture.current.selected'], { encoding: 'utf8' })
    expect(text.status).toBe(1)
    expect(text.stderr).toContain('execution did not start')
    expect(text.stdout).not.toContain('PASS fixture.current.selected')
    expect(output).not.toHaveProperty('scenarios')
  })
  it('reports missing malformed and unsupported configuration', async () => {
    const root = await emptyFixture()
    await rm(join(root, '.focused-spec/config.yaml'))
    const missing = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(missing.status).toBe(1)
    expect(json(missing.stdout)).toMatchObject({ valid: false, violations: [expect.objectContaining({ message: expect.stringContaining('cannot read configuration') })] })

    await put(root, '.focused-spec/config.yaml', 'version: [\n')
    const malformed = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(malformed.status).toBe(1)
    expect(json(malformed.stdout)).toMatchObject({ valid: false, violations: [expect.objectContaining({ message: expect.stringContaining('invalid YAML') })] })

    await put(root, '.focused-spec/config.yaml', 'version: 2\nspecifications:\n  source: files\nrunners: {}\n')
    const unsupported = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(unsupported.status).toBe(1)
    expect(json(unsupported.stdout)).toMatchObject({ valid: false, violations: [expect.objectContaining({ message: 'configuration version must be 1' })] })
  })

  it('rejects invalid runner paths and non JSON options', async () => {
    const root = await fixture()
    await put(root, '.focused-spec/config.yaml', 'version: 1\nspecifications:\n  source: openspec\nrunners:\n  fixture:\n    module: ../outside.ts\n')
    const pathResult = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(pathResult.status).toBe(1)
    expect(json(pathResult.stdout)).toMatchObject({ valid: false, violations: [expect.objectContaining({ message: expect.stringContaining('stay inside project root') })] })

    await put(root, '.focused-spec/config.yaml', 'version: 1\nspecifications:\n  source: openspec\nrunners:\n  fixture:\n    module: ./runner.ts\n    options: 1e999\n')
    const optionsResult = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(optionsResult.status).toBe(1)
    expect(json(optionsResult.stdout)).toMatchObject({ valid: false, violations: [expect.objectContaining({ message: expect.stringContaining('JSON-compatible') })] })
  })

  it('validates scenario structure without importing runner modules in syntax only mode', async () => {
    const root = await fixture()
    await rm(join(root, 'runner.ts'))
    const syntax = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--change', 'add', '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(syntax.status).toBe(0)
    expect(json(syntax.stdout)).toEqual({ valid: true, mode: 'syntax-only' })
    const full = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--change', 'add', '--json'], { encoding: 'utf8' })
    expect(full.status).toBe(1)
    expect(json(full.stdout)).toMatchObject({ valid: false, violations: [expect.objectContaining({ message: expect.stringContaining('ENOENT') })] })
  })

  it('rejects an added change that steals a current scenario ID', async () => {
    const root = await fixture()
    const path = 'openspec/changes/add/specs/new/spec.md'
    const delta = (operation: string) => [
      `## ${operation} Requirements`,
      '### Requirement: Current behavior',
      '#### Scenario: Claims current ID',
      '- **ID**: `fixture.current.passes`',
      '- **EVIDENCE**: `planned:fixture::future`',
      '- **WHEN** the change is planned',
      '- **THEN** its ownership is validated',
    ].join('\n')
    await put(root, path, delta('ADDED'))
    const added = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--change', 'add', '--json'], { encoding: 'utf8' })
    expect(added.status).toBe(1)
    expect(json(added.stdout)).toMatchObject({ valid: false, violations: [expect.objectContaining({ message: expect.stringContaining('already belongs to current scenario') })] })

    await put(root, path, delta('MODIFIED'))
    const modified = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--change', 'add', '--json'], { encoding: 'utf8' })
    expect(modified.status).toBe(0)
    expect(json(modified.stdout)).toMatchObject({ valid: true, plannedEvidence: 1 })
  })
})
