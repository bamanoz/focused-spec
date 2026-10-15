import { spawnSync } from 'node:child_process'
import { access, mkdtemp, mkdir, readFile, readdir, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))
const roots: string[] = []

interface FixtureItem {
  readonly line: number
  readonly name: string
  readonly nativeIds: readonly string[]
  readonly markerId?: string
  readonly evidence?: readonly string[]
  readonly evidenceLocations?: readonly { readonly path: string; readonly line: number }[]
}

interface InspectionOutput {
  readonly valid: boolean
  readonly selection: {
    readonly scopes: { readonly mode: 'all' } | { readonly mode: 'selected'; readonly name: string }
    readonly scenario?: string
  }
  readonly scenarios?: readonly {
    readonly scope: string
    readonly id: string
    readonly name: string
    readonly source: { readonly path: string; readonly line: number }
    readonly evidence: readonly { readonly reference: string; readonly source: { readonly path: string; readonly line: number } }[]
  }[]
  readonly violations?: readonly { readonly path: string; readonly line?: number; readonly message: string }[]
}

const formatModule = [
  'export default {',
  '  apiVersion: 2,',
  '  parse({ source }) {',
  '    const document = JSON.parse(source)',
  '    return { items: document.items, diagnostics: document.diagnostics ?? [] }',
  '  },',
  '  bind({ documents }) {',
  '    const enrollments = []',
  '    for (const [document, catalog] of documents.entries()) {',
  '      for (const [item, native] of catalog.items.entries()) {',
  '        const [kind, id, ...evidence] = native.nativeIds',
  '        if (kind !== "bound-shared" || id === undefined) continue',
  '        enrollments.push({ document, item, id, evidence, location: { path: "registry/shared.yaml", line: 17 } })',
  '      }',
  '    }',
  '    return { enrollments, diagnostics: [], sourceClaims: [] }',
  '  },',
  '}',
].join('\n')

const runnerModule = [
  "import { writeFileSync } from 'node:fs'",
  "writeFileSync(new URL('./runner-imported', import.meta.url), 'runner imported')",
  'export default {',
  '  apiVersion: 1,',
  '  resolve() { throw new Error("runner resolution must not start during inspection") },',
  '  run() { throw new Error("runner execution must not start during inspection") },',
  '}',
].join('\n')

async function put(root: string, path: string, source: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, source)
}

function configuration(configPath = '.focused-spec/config.yaml'): { readonly path: string; readonly source: string } {
  return {
    path: configPath,
    source: JSON.stringify({
      version: 5,
      specifications: {
        formats: { fixture: { module: './format.mjs' } },
        documents: [{ match: 'specs/{scope}.json', format: 'fixture' }],
      },
      runners: { local: { module: './runner.mjs' } },
    }, null, 2),
  }
}

async function fixture(
  documents: Readonly<Record<string, readonly FixtureItem[]>> = {},
  configPath = '.focused-spec/config.yaml',
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-inspection-'))
  roots.push(root)
  await put(root, 'format.mjs', formatModule)
  await put(root, 'runner.mjs', runnerModule)
  const config = configuration(configPath)
  await put(root, config.path, config.source)
  for (const [scope, items] of Object.entries(documents)) {
    await put(root, `specs/${scope}.json`, JSON.stringify({ items }, null, 2))
  }
  return root
}

function invoke(root: string, ...argumentsList: string[]) {
  const result = spawnSync(process.execPath, [cli, ...argumentsList], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
  })
  expect(result.error, result.stderr).toBeUndefined()
  return result
}

function parseOutput(stdout: string): InspectionOutput {
  return JSON.parse(stdout) as InspectionOutput
}

async function treeSnapshot(root: string, relative = ''): Promise<readonly string[]> {
  const directory = join(root, relative)
  const entries = await readdir(directory, { withFileTypes: true })
  const rows: string[] = []
  for (const entry of entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    const path = relative === '' ? entry.name : `${relative}/${entry.name}`
    if (entry.isDirectory()) {
      rows.push(`directory:${path}`, ...await treeSnapshot(root, path))
    } else if (entry.isSymbolicLink()) {
      rows.push(`symlink:${path}:${await readlink(join(root, path))}`)
    } else {
      rows.push(`file:${path}:${await readFile(join(root, path), 'base64')}`)
    }
  }
  return rows
}

