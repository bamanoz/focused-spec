import { spawnSync } from 'node:child_process'
import { access, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import type { ExecutionResult, FocusedSpecConfig, Violation } from '../packages/core/src/model.js'

const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))
const modules = fileURLToPath(new URL('../node_modules', import.meta.url))
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

async function put(root: string, path: string, source: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), source)
}

const runner = [
  "import { spawnSync } from 'node:child_process'",
  "import { appendFileSync } from 'node:fs'",
  'export default { apiVersion: 1,',
  'resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
  "run({ targets, projectRoot }) { appendFileSync(projectRoot + '/executed', 'yes'); return { results: targets.map(target => { const result = spawnSync(process.execPath, ['--test', '--test-name-pattern', '^' + target.selector + '$', 'behavior.test.mjs'], { cwd: projectRoot, encoding: 'utf8' }); return { targetId: target.targetId, status: result.status === 0 ? 'pass' : 'fail', diagnostic: result.stderr }; }) }; }",
  '}',
].join('\n')

async function fixture(): Promise<{ root: string; config: FocusedSpecConfig }> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-plugins-'))
  roots.push(root)
  await put(root, 'package.json', '{"private":true,"type":"module"}')
  await mkdir(join(root, 'node_modules'))
  await symlink(join(modules, '@focused-spec'), join(root, 'node_modules/@focused-spec'), 'dir')
  await put(root, 'runner.mjs', runner)
  await put(root, 'behavior.test.mjs', "import test from 'node:test'; import assert from 'node:assert/strict'; test('protected', () => assert.equal(2 + 2, 4));")
  return { root, config: { version: 4, specifications: { formats: { markdown: { package: '@focused-spec/format-markdown' } }, documents: [{ match: 'specs/document.md', scope: 'current', format: 'markdown' }] }, runners: { local: { module: './runner.mjs' } } } }
}

async function configure(root: string, config: unknown, entries: unknown): Promise<void> {
  await put(root, '.focused-spec/config.yaml', JSON.stringify(config))
  await put(root, '.focused-spec/evidence.yaml', JSON.stringify({ scopes: { current: entries } }))
}

function run(root: string): { code: number | null; result: ExecutionResult & { readonly violations?: readonly Violation[] } } {
  const child = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8', timeout: 20_000 })
  expect(child.error, child.stderr).toBeUndefined()
  return { code: child.status, result: JSON.parse(child.stdout) as ExecutionResult & { readonly violations?: readonly Violation[] } }
}

function entry(): { evidence: string[] } { return { evidence: ['local::protected'] } }

const nativeFormat = 'export default { apiVersion: 1, parse({ source, options }) { const item = JSON.parse(source); return { items: [{ line: 1, name: item.name, nativeIds: [options.nativeId] }], diagnostics: [] }; } };'

