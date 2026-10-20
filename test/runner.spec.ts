import { spawnSync } from 'node:child_process'
import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import runner from '../packages/runners/vitest/src/index.js'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('project Vitest evidence runner', () => {
  it('selects an exact listed test and rejects a controlled failing test', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-vitest-'))
    roots.push(root)
    await mkdir(join(root, 'test'))
    await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir')
    await writeFile(join(root, 'package.json'), '{"type":"module"}\n')
    await writeFile(join(root, 'test', 'selected.spec.ts'), [
      "import { describe, expect, it } from 'vitest'",
      "describe('selection', () => {",
      "  it('passes', () => { expect(2 + 2).toBe(4) })",
      "  it('fails', () => { expect(2 + 2).toBe(5) })",
      '})',
    ].join('\n'))
    const context = { projectRoot: root, cwd: root, runnerId: 'vitest', options: null, signal: new AbortController().signal }
    const passing = 'test/selected.spec.ts::selection > passes'
    const failing = 'test/selected.spec.ts::selection > fails'
    const resolution = await runner.resolve({ ...context, selectors: [passing, failing, 'test/selected.spec.ts::missing'] })
    expect(resolution.targets.map(target => target.selector)).toEqual([passing, failing])
    expect(resolution.errors).toEqual([{ selector: 'test/selected.spec.ts::missing', message: expect.stringContaining('not found') }])
    const passed = await runner.run({ ...context, targets: [resolution.targets[0]!] })
    expect(passed.results).toEqual([{ targetId: passing, status: 'pass' }])
    const failed = await runner.run({ ...context, targets: [resolution.targets[1]!] })
    expect(failed.results).toEqual([{ targetId: failing, status: 'fail', diagnostic: expect.stringContaining('expected 4 to be 5') }])
    const mixed = await runner.run({ ...context, targets: resolution.targets })
    expect(mixed.results).toEqual([
      { targetId: passing, status: 'pass' },
      { targetId: failing, status: 'fail', diagnostic: expect.stringContaining('expected 4 to be 5') },
    ])
  })
})

describe('native item evidence execution', () => {
  const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))

  async function fixture(items: unknown[], entries: Record<string, unknown>): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-native-identity-'))
    roots.push(root)
    await mkdir(join(root, '.focused-spec'))
    await writeFile(join(root, 'package.json'), '{"type":"module"}')
    await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir')
    await writeFile(join(root, 'native.records'), 'Consumer-native document')
    await writeFile(join(root, 'format.mjs'), `export default { apiVersion: 2, parse() { return { items: ${JSON.stringify(items)}, diagnostics: [] }; } };`)
    await writeFile(join(root, '.focused-spec/config.yaml'), JSON.stringify({
      version: 5,
      specifications: { formats: { native: { package: '@focused-spec/format-registry', options: { parser: { module: './format.mjs' } } } }, documents: [{ match: 'native.records', scope: 'current', format: 'native' }] },
      runners: { local: { module: './runner.mjs' } },
    }))
    await writeFile(join(root, '.focused-spec/evidence.yaml'), JSON.stringify({ scopes: { current: entries } }))
    await writeFile(join(root, 'runner.mjs'), [
      "import { spawnSync } from 'node:child_process';",
      "import { appendFileSync } from 'node:fs';",
      'export default { apiVersion: 1,',
      'resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] }; },',
      'run({ targets, projectRoot }) {',
      "  appendFileSync(projectRoot + '/runner-executed', 'yes');",
      "  return { results: targets.map(target => { const result = spawnSync(process.execPath, ['--test', '--test-name-pattern', '^' + target.selector + '$', 'behavior.test.mjs'], { cwd: projectRoot, encoding: 'utf8' }); return { targetId: target.targetId, status: result.status === 0 ? 'pass' : 'fail', diagnostic: result.stderr }; }) };",
      '} };',
    ].join('\n'))
    await writeFile(join(root, 'behavior.test.mjs'), [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import { appendFileSync, existsSync } from 'node:fs';",
      "for (const name of ['alpha', 'beta', 'shared']) test(name, () => { appendFileSync('observed', name + '\\n'); assert.equal(name === 'beta' && existsSync('fail-beta'), false); });",
    ].join('\n'))
    return root
  }

  function run(root: string): { code: number | null; result: Record<string, unknown> } {
    const child = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8', timeout: 20_000 })
    expect(child.error, child.stderr).toBeUndefined()
    return { code: child.status, result: JSON.parse(child.stdout) as Record<string, unknown> }
  }

  it.each(['direct', 'external'] as const)('binds distinct same-line native items independently through %s identities and executes AND evidence', async binding => {
    const items = [
      { line: 1, name: 'Alpha native behavior', nativeIds: ['NATIVE-A'], ...(binding === 'direct' ? { markerId: 'native.alpha.bound' } : {}) },
      { line: 1, name: 'Beta native behavior', nativeIds: ['NATIVE-B'], ...(binding === 'direct' ? { markerId: 'native.beta.bound' } : {}) },
    ]
    const root = await fixture(items, {
      'native.alpha.bound': { evidence: ['local::alpha', 'local::shared'], ...(binding === 'external' ? { source: { path: 'native.records', nativeId: 'NATIVE-A' } } : {}) },
      'native.beta.bound': { evidence: ['local::beta', 'local::shared'], ...(binding === 'external' ? { source: { path: 'native.records', nativeId: 'NATIVE-B' } } : {}) },
    })
    const passed = run(root)
    expect(passed.code).toBe(0)
    expect(passed.result).toMatchObject({ success: true, executionStarted: true, targetCount: 3, scenarios: [
      { id: 'native.alpha.bound', scope: 'current', status: 'PASS' },
      { id: 'native.beta.bound', scope: 'current', status: 'PASS' },
    ] })
    expect((await readFile(join(root, 'observed'), 'utf8')).trim().split('\n').sort()).toEqual(['alpha', 'beta', 'shared'])
    await rm(join(root, 'observed'))
    await writeFile(join(root, 'fail-beta'), 'Controlled behavioral failure')
    const failed = run(root)
    expect(failed.code).toBe(1)
    expect(failed.result).toMatchObject({ success: false, executionStarted: true, targetCount: 3, scenarios: [
      { id: 'native.alpha.bound', status: 'PASS' },
      { id: 'native.beta.bound', status: 'FAIL' },
    ] })
    expect((await readFile(join(root, 'observed'), 'utf8')).trim().split('\n').sort()).toEqual(['alpha', 'beta', 'shared'])
  })

  it('rejects two external registrations claiming the same actual native item through different native IDs', async () => {
    const root = await fixture([{ line: 1, name: 'One native behavior', nativeIds: ['NATIVE-A', 'NATIVE-B'] }], {
      'native.alpha.bound': { evidence: ['local::alpha'], source: { path: 'native.records', nativeId: 'NATIVE-A' } },
      'native.beta.bound': { evidence: ['local::beta'], source: { path: 'native.records', nativeId: 'NATIVE-B' } },
    })
    const rejected = run(root)
    expect(rejected.code).toBe(1)
    expect(rejected.result).toMatchObject({ valid: false, executionStarted: false, violations: expect.arrayContaining([
      expect.objectContaining({ message: expect.stringContaining('native item is bound more than once') }),
    ]) })
    await expect(access(join(root, 'runner-executed'))).rejects.toThrow()
    await expect(access(join(root, 'observed'))).rejects.toThrow()
  })
})
