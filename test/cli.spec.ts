import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))

interface Layout {
  readonly match: string
  readonly scope?: 'baseline'
  readonly exclude?: readonly string[]
}

const openSpecLayouts: readonly Layout[] = [
  { match: 'openspec/specs/**/spec.md', scope: 'baseline' },
  { match: 'openspec/changes/{scope}/specs/**/spec.md' },
]

async function put(root: string, path: string, content: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, content)
}

function configYaml(
  layouts: readonly Layout[],
  runners: readonly string[] = [
    'runners:',
    '  fixture:',
    '    module: ./runner.ts',
  ],
): string {
  const documents = layouts.flatMap(layout => [
    `    - match: ${JSON.stringify(layout.match)}`,
    ...(layout.scope === undefined ? [] : [`      scope: ${layout.scope}`]),
    ...(layout.exclude === undefined ? [] : [
      '      exclude:',
      ...layout.exclude.map(pattern => `        - ${JSON.stringify(pattern)}`),
    ]),
  ])
  return [
    'version: 2',
    'specifications:',
    '  documents:',
    ...documents,
    ...runners,
  ].join('\n')
}

async function configure(root: string, layouts: readonly Layout[] = openSpecLayouts, runners?: readonly string[]): Promise<void> {
  await put(root, '.focused-spec/config.yaml', configYaml(layouts, runners))
}

