import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))

interface Layout {
  readonly match: string
  readonly scope?: string
  readonly exclude?: readonly string[]
}

const openSpecLayouts: readonly Layout[] = [
  { match: 'openspec/specs/**/spec.md', scope: 'current' },
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
  await configure(root, [{ match: 'specs/**/*.md', scope: 'current' }], ['runners: {}'])
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('focused-spec CLI', () => {
  it('shows a successful command overview for root help forms', () => {
    for (const args of [['--help'], ['-h'], ['help']]) {
      const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })
      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).toMatch(/validate\s+Check scenario structure and resolve evidence without running tests/)
      expect(result.stdout).toMatch(/run\s+Strictly validate, then execute selected evidence/)
      expect(result.stdout).toContain('focused-spec <command> --help')
      expect(result.stdout).not.toContain('execution selection:')
    }
  })

  it('explains validation modes and options in command help', () => {
    for (const args of [['validate', '--help'], ['validate', '-h'], ['help', 'validate']]) {
      const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })
      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('focused-spec validate [options]')
      for (const option of ['--root <path>', '--config <path>', '--scope <name>', '--strict', '--syntax-only', '--json', '--timings', '-h, --help']) {
        expect(result.stdout).toContain(option)
      }
      expect(result.stdout).toContain('without loading runners or resolving evidence')
      expect(result.stdout).toContain('planned: evidence is allowed in every scope')
      expect(result.stdout).toContain('without running tests')
      expect(result.stdout).toContain('focused-spec validate --scope add-search --strict')
      expect(result.stdout).not.toContain('--allow-skip')
      expect(result.stdout).not.toContain('--scenario')
    }
  })

  it('explains execution selection and skip policy in command help', () => {
    for (const args of [['run', '--help'], ['run', '-h'], ['help', 'run']]) {
      const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })
      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('focused-spec run [options]')
      for (const option of ['--root <path>', '--config <path>', '--scope <name>', '--scenario <id>', '--allow-skip', '--json', '--timings', '-h, --help']) {
        expect(result.stdout).toContain(option)
      }
      expect(result.stdout).toContain('Narrow validation and execution to matching scenarios')
      expect(result.stdout).toContain('never relabel SKIP as PASS')
      expect(result.stdout).toContain('validates strictly before starting tests')
      expect(result.stdout).toContain('focused-spec run --scope add-search --scenario search.results.empty')
      expect(result.stdout).not.toContain('--syntax-only')
      expect(result.stdout).not.toMatch(/^  --strict\b/m)
    }
  })

  it('shows help without loading configuration or runners', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-cli-help-'))
    roots.push(root)
    for (const args of [['--help'], ['validate', '--help'], ['run', '--json', '--help']]) {
      const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).not.toContain('valid: false')
      expect(result.stdout).not.toMatch(/^\{/)
    }
  })

  it('directs invalid invocations to help without succeeding', () => {
    const invalid = [
      { args: [], diagnostic: 'missing command', hint: 'focused-spec --help' },
      { args: ['unknown', '--help'], diagnostic: 'unknown command unknown', hint: 'focused-spec --help' },
      { args: ['help', 'unknown'], diagnostic: 'unknown help command unknown', hint: 'focused-spec --help' },
      { args: ['validate', '--unknown'], diagnostic: 'unknown argument --unknown', hint: 'focused-spec validate --help' },
      { args: ['run', '--scope'], diagnostic: 'missing value for --scope', hint: 'focused-spec run --help' },
    ]
    for (const { args, diagnostic, hint } of invalid) {
      const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })
      expect(result.status, `arguments: ${JSON.stringify(args)}; stderr: ${result.stderr}`).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain(diagnostic)
      expect(result.stderr).toContain(hint)
      expect(result.stderr).not.toContain('Usage:')
    }
  })

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
      validationScope: { scopes: { mode: 'all' } },
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

  it('rejects unmarked ID reuse across captured scopes', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/other/specs/new/spec.md', focusedScenario(
      'fixture.future.planned',
      'planned:fixture::other',
      { name: 'Reuses the planned ID', operation: 'ADDED' },
    ))

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(1)
    const output = json(validate.stdout)
    expect(output).toMatchObject({ valid: false, validationScope: { scopes: { mode: 'all' } } })
    expect(output.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ scenarioId: 'fixture.future.planned', message: expect.stringContaining('repeated IDs require exactly one owner') }),
    ]))
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
      validationScope: { scopes: { mode: 'all' } },
      executionSelection: { scopes: { mode: 'all' } },
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

  it('allows planned evidence in every scope only during non-strict validation', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/current/spec.md', focusedScenario(
      'fixture.current.planned',
      'planned:fixture::current',
    ))

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({
      valid: true,
      validationScope: { scopes: { mode: 'all' } },
      scenarios: 2,
      plannedEvidence: 2,
      targets: 0,
    })

    const strict = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--strict', '--json'], { encoding: 'utf8' })
    expect(strict.status).toBe(1)
    expect(json(strict.stdout)).toMatchObject({
      valid: false,
      validationScope: { scopes: { mode: 'all' } },
      violations: expect.arrayContaining([
        expect.objectContaining({ scenarioId: 'fixture.current.planned' }),
        expect.objectContaining({ scenarioId: 'fixture.future.planned' }),
      ]),
    })
  })

  it('preserves successful validation when no specifications match', async () => {
    const root = await emptyFixture()
    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({
      valid: true,
      validationScope: { scopes: { mode: 'all' } },
      scenarios: 0,
      plannedEvidence: 0,
      targets: 0,
    })
    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      executionStarted: false,
      validationScope: { scopes: { mode: 'all' } },
      executionSelection: { scopes: { mode: 'all' } },
      scenarios: [],
      targetCount: 0,
    })
  })

  it('runs all scopes and disambiguates repeated scenario IDs', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.current.passes',
      'fixture::revised',
      { name: 'A second scope revises current evidence', revisionRows: ['- **REVISES**: current'] },
    ))
    await put(root, 'openspec/changes/other/specs/new/spec.md', focusedScenario(
      'fixture.current.passes',
      'fixture::other-revision',
      { name: 'Another scope revises current evidence', revisionRows: ['- **REVISES**: current'] },
    ))
    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    const output = json(run.stdout)
    expect(output).toMatchObject({
      success: true,
      executionStarted: true,
      validationScope: { scopes: { mode: 'all' } },
      executionSelection: { scopes: { mode: 'all' } },
      targetCount: 3,
    })
    expect(output.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'fixture.current.passes', scope: 'add', status: 'PASS' }),
      expect.objectContaining({ id: 'fixture.current.passes', scope: 'other', status: 'PASS' }),
      expect.objectContaining({ id: 'fixture.current.passes', scope: 'current', status: 'PASS' }),
    ]))

    const text = spawnSync(process.execPath, [cli, 'run', '--root', root], { encoding: 'utf8' })
    expect(text.status).toBe(0)
    expect(text.stdout).toMatch(/^validation scope: all discovered scopes$/m)
    expect(text.stdout).toMatch(/^execution selection: all discovered scopes$/m)
    expect(text.stdout).toContain('PASS [add] fixture.current.passes')
    expect(text.stdout).toContain('PASS [other] fixture.current.passes')
    expect(text.stdout).toContain('PASS [current] fixture.current.passes')
  })

  it('reports selected scope and scenario execution independently of validation scope', async () => {
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
      validationScope: { scopes: { mode: 'selected', name: 'add' }, scenario: 'fixture.future.executes' },
      executionSelection: { scopes: { mode: 'selected', name: 'add' }, scenario: 'fixture.future.executes' },
      scenarios: [{ id: 'fixture.future.executes', scope: 'add', status: 'PASS' }],
      targetCount: 1,
    })
  })

  it('runs a selected scenario despite unrelated invalid evidence in its scope', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
    await put(root, 'openspec/specs/current/spec.md', [
      focusedScenario('fixture.current.selected', 'fixture::selected'),
      focusedScenario('fixture.current.unresolved', 'fixture::broken'),
      focusedScenario('fixture.current.planned', 'planned:fixture::future'),
      '#### Scenario: Unrelated malformed evidence',
      '- **ID**: `fixture.current.malformed`',
      '- **EVIDENCE**: fixture::missing-backticks',
      '- **WHEN** another scenario is checked',
      '- **THEN** its evidence is invalid',
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
    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      validationScope: { scopes: { mode: 'all' }, scenario: 'fixture.current.selected' },
      executionSelection: { scopes: { mode: 'all' }, scenario: 'fixture.current.selected' },
      scenarios: [{ id: 'fixture.current.selected', scope: 'current', status: 'PASS' }],
      targetCount: 1,
    })

    const full = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(full.status).toBe(1)
    expect(json(full.stdout)).toMatchObject({ valid: false, executionStarted: false, validationScope: { scopes: { mode: 'all' } } })
  })

  it('rejects invalid selected scenario before execution', async () => {
    for (const [content, expected] of [
      [focusedScenario('fixture.bad', 'planned:fixture::later'), 'planned evidence is not allowed'],
      [focusedScenario('fixture.bad', 'fixture::test', { revisionRows: ['- **REVISES**: missing'] }), 'REVISES missing'],
      [['#### Scenario: Malformed evidence', '- **ID**: `fixture.bad`', '- **EVIDENCE**: fixture::bad', '- **WHEN** a scenario is requested', '- **THEN** its evidence is invalid'].join('\n'), 'malformed EVIDENCE row'],
      [['#### Scenario: Missing outcome', '- **ID**: `fixture.bad`', '- **EVIDENCE**: `fixture::bad`', '- **WHEN** a scenario is requested'].join('\n'), 'expected exactly one THEN'],
    ] as const) {
      const root = await fixture()
      await put(root, 'openspec/changes/add/specs/new/spec.md', content)
      const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.bad', '--json'], { encoding: 'utf8' })
      expect(run.status).toBe(1)
      const output = json(run.stdout)
      expect(output).toMatchObject({ valid: false, executionStarted: false, validationScope: { scopes: { mode: 'selected', name: 'add' }, scenario: 'fixture.bad' } })
      expect(output.violations).toEqual(expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.bad', message: expect.stringContaining(expected) })]))
      expect(output).not.toHaveProperty('success')
    }
  })

  it('rejects a missing selected scenario before resolving evidence', async () => {
    const root = await fixture()
    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.missing', '--json'], { encoding: 'utf8' })
    expect(run.status).toBe(1)
    const output = json(run.stdout)
    expect(output).toMatchObject({ valid: false, executionStarted: false, validationScope: { scopes: { mode: 'selected', name: 'add' }, scenario: 'fixture.missing' } })
    expect(output.violations).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'fixture.missing', message: expect.stringContaining('selected scenario') })]))
    expect(output).not.toHaveProperty('success')
  })

  it('validates and runs every matching scope for a selected scenario ID', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario('fixture.current.passes', 'fixture::revised', { revisionRows: ['- **REVISES**: current'] }))
    await put(root, 'openspec/changes/other/specs/new/spec.md', focusedScenario('fixture.current.passes', 'fixture::other', { revisionRows: ['- **REVISES**: current'] }))
    await put(root, 'openspec/changes/add/specs/unrelated/spec.md', focusedScenario('fixture.unrelated.planned', 'planned:fixture::later'))
    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scenario', 'fixture.current.passes', '--json'], { encoding: 'utf8' })
    expect(run.status).toBe(0)
    const output = json(run.stdout)
    expect(output).toMatchObject({ success: true, validationScope: { scopes: { mode: 'all' }, scenario: 'fixture.current.passes' }, targetCount: 3 })
    expect(output.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'current', id: 'fixture.current.passes', status: 'PASS' }),
      expect.objectContaining({ scope: 'add', id: 'fixture.current.passes', status: 'PASS' }),
      expect.objectContaining({ scope: 'other', id: 'fixture.current.passes', status: 'PASS' }),
    ]))
    expect((output.scenarios as unknown[]).length).toBe(3)
  })

  it('reports missing malformed and unsupported configuration', async () => {
    const root = await emptyFixture()
    await rm(join(root, '.focused-spec/config.yaml'))
    const missing = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(missing.status).toBe(1)
    expect(json(missing.stdout)).toMatchObject({
      valid: false,
      validationScope: { scopes: { mode: 'all' } },
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
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.future.concrete',
      'fixture::future',
    ))
    await rm(join(root, 'runner.ts'))
    const syntax = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(syntax.status).toBe(0)
    expect(json(syntax.stdout)).toEqual({
      valid: true,
      mode: 'syntax-only',
      validationScope: { scopes: { mode: 'selected', name: 'add' } },
    })
    const full = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
    expect(full.status).toBe(1)
    expect(json(full.stdout)).toMatchObject({
      valid: false,
      validationScope: { scopes: { mode: 'selected', name: 'add' } },
      violations: [expect.objectContaining({ path: 'fixture' })],
    })
  })

  it('rejects unmarked ID reuse from another scope', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.current.passes',
      'planned:fixture::future',
      { name: 'Claims an existing scope ID', operation: 'ADDED' },
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
      [{ match: '../outside/**/*.md', scope: 'current' }],
      [{ match: '/absolute/specs/**/*.md', scope: 'current' }],
      [{ match: 'specs/{scope}/nested/{scope}.md' }],
      [{ match: 'specs/pre*{scope}/spec.md' }],
      [{ match: 'specs/{scope}/*.json' }],
      [{ match: 'specs/unowned/**/*.md' }],
      [{ match: 'specs/{scope}/spec.md', scope: 'current' }],
      [{ match: 'specs/**/*.md', scope: '../unsafe' }],
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
      validationScope: { scopes: { mode: 'all' } },
      scenarios: 6,
      targets: 6,
    })

    for (const [name, scenarios] of [['Feature-One', 1], ['nested-feature', 1], ['spec-kit-feature', 1], ['account-lock', 2], ['bmad', 1]] as const) {
      const selected = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', name, '--json'], { encoding: 'utf8' })
      expect(selected.status).toBe(0)
      expect(json(selected.stdout)).toMatchObject({
        valid: true,
        validationScope: { scopes: { mode: 'selected', name } },
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
      validationScope: { scopes: { mode: 'selected', name: 'missing' } },
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
      validationScope: { scopes: { mode: 'selected', name: 'empty' } },
      violations: [expect.objectContaining({ path: expect.stringContaining('empty') })],
    })

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'empty', '--json'], { encoding: 'utf8' })
    const output = json(run.stdout)
    expect(run.status).toBe(1)
    expect(output).toMatchObject({
      valid: false,
      executionStarted: false,
      executionSelection: { scopes: { mode: 'selected', name: 'empty' } },
    })
    expect(output).not.toHaveProperty('success')
    expect(output).not.toHaveProperty('scenarios')
  })

  it('rejects a document claimed by multiple layouts', async () => {
    const root = await emptyFixture()
    await configure(root, [
      { match: 'specs/**/spec.md', scope: 'current' },
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

  it('accepts revisions from an unselected source without resolving its evidence', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/current/spec.md', [
      '#### Scenario: Malformed source evidence is irrelevant to selection',
      '- **ID**: `fixture.current.passes`',
      '- **EVIDENCE**: fixture::missing-backticks',
      '- **WHEN** ownership is checked for a selected revision',
      '- **THEN** the source scope evidence is not validated or resolved',
    ].join('\n'))
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.current.passes',
      'planned:fixture::revised',
      { name: 'Explicit revision', revisionRows: ['- **REVISES**: current'] },
    ))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(json(result.stdout)).toMatchObject({
      valid: true,
      validationScope: { scopes: { mode: 'selected', name: 'add' } },
      scenarios: 1,
      plannedEvidence: 1,
      targets: 0,
    })
  })

  it('treats baseline as an ordinary revision source name', async () => {
    const root = await fixture()
    await configure(root, [
      { match: 'openspec/specs/**/spec.md', scope: 'baseline' },
      { match: 'openspec/changes/{scope}/specs/**/spec.md' },
    ])
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.current.passes',
      'planned:fixture::revised',
      { name: 'Explicit revision', revisionRows: ['- **REVISES**: baseline'] },
    ))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(json(result.stdout)).toMatchObject({
      valid: true,
      scenarios: 1,
      plannedEvidence: 1,
    })
  })

  it('rejects revisions without an owning source scope', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.unowned.revision',
      'planned:fixture::revised',
      { name: 'Orphan revision', revisionRows: ['- **REVISES**: current'] },
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

  it('rejects cyclic revision ownership', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/first/specs/new/spec.md', focusedScenario(
      'fixture.cyclic.revision',
      'planned:fixture::first',
      { revisionRows: ['- **REVISES**: second'] },
    ))
    await put(root, 'openspec/changes/second/specs/new/spec.md', focusedScenario(
      'fixture.cyclic.revision',
      'planned:fixture::second',
      { revisionRows: ['- **REVISES**: first'] },
    ))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({
      valid: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ scenarioId: 'fixture.cyclic.revision' }),
      ]),
    })
  })

  it('rejects revisions from the same scope', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/current/spec.md', focusedScenario(
      'fixture.current.passes',
      'fixture::current',
      { name: 'Scope cannot revise itself', revisionRows: ['- **REVISES**: current'] },
    ))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'current', '--json'], { encoding: 'utf8' })
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
      ['- **REVISES**: `current`'],
      ['- **REVISES**: current', '- **REVISES**: current'],
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
      validationScope: { scopes: { mode: 'selected', name: 'missing' } },
      executionSelection: { scopes: { mode: 'selected', name: 'missing' } },
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

  it('validates only the selected scope evidence', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.future.executes',
      'fixture::future',
      { name: 'Selected scope evidence executes' },
    ))
    await put(root, 'openspec/changes/unrelated/specs/new/spec.md', focusedScenario(
      'fixture.unrelated.invalid',
      'fixture::broken',
      { name: 'Unrelated evidence is invalid' },
    ))
    await put(root, 'runner.ts', [
      'export default {',
      '  apiVersion: 1,',
      '  async resolve(request) { return {',
      '    targets: request.selectors.filter(selector => selector !== "broken").map(selector => ({ selector, targetId: selector, displayName: selector })),',
      '    errors: request.selectors.filter(selector => selector === "broken").map(selector => ({ selector, message: "must stay unresolved" })),',
      '  } },',
      '  async run(request) { return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--strict', '--json'], { encoding: 'utf8' })
    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toMatchObject({
      valid: true,
      validationScope: { scopes: { mode: 'selected', name: 'add' } },
      scenarios: 1,
      targets: 1,
    })

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })
    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      executionStarted: true,
      validationScope: { scopes: { mode: 'selected', name: 'add' } },
      executionSelection: { scopes: { mode: 'selected', name: 'add' } },
      scenarios: [{ id: 'fixture.future.executes', scope: 'add', status: 'PASS' }],
    })
  })

  it('reuses strict resolution for scoped execution without resolving twice', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.future.executes',
      'fixture::future',
      { name: 'Future evidence executes' },
    ))
    await put(root, 'openspec/changes/add/specs/shared/spec.md', focusedScenario(
      'fixture.future.shared',
      'fixture::future',
      { name: 'Future evidence is shared' },
    ))
    await put(root, 'runner.ts', [
      "import { appendFile } from 'node:fs/promises'",
      "import { join } from 'node:path'",
      'export default {',
      '  apiVersion: 1,',
      '  async resolve(request) {',
      '    await appendFile(join(request.projectRoot, "calls"), `resolve:${request.selectors.join(",")}\n`)',
      '    return { targets: request.selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] }',
      '  },',
      '  async run(request) {',
      '    await appendFile(join(request.projectRoot, "calls"), `run:${request.targets.map(target => target.targetId).join(",")}\n`)',
      '    return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) }',
      '  },',
      '}',
    ].join('\n'))

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      scenarios: [
        { id: 'fixture.future.executes', scope: 'add', evidence: [{ reference: 'fixture::future', status: 'PASS' }] },
        { id: 'fixture.future.shared', scope: 'add', evidence: [{ reference: 'fixture::future', status: 'PASS' }] },
      ],
      targetCount: 1,
    })
    expect(await readFile(join(root, 'calls'), 'utf8')).toBe('resolve:future\nrun:future\n')
  })

  it('executes revised evidence rather than source-scope evidence for the same scenario ID', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', focusedScenario(
      'fixture.current.passes',
      'fixture::revised',
      { name: 'Revision executes', revisionRows: ['- **REVISES**: current'] },
    ))
    await put(root, 'runner.ts', [
      "import { appendFile } from 'node:fs/promises'",
      "import { join } from 'node:path'",
      'export default {',
      '  apiVersion: 1,',
      '  async resolve(request) { return { targets: request.selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run(request) {',
      '    await appendFile(join(request.projectRoot, "runs"), `${request.targets.map(target => target.targetId).join(",")}\n`)',
      '    return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) }',
      '  },',
      '}',
    ].join('\n'))

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.current.passes', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      scenarios: [{
        id: 'fixture.current.passes',
        scope: 'add',
        evidence: [{ reference: 'fixture::revised', status: 'PASS' }],
      }],
      targetCount: 1,
    })
    expect(await readFile(join(root, 'runs'), 'utf8')).toBe('revised\n')
  })

  it('reports phase timings only when requested', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })

    const ordinaryValidation = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    const timedValidation = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json', '--timings'], { encoding: 'utf8' })
    const ordinaryRun = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    const timedRun = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json', '--timings'], { encoding: 'utf8' })
    const timedText = spawnSync(process.execPath, [cli, 'run', '--root', root, '--timings'], { encoding: 'utf8' })

    expect(ordinaryValidation.status).toBe(0)
    expect(timedValidation.status).toBe(0)
    expect(ordinaryRun.status).toBe(0)
    expect(timedRun.status).toBe(0)
    expect(timedText.status).toBe(0)
    const ordinaryValidationOutput = json(ordinaryValidation.stdout)
    const timedValidationOutput = json(timedValidation.stdout)
    const ordinaryRunOutput = json(ordinaryRun.stdout)
    const timedRunOutput = json(timedRun.stdout)
    expect(ordinaryValidationOutput).not.toHaveProperty('timings')
    expect(ordinaryRunOutput).not.toHaveProperty('timings')
    expect(timedValidationOutput).toMatchObject({
      valid: ordinaryValidationOutput.valid,
      scenarios: ordinaryValidationOutput.scenarios,
      plannedEvidence: ordinaryValidationOutput.plannedEvidence,
      targets: ordinaryValidationOutput.targets,
      timings: {
        validationMs: expect.any(Number),
        resolutionMs: expect.any(Number),
        totalMs: expect.any(Number),
      },
    })
    expect(timedRunOutput).toMatchObject({
      success: ordinaryRunOutput.success,
      scenarios: ordinaryRunOutput.scenarios,
      targetCount: ordinaryRunOutput.targetCount,
      timings: {
        validationMs: expect.any(Number),
        resolutionMs: expect.any(Number),
        executionMs: expect.any(Number),
        totalMs: expect.any(Number),
      },
    })
    const validationTimings = timedValidationOutput.timings as Record<string, number>
    const runTimings = timedRunOutput.timings as Record<string, number>
    for (const duration of Object.values(validationTimings)) expect(duration).toBeGreaterThan(0)
    for (const duration of Object.values(runTimings)) expect(duration).toBeGreaterThan(0)
    expect(timedText.stdout).toMatch(/^timings: validation [\d.]+ ms, resolution [\d.]+ ms, execution [\d.]+ ms, total [\d.]+ ms$/m)
  })

  it('reports reached timings on validation failure', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
    await put(root, 'runner.ts', [
      'export default {',
      '  apiVersion: 1,',
      '  async resolve(request) { return { targets: [], errors: request.selectors.map(selector => ({ selector, message: "not found" })) } },',
      '  async run() { throw new Error("execution must not start") },',
      '}',
    ].join('\n'))

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json', '--timings'], { encoding: 'utf8' })
    const text = spawnSync(process.execPath, [cli, 'run', '--root', root, '--timings'], { encoding: 'utf8' })
    const output = json(run.stdout)

    expect(run.status).toBe(1)
    expect(text.status).toBe(1)
    expect(output).toMatchObject({
      valid: false,
      executionStarted: false,
      violations: [expect.objectContaining({ scenarioId: 'fixture.current.passes' })],
      timings: {
        validationMs: expect.any(Number),
        resolutionMs: expect.any(Number),
        totalMs: expect.any(Number),
      },
    })
    expect(output).not.toHaveProperty('success')
    expect(output).not.toHaveProperty('scenarios')
    expect(output.timings).not.toHaveProperty('executionMs')
    for (const duration of Object.values(output.timings as Record<string, number>)) expect(duration).toBeGreaterThan(0)
    expect(text.stderr).toContain('execution did not start')
    expect(text.stderr).toMatch(/^timings: validation [\d.]+ ms, resolution [\d.]+ ms, total [\d.]+ ms$/m)
  })
})