describe('plugin architecture', () => {
  it('selects explicit Markdown and Gherkin formats', async () => {
    const { root, config } = await fixture()
    await configure(root, { ...config, specifications: {
      formats: { markdown: { package: '@focused-spec/format-markdown' }, gherkin: { package: '@focused-spec/format-gherkin' } },
      documents: [{ match: 'specs/markdown.feature', scope: 'current', format: 'markdown' }, { match: 'specs/gherkin.md', scope: 'current', format: 'gherkin' }],
    } }, { 'plugin.markdown.bound': entry(), 'plugin.gherkin.bound': entry() })
    await put(root, 'specs/markdown.feature', '<!-- focused-spec:id=plugin.markdown.bound -->\n#### Scenario: Markdown selected explicitly\n')
    await put(root, 'specs/gherkin.md', 'Feature: Explicit selection\n  @focused.plugin.gherkin.bound\n  Scenario: Gherkin selected explicitly\n    Given a declared format\n')
    const passed = run(root)
    expect(passed.code).toBe(0)
    expect(passed.result.scenarios.map(item => [item.id, item.status])).toEqual([['plugin.gherkin.bound', 'PASS'], ['plugin.markdown.bound', 'PASS']])
  })

  it('rejects missing and conflicting format registrations', async () => {
    const { root, config } = await fixture()
    await put(root, 'specs/document.md', '<!-- focused-spec:id=plugin.markdown.bound -->\n#### Scenario: Protected\n')
    for (const specifications of [
      { formats: config.specifications.formats, documents: [{ match: 'specs/document.md', scope: 'current' }] },
      { formats: config.specifications.formats, documents: [{ match: 'specs/document.md', scope: 'current', format: 'unknown' }] },
      { formats: { markdown: { package: '@focused-spec/format-markdown', module: './format.mjs' } }, documents: config.specifications.documents },
    ]) {
      await configure(root, { ...config, specifications }, { 'plugin.markdown.bound': entry() })
      const rejected = run(root)
      expect(rejected.code).toBe(1)
      expect(rejected.result.violations).toEqual(expect.arrayContaining([expect.objectContaining({ path: join(root, '.focused-spec/config.yaml') })]))
      await expect(access(join(root, 'executed'))).rejects.toThrow()
    }
  })

  it('binds a project-native format without extension inference', async () => {
    const { root, config } = await fixture()
    await put(root, 'format.mjs', nativeFormat)
    await put(root, 'specs/native.records', '{"name":"Consumer-native item"}')
    await configure(root, { ...config, specifications: {
      formats: { native: { module: './format.mjs', options: { nativeId: 'RULE-7' } } },
      documents: [{ match: 'specs/native.records', format: 'native', scope: 'current' }],
    } }, { 'plugin.native.bound': { ...entry(), source: { path: 'specs/native.records', nativeId: 'RULE-7' } } })
    const passed = run(root)
    expect(passed.code).toBe(0)
    expect(passed.result.scenarios).toEqual([expect.objectContaining({ id: 'plugin.native.bound', scope: 'current', status: 'PASS' })])
  })

  it('rejects malformed format responses', async () => {
    const { root, config } = await fixture()
    await put(root, 'specs/document.md', 'A native input')
    const valid = { line: 1, name: 'Protected', nativeIds: [], markerId: 'plugin.native.bound' }
    for (const value of [
      { items: [{ ...valid, line: 0 }], diagnostics: [] },
      { items: [{ ...valid, markerId: 'INVALID' }], diagnostics: [] },
      { items: [valid], diagnostics: [{ message: 3 }] },
      { items: [{ ...valid, scope: 'spoofed' }], diagnostics: [] },
    ]) {
      await put(root, 'format.mjs', `export default { apiVersion: 1, parse() { return ${JSON.stringify(value)} } }`)
      await configure(root, { ...config, specifications: { ...config.specifications, formats: { markdown: { module: './format.mjs' } } } }, { 'plugin.native.bound': entry() })
      const rejected = run(root)
      expect(rejected.code).toBe(1)
      expect(rejected.result.violations).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'specs/document.md', message: expect.stringContaining('format') })]))
      await expect(access(join(root, 'executed'))).rejects.toThrow()
    }
  })

  it('terminates a blocking format host', async () => {
    const { root, config } = await fixture()
    await put(root, 'format.mjs', 'export default { apiVersion: 1, parse() { while (true) {} } }')
    await put(root, 'specs/document.md', 'A native input')
    await configure(root, { ...config, specifications: { ...config.specifications, formats: { markdown: { module: './format.mjs', timeoutMs: 250 } } } }, { 'plugin.native.bound': entry() })
    const rejected = run(root)
    expect(rejected.code).toBe(1)
    expect(rejected.result.violations).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('timed out') })]))
    await expect(access(join(root, 'executed'))).rejects.toThrow()
  })

  it('resolves an import-only consumer package subpath', async () => {
    const { root, config } = await fixture()
    await put(root, 'node_modules/consumer-plugins/package.json', JSON.stringify({ name: 'consumer-plugins', type: 'module', exports: { './format': { import: './format.mjs' }, './runner': { import: './runner.mjs' } } }))
    await put(root, 'node_modules/consumer-plugins/format.mjs', nativeFormat)
    await put(root, 'node_modules/consumer-plugins/runner.mjs', runner)
    await put(root, 'specs/native.records', '{"name":"Import-only consumer format"}')
    await configure(root, { ...config, specifications: { formats: { native: { package: 'consumer-plugins/format', options: { nativeId: 'CONSUMER-1' } } }, documents: [{ match: 'specs/native.records', format: 'native', scope: 'current' }] }, runners: { local: { package: 'consumer-plugins/runner' } } }, { 'plugin.package.bound': { ...entry(), source: { path: 'specs/native.records', nativeId: 'CONSUMER-1' } } })
    const passed = run(root)
    expect(passed.code).toBe(0)
    expect(passed.result.scenarios).toEqual([expect.objectContaining({ id: 'plugin.package.bound', status: 'PASS' })])
    await rm(join(root, 'node_modules/consumer-plugins'), { recursive: true })
    const missing = run(root)
    expect(missing.code).toBe(1)
    expect(missing.result.violations).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('consumer-plugins') })]))
  })
})
