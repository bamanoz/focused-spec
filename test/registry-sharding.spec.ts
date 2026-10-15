import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { loadEvidenceRegistry } from '@focused-spec/format-registry'
import { loadConfig } from '../packages/core/dist/config.js'
import type { ExecutionResult, FocusedSpecConfig } from '../packages/core/dist/model.js'
import { discoverDocuments } from '../packages/core/dist/sources.js'

const roots: string[] = []
const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))

async function put(root: string, path: string, source: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), source)
}

async function fixture(files: readonly string[] = ['registry/*.yaml']): Promise<{ root: string; config: FocusedSpecConfig }> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-shards-'))
  roots.push(root)
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
  const config: FocusedSpecConfig = {
    version: 5,
    specifications: { formats: { markdown: { package: '@focused-spec/format-registry', options: { parser: { package: '@focused-spec/format-markdown' }, files } } }, documents: [{ match: 'specs/{scope}.md', format: 'markdown' }] },
    runners: { local: { module: './runner.mjs' } },
  }
  await put(root, '.focused-spec/config.yaml', JSON.stringify(config))
  return { root, config }
}

function registry(scopes: unknown): string { return `${JSON.stringify({ scopes }, null, 2)}\n` }
function marked(id: string): string { return `<!-- focused-spec:id=${id} -->\n#### Scenario: ${id}\n` }

function run(root: string): { status: number | null; result: ExecutionResult } {
  const child = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
  return { status: child.status, result: JSON.parse(child.stdout) as ExecutionResult }
}

afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

