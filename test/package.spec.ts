import { spawnSync } from 'node:child_process'
import { cp, lstat, mkdtemp, mkdir, readFile, realpath, rm, stat, symlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repository, root, consumer, installedEntries, packedTarball, markdownTarball, vitestRunnerTarball, inlineTarball, registryTarball, put, packageIdentity, packPackage, installPackage, createPackedConsumer, installConsumerFramework, integrationTree, expectInstallerReadableSkill } from './fixtures/package-suite.js'


describe('package distribution', () => {
  it('packs prepared core output without rebuilding it when scripts are disabled', async () => {
    const checkout = await mkdtemp(join(root, 'prepared-pack-'))
    for (const name of ['scripts', 'skills', 'guidance']) await cp(join(repository, name), join(checkout, name), { recursive: true })
    for (const name of ['tsconfig.json', 'package.json', 'README.md', 'LICENSE']) await cp(join(repository, name), join(checkout, name))
    await put(join(checkout, 'docs/guides/runners.md'), await readFile(join(repository, 'docs/guides/runners.md'), 'utf8'))
    await symlink(join(repository, 'node_modules'), join(checkout, 'node_modules'), 'dir')
    for (const name of ['core', 'sdk/typescript', 'sdk/go', 'formats/markdown', 'formats/gherkin', 'formats/inline', 'formats/registry', 'formats/scenarios-typescript', 'formats/scenarios-go', 'formats/scenarios-python', 'formats/scenarios-dotnet', 'runners/vitest', 'runners/pytest', 'runners/go', 'runners/scenarios-typescript', 'runners/scenarios-go', 'runners/scenarios-python', 'runners/scenarios-dotnet']) await mkdir(join(checkout, 'packages', name), { recursive: true })
    const packageRoot = join(checkout, 'packages/core')
    await cp(join(repository, 'packages/core'), packageRoot, { recursive: true })
    const prepared = join(packageRoot, 'dist/prepared-only.js')
    await put(prepared, 'export const prepared = true\n')
    const packed = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { cwd: packageRoot, encoding: 'utf8', timeout: 60000 })
    expect(packed.status, packed.stderr).toBe(0)
    const files = (JSON.parse(packed.stdout) as { files: { path: string }[] }[])[0]!.files.map(file => file.path)
    expect(files).toContain('dist/prepared-only.js')
    expect(await readFile(prepared, 'utf8')).toBe('export const prepared = true\n')
  }, 60000)

  it('omits retired generated assets after repeated staging', async () => {
    const checkout = await mkdtemp(join(root, 'staging-'))
    for (const name of ['scripts', 'skills', 'guidance']) await cp(join(repository, name), join(checkout, name), { recursive: true })
    await put(join(checkout, 'docs/guides/runners.md'), await readFile(join(repository, 'docs/guides/runners.md'), 'utf8'))
    for (const name of ['README.md', 'LICENSE']) await cp(join(repository, name), join(checkout, name))
    for (const name of ['core', 'sdk/typescript', 'sdk/go', 'formats/markdown', 'formats/gherkin', 'formats/inline', 'formats/registry', 'formats/scenarios-typescript', 'formats/scenarios-go', 'formats/scenarios-python', 'formats/scenarios-dotnet', 'runners/vitest', 'runners/pytest', 'runners/go', 'runners/scenarios-typescript', 'runners/scenarios-go', 'runners/scenarios-python', 'runners/scenarios-dotnet']) await mkdir(join(checkout, 'packages', name), { recursive: true })
    const stage = () => spawnSync(process.execPath, ['scripts/stage-assets.mjs'], { cwd: checkout, encoding: 'utf8' })
    await put(join(checkout, 'skills/retired/SKILL.md'), 'retired loader')
    await put(join(checkout, 'guidance/retired.md'), 'retired guidance')
    expect(stage().status).toBe(0)
    await rm(join(checkout, 'skills/retired'), { recursive: true })
    await rm(join(checkout, 'guidance/retired.md'))
    expect(stage().status).toBe(0)
    expect(await stat(join(checkout, 'packages/core/skills/retired/SKILL.md')).then(() => 'present', error => error.code)).toBe('ENOENT')
    expect(await stat(join(checkout, 'packages/core/guidance/retired.md')).then(() => 'present', error => error.code)).toBe('ENOENT')
    for (const topic of ['workflow', 'review', 'author-revise', 'upgrade', 'verify', 'integration', 'formats', 'runners']) {
      expect(await readFile(join(checkout, `packages/core/guidance/${topic}.md`), 'utf8')).toBe(await readFile(join(checkout, `guidance/${topic}.md`), 'utf8'))
    }
    expect(await readFile(join(checkout, 'packages/core/skills/focused-spec/SKILL.md'), 'utf8')).toBe(await readFile(join(checkout, 'skills/focused-spec/SKILL.md'), 'utf8'))
  })

  it('installs independent core and adapter packages', async () => {
    const project = await createPackedConsumer('independent-adapters-')
    const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
    for (const name of ['@focused-spec/format-markdown', '@focused-spec/format-gherkin', '@focused-spec/format-inline', '@focused-spec/format-registry', '@focused-spec/runner-vitest', '@cucumber/gherkin', 'mdast-util-from-markdown', 'vitest']) {
      await expect(stat(join(project, 'node_modules', name))).rejects.toThrow()
    }
    await put(join(project, '.focused-spec/config.yaml'), JSON.stringify({ version: 5,
      specifications: { formats: { markdown: { package: '@focused-spec/format-registry', options: { parser: { package: '@focused-spec/format-markdown' } } } }, documents: [{ match: 'specs/contract.md', scope: 'current', format: 'markdown' }] },
      runners: { vitest: { package: '@focused-spec/runner-vitest' } },
    }))
    await put(join(project, '.focused-spec/evidence.yaml'), 'scopes:\n  current:\n    consumer.adapters.work:\n      evidence: ["vitest::test/contract.spec.ts::consumer > rejects blocked account"]\n')
    await put(join(project, 'specs/contract.md'), '<!-- focused-spec:id=consumer.adapters.work -->\n#### Scenario: Blocked accounts are rejected\n')
    const invoke = () => spawnSync(process.execPath, [cli, 'run', '--root', project, '--json'], { cwd: project, encoding: 'utf8', timeout: 120_000,
      env: { ...process.env, npm_config_offline: 'true', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' },
    })
    const missing = invoke()
    expect(missing.status).toBe(1)
    expect(JSON.parse(missing.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('@focused-spec/format-registry') })]) })
    await installConsumerFramework(project, packedTarball, registryTarball, markdownTarball, vitestRunnerTarball)
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    await put(join(project, 'test/contract.spec.ts'), "import { describe, expect, it } from 'vitest'; import { authenticate } from '../auth.mjs'; describe('consumer', () => { it('rejects blocked account', () => expect(authenticate(true)).toBe(false)); });")
    const passed = invoke()
    expect(passed.status, passed.stdout + passed.stderr).toBe(0)
    expect(JSON.parse(passed.stdout)).toMatchObject({ success: true, scenarios: [{ id: 'consumer.adapters.work', status: 'PASS' }] })
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => true\n')
    const regressed = invoke()
    expect(regressed.status).toBe(1)
    expect(JSON.parse(regressed.stdout)).toMatchObject({ success: false, scenarios: [{ id: 'consumer.adapters.work', status: 'FAIL' }] })
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    const restored = invoke()
    expect(restored.status, restored.stdout + restored.stderr).toBe(0)
    expect(JSON.parse(restored.stdout)).toMatchObject({ success: true, scenarios: [{ id: 'consumer.adapters.work', status: 'PASS' }] })
  }, 300_000)

  it('executes independently packed inline and registry formats', async () => {
    const project = await createPackedConsumer('storage-formats-')
    const otherTarballs = ['formats/gherkin', 'runners/go', 'runners/pytest'].map(name => packPackage(join(repository, 'packages', name), root))
    await installConsumerFramework(project, packedTarball, markdownTarball, inlineTarball, registryTarball, vitestRunnerTarball, ...otherTarballs)
    const references = ['vitest::test/behavior.spec.ts::consumer > rejects blocked', 'vitest::test/behavior.spec.ts::consumer > permits active']
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    await put(join(project, 'test/behavior.spec.ts'), "import { describe, expect, it } from 'vitest'; import { authenticate } from '../auth.mjs'; describe('consumer', () => { it('rejects blocked', () => expect(authenticate(true)).toBe(false)); it('permits active', () => expect(authenticate(false)).toBe(true)); });")
    const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
    const invoke = () => spawnSync(process.execPath, [cli, 'run', '--root', project, '--json'], { cwd: project, encoding: 'utf8', timeout: 120000 })
    for (const representation of ['inline', 'registry'] as const) {
      const format = representation === 'inline'
        ? { package: '@focused-spec/format-inline' }
        : { package: '@focused-spec/format-registry', options: { parser: { package: '@focused-spec/format-markdown' }, files: ['evidence/auth.yaml'] } }
      await put(join(project, '.focused-spec/config.yaml'), JSON.stringify({ version: 5, specifications: { formats: { selected: format }, documents: [{ match: 'specs/auth.md', scope: 'current', format: 'selected' }] }, runners: { vitest: { package: '@focused-spec/runner-vitest' } } }))
      const source = representation === 'inline'
        ? ['#### Scenario: Account access', '- **ID**: `Auth-login`', ...references.map(ref => '- **EVIDENCE**: `' + ref + '`'), '- **WHEN** an account authenticates', '- **THEN** blocked access is rejected and active access remains permitted'].join('\n')
        : '<!-- focused-spec:id=Auth-login -->\n#### Scenario: Account access\n'
      await put(join(project, 'specs/auth.md'), source)
      if (representation === 'registry') await put(join(project, 'evidence/auth.yaml'), JSON.stringify({ scopes: { current: { 'Auth-login': { evidence: references } } } }))
      else await expect(stat(join(project, '.focused-spec/evidence.yaml'))).rejects.toThrow()
      const baseline = invoke()
      expect(baseline.status, baseline.stdout + baseline.stderr).toBe(0)
      expect(JSON.parse(baseline.stdout)).toMatchObject({ targetCount: 2, scenarios: [{ id: 'Auth-login', status: 'PASS', evidence: references.map(reference => ({ reference, status: 'PASS' })) }] })
      await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => true\n')
      const regressed = invoke()
      expect(regressed.status, regressed.stdout + regressed.stderr).toBe(1)
      expect(JSON.parse(regressed.stdout)).toMatchObject({ scenarios: [{ status: 'FAIL', evidence: [{ reference: references[0], status: 'FAIL' }, { reference: references[1], status: 'PASS' }] }] })
      await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
      const restored = invoke()
      expect(restored.status, restored.stdout + restored.stderr).toBe(0)
    }
  }, 300000)

  it('typechecks consumer formats against the storage-independent format API', async () => {
    const project = await createPackedConsumer('format-api-two-')
    await installConsumerFramework(project, packedTarball, vitestRunnerTarball)
    await put(join(project, 'format.ts'), [
      "import type { FormatPlugin } from 'focused-spec/format'",
      'export default { apiVersion: 2, parse({ source }) { return { items: [{ line: 1, name: source, nativeIds: ["native"] }], diagnostics: [] } },',
      'bind({ documents, projectRoot }) { if (!projectRoot || documents[0]?.items[0]?.nativeIds[0] !== "native") throw new Error("catalog not supplied"); return { enrollments: [{ document: 0, item: 0, id: "Consumer ID", evidence: ["vitest::test/auth.spec.ts::rejects blocked"], location: { path: "virtual-origin", line: 9 } }], diagnostics: [], sourceClaims: [] } }',
      '} satisfies FormatPlugin',
    ].join('\n'))
    await put(join(project, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, noEmit: true }, files: ['format.ts'] }))
    const typed = spawnSync(process.execPath, [resolve(repository, 'node_modules/typescript/bin/tsc'), '-p', join(project, 'tsconfig.json')], { cwd: project, encoding: 'utf8' })
    expect(typed.status, typed.stdout + typed.stderr).toBe(0)
    await put(join(project, '.focused-spec/config.yaml'), JSON.stringify({ version: 5, specifications: { formats: { custom: { module: './format.ts' } }, documents: [{ match: 'specs/native.custom', scope: 'current', format: 'custom' }] }, runners: { vitest: { package: '@focused-spec/runner-vitest' } } }))
    await put(join(project, 'specs/native.custom'), 'Blocked accounts cannot authenticate')
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    await put(join(project, 'test/auth.spec.ts'), "import { it, expect } from 'vitest'; import { authenticate } from '../auth.mjs'; it('rejects blocked', () => expect(authenticate(true)).toBe(false));")
    const invoke = () => spawnSync(process.execPath, [join(project, 'node_modules/focused-spec/dist/cli.js'), 'run', '--json', '--scenario', 'Consumer ID'], { cwd: project, encoding: 'utf8', timeout: 120000 })
    const baseline = invoke()
    expect(baseline.status, baseline.stdout + baseline.stderr).toBe(0)
    expect(JSON.parse(baseline.stdout)).toMatchObject({ scenarios: [{ id: 'Consumer ID', status: 'PASS' }] })
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => true\n')
    const regressed = invoke()
    expect(regressed.status, regressed.stdout + regressed.stderr).toBe(1)
    expect(JSON.parse(regressed.stdout)).toMatchObject({ scenarios: [{ id: 'Consumer ID', status: 'FAIL' }] })
    await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
    const restored = invoke()
    expect(restored.status, restored.stdout + restored.stderr).toBe(0)
  }, 300000)


  it('installs the CLI without creating an agent skill or runner', () => {
    expect(installedEntries).not.toContain('.focused-spec')
    expect(installedEntries).not.toContain('.agents')
    expect(installedEntries).not.toContain('.omp')
    expect(installedEntries).not.toContain('focused-spec.yaml')
  })

  it('ships installer-readable skill metadata', async () => {
    await expectInstallerReadableSkill(consumer)
  })

  it('reports invoked identity from a packed unconfigured consumer', async () => {
    const project = await createPackedConsumer('version-identity-')
    try {
      await put(join(project, '.focused-spec/config.yaml'), 'invalid: [')
      const packageRoot = await realpath(join(project, 'node_modules/focused-spec'))
      const identity = packageIdentity(await readFile(join(packageRoot, 'package.json'), 'utf8'))
      const cli = join(packageRoot, 'dist/cli.js')
      const before = await integrationTree(project)
      const environment = { ...process.env, npm_config_offline: 'true', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' }

      const machine = spawnSync(process.execPath, [cli, 'version', '--json'], { cwd: project, encoding: 'utf8', env: environment })
      expect(machine.status, machine.stderr).toBe(0)
      expect(machine.stderr).toBe('')
      expect(JSON.parse(machine.stdout)).toEqual({
        package: identity,
        executable: await realpath(cli),
        runtime: { node: process.version },
        contracts: { guidance: 1, configuration: 5, format: 2, runner: 1 },
      })

      const text = spawnSync(process.execPath, [cli, '--version'], { cwd: project, encoding: 'utf8', env: environment })
      expect(text.status, text.stderr).toBe(0)
      expect(text.stderr).toBe('')
      expect(text.stdout).toBe(`${identity.name} ${identity.version}\n`)
      expect(await integrationTree(project)).toEqual(before)
    } finally {
      await rm(project, { recursive: true, force: true })
    }
  }, 300_000)

  it('lists and shows packed enrollment provenance without loading its runner', async () => {
    const project = await createPackedConsumer('inspection-provenance-')
    try {
      installPackage(project, packedTarball, registryTarball, markdownTarball)
      await put(join(project, '.focused-spec/config.yaml'), [
        'version: 5',
        'specifications:',
        '  formats: { markdown: { package: "@focused-spec/format-registry", options: { parser: { package: "@focused-spec/format-markdown" } } } }',
        '  documents:',
        '    - match: specs/**/*.md',
        '      format: markdown',
        '      scope: current',
        'runners:',
        '  consumer: { module: ./runner.mjs }',
      ].join('\n'))
      await put(join(project, '.focused-spec/evidence.yaml'), [
        'scopes:',
        '  current:',
        '    packed.inspects:',
        '      evidence:',
        '        - planned:consumer::future',
        '        - consumer::present',
      ].join('\n'))
      await put(join(project, 'specs/inspection.md'), [
        '<!-- focused-spec:id=packed.inspects -->',
        '#### Scenario: Packed inspection preserves provenance',
        '',
        'The packed CLI reports exact native and evidence sources.',
      ].join('\n'))
      await put(join(project, 'runner.mjs'), [
        "import { writeFileSync } from 'node:fs'",
        "writeFileSync(new URL('./runner-imported', import.meta.url), 'imported')",
        'export default { apiVersion: 1, resolve() { throw new Error("inspection must not resolve") }, run() { throw new Error("inspection must not execute") } }',
      ].join('\n'))
      const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
      const scenario = {
        scope: 'current',
        id: 'packed.inspects',
        name: 'Scenario: Packed inspection preserves provenance',
        source: { path: 'specs/inspection.md', line: 2 },
        evidence: [
          { reference: 'planned:consumer::future', source: { path: '.focused-spec/evidence.yaml', line: 5 } },
          { reference: 'consumer::present', source: { path: '.focused-spec/evidence.yaml', line: 6 } },
        ],
      }
      const before = await integrationTree(project)

      const listed = spawnSync(process.execPath, [cli, 'list', '--root', project, '--json'], { cwd: project, encoding: 'utf8' })
      expect(listed.status, listed.stderr || listed.stdout).toBe(0)
      expect(listed.stderr).toBe('')
      expect(JSON.parse(listed.stdout)).toEqual({ valid: true, selection: { scopes: { mode: 'all' } }, scenarios: [scenario] })

      const shown = spawnSync(process.execPath, [cli, 'show', 'packed.inspects', '--root', project, '--scope', 'current', '--json'], { cwd: project, encoding: 'utf8' })
      expect(shown.status, shown.stderr || shown.stdout).toBe(0)
      expect(shown.stderr).toBe('')
      expect(JSON.parse(shown.stdout)).toEqual({
        valid: true,
        selection: { scopes: { mode: 'selected', name: 'current' }, scenario: 'packed.inspects' },
        scenarios: [scenario],
      })
      expect(await lstat(join(project, 'runner-imported')).then(() => true, () => false)).toBe(false)
      expect(await integrationTree(project)).toEqual(before)
    } finally {
      await rm(project, { recursive: true, force: true })
    }
  }, 300_000)

  it('installs and executes the packed CLI from a consumer project', async () => {
    installPackage(consumer, packedTarball, registryTarball, markdownTarball)
    await put(join(consumer, '.focused-spec/config.yaml'), [
      'version: 5',
      'specifications:',
      '  formats: { markdown: { package: "@focused-spec/format-registry", options: { parser: { package: "@focused-spec/format-markdown" } } } }',
      '  documents:',
      '    - match: specs/**/*.md',
      '      format: markdown',
      '      scope: current',
      'runners:',
      '  consumer:',
      '    module: ./runner.ts',
    ].join('\n'))
    await put(join(consumer, '.focused-spec/evidence.yaml'), [
      'scopes:',
      '  current:',
      '    consumer.cli.works:',
      '      evidence: ["consumer::sample"]',
    ].join('\n'))
    await put(join(consumer, 'specs/example.md'), [
      '<!-- focused-spec:id=consumer.cli.works -->',
      '#### Scenario: Installed CLI checks evidence',
      '',
      'The installed CLI resolves one evidence target.',
    ].join('\n'))
    await put(join(consumer, 'runner.ts'), 'export default { apiVersion: 1, async resolve({ selectors }: { selectors: string[] }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run({ targets }: { targets: { targetId: string }[] }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "pass" })) } } }')
    const cli = join(consumer, 'node_modules/focused-spec/dist/cli.js')
    const validation = spawnSync(process.execPath, [cli, 'validate', '--root', consumer, '--json'], { encoding: 'utf8' })
    expect(validation.status).toBe(0)
    expect(JSON.parse(validation.stdout)).toMatchObject({ valid: true, validationScope: { scopes: { mode: 'all' } }, scenarios: 1, targets: 1 })
    const execution = spawnSync(process.execPath, [cli, 'run', '--root', consumer, '--json'], { encoding: 'utf8' })
    expect(execution.status).toBe(0)
    expect(JSON.parse(execution.stdout)).toMatchObject({ success: true, validationScope: { scopes: { mode: 'all' } }, executionSelection: { scopes: { mode: 'all' } }, scenarios: [{ id: 'consumer.cli.works', scope: 'current', status: 'PASS' }] })
  })

  it('typechecks a consumer plugin against focused-spec runner', async () => {
    await put(join(consumer, 'plugin.ts'), [
      "import type { RunnerPlugin } from 'focused-spec/runner'",
      "import type { FormatPlugin } from 'focused-spec/format'",
      'export default { apiVersion: 1, async resolve() { return { targets: [], errors: [] } }, async run() { return { results: [] } } } satisfies RunnerPlugin',
      'export const format = { apiVersion: 2, parse() { return { items: [], diagnostics: [] } } } satisfies FormatPlugin',
    ].join('\n'))
    await put(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: true }, files: ['plugin.ts'] }))
    const tsc = spawnSync(process.execPath, [resolve(repository, 'node_modules/typescript/bin/tsc'), '-p', join(consumer, 'tsconfig.json')], { cwd: consumer, encoding: 'utf8' })
    expect(tsc.status, tsc.stdout + tsc.stderr).toBe(0)
  })
})
