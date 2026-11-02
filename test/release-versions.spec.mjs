import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'glob'
import { afterEach, describe, expect, it } from 'vitest'

const repository = fileURLToPath(new URL('..', import.meta.url))
const roots = []
const sourcePaths = [
  'package.json',
  'packages/*/package.json', 'packages/*/*/package.json',
  'packages/sdk/python/pyproject.toml',
  'packages/sdk/go/go.mod',
  'packages/sdk/dotnet/**/*.csproj',
  'examples/scenarios/go/go.mod',
  'examples/scenarios/dotnet/**/*.csproj',
  'scripts/stage-assets.mjs',
  'docs/guides/install.md', 'docs/development/releasing.md',
  'guidance/integration.md',
  'README.md',
  'packages/sdk/go/README.md', 'packages/sdk/python/README.md', 'packages/sdk/dotnet/FocusedSpec.Scenarios/README.md',
  'test/package*.spec.ts', 'test/*-native-plugins.spec.ts', 'test/go-executable-scenarios.spec.ts',
  'test/dotnet-scenarios.spec.ts', 'test/python-scenarios.spec.ts',
]

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'focused-release-versions-'))
  roots.push(root)
  for (const path of await glob(sourcePaths, { cwd: repository, nodir: true, posix: true })) {
    const destination = join(root, path)
    await mkdir(dirname(destination), { recursive: true })
    await cp(join(repository, path), destination)
  }
  return root
}

async function editText(root, path, edit) {
  const file = join(root, path)
  await writeFile(file, edit(await readFile(file, 'utf8')))
}