function focusedScenario(
  id: string,
  evidence: string,
  options: { readonly name?: string; readonly revisionRows?: readonly string[]; readonly operation?: string } = {},
): string {
  return [
    ...(options.operation === undefined ? [] : [`## ${options.operation} Requirements`]),
    '### Requirement: Observable behavior',
    `#### Scenario: ${options.name ?? id}`,
    `- **ID**: \`${id}\``,
    ...(options.revisionRows ?? []),
    `- **EVIDENCE**: \`${evidence}\``,
    '- **WHEN** the configured behavior is requested',
    '- **THEN** its evidence has the configured result',
  ].join('\n')
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-cli-'))
  roots.push(root)
  await configure(root)
  await put(root, 'openspec/specs/current/spec.md', focusedScenario(
    'fixture.current.passes',
    'fixture::current',
    { name: 'Current evidence passes' },
  ))
  await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
    'fixture.future.planned',
    'planned:fixture::future',
    { name: 'Future evidence is planned', operation: 'ADDED' },
  ))
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
  await configure(root, [{ match: 'specs/**/*.md', scope: 'baseline' }], ['runners: {}'])
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('focused-spec CLI', () => {
  it('reports all scenarios, planned evidence, and unique resolved targets', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/shared/spec.md', focusedScenario(
      'fixture.current.shared',
      'fixture::current',
      { name: 'A second scenario shares executable evidence' },
    ))

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({
      valid: true,
      validationScope: { baseline: true, scopes: { mode: 'all' } },
      scenarios: 3,
      plannedEvidence: 1,
      targets: 1,
    })

    const text = spawnSync(process.execPath, [cli, 'validate', '--root', root], { encoding: 'utf8' })
    expect(text.status).toBe(0)
    expect(text.stdout).toContain('3 scenarios')
    expect(text.stdout).toContain('1 planned evidence')
    expect(text.stdout).toContain('1 unique targets')
  })

  it('rejects duplicate IDs introduced by separate active changes', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/other/specs/new/spec.md', focusedScenario(
      'fixture.future.planned',
      'planned:fixture::other',
      { name: 'Reuses the planned ID', operation: 'ADDED' },
    ))

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(1)
    expect(json(validate.stdout)).toMatchObject({
      valid: false,
      validationScope: { baseline: true, scopes: { mode: 'all' } },
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
    await rm(join(root, 'openspec/changes'), { recursive: true })

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(1)
    expect(json(run.stdout)).toMatchObject({
      valid: false,
      executionStarted: false,
      validationScope: { baseline: true, scopes: { mode: 'all' } },
      executionSelection: { source: 'baseline' },
      violations: [expect.objectContaining({ scenarioId: 'fixture.current.passes', line: 5 })],
    })
  })

  it('rejects runner timeouts that overflow the host timer', async () => {
    const root = await fixture()
    await configure(root, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
      '    timeoutMs: 2147482647',
    ])
    const allowed = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(allowed.status).toBe(0)

    await configure(root, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
      '    timeoutMs: 2147482648',
    ])
    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(1)
    expect(json(validate.stdout)).toMatchObject({
      valid: false,
      violations: [expect.objectContaining({ message: expect.stringContaining('timeoutMs') })],
    })
    expect(validate.stderr).not.toContain('TimeoutOverflowWarning')
  })

  it('counts an all-planned change without inventing executable targets', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/specs'), { recursive: true })

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({
      valid: true,
      validationScope: { baseline: true, scopes: { mode: 'selected', name: 'add' } },
      scenarios: 1,
      plannedEvidence: 1,
      targets: 0,
    })

    const strict = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--strict', '--json'], { encoding: 'utf8' })
    expect(strict.status).toBe(1)
    expect(json(strict.stdout)).toMatchObject({
      valid: false,
      validationScope: { baseline: true, scopes: { mode: 'selected', name: 'add' } },
      violations: [expect.objectContaining({ scenarioId: 'fixture.future.planned' })],
    })
  })

  it('preserves successful validation when no specifications match', async () => {
    const root = await emptyFixture()
    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({
      valid: true,
      validationScope: { baseline: true, scopes: { mode: 'all' } },
      scenarios: 0,
      plannedEvidence: 0,
      targets: 0,
    })
    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      executionStarted: false,
      validationScope: { baseline: true, scopes: { mode: 'all' } },
      executionSelection: { source: 'baseline' },
      scenarios: [],
      targetCount: 0,
    })
  })

  it('separates run validation scope from current execution selection', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.future.executes',
      'fixture::future',
      { name: 'Future evidence executes', operation: 'ADDED' },
    ))
    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      executionStarted: true,
      validationScope: { baseline: true, scopes: { mode: 'all' } },
      executionSelection: { source: 'baseline' },
      scenarios: [{ id: 'fixture.current.passes', status: 'PASS' }],
      targetCount: 1,
    })

    const text = spawnSync(process.execPath, [cli, 'run', '--root', root], { encoding: 'utf8' })
    expect(text.status).toBe(0)
    expect(text.stdout).toMatch(/^validation scope:/m)
    expect(text.stdout).toMatch(/^execution selection:/m)
    expect(text.stdout).toContain('baseline')
  })

  it('reports selected change and scenario execution independently of validation scope', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.future.executes',
      'fixture::future',
      { name: 'Future evidence executes', operation: 'ADDED' },
    ))

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.future.executes', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      executionStarted: true,
      validationScope: { baseline: true, scopes: { mode: 'selected', name: 'add' } },
      executionSelection: { source: 'scope', scope: 'add', scenario: 'fixture.future.executes' },
      scenarios: [{ id: 'fixture.future.executes', status: 'PASS' }],
      targetCount: 1,
    })
  })

  it('attributes an unselected scenario error to validation before execution', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
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
      validationScope: { baseline: true, scopes: { mode: 'all' } },
      executionSelection: { source: 'baseline', scenario: 'fixture.current.selected' },
      violations: [{ scenarioId: 'fixture.current.unselected' }],
    })
    expect(output).not.toHaveProperty('success')
    expect(output).not.toHaveProperty('scenarios')

    const text = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scenario', 'fixture.current.selected'], { encoding: 'utf8' })
    expect(text.status).toBe(1)
    expect(text.stderr).toContain('execution did not start')
    expect(text.stdout).not.toContain('PASS fixture.current.selected')
  })

  it('reports missing malformed and unsupported configuration', async () => {
    const root = await emptyFixture()
    await rm(join(root, '.focused-spec/config.yaml'))
    const missing = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(missing.status).toBe(1)
    expect(json(missing.stdout)).toMatchObject({
      valid: false,
      validationScope: { baseline: true, scopes: { mode: 'all' } },
      violations: [expect.objectContaining({ message: expect.stringContaining('cannot read configuration') })],
    })

    await put(root, '.focused-spec/config.yaml', 'version: [\n')
    const malformed = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(malformed.status).toBe(1)
    expect(json(malformed.stdout)).toMatchObject({ valid: false, violations: [expect.objectContaining({ message: expect.stringContaining('invalid YAML') })] })

    await put(root, '.focused-spec/config.yaml', 'version: 1\nspecifications:\n  source: files\n  paths: [specs/**/*.md]\nrunners: {}\n')
    const unsupported = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(unsupported.status).toBe(1)
    expect(json(unsupported.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('version') })]) })
  })

  it('rejects invalid runner paths and non JSON options', async () => {
    const root = await fixture()
    await configure(root, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ../outside.ts',
    ])
    const pathResult = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(pathResult.status).toBe(1)
    expect(json(pathResult.stdout)).toMatchObject({ valid: false, violations: [expect.objectContaining({ message: expect.stringContaining('project root') })] })

    await configure(root, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
      '    options: 1e999',
    ])
    const optionsResult = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(optionsResult.status).toBe(1)
    expect(json(optionsResult.stdout)).toMatchObject({ valid: false, violations: [expect.objectContaining({ message: expect.stringContaining('JSON-compatible') })] })
  })

  it('validates scenario structure without importing runner modules in syntax only mode', async () => {
    const root = await fixture()
    await rm(join(root, 'runner.ts'))
    const syntax = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(syntax.status).toBe(0)
    expect(json(syntax.stdout)).toEqual({
      valid: true,
      mode: 'syntax-only',
      validationScope: { baseline: true, scopes: { mode: 'selected', name: 'add' } },
    })
    const full = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
    expect(full.status).toBe(1)
    expect(json(full.stdout)).toMatchObject({
      valid: false,
      validationScope: { baseline: true, scopes: { mode: 'selected', name: 'add' } },
      violations: [expect.objectContaining({ path: 'fixture' })],
    })
  })

  it('rejects an added change that steals a current scenario ID', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.current.passes',
      'planned:fixture::future',
      { name: 'Claims the baseline ID', operation: 'ADDED' },
    ))

    const added = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
    expect(added.status).toBe(1)
    expect(json(added.stdout)).toMatchObject({
      valid: false,
      violations: [expect.objectContaining({ scenarioId: 'fixture.current.passes' })],
    })
  })

  it('rejects unsafe and ambiguous document layouts', async () => {
    const root = await emptyFixture()
    const invalidLayouts: readonly (readonly Layout[])[] = [
      [{ match: '../outside/**/*.md', scope: 'baseline' }],
      [{ match: '/absolute/specs/**/*.md', scope: 'baseline' }],
      [{ match: 'specs/{scope}/nested/{scope}.md' }],
      [{ match: 'specs/pre*{scope}/spec.md' }],
      [{ match: 'specs/{scope}/*.json' }],
      [{ match: 'specs/unowned/**/*.md' }],
    ]

    for (const layouts of invalidLayouts) {
      await configure(root, layouts, ['runners: {}'])
      const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
      expect(result.status).toBe(1)
      const output = json(result.stdout)
      expect(output).toMatchObject({ valid: false })
      expect(output.violations).toEqual(expect.arrayContaining([expect.objectContaining({ path: expect.any(String) })]))
      expect(JSON.stringify(output)).toMatch(/document|layout|Markdown|path|scope|specifications/iu)
    }

    await configure(root)
    const unsafeScope = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', '../outside', '--json'], { encoding: 'utf8' })
    expect(unsafeScope.status).toBe(1)
    expect(unsafeScope.stdout + unsafeScope.stderr).toContain('scope')
  })

  it('rejects specification symlinks that escape the project root', async () => {
    const root = await emptyFixture()
    const outside = await mkdtemp(join(tmpdir(), 'focused-spec-outside-'))
    roots.push(outside)
    await put(outside, 'escape.md', focusedScenario('fixture.escape', 'fixture::escape'))
    await mkdir(join(root, 'specs'), { recursive: true })
    await symlink(outside, join(root, 'specs', 'linked'), 'junction')

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    const output = JSON.stringify(json(result.stdout))
    expect(output).toContain('specs/linked/escape.md')
    expect(output).toMatch(/outside|escape|project root/iu)
  })

  it('discovers adjacent and nested scope documents from declared patterns', async () => {
    const root = await emptyFixture()
    const layouts: readonly Layout[] = [
      { match: 'openspec/changes/{scope}/spec.md', exclude: ['openspec/changes/archive/**'] },
      { match: 'features/{scope}/capabilities/**/spec.md' },
      { match: 'specs/{scope}/spec.md' },
      { match: '.kiro/specs/{scope}/requirements.md' },
      { match: '.kiro/specs/{scope}/bugfix.md' },
      { match: 'specs/spec-{scope}/SPEC.md' },
    ]
    await configure(root, layouts)
    await put(root, 'runner.ts', [
      'export default { apiVersion: 1,',
      '  async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run({ targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))
    await put(root, 'openspec/changes/Feature-One/spec.md', focusedScenario('layout.adjacent', 'fixture::adjacent'))
    await put(root, 'openspec/changes/archive/spec.md', focusedScenario('layout.archived', 'fixture::archived'))
    await put(root, 'features/nested-feature/capabilities/auth/spec.md', focusedScenario('layout.nested', 'fixture::nested'))
    await put(root, 'specs/spec-kit-feature/spec.md', focusedScenario('layout.spec-kit', 'fixture::spec-kit'))
    await put(root, '.kiro/specs/account-lock/requirements.md', focusedScenario('layout.kiro.requirements', 'fixture::requirements'))
    await put(root, '.kiro/specs/account-lock/bugfix.md', focusedScenario('layout.kiro.bugfix', 'fixture::bugfix'))
    await put(root, 'specs/spec-bmad/SPEC.md', focusedScenario('layout.bmad', 'fixture::bmad'))

    const all = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(all.status).toBe(0)
    expect(json(all.stdout)).toMatchObject({
      valid: true,
      validationScope: { baseline: true, scopes: { mode: 'all' } },
      scenarios: 6,
      targets: 6,
    })

    for (const [name, scenarios] of [['Feature-One', 1], ['nested-feature', 1], ['spec-kit-feature', 1], ['account-lock', 2], ['bmad', 1]] as const) {
      const selected = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', name, '--json'], { encoding: 'utf8' })
      expect(selected.status).toBe(0)
      expect(json(selected.stdout)).toMatchObject({
        valid: true,
        validationScope: { baseline: true, scopes: { mode: 'selected', name } },
        scenarios,
      })
    }
  })

  it('rejects a selected scope with no documents', async () => {
    const root = await fixture()
    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'missing', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({
      valid: false,
      validationScope: { baseline: true, scopes: { mode: 'selected', name: 'missing' } },
      violations: [expect.objectContaining({ path: expect.stringContaining('missing') })],
    })
  })

  it('rejects a selected scope with no focused scenarios', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/empty/specs/native/spec.md', '# Native design\n\nNo focused scenarios are declared here.\n')
    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'empty', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({
      valid: false,
      validationScope: { baseline: true, scopes: { mode: 'selected', name: 'empty' } },
      violations: [expect.objectContaining({ path: expect.stringContaining('empty') })],
    })

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'empty', '--json'], { encoding: 'utf8' })
    const output = json(run.stdout)
    expect(run.status).toBe(1)
    expect(output).toMatchObject({
      valid: false,
      executionStarted: false,
      executionSelection: { source: 'scope', scope: 'empty' },
    })
    expect(output).not.toHaveProperty('success')
    expect(output).not.toHaveProperty('scenarios')
  })

  it('rejects a document claimed by multiple layouts', async () => {
    const root = await emptyFixture()
    await configure(root, [
      { match: 'specs/**/spec.md', scope: 'baseline' },
      { match: 'specs/{scope}/spec.md' },
    ])
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve() { return { targets: [], errors: [] } }, async run() { return { results: [] } } }')
    await put(root, 'specs/auth/spec.md', focusedScenario('layout.overlap', 'fixture::overlap'))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    const output = JSON.stringify(json(result.stdout))
    expect(output).toContain('specs/auth/spec.md')
    expect(output).toMatch(/claim|conflict|layout|overlap/iu)
  })

  it('accepts explicit baseline revisions in a named scope', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.current.passes',
      'planned:fixture::revised',
      { name: 'Explicit revision', revisionRows: ['- **REVISES**: baseline'] },
    ))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(json(result.stdout)).toMatchObject({
      valid: true,
      validationScope: { baseline: true, scopes: { mode: 'selected', name: 'add' } },
      scenarios: 2,
      plannedEvidence: 1,
    })
  })

  it('rejects revisions without a baseline owner', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/specs'), { recursive: true })
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.unowned.revision',
      'planned:fixture::revised',
      { name: 'Orphan revision', revisionRows: ['- **REVISES**: baseline'] },
    ))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({
      valid: false,
      violations: [expect.objectContaining({
        path: 'openspec/changes/add/specs/new/spec.md',
        scenarioId: 'fixture.unowned.revision',
      })],
    })
  })

  it('rejects revision markers on baseline scenarios', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/current/spec.md', focusedScenario(
      'fixture.current.passes',
      'fixture::current',
      { name: 'Baseline cannot revise', revisionRows: ['- **REVISES**: baseline'] },
    ))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({
      valid: false,
      violations: [expect.objectContaining({
        path: 'openspec/specs/current/spec.md',
        scenarioId: 'fixture.current.passes',
      })],
    })
  })

  it('rejects malformed and repeated revision markers', async () => {
    const root = await fixture()
    const path = 'openspec/changes/add/specs/new/spec.md'
    for (const revisionRows of [
      ['- **REVISES**: `baseline`'],
      ['- **REVISES**: baseline', '- **REVISES**: baseline'],
    ]) {
      await put(root, path, focusedScenario(
        'fixture.current.passes',
        'planned:fixture::revised',
        { name: 'Ambiguous revision', revisionRows },
      ))
      const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
      expect(result.status).toBe(1)
      const output = json(result.stdout)
      expect(output).toMatchObject({ valid: false })
      expect(output.violations).toEqual(expect.arrayContaining([expect.objectContaining({ path })]))
      expect(JSON.stringify(output)).toMatch(/REVISES|revision/iu)
    }
  })

  it('refuses to execute a named scope without documents', async () => {
    const root = await fixture()
    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'missing', '--json'], { encoding: 'utf8' })
    const output = json(result.stdout)

    expect(result.status).toBe(1)
    expect(output).toMatchObject({
      valid: false,
      executionStarted: false,
      validationScope: { baseline: true, scopes: { mode: 'selected', name: 'missing' } },
      executionSelection: { source: 'scope', scope: 'missing' },
      violations: [expect.objectContaining({ path: expect.stringContaining('missing') })],
    })
    expect(output).not.toHaveProperty('success')
    expect(output).not.toHaveProperty('scenarios')
  })

  it('rejects unmarked ID reuse under an OpenSpec MODIFIED heading', async () => {
    const root = await fixture()
    for (const operation of ['MODIFIED', 'REMOVED']) {
      await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
        'fixture.current.passes',
        'planned:fixture::future',
        { name: 'Heading grants no revision right', operation },
      ))
      const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(json(result.stdout)).toMatchObject({
        valid: false,
        violations: [expect.objectContaining({ scenarioId: 'fixture.current.passes' })],
      })
    }
  })

  it('validates baseline and selected scope without unrelated scopes', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.future.executes',
      'fixture::future',
      { name: 'Selected scope evidence executes' },
    ))
    await put(root, 'openspec/changes/unrelated/specs/new/spec.md', focusedScenario(
      'fixture.unrelated.invalid',
      'missing::unrelated',
      { name: 'Unrelated evidence is invalid' },
    ))

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--strict', '--json'], { encoding: 'utf8' })
    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toMatchObject({
      valid: true,
      validationScope: { baseline: true, scopes: { mode: 'selected', name: 'add' } },
      scenarios: 2,
      targets: 2,
    })

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      executionStarted: true,
      validationScope: { baseline: true, scopes: { mode: 'selected', name: 'add' } },
      executionSelection: { source: 'scope', scope: 'add' },
      scenarios: [{ id: 'fixture.future.executes', status: 'PASS' }],
    })
  })
})
