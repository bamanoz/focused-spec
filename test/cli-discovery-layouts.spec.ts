import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import { mkdtemp, mkdir, readFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { roots, cli, baselineEntries, put, configYaml, nativeScenario, inlineScenario, configure, configureInline, writeRegistry, fixture, emptyFixture, json } from './fixtures/cli-suite.js'
import type { RegistryEntry } from './fixtures/cli-suite.js'


describe('focused-spec CLI', () => {
  it.each(['zero-depth', 'nested'] as const)('preserves captured scope before a globstar with leading ./ for %s documents', async depth => {
    const root = await fixture()
    const path = depth === 'zero-depth' ? 'changes/alpha/spec.md' : 'changes/alpha/auth/deep/spec.md'
    await put(root, path, nativeScenario('fixture.capture.passes'))
    await put(root, 'changes/beta/spec.md', nativeScenario('fixture.capture.other'))
    await writeRegistry(root, [
      { scope: 'alpha', id: 'fixture.capture.passes', evidence: ['fixture::captured'] },
      { scope: 'beta', id: 'fixture.capture.other', evidence: ['fixture::other'] },
    ])
    for (const match of ['changes/{scope}/**/spec.md', './changes/{scope}/**/spec.md']) {
      await configure(root, [{ match }])
      const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'alpha', '--strict', '--json'], { encoding: 'utf8', timeout: 20_000 })
      expect(validate.error, validate.stderr).toBeUndefined()
      expect(validate.status, validate.stdout).toBe(0)
      expect(json(validate.stdout)).toMatchObject({ valid: true, scenarios: 1, targets: 1, validationScope: { scopes: { mode: 'selected', name: 'alpha' } } })
      const executed = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'alpha', '--json'], { encoding: 'utf8', timeout: 20_000 })
      expect(executed.error, executed.stderr).toBeUndefined()
      expect(executed.status, executed.stdout).toBe(0)
      expect(json(executed.stdout)).toMatchObject({ success: true, targetCount: 1, scenarios: [{ id: 'fixture.capture.passes', scope: 'alpha', status: 'PASS' }] })
    }
  })

  it('captures scope from the matching expanded brace alternative', async () => {
    const root = await emptyFixture()
    await configure(root, [
      { match: 'changes/{scope}/{specs,specs/nested}/spec.md' },
      { match: '{openspec,docs/x}/changes/{scope}/**/spec.md' },
    ])
    await put(root, 'changes/alpha/specs/spec.md', nativeScenario('fixture.capture.alternative'))
    await put(root, 'docs/x/changes/beta/nested/spec.md', nativeScenario('fixture.capture.prefix'))
    await writeRegistry(root, [
      { scope: 'alpha', id: 'fixture.capture.alternative', evidence: ['planned:fixture::alternative'] },
      { scope: 'beta', id: 'fixture.capture.prefix', evidence: ['planned:fixture::prefix'] },
    ])

    for (const scope of ['alpha', 'beta']) {
      const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', scope, '--json'], { encoding: 'utf8' })
      expect(result.status, result.stdout).toBe(0)
      expect(json(result.stdout)).toMatchObject({ valid: true, scenarios: 1, plannedEvidence: 1, validationScope: { scopes: { mode: 'selected', name: scope } } })
    }
  })

  it('rejects old config and format APIs without fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-api-cutover-'))
    roots.push(root)
    await configureInline(root, undefined, ['runners:', '  missing: { module: ./missing-runner.mjs }'])
    const current = await readFile(join(root, '.focused-spec/config.yaml'), 'utf8')
    await put(root, 'specs/cutover.md', inlineScenario('cutover.evidence', ['planned:missing::future']))
    const supported = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(supported.status, supported.stdout).toBe(0)
    for (const version of [1, 2, 3, 4]) {
      await put(root, '.focused-spec/config.yaml', current.replace('version: 5', `version: ${version}`))
      const obsolete = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
      expect(obsolete.status, obsolete.stdout).toBe(1)
      expect(json(obsolete.stdout)).toMatchObject({ valid: false,
        violations: expect.arrayContaining([expect.objectContaining({ path: join(root, '.focused-spec/config.yaml') })]) })
    }
    await put(root, '.focused-spec/config.yaml', `${current}\nevidence:\n  files: [.focused-spec/evidence.yaml]\n`)
    await put(root, '.focused-spec/evidence.yaml', 'scopes: {}\n')
    const obsoleteEvidence = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(obsoleteEvidence.status).toBe(1)
    expect(json(obsoleteEvidence.stdout)).toMatchObject({ valid: false,
      violations: expect.arrayContaining([expect.objectContaining({
        path: join(root, '.focused-spec/config.yaml'),
        message: expect.stringMatching(/evidence|format.*options/iu),
      })]) })

    await put(root, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats: { legacy: { module: ./legacy-format.mjs } }',
      '  documents: [{ match: specs/legacy.md, scope: current, format: legacy }]',
      'runners: {}',
    ].join('\n'))
    await put(root, 'legacy-format.mjs', 'export default { apiVersion: 1, parse() { throw new Error("API 1 parser must not run") } }')
    await put(root, 'specs/legacy.md', 'legacy input')
    const obsoleteApi = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(obsoleteApi.status).toBe(1)
    expect(json(obsoleteApi.stdout)).toMatchObject({ valid: false,
      violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/Format API 1|apiVersion.*2|instructions --protocol 1/iu) })]) })
    expect(obsoleteApi.stdout).not.toContain('API 1 parser must not run')
    const apiMessages = (json(obsoleteApi.stdout).violations as { message: string }[]).map(item => item.message)
    expect(apiMessages.some(message => message.includes('topic upgrade'))).toBe(true)
    const guidance = spawnSync(process.execPath, [cli, 'instructions', '--protocol', '1', '--topic', 'upgrade', '--json'], { cwd: root, encoding: 'utf8' })
    expect(guidance.status, guidance.stderr).toBe(0)
    expect(json(guidance.stdout)).toMatchObject({ protocolVersion: 1, topic: 'upgrade', package: { name: 'focused-spec' } })
  })

  it('accepts the same ID in independent scopes', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/other/specs/new/spec.md', nativeScenario('fixture.future.planned'))
    await writeRegistry(root, [
      ...baselineEntries,
      { scope: 'other', id: 'fixture.future.planned', evidence: ['planned:fixture::other'] },
    ])

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toMatchObject({ scenarios: 3, plannedEvidence: 2 })
  })

  it('does not inherit evidence from another scope with the same ID', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Add scope must supply evidence'))
    await writeRegistry(root, [baselineEntries[0]!])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({
      valid: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.current.passes', message: expect.stringMatching(/registry|evidence/iu) })]),
    })
  })

  it('runs all scopes and disambiguates repeated scenario IDs', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Add scope evidence'))
    await put(root, 'openspec/changes/other/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Other scope evidence'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.current.passes', evidence: ['fixture::add'] },
      { scope: 'other', id: 'fixture.current.passes', evidence: ['fixture::other'] },
    ])

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    const output = json(run.stdout)
    expect(output).toMatchObject({ success: true, targetCount: 3 })
    expect(output.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'fixture.current.passes', scope: 'current', status: 'PASS' }),
      expect.objectContaining({ id: 'fixture.current.passes', scope: 'add', status: 'PASS' }),
      expect.objectContaining({ id: 'fixture.current.passes', scope: 'other', status: 'PASS' }),
    ]))
  })

  it('reports selected scope and scenario execution independently', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.future.executes', 'Future evidence executes'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.future.executes', evidence: ['fixture::future'] },
    ])

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.future.executes', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      validationScope: { scopes: { mode: 'selected', name: 'add' }, scenario: 'fixture.future.executes' },
      executionSelection: { scopes: { mode: 'selected', name: 'add' }, scenario: 'fixture.future.executes' },
      scenarios: [{ id: 'fixture.future.executes', scope: 'add', status: 'PASS' }],
      targetCount: 1,
    })
  })

  it('validates a selected scope independently of another same-ID scope', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/current/spec.md', nativeScenario('fixture.current.passes', 'Unrelated current binding'))
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Independent add binding'))
    await writeRegistry(root, [
      { scope: 'current', id: 'fixture.current.passes', evidence: ['missing::broken'] },
      { scope: 'add', id: 'fixture.current.passes', evidence: ['planned:fixture::add'] },
    ])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(0)
    expect(json(result.stdout)).toMatchObject({ scenarios: 1, plannedEvidence: 1, targets: 0 })
  })

  it('advertises executable workflow guidance for obsolete configuration and inline metadata', async () => {
    const root = await emptyFixture()
    const config = configYaml([{ match: 'specs/**/*.md', scope: 'current' }], ['runners:', '  unit: { module: ./missing-runner.mjs }'])
    const metadata = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8')) as { version: string }
    const assertAdvertised = (result: SpawnSyncReturns<string>): void => {
      expect(result.status).toBe(1)
      const messages = (json(result.stdout).violations as { message: string }[]).map(item => item.message)
      expect(messages.some(message => message.includes('instructions --protocol 1 --topic upgrade --json'))).toBe(true)
      expect(messages.join('\n')).not.toContain('./node_modules/.bin')
      const guidance = spawnSync(process.execPath, [cli, 'instructions', '--protocol', '1', '--topic', 'upgrade', '--json'], { cwd: root, encoding: 'utf8' })
      expect(guidance.status, guidance.stderr).toBe(0)
      expect(json(guidance.stdout)).toMatchObject({ protocolVersion: 1, package: { name: 'focused-spec', version: metadata.version }, topic: 'upgrade', content: expect.any(String) })
    }
    const legacySource = '#### Scenario: Blocked account\n- **ID**: `auth.blocked`\n- **EVIDENCE**: `unit::blocked`\n- **REVISES**: `auth.previous`\n- **WHEN** a blocked account authenticates\n- **THEN** it is rejected\n'
    await put(root, 'specs/auth.md', nativeScenario('auth.blocked'))
    await writeRegistry(root, [{ scope: 'current', id: 'auth.blocked', evidence: ['planned:unit::blocked'] }])
    for (const version of [1, 2, 3, 4]) {
      await put(root, '.focused-spec/config.yaml', config.replace('version: 5', `version: ${version}`))
      assertAdvertised(spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' }))
    }
    await put(root, '.focused-spec/config.yaml', config)
    await put(root, 'specs/auth.md', legacySource)
    assertAdvertised(spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' }))
    await configureInline(root, undefined, ['runners: {}'])
    assertAdvertised(spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' }))
  })

  it('resolves a shared target once for scoped execution', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', [
      nativeScenario('fixture.future.executes', 'Future evidence executes'),
      nativeScenario('fixture.future.shared', 'Future evidence is shared'),
    ].join('\n\n'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.future.executes', evidence: ['fixture::future'] },
      { scope: 'add', id: 'fixture.future.shared', evidence: ['fixture::future'] },
    ])
    await put(root, 'runner.ts', [
      "import { appendFile } from 'node:fs/promises'",
      "import { join } from 'node:path'",
      'export default { apiVersion: 1,',
      '  async resolve(request) { await appendFile(join(request.projectRoot, "calls"), `resolve:${request.selectors.join(",")}\\n`); return { targets: request.selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run(request) { await appendFile(join(request.projectRoot, "calls"), `run:${request.targets.map(target => target.targetId).join(",")}\\n`); return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({ scenarios: [{ status: 'PASS' }, { status: 'PASS' }], targetCount: 1 })
    expect(await readFile(join(root, 'calls'), 'utf8')).toBe('resolve:future\nrun:future\n')
  })

  it('executes only selected-scope evidence for the same scenario ID', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Add-scope evidence executes'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.current.passes', evidence: ['fixture::add'] },
    ])
    await put(root, 'runner.ts', [
      "import { appendFile } from 'node:fs/promises'",
      "import { join } from 'node:path'",
      'export default { apiVersion: 1,',
      '  async resolve(request) { return { targets: request.selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run(request) { await appendFile(join(request.projectRoot, "runs"), `${request.targets.map(target => target.targetId).join(",")}\\n`); return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.current.passes', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({ scenarios: [{ id: 'fixture.current.passes', scope: 'add', status: 'PASS' }], targetCount: 1 })
    expect(await readFile(join(root, 'runs'), 'utf8')).toBe('add\n')
  })

  it('rejects unsafe document layouts and escaped specification symlinks', async () => {
    const root = await emptyFixture()
    await configure(root, [{ match: '../outside/**/*.md', scope: 'current' }], ['runners: {}'])
    const unsafe = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(unsafe.status).toBe(1)

    await configure(root, [{ match: 'specs/**/*.md', scope: 'current' }], ['runners: {}'])
    const outside = await mkdtemp(join(tmpdir(), 'focused-spec-outside-'))
    roots.push(outside)
    await put(outside, 'escape.md', nativeScenario('fixture.escape'))
    await mkdir(join(root, 'specs'), { recursive: true })
    await symlink(outside, join(root, 'specs/linked'), 'junction')
    const escaped = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(escaped.status).toBe(1)
    expect(JSON.stringify(json(escaped.stdout))).toMatch(/outside|escape|project root/iu)
  })

  it('validates and runs every matching scope for a selected scenario ID', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Add occurrence'))
    await put(root, 'openspec/changes/other/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Other occurrence'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.current.passes', evidence: ['fixture::add'] },
      { scope: 'other', id: 'fixture.current.passes', evidence: ['fixture::other'] },
    ])

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scenario', 'fixture.current.passes', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    const output = json(run.stdout)
    expect(output).toMatchObject({ success: true, validationScope: { scopes: { mode: 'all' }, scenario: 'fixture.current.passes' }, targetCount: 3 })
    expect(output.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'current', status: 'PASS' }),
      expect.objectContaining({ scope: 'add', status: 'PASS' }),
      expect.objectContaining({ scope: 'other', status: 'PASS' }),
    ]))
  })

  it('rejects a selected scope with no documents', async () => {
    const root = await fixture()

    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'missing', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({
      valid: false,
      executionStarted: false,
      validationScope: { scopes: { mode: 'selected', name: 'missing' } },
      executionSelection: { scopes: { mode: 'selected', name: 'missing' } },
    })
  })

  it('rejects a document claimed by multiple layouts', async () => {
    const root = await emptyFixture()
    await configure(root, [
      { match: 'specs/**/spec.md', scope: 'current' },
      { match: 'specs/{scope}/spec.md' },
    ])
    await put(root, 'specs/auth/spec.md', nativeScenario('layout.overlap'))
    await writeRegistry(root, [{ scope: 'current', id: 'layout.overlap', evidence: ['fixture::overlap'] }])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(JSON.stringify(json(result.stdout))).toMatch(/claim|multiple|overlap/iu)
  })

  it('discovers fixed and captured scope documents from declared patterns', async () => {
    const root = await emptyFixture()
    await configure(root, [
      { match: 'openspec/changes/{scope}/spec.md' },
      { match: 'features/{scope}/capabilities/**/spec.md' },
      { match: 'specs/**/*.md', scope: 'current' },
    ], [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
    ])
    await put(root, 'openspec/changes/add/spec.md', nativeScenario('layout.adjacent'))
    await put(root, 'features/account/capabilities/auth/spec.md', nativeScenario('layout.nested'))
    await put(root, 'specs/current.md', nativeScenario('layout.fixed'))
    await writeRegistry(root, [
      { scope: 'add', id: 'layout.adjacent', evidence: ['fixture::adjacent'] },
      { scope: 'account', id: 'layout.nested', evidence: ['fixture::nested'] },
      { scope: 'current', id: 'layout.fixed', evidence: ['fixture::fixed'] },
    ])
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run() { return { results: [] } } }')

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(0)
    expect(json(result.stdout)).toMatchObject({ valid: true, scenarios: 3, targets: 3 })
  })

  it('rejects excessive document and exclusion glob complexity', async () => {
    const root = await emptyFixture()
    const deep = '{'.repeat(40) + 'a,b' + '}'.repeat(40)
    for (const layout of [
      { match: `specs/${deep}.md`, scope: 'current' },
      { match: 'specs/@(@(@(a))).md', scope: 'current' },
      { match: `specs/[${deep}].md`, scope: 'current' },
      { match: `specs/${'a'.repeat(4096)}.md`, scope: 'current' },
      { match: `specs/${'{a}'.repeat(129)}.md`, scope: 'current' },
      { match: 'specs/{1..257}.md', scope: 'current' },
      { match: 'specs/**/*.md', scope: 'current', exclude: [`specs/${deep}.md`] },
      { match: 'specs/**/*.md', scope: 'current', exclude: ['specs/{1..257}.md'] },
    ]) {
      await configure(root, [layout], ['runners: {}'])
      const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8', timeout: 10000 })
      expect(result.status).toBe(1)
      expect(json(result.stdout)).toMatchObject({ valid: false, executionStarted: false,
        violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/glob pattern exceeds/u) })]) })
      expect(result.stderr).not.toContain('Maximum call stack')
    }
  })

  it('rejects unsafe brace-expanded document and exclusion paths before discovery', async () => {
    const root = await emptyFixture()
    for (const layout of [
      { match: '{../outside,specs}/**/*.md', scope: 'current' },
      { match: '{/tmp,specs}/**/*.md', scope: 'current' },
      { match: 'specs/**/*.md', scope: 'current', exclude: ['{../outside,specs}/**/*.md'] },
      { match: 'specs/**/*.md', scope: 'current', exclude: ['{/tmp,specs}/**/*.md'] },
    ]) {
      await configure(root, [layout], ['runners: {}'])

      const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(json(result.stdout)).toMatchObject({
        valid: false,
        violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('safe project-relative path pattern') })]),
      })
    }
  })

  it('isolates a format parse failure to its document', async () => {
    const root = await emptyFixture()
    await put(root, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats:',
      '    local:',
      '      module: ./format.mjs',
      '  documents:',
      '    - match: "docs/*.md"',
      '      format: local',
      '      scope: current',
      'runners:',
      '  fixture: { module: ./runner.mjs }',
    ].join('\n'))
    await put(root, 'format.mjs', [
      'export default { apiVersion: 2, parse({ source }) {',
      '  if (source.includes("explode")) throw new Error("document-only failure")',
      '  const markerId = source.trim()',
      '  return { items: [{ line: 1, name: markerId, nativeIds: [markerId], markerId }], diagnostics: [] }',
      '}, bind({ documents }) { return { enrollments: documents.flatMap((document, documentIndex) => document.items.map((item, itemIndex) => ({ document: documentIndex, item: itemIndex, id: item.markerId, evidence: ["planned:fixture::good"], location: { path: document.path, line: item.line } }))), diagnostics: [], sourceClaims: [] } } }',
    ].join('\n'))
    await put(root, 'runner.mjs', 'export default { apiVersion: 1, async resolve() { return { targets: [], errors: [] } }, async run() { return { results: [] } } }')
    await put(root, 'docs/a.md', 'explode')
    await put(root, 'docs/b.md', 'format.current.good')

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    const output = json(result.stdout)
    const violations = output.violations as { path: string; message: string }[]
    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'docs/a.md', message: expect.stringContaining('document-only failure') }),
    ]))
    expect(violations.filter(violation => violation.path === 'docs/b.md')).toEqual([])
    expect(violations.some(violation => violation.message.includes('format-provided evidence enrollment'))).toBe(false)
  })

  it('preserves padded stepped and hidden document discovery', async () => {
    const root = await emptyFixture()
    await configure(root, [
      { match: 'specs/record-{01..03}.md', scope: 'padded' },
      { match: 'changes/{scope}/case-{1..5..2}.md', exclude: ['changes/*/case-3.md'] },
      { match: 'specs/.hidden/*.md', scope: 'hidden' },
    ])
    const entries: RegistryEntry[] = []
    for (const [path, scope, id] of [
      ['specs/record-01.md', 'padded', 'range.one'], ['specs/record-02.md', 'padded', 'range.two'],
      ['specs/record-03.md', 'padded', 'range.three'], ['changes/alpha.one/case-1.md', 'alpha.one', 'step.one'],
      ['changes/alpha.one/case-5.md', 'alpha.one', 'step.five'], ['specs/.hidden/item.md', 'hidden', 'hidden.item'],
    ] as const) {
      await put(root, path, nativeScenario(id))
      entries.push({ scope, id, evidence: ['planned:fixture::future'] })
    }
    for (const path of ['specs/record-04.md', 'changes/alpha.one/case-2.md', 'changes/alpha.one/case-3.md']) {
      await put(root, path, nativeScenario('unselected.item'))
    }
    await writeRegistry(root, entries)
    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    expect(json(result.stdout)).toMatchObject({ valid: true, scenarios: 6 })
  })
})