function check(root) {
  const result = spawnSync(process.execPath, [join(repository, 'scripts/release-versions.mjs'), '--json'], {
    cwd: repository,
    encoding: 'utf8',
    env: { ...process.env, FOCUSED_SPEC_RELEASE_ROOT: root },
  })
  return { status: result.status, report: JSON.parse(result.stdout) }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('release-versions', () => {
  it('accepts matching structured distribution metadata and orders workspaces by dependencies', async () => {
    const root = await temporaryRoot()
    const { status, report } = check(root)
    expect(status).toBe(0)
    expect(report).toMatchObject({ version: '0.11.0', valid: true, go: { module: 'github.com/bamanoz/focused-spec/packages/sdk/go', expectedTag: 'packages/sdk/go/v0.11.0', versionField: false } })
    expect(report.distributions.find(distribution => distribution.kind === 'python')).toMatchObject({ name: 'focused-spec-scenarios', version: '0.11.0' })
    expect(report.distributions.find(distribution => distribution.kind === 'dotnet')).toMatchObject({ packageVersion: '0.11.0', name: 'FocusedSpec.Scenarios', targetFrameworks: ['net10.0', 'net8.0'] })
    const names = report.distributions.filter(distribution => distribution.kind === 'npm').map(distribution => distribution.name)
    expect(names.indexOf('@focused-spec/format-scenarios-python')).toBeLessThan(names.indexOf('@focused-spec/runner-scenarios-python'))
    expect(names.indexOf('@focused-spec/format-scenarios-dotnet')).toBeLessThan(names.indexOf('@focused-spec/runner-scenarios-dotnet'))
  })

  it('discovers new workspaces and rejects a publish dependency cycle', async () => {
    const root = await temporaryRoot()
    const manifestPath = join(root, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    manifest.workspaces.push('packages/release-fixtures/*')
    await writeFile(manifestPath, JSON.stringify(manifest))
    const first = { name: '@focused-spec/release-first', version: '0.11.0', dependencies: { '@focused-spec/release-second': '0.11.0' } }
    const second = { name: '@focused-spec/release-second', version: '0.11.0', dependencies: { '@focused-spec/release-first': '0.11.0' } }
    for (const [directory, value] of [['first', first], ['second', second]]) {
      const path = join(root, 'packages/release-fixtures', directory, 'package.json')
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(value))
    }
    const { status, report } = check(root)
    expect(status).toBe(1)
    expect(report.distributions.filter(distribution => distribution.kind === 'npm')).toEqual([])
    expect(report.findings).toContain('npm dependency cycle: packages/release-fixtures/first/package.json (@focused-spec/release-first) -> packages/release-fixtures/second/package.json (@focused-spec/release-second) -> packages/release-fixtures/first/package.json (@focused-spec/release-first)')
  })

  it('reports npm manifest drift with the exact path and observed value', async () => {
    const root = await temporaryRoot()
    await editText(root, 'packages/sdk/typescript/package.json', text => text.replace('"version": "0.11.0"', '"version": "9.8.7"'))
    const { status, report } = check(root)
    expect(status).toBe(1)
    expect(report.findings).toContain('packages/sdk/typescript/package.json: version 9.8.7 does not match 0.11.0')
  })

  it('compares only the Python project.version value', async () => {
    const root = await temporaryRoot()
    await editText(root, 'packages/sdk/python/pyproject.toml', text => text.replace('version = "0.11.0"', 'version = "9.8.7"'))
    const { status, report } = check(root)
    expect(status).toBe(1)
    expect(report.findings).toContain('packages/sdk/python/pyproject.toml: project.version 9.8.7 does not match 0.11.0')
  })

  it('checks effective .NET PackageVersion and distribution identity', async () => {
    const root = await temporaryRoot()
    const path = 'packages/sdk/dotnet/FocusedSpec.Scenarios/FocusedSpec.Scenarios.csproj'
    await editText(root, path, text => text.replace('<Version>0.11.0</Version>', '<Version>0.11.0</Version>\n    <PackageVersion>9.8.7</PackageVersion>'))
    const { status, report } = check(root)
    expect(status).toBe(1)
    expect(report.findings).toContain(`${path}: PackageVersion 9.8.7 does not match 0.11.0`)
    expect(report.distributions.find(distribution => distribution.kind === 'dotnet')).toMatchObject({ packageVersion: '9.8.7' })
  })

  it('rejects a noncanonical Go module and a drifted example marker independently', async () => {
    const root = await temporaryRoot()
    await editText(root, 'packages/sdk/go/go.mod', text => text.replace('github.com/bamanoz/focused-spec/packages/sdk/go', 'example.com/focused-spec'))
    let result = check(root)
    expect(result.status).toBe(1)
    expect(result.report.findings).toContain('packages/sdk/go/go.mod: module example.com/focused-spec does not match github.com/bamanoz/focused-spec/packages/sdk/go')

    await editText(root, 'packages/sdk/go/go.mod', text => text.replace('example.com/focused-spec', 'github.com/bamanoz/focused-spec/packages/sdk/go'))
    await editText(root, 'examples/scenarios/go/go.mod', text => text.replace('v0.0.0-COORDINATED', 'v0.0.0'))
    result = check(root)
    expect(result.status).toBe(1)
    expect(result.report.findings).toContain('examples/scenarios/go/go.mod: require github.com/bamanoz/focused-spec/packages/sdk/go v0.0.0 does not match v0.0.0-COORDINATED')
  })

  it('finds stale staged public URLs and hardcoded .NET test-consumer versions', async () => {
    const root = await temporaryRoot()
    await editText(root, 'scripts/stage-assets.mjs', text => text.replace('blob/v0.11.0/', 'blob/v9.8.7/'))
    let result = check(root)
    expect(result.status).toBe(1)
    expect(result.report.findings).toContain('scripts/stage-assets.mjs:7: release reference 9.8.7 does not match 0.11.0')

    await editText(root, 'scripts/stage-assets.mjs', text => text.replaceAll('v9.8.7/', 'v0.11.0/'))
    await editText(root, 'test/dotnet-native-plugins.spec.ts', text => text.replace('FocusedSpec.Scenarios" Version="0.11.0"', 'FocusedSpec.Scenarios" Version="9.8.7"'))
    result = check(root)
    expect(result.status).toBe(1)
    expect(result.report.findings).toContain('test/dotnet-native-plugins.spec.ts:121: release reference 9.8.7 does not match 0.11.0')
  })
})