async function expectRunnerNotImported(root: string): Promise<void> {
  await expect(access(join(root, 'runner-imported'))).rejects.toMatchObject({ code: 'ENOENT' })
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('CLI inspection', () => {
  it('lists selected enrollments without importing runners, resolving evidence, executing tests, or writing', async () => {
    const root = await fixture({
      current: [
        { line: 3, name: 'Selected inventory', nativeIds: [], markerId: 'inspection.read-only', evidence: ['local::concrete target', 'planned:local::planned target'] },
        { line: 8, name: 'Unselected inventory', nativeIds: [], markerId: 'inspection.other', evidence: ['local::other'] },
      ],
    }, 'config/inspection.yaml')
    await put(root, '.focused-spec/config.yaml', 'this default configuration must not be read: [')
    const before = await treeSnapshot(root)

    const result = invoke(root, 'list', '--root', root, '--config', 'config/inspection.yaml', '--scenario', 'inspection.read-only', '--json')

    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(parseOutput(result.stdout)).toEqual({
      valid: true,
      selection: { scopes: { mode: 'all' }, scenario: 'inspection.read-only' },
      scenarios: [{
        scope: 'current',
        id: 'inspection.read-only',
        name: 'Selected inventory',
        source: { path: 'specs/current.json', line: 3 },
        evidence: [
          { reference: 'local::concrete target', source: { path: 'specs/current.json', line: 3 } },
          { reference: 'planned:local::planned target', source: { path: 'specs/current.json', line: 3 } },
        ],
      }],
    })
    expect(await treeSnapshot(root)).toEqual(before)
    await expectRunnerNotImported(root)
  })

  it('selects exact opaque IDs independently across scopes', async () => {
    const exact = 'Opaque Δ / punctuation?!'
    const root = await fixture({
      alpha: [
        { line: 2, name: 'Alpha exact', nativeIds: [], markerId: exact, evidence: ['local::alpha'] },
        { line: 5, name: 'Case distinct', nativeIds: [], markerId: 'opaque Δ / punctuation?!', evidence: ['local::case'] },
        { line: 8, name: 'Flag-looking', nativeIds: [], markerId: '--json', evidence: ['local::flag'] },
      ],
      beta: [{ line: 4, name: 'Beta exact', nativeIds: [], markerId: exact, evidence: ['local::beta'] }],
    })

    const allScopes = invoke(root, 'show', exact, '--root', root, '--json')
    expect(allScopes.status, allScopes.stderr).toBe(0)
    expect(parseOutput(allScopes.stdout).scenarios?.map(scenario => [scenario.scope, scenario.id])).toEqual([
      ['alpha', exact],
      ['beta', exact],
    ])

    const selectedScope = invoke(root, 'show', exact, '--root', root, '--scope', 'beta', '--json')
    expect(selectedScope.status, selectedScope.stderr).toBe(0)
    expect(parseOutput(selectedScope.stdout)).toMatchObject({
      valid: true,
      selection: { scopes: { mode: 'selected', name: 'beta' }, scenario: exact },
      scenarios: [{ scope: 'beta', id: exact, name: 'Beta exact' }],
    })

    const flagLooking = invoke(root, 'show', '--root', root, '--json', '--', '--json')
    expect(flagLooking.status, flagLooking.stderr).toBe(0)
    expect(parseOutput(flagLooking.stdout).scenarios?.map(scenario => scenario.id)).toEqual(['--json'])

    const absent = invoke(root, 'show', 'Opaque Δ / punctuation?', '--root', root, '--json')
    expect(absent.status).toBe(1)
    const absentOutput = parseOutput(absent.stdout)
    expect(absentOutput).toMatchObject({ valid: false, selection: { scenario: 'Opaque Δ / punctuation?' } })
    expect(absentOutput).not.toHaveProperty('scenarios')
    await expectRunnerNotImported(root)
  })

  it('reports deterministic native and ordered evidence provenance with source fallback', async () => {
    const root = await fixture({
      Z: [
        {
          line: 9,
          name: 'Per-reference origins',
          nativeIds: [],
          markerId: 'B',
          evidence: ['local::first', 'planned:local::second'],
          evidenceLocations: [{ path: 'evidence/first.yaml', line: 31 }, { path: 'evidence/second.yaml', line: 47 }],
        },
        {
          line: 13,
          name: 'Shared origin',
          nativeIds: ['bound-shared', 'a', 'local::shared-first', 'planned:local::shared-second'],
        },
      ],
      a: [{ line: 2, name: 'Native fallback', nativeIds: [], markerId: 'z', evidence: ['local::native'] }],
    })

    const result = invoke(root, 'list', '--root', root, '--json')
    expect(result.status, result.stderr).toBe(0)
    expect(parseOutput(result.stdout).scenarios).toEqual([
      {
        scope: 'Z', id: 'B', name: 'Per-reference origins', source: { path: 'specs/Z.json', line: 9 },
        evidence: [
          { reference: 'local::first', source: { path: 'evidence/first.yaml', line: 31 } },
          { reference: 'planned:local::second', source: { path: 'evidence/second.yaml', line: 47 } },
        ],
      },
      {
        scope: 'Z', id: 'a', name: 'Shared origin', source: { path: 'specs/Z.json', line: 13 },
        evidence: [
          { reference: 'local::shared-first', source: { path: 'registry/shared.yaml', line: 17 } },
          { reference: 'planned:local::shared-second', source: { path: 'registry/shared.yaml', line: 17 } },
        ],
      },
      {
        scope: 'a', id: 'z', name: 'Native fallback', source: { path: 'specs/a.json', line: 2 },
        evidence: [{ reference: 'local::native', source: { path: 'specs/a.json', line: 2 } }],
      },
    ])

    const text = invoke(root, 'list', '--root', root)
    expect(text.status, text.stderr).toBe(0)
    for (const value of ['Per-reference origins', 'specs/Z.json:9', 'local::first', 'evidence/first.yaml:31', 'planned:local::shared-second', 'registry/shared.yaml:17', 'Native fallback', 'specs/a.json:2', 'local::native']) {
      expect(text.stdout).toContain(value)
    }
    expect(text.stdout).not.toContain('PASS')
    await expectRunnerNotImported(root)
  })

  it('fails closed at structural and selection boundaries without partial inventories', async () => {
    const malformed = await fixture({ current: [
      { line: 2, name: 'Good selected item', nativeIds: [], markerId: 'good', evidence: ['local::good'] },
      { line: 6, name: 'Malformed selected item', nativeIds: [], markerId: 'bad', evidence: ['not-a-reference'] },
    ] })
    const selectedBad = invoke(malformed, 'list', '--root', malformed, '--scenario', 'bad', '--json')
    expect(selectedBad.status).toBe(1)
    expect(parseOutput(selectedBad.stdout)).toMatchObject({
      valid: false,
      selection: { scopes: { mode: 'all' }, scenario: 'bad' },
      violations: [expect.objectContaining({ path: 'specs/current.json', line: 6 })],
    })
    expect(parseOutput(selectedBad.stdout)).not.toHaveProperty('scenarios')
    const isolatedGood = invoke(malformed, 'list', '--root', malformed, '--scenario', 'good', '--json')
    expect(isolatedGood.status, isolatedGood.stderr).toBe(0)
    expect(parseOutput(isolatedGood.stdout).scenarios?.map(scenario => scenario.id)).toEqual(['good'])

    const duplicate = await fixture({ current: [
      { line: 2, name: 'First duplicate', nativeIds: [], markerId: 'duplicate', evidence: ['local::first'] },
      { line: 5, name: 'Second duplicate', nativeIds: [], markerId: 'duplicate', evidence: ['local::second'] },
    ] })
    const duplicateResult = invoke(duplicate, 'list', '--root', duplicate, '--json')
    expect(duplicateResult.status).toBe(1)
    expect(parseOutput(duplicateResult.stdout)).not.toHaveProperty('scenarios')

    const missingId = invoke(malformed, 'show', 'missing', '--root', malformed, '--json')
    expect(missingId.status).toBe(1)
    expect(parseOutput(missingId.stdout)).toMatchObject({ valid: false, selection: { scenario: 'missing' } })
    expect(parseOutput(missingId.stdout)).not.toHaveProperty('scenarios')
    const missingScope = invoke(malformed, 'list', '--root', malformed, '--scope', 'absent', '--json')
    expect(missingScope.status).toBe(1)
    expect(parseOutput(missingScope.stdout)).toMatchObject({ valid: false, selection: { scopes: { mode: 'selected', name: 'absent' } } })
    expect(parseOutput(missingScope.stdout)).not.toHaveProperty('scenarios')

    const structural = await fixture()
    await put(structural, 'specs/current.json', '{ invalid JSON')
    const structuralResult = invoke(structural, 'list', '--root', structural, '--json')
    expect(structuralResult.status).toBe(1)
    expect(parseOutput(structuralResult.stdout)).toMatchObject({ valid: false, violations: [expect.objectContaining({ path: 'specs/current.json' })] })
    expect(parseOutput(structuralResult.stdout)).not.toHaveProperty('scenarios')

    const invalidConfig = await fixture()
    await put(invalidConfig, '.focused-spec/config.yaml', 'version: [')
    const configResult = invoke(invalidConfig, 'list', '--root', invalidConfig, '--json')
    expect(configResult.status).toBe(1)
    expect(parseOutput(configResult.stdout)).toMatchObject({
      valid: false,
      selection: { scopes: { mode: 'all' } },
      violations: [expect.objectContaining({ message: expect.stringMatching(/invalid YAML/iu) })],
    })
    expect(parseOutput(configResult.stdout)).not.toHaveProperty('scenarios')

    const empty = await fixture()
    const emptyResult = invoke(empty, 'list', '--root', empty, '--json')
    expect(emptyResult.status, emptyResult.stderr).toBe(0)
    expect(parseOutput(emptyResult.stdout)).toEqual({ valid: true, selection: { scopes: { mode: 'all' } }, scenarios: [] })

    for (const root of [malformed, duplicate, structural, invalidConfig, empty]) await expectRunnerNotImported(root)
  })
})
