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
})