describe('sharded evidence registry', () => {
  it('composes explicit domain shards with AND evidence', async () => {
    const { root, config } = await fixture(['registry/auth.yaml', 'registry/billing*.yml'])
    await put(root, 'registry/auth.yaml', registry({ current: { 'auth.good': { evidence: ['local::first', 'local::second'] } } }))
    await put(root, 'registry/billing.yml', registry({ current: { 'billing.good': { evidence: ['local::billing'] } } }))
    await put(root, '.focused-spec/evidence.yaml', 'not a registry')
    await put(root, 'specs/current.md', `${marked('auth.good')}\n${marked('billing.good')}`)
    const discovery = await discoverDocuments(root, config)
    expect(discovery.violations).toEqual([])
    expect(discovery.scopes.get('current')?.flatMap(document => document.scenarios).map(item => [item.id, item.evidence])).toEqual([
      ['auth.good', ['local::first', 'local::second']], ['billing.good', ['local::billing']],
    ])
    await put(root, 'state.json', JSON.stringify({ first: true, second: true, billing: true }))
    await put(root, 'evidence.mjs', [
      "import test from 'node:test'",
      "import assert from 'node:assert/strict'",
      "import { readFileSync } from 'node:fs'",
      "for (const name of ['first', 'second', 'billing']) test(name, () => assert.equal(JSON.parse(readFileSync(new URL('./state.json', import.meta.url)))[name], true))",
    ].join('\n'))
    await put(root, 'runner.mjs', [
      "import { spawnSync } from 'node:child_process'",
      'export default { apiVersion: 1,',
      'async resolve(request) { return { targets: request.selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      "async run(request) { return { results: request.targets.map(target => { const child = spawnSync(process.execPath, ['--test', '--test-name-pattern', `^${target.selector}$`, 'evidence.mjs'], { cwd: request.projectRoot, encoding: 'utf8' }); return { targetId: target.targetId, status: child.status === 0 ? 'pass' : 'fail', diagnostic: child.stdout + child.stderr } }) } } }",
    ].join('\n'))
    const passed = run(root)
    expect(passed.status).toBe(0)
    expect(passed.result.scenarios.map(item => [item.id, item.status])).toEqual([['auth.good', 'PASS'], ['billing.good', 'PASS']])
    await put(root, 'state.json', JSON.stringify({ first: true, second: false, billing: true }))
    const failed = run(root)
    expect(failed.status).not.toBe(0)
    expect(failed.result.scenarios.find(item => item.id === 'auth.good')).toMatchObject({ status: 'FAIL', evidence: [
      { reference: 'local::first', status: 'PASS' }, { reference: 'local::second', status: 'FAIL' },
    ] })
    expect(failed.result.scenarios.find(item => item.id === 'billing.good')?.status).toBe('PASS')
  })

  it('rejects excessive registry glob complexity without partial sources', async () => {
    const { root } = await fixture()
    await put(root, 'registry/auth.yaml', registry({ current: { 'auth.good': { evidence: ['local::first'] } } }))
    const deep = '{'.repeat(40) + 'a,b' + '}'.repeat(40)
    for (const pattern of [`registry/${deep}.yaml`, `registry/${'a'.repeat(4096)}.yaml`, 'registry/{1..257}.yaml']) {
      const loaded = await loadEvidenceRegistry(root, ['registry/auth.yaml', pattern])
      expect(loaded.entries).toEqual([])
      expect(loaded.files).toEqual([])
      expect(loaded.violations).toEqual([expect.objectContaining({ path: pattern, message: expect.stringMatching(/glob pattern exceeds/u) })])
    }
    await put(root, 'registry/001.yaml', 'scopes: {}')
    await put(root, 'registry/256.yaml', 'scopes: {}')
    const bounded = await loadEvidenceRegistry(root, ['registry/{001..256}.yaml'])
    expect(bounded.violations).toEqual([])
    expect(bounded.files).toEqual(['registry/001.yaml', 'registry/256.yaml'])
  })

  it('reports dangling registry links beside readable shards', async () => {
    const { root } = await fixture()
    await put(root, 'registry/auth.yaml', 'scopes: {}')
    await symlink(join(root, 'missing.yaml'), join(root, 'registry/broken.yaml'))
    const loaded = await loadEvidenceRegistry(root, ['registry/*.yaml'])
    expect(loaded.files).toEqual(['registry/auth.yaml'])
    expect(loaded.violations).toEqual([expect.objectContaining({ path: 'registry/broken.yaml', message: expect.stringMatching(/cannot read evidence registry/u) })])
  })

  it('rejects duplicate identities across shards with both locations', async () => {
    const { root } = await fixture()
    await put(root, 'registry/auth.yaml', 'scopes:\n  current:\n    auth.good:\n      evidence: [local::first]\n')
    await put(root, 'registry/other.yaml', '\nscopes:\n  current:\n    auth.good:\n      evidence: [local::second]\n')
    const loaded = await loadEvidenceRegistry(root, ['registry/*.yaml'], 'current', 'auth.good')
    expect(loaded.entries).toEqual([])
    expect(loaded.violations).toEqual([expect.objectContaining({
      path: 'registry/other.yaml', line: 5, scenarioId: 'auth.good',
      message: expect.stringMatching(/duplicate.*current\/auth\.good.*registry\/auth\.yaml:4/u),
    })])
  })

  it('isolates selected identities and scopes across shards', async () => {
    const { root, config } = await fixture()
    await put(root, 'registry/auth.yaml', registry({ current: {
      'auth.good': { evidence: ['local::first'] }, 'auth.invalid': { evidence: [], behavior: 'unsupported' },
    }, working: { 'auth.good': { evidence: ['local::second'] }, 'auth.duplicate': { evidence: ['local::first'] } } }))
    await put(root, 'registry/other.yaml', registry({ working: { 'auth.duplicate': { evidence: ['local::second'] } } }))
    await put(root, 'specs/current.md', marked('auth.good'))
    await put(root, 'specs/working.md', marked('auth.good'))
    const current = await discoverDocuments(root, config, 'current', 'auth.good')
    expect(current.violations).toEqual([])
    expect(current.scopes.get('current')?.[0]?.scenarios[0]?.evidence).toEqual(['local::first'])
    const working = await discoverDocuments(root, config, 'working', 'auth.good')
    expect(working.violations).toEqual([])
    expect(working.scopes.get('working')?.[0]?.scenarios[0]?.evidence).toEqual(['local::second'])
    const full = await loadEvidenceRegistry(root, ['registry/*.yaml'])
    expect(full.violations.map(item => item.message)).toEqual(expect.arrayContaining([
      expect.stringMatching(/unknown registry entry key behavior/u), expect.stringMatching(/duplicate.*working\/auth\.duplicate/u),
    ]))
  })

  it('reports binding failures at their shard and line', async () => {
    const { root, config } = await fixture()
    await put(root, 'registry/auth.yaml', 'scopes:\n  current:\n    auth.missing:\n      evidence: [local::first]\n')
    await put(root, 'specs/current.md', '# Unrelated native content\n')
    const discovery = await discoverDocuments(root, config)
    expect(discovery.violations).toEqual([expect.objectContaining({ path: 'registry/auth.yaml', line: 4,
      scenarioId: 'auth.missing', message: expect.stringMatching(/binding.*found 0/u) })])
  })

  it('rejects unsafe evidence configuration before discovery', async () => {
    const { root, config } = await fixture()
    await put(root, 'registry/auth.yaml', registry({}))
    await put(root, '.focused-spec/evidence.yaml', registry({}))
    expect((await discoverDocuments(root, config)).violations).toEqual([])
    const parser = { package: '@focused-spec/format-markdown' }
    for (const options of [null, {}, { parser, files: [] }, { parser, files: ['registry/auth.yaml'], include: 'other.yaml' },
      { parser, files: ['../outside.yaml'] }, { parser, files: ['/outside.yaml'] }, { parser, files: ['!registry/*.yaml'] },
      { parser, files: ['registry\\auth.yaml'] }, { parser, files: ['{../outside,registry/auth}.yaml'] }]) {
      const configured = { ...config, specifications: { ...config.specifications,
        formats: { markdown: { package: '@focused-spec/format-registry', options } } } }
      await put(root, '.focused-spec/config.yaml', JSON.stringify(configured))
      const loaded = await loadConfig(root)
      expect(loaded.config, JSON.stringify(options)).toBeDefined()
      const discovered = await discoverDocuments(root, loaded.config!)
      expect(discovered.violations.some(item => /option|parser|file|source|path|pattern/iu.test(item.message)), JSON.stringify(options)).toBe(true)
    }
    await put(root, '.focused-spec/config.yaml', JSON.stringify(config))
    expect((await loadConfig(root)).violations).toEqual([])
  })

  it('rejects missing overlapping unsupported and escaping sources', async () => {
    const { root } = await fixture()
    await put(root, 'registry/auth.yaml', registry({ current: { 'auth.good': { evidence: ['local::first'] } } }))
    await put(root, 'registry/readme.txt', 'scopes: {}')
    const absent = await loadEvidenceRegistry(root, ['registry/missing*.yaml'])
    expect(absent.violations).toEqual([expect.objectContaining({ path: 'registry/missing*.yaml', message: expect.stringMatching(/missing source/u) })])
    const overlap = await loadEvidenceRegistry(root, ['registry/*.yaml', 'registry/auth.yaml'])
    expect(overlap.violations).toEqual([expect.objectContaining({ path: 'registry/auth.yaml', message: expect.stringMatching(/claimed more than once/u) })])
    await symlink(join(root, 'registry/auth.yaml'), join(root, 'registry/alias.yml'))
    const alias = await loadEvidenceRegistry(root, ['registry/auth.yaml', 'registry/alias.yml'])
    expect(alias.violations).toEqual([expect.objectContaining({ path: 'registry/alias.yml', message: expect.stringMatching(/also claimed through registry\/auth\.yaml/u) })])
    const extension = await loadEvidenceRegistry(root, ['registry/readme.txt'])
    expect(extension.violations).toEqual([expect.objectContaining({ path: 'registry/readme.txt', message: expect.stringMatching(/\.yaml or \.yml/u) })])
    const outside = await mkdtemp(join(tmpdir(), 'focused-spec-outside-shard-'))
    roots.push(outside)
    await put(outside, 'outside.yaml', 'scopes: {}')
    await symlink(join(outside, 'outside.yaml'), join(root, 'registry/escape.yaml'))
    const escaped = await loadEvidenceRegistry(root, ['registry/escape.yaml'])
    expect(escaped.violations).toEqual([expect.objectContaining({ path: 'registry/escape.yaml', message: expect.stringMatching(/outside project root/u) })])
  })
})
