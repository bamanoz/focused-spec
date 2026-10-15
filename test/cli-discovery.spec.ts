import { spawnSync } from 'node:child_process'
import { lstat, mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))
const roots: string[] = []

async function put(root: string, path: string, content: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, content)
}

async function fixture(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix))
  roots.push(root)
  return root
}

function invoke(root: string, ...argumentsList: string[]) {
  return spawnSync(process.execPath, [cli, ...argumentsList], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
    env: {
      ...process.env,
      npm_config_offline: 'true',
      HTTP_PROXY: 'http://127.0.0.1:1',
      HTTPS_PROXY: 'http://127.0.0.1:1',
    },
  })
}

function parseJson(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>
}

async function entries(root: string): Promise<string[]> {
  return (await readdir(root, { recursive: true })).sort()
}

function inlineScenario(id: string, evidence: readonly string[], name = id): string {
  return [
    `#### Scenario: ${name}`,
    `- **ID**: \`${id}\``,
    ...evidence.map(reference => `- **EVIDENCE**: \`${reference}\``),
    '- **WHEN** the selected behavior is inspected',
    '- **THEN** only its enrolled evidence is considered',
  ].join('\n')
}

async function configureInline(root: string, runners: readonly string[] = [
  'runners:',
  '  fixture: { module: ./runner.mjs }',
]): Promise<void> {
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
  await put(root, '.focused-spec/config.yaml', [
    'version: 5',
    'specifications:',
    '  formats:',
    '    inline: { package: "@focused-spec/format-inline" }',
    '  documents:',
    '    - match: "specs/{scope}.md"',
    '      format: inline',
    ...runners,
  ].join('\n'))
}

async function exists(path: string): Promise<boolean> {
  return await lstat(path).then(() => true, () => false)
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('CLI discovery and transport', () => {
  it('runs the workspace-linked CLI through offline npx', async () => {
    const repository = fileURLToPath(new URL('..', import.meta.url))
    const result = spawnSync('npx', ['--no-install', 'focused-spec', 'version', '--json'], {
      cwd: repository,
      encoding: 'utf8',
      timeout: 20_000,
      env: { ...process.env, npm_config_offline: 'true', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' },
    })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(parseJson(result.stdout)).toMatchObject({
      package: { name: 'focused-spec' },
      executable: await realpath(cli),
    })
  })

  it('reports invoked offline identity and rejects ignored version arguments', async () => {
    const root = await fixture('focused-cli-version-')
    await put(root, 'package.json', '{"name":"unrelated-consumer","version":"99.0.0"}\n')
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    const before = await entries(root)
    const identity = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8')) as { name: string; version: string }

    const machine = invoke(root, 'version', '--json')
    expect(machine.status, machine.stderr).toBe(0)
    expect(machine.stderr).toBe('')
    expect(parseJson(machine.stdout)).toEqual({
      package: { name: identity.name, version: identity.version },
      executable: await realpath(cli),
      runtime: { node: process.version },
      contracts: { guidance: 1, configuration: 5, format: 2, runner: 1 },
    })

    for (const argumentsList of [['version'], ['--version'], ['-V']] as const) {
      const result = invoke(root, ...argumentsList)
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toBe(`focused-spec ${identity.version}\n`)
    }

    const aliasHelp = invoke(root, '--version', '--help')
    expect(aliasHelp.status, aliasHelp.stderr).toBe(0)
    expect(aliasHelp.stderr).toBe('')
    expect(aliasHelp.stdout).toContain('focused-spec version [--json]')

    for (const [argumentsList, json] of [
      [['version', 'extra'], false],
      [['version', '--json', '--json'], true],
      [['--version', '--json'], true],
      [['-V', 'extra'], false],
    ] as const) {
      const result = invoke(root, ...argumentsList)
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      if (json) {
        expect(parseJson(result.stderr)).toMatchObject({ error: { code: 'invalid_arguments', message: expect.any(String), help: 'focused-spec version --help' } })
      } else {
        expect(result.stderr).toContain('focused-spec version --help')
      }
    }
    expect(await entries(root)).toEqual(before)
  })

  it('returns JSON argument errors across commands without prototype command leakage', async () => {
    const root = await fixture('focused-cli-errors-')
    const rows = [
      { argumentsList: ['--json'], help: 'focused-spec --help' },
      { argumentsList: ['validate', '--unknown', '--json'], help: 'focused-spec validate --help' },
      { argumentsList: ['run', '--scope', '--json'], help: 'focused-spec run --help' },
      { argumentsList: ['plugin-docs', '--json'], help: 'focused-spec plugin-docs --help' },
      { argumentsList: ['instructions', '--topic', 'unknown', '--json'], help: 'focused-spec instructions --help' },
      { argumentsList: ['list', '--root', '--json'], help: 'focused-spec list --help' },
      { argumentsList: ['show', '--json'], help: 'focused-spec show --help' },
      { argumentsList: ['version', '--json', '--json'], help: 'focused-spec version --help' },
      { argumentsList: ['init', '--json'], help: 'focused-spec init --help' },
      { argumentsList: ['toString', '--json'], help: 'focused-spec --help' },
    ] as const

    for (const { argumentsList, help } of rows) {
      const result = invoke(root, ...argumentsList)
      expect(result.status, argumentsList.join(' ')).toBe(1)
      expect(result.stdout, argumentsList.join(' ')).toBe('')
      expect(parseJson(result.stderr), argumentsList.join(' ')).toMatchObject({
        error: { code: 'invalid_arguments', message: expect.any(String), help },
      })
    }

    const prototypeHelp = invoke(root, 'help', 'toString')
    expect(prototypeHelp.status).toBe(1)
    expect(prototypeHelp.stdout).toBe('')
    expect(prototypeHelp.stderr).toContain('focused-spec --help')
  })

  it('renders uncaught plugin documentation failures as one JSON error', async () => {
    const root = await fixture('focused-cli-plugin-error-')
    await put(root, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats:',
      '    local: { module: ./format.mjs }',
      '  documents:',
      '    - match: "specs/*.txt"',
      '      format: local',
      '      scope: current',
      'runners: {}',
    ].join('\n'))
    await put(root, 'format.mjs', 'export default { apiVersion: 2, parse() { throw new Error("must not parse for documentation") } }\n')

    const result = invoke(root, 'plugin-docs', '--format', 'local', '--json')
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(parseJson(result.stderr)).toEqual({
      error: {
        code: 'command_failed',
        message: expect.stringMatching(/documentation|local/iu),
      },
    })
  })

  it('preserves opaque option-looking IDs without enabling JSON or help transport', async () => {
    const root = await fixture('focused-cli-opaque-')
    await configureInline(root, ['runners:', '  missing: { module: ./missing-runner.mjs }'])
    await put(root, 'specs/current.md', [
      inlineScenario('--json', ['planned:missing::json']),
      inlineScenario('--help', ['planned:missing::help']),
    ].join('\n\n'))

    for (const id of ['--json', '--help']) {
      const shown = invoke(root, 'show', '--root', root, '--', id)
      expect(shown.status, shown.stderr).toBe(0)
      expect(shown.stderr).toBe('')
      expect(shown.stdout).toContain(`[current] ${id}:`)
      expect(() => JSON.parse(shown.stdout)).toThrow()
    }

    const actualHelp = invoke(root, 'show', '--root', join(root, 'missing'), '--help')
    expect(actualHelp.status, actualHelp.stderr).toBe(0)
    expect(actualHelp.stderr).toBe('')
    expect(actualHelp.stdout).toContain('focused-spec show')
    expect(actualHelp.stdout).toContain('--root <path>')

    const validateValue = invoke(root, 'validate', '--root', root, '--scenario', '--json', '--syntax-only')
    expect(validateValue.status, validateValue.stderr).toBe(0)
    expect(validateValue.stderr).toBe('')
    expect(validateValue.stdout).toContain('scenario --json')
    expect(() => JSON.parse(validateValue.stdout)).toThrow()

    const runValue = invoke(root, 'run', '--root', root, '--scenario', '--json', '--json')
    expect(runValue.status).toBe(1)
    expect(runValue.stderr).toBe('')
    expect(parseJson(runValue.stdout)).toMatchObject({
      valid: false,
      validationScope: { scopes: { mode: 'all' }, scenario: '--json' },
      executionSelection: { scopes: { mode: 'all' }, scenario: '--json' },
    })

    const rejectedValue = invoke(root, 'validate', '--scope', '--opaque', '--json')
    expect(rejectedValue.status).toBe(1)
    expect(rejectedValue.stdout).toBe('')
    expect(parseJson(rejectedValue.stderr)).toMatchObject({ error: { code: 'invalid_arguments', help: 'focused-spec validate --help' } })

    const delimitedExcess = invoke(root, 'show', '--', '--json', 'extra')
    expect(delimitedExcess.status).toBe(1)
    expect(delimitedExcess.stdout).toBe('')
    expect(delimitedExcess.stderr).toContain('focused-spec show --help')
    expect(() => JSON.parse(delimitedExcess.stderr)).toThrow()
  })

  it('discovers version inspection and validation selection help offline', async () => {
    const root = await fixture('focused-cli-help-')
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    const before = await entries(root)

    for (const argumentsList of [['--help'], ['-h'], ['help']] as const) {
      const result = invoke(root, ...argumentsList)
      expect(result.status, result.stderr).toBe(0)
      for (const command of ['version', 'list', 'show']) expect(result.stdout).toMatch(new RegExp(`^\\s+${command}\\s`, 'mu'))
    }

    const expectedOptions = {
      version: ['--json'],
      list: ['--config', '--json', '--root', '--scenario', '--scope'],
      show: ['--config', '--json', '--root', '--scope'],
      validate: ['--config', '--json', '--root', '--scenario', '--scope', '--strict', '--syntax-only', '--timings'],
    } as const
    for (const [command, options] of Object.entries(expectedOptions)) {
      for (const argumentsList of [[command, '--help'], [command, '-h'], ['help', command]]) {
        const result = invoke(root, ...argumentsList)
        expect(result.status, `${command}: ${result.stderr}`).toBe(0)
        expect(result.stderr).toBe('')
        expect(result.stdout).toMatch(new RegExp(`^\\s*focused-spec ${command}(?: | \\[| \\(|$)`, 'mu'))
        const actual = [...result.stdout.matchAll(/^\s+(--[a-z-]+)/gmu)].map(match => match[1]!).sort()
        expect(actual).toEqual([...options].sort())
      }
    }
    expect(await entries(root)).toEqual(before)
  })

  it('validates selected scenarios without resolving unrelated evidence or executing tests', async () => {
    const root = await fixture('focused-cli-selection-')
    await configureInline(root)
    await put(root, 'specs/good.md', [
      inlineScenario('selection.shared', ['fixture::good'], 'Good occurrence'),
      inlineScenario('selection.unrelated', ['malformed-reference'], 'Unrelated malformed occurrence'),
    ].join('\n\n'))
    await put(root, 'specs/other.md', inlineScenario('selection.shared', ['fixture::other'], 'Other occurrence'))
    await put(root, 'runner.mjs', [
      "import { appendFile, writeFile } from 'node:fs/promises'",
      "import { resolve } from 'node:path'",
      'export default { apiVersion: 1,',
      '  async resolve(request) { await appendFile(resolve(request.projectRoot, "resolved"), request.selectors.join("\\n") + "\\n"); return { targets: request.selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run(request) { await writeFile(resolve(request.projectRoot, "executed"), String(request.targets.length)); throw new Error("validation must not execute") },',
      '}',
    ].join('\n'))

    const scoped = invoke(root, 'validate', '--root', root, '--scope', 'good', '--scenario', 'selection.shared', '--json')
    expect(scoped.status, scoped.stderr || scoped.stdout).toBe(0)
    expect(parseJson(scoped.stdout)).toEqual({
      valid: true,
      scenarios: 1,
      plannedEvidence: 0,
      targets: 1,
      validationScope: { scopes: { mode: 'selected', name: 'good' }, scenario: 'selection.shared' },
    })
    expect(await readFile(join(root, 'resolved'), 'utf8')).toBe('good\n')
    expect(await exists(join(root, 'executed'))).toBe(false)

    await rm(join(root, 'resolved'))
    const everyScope = invoke(root, 'validate', '--root', root, '--scenario', 'selection.shared', '--json')
    expect(everyScope.status, everyScope.stderr || everyScope.stdout).toBe(0)
    expect(parseJson(everyScope.stdout)).toEqual({
      valid: true,
      scenarios: 2,
      plannedEvidence: 0,
      targets: 2,
      validationScope: { scopes: { mode: 'all' }, scenario: 'selection.shared' },
    })
    expect((await readFile(join(root, 'resolved'), 'utf8')).trim().split('\n').sort()).toEqual(['good', 'other'])
    expect(await exists(join(root, 'executed'))).toBe(false)

    await rm(join(root, 'resolved'))
    const full = invoke(root, 'validate', '--root', root, '--json')
    expect(full.status).toBe(1)
    expect(full.stderr).toBe('')
    expect(parseJson(full.stdout)).toMatchObject({ valid: false, validationScope: { scopes: { mode: 'all' } } })
    expect(await exists(join(root, 'resolved'))).toBe(false)
    expect(await exists(join(root, 'executed'))).toBe(false)
  })

  it('preserves selected validation modes and structural boundaries', async () => {
    const root = await fixture('focused-cli-modes-')
    const importMarker = join(root, 'runner-imported')
    await configureInline(root, [
      'runners:',
      '  unavailable: { module: ./unavailable.mjs }',
    ])
    await put(root, 'unavailable.mjs', [
      "import { writeFileSync } from 'node:fs'",
      `writeFileSync(${JSON.stringify(importMarker)}, 'imported')`,
      'throw new Error("selected runner is unavailable")',
    ].join('\n'))
    await put(root, 'specs/current.md', [
      inlineScenario('modes.planned', ['planned:unavailable::future']),
      inlineScenario('modes.concrete', ['unavailable::target']),
      inlineScenario('modes.malformed', ['malformed-reference']),
    ].join('\n\n'))

    const syntax = invoke(root, 'validate', '--root', root, '--scenario', 'modes.concrete', '--syntax-only', '--json')
    expect(syntax.status, syntax.stderr || syntax.stdout).toBe(0)
    expect(parseJson(syntax.stdout)).toEqual({
      valid: true,
      mode: 'syntax-only',
      validationScope: { scopes: { mode: 'all' }, scenario: 'modes.concrete' },
    })
    expect(await exists(importMarker)).toBe(false)

    const ordinary = invoke(root, 'validate', '--root', root, '--scenario', 'modes.planned', '--json')
    expect(ordinary.status, ordinary.stderr || ordinary.stdout).toBe(0)
    expect(parseJson(ordinary.stdout)).toEqual({
      valid: true,
      scenarios: 1,
      plannedEvidence: 1,
      targets: 0,
      validationScope: { scopes: { mode: 'all' }, scenario: 'modes.planned' },
    })
    expect(await exists(importMarker)).toBe(false)

    const strict = invoke(root, 'validate', '--root', root, '--scenario', 'modes.planned', '--strict', '--json')
    expect(strict.status).toBe(1)
    expect(parseJson(strict.stdout)).toMatchObject({
      valid: false,
      validationScope: { scopes: { mode: 'all' }, scenario: 'modes.planned' },
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'modes.planned', message: expect.stringMatching(/planned/iu) })]),
    })

    const malformed = invoke(root, 'validate', '--root', root, '--scenario', 'modes.malformed', '--syntax-only', '--json')
    expect(malformed.status).toBe(1)
    expect(parseJson(malformed.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'modes.malformed' })]) })

    for (const [argumentsList, message] of [
      [['validate', '--root', root, '--scenario', 'modes.absent', '--syntax-only', '--json'], /selected scenario not found/iu],
      [['validate', '--root', root, '--scope', 'absent', '--scenario', 'modes.planned', '--syntax-only', '--json'], /scope has no matching documents/iu],
    ] as const) {
      const absent = invoke(root, ...argumentsList)
      expect(absent.status).toBe(1)
      expect(parseJson(absent.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(message) })]) })
    }

    const unavailable = invoke(root, 'validate', '--root', root, '--scenario', 'modes.concrete', '--json')
    expect(unavailable.status).toBe(1)
    expect(parseJson(unavailable.stdout)).toMatchObject({
      valid: false,
      validationScope: { scopes: { mode: 'all' }, scenario: 'modes.concrete' },
      violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/runner|unavailable/iu) })]),
    })
    expect(await exists(importMarker)).toBe(true)

    const full = invoke(root, 'validate', '--root', root, '--json')
    expect(full.status).toBe(1)
    expect(parseJson(full.stdout)).toMatchObject({
      valid: false,
      validationScope: { scopes: { mode: 'all' } },
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'modes.malformed' })]),
    })

    const structural = await fixture('focused-cli-structural-')
    await put(structural, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats:',
      '    broken: { module: ./broken-format.mjs }',
      '  documents:',
      '    - match: "specs/*.txt"',
      '      format: broken',
      '      scope: current',
      'runners: {}',
    ].join('\n'))
    await put(structural, 'broken-format.mjs', 'throw new Error("structural format failure")\n')
    await put(structural, 'specs/outcome.txt', 'selected native outcome\n')
    const failedSource = invoke(structural, 'validate', '--root', structural, '--scenario', 'modes.any', '--syntax-only', '--json')
    expect(failedSource.status).toBe(1)
    expect(failedSource.stderr).toBe('')
    expect(parseJson(failedSource.stdout)).toMatchObject({
      valid: false,
      validationScope: { scopes: { mode: 'all' }, scenario: 'modes.any' },
      violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/format|structural|failure/iu) })]),
    })
  })

  it('separates invalid init invocation errors from valid installation reports', async () => {
    const root = await fixture('focused-cli-init-boundary-')
    const before = await entries(root)
    for (const argumentsList of [
      ['init', '--json'],
      ['init', '--tools', 'claude', '--tools', 'codex', '--json'],
      ['init', '--unknown', '--json'],
    ]) {
      const result = invoke(root, ...argumentsList)
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(parseJson(result.stderr)).toMatchObject({
        error: { code: 'invalid_arguments', message: expect.any(String), help: 'focused-spec init --help' },
      })
      expect(await entries(root)).toEqual(before)
    }

    await put(root, '.claude/skills/focused-spec/SKILL.md', 'custom integration\n')
    const conflict = invoke(root, 'init', root, '--tools', 'claude', '--json')
    expect(conflict.status).toBe(1)
    expect(conflict.stderr).toBe('')
    expect(parseJson(conflict.stdout)).toMatchObject({
      root: await realpath(root),
      tools: ['claude'],
      dryRun: false,
      files: expect.arrayContaining([expect.objectContaining({ path: '.claude/skills/focused-spec/SKILL.md', action: 'conflict', applied: false })]),
      errors: expect.arrayContaining([expect.objectContaining({ path: '.claude/skills/focused-spec/SKILL.md', message: expect.any(String) })]),
    })
    expect(await readFile(join(root, '.claude/skills/focused-spec/SKILL.md'), 'utf8')).toBe('custom integration\n')

    const tree = await entries(root)
    const preview = invoke(root, 'init', root, '--tools', 'agents', '--dry-run', '--json')
    expect(preview.status, preview.stderr).toBe(0)
    expect(preview.stderr).toBe('')
    expect(parseJson(preview.stdout)).toMatchObject({
      root: await realpath(root),
      tools: ['agents'],
      dryRun: true,
      files: [{ path: '.agents/skills/focused-spec/SKILL.md', action: 'install', applied: false }],
      errors: [],
    })
    expect(await entries(root)).toEqual(tree)
  })
})
