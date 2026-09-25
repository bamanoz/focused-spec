import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repository = fileURLToPath(new URL('..', import.meta.url))
let root: string
let consumer: string
let installedEntries: string[]

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'focused-spec-consumer-'))
  consumer = join(root, 'project')
  await mkdir(consumer)
  await writeFile(join(consumer, 'package.json'), '{"name":"consumer","private":true,"type":"module"}\n')
  const pack = spawnSync('npm', ['pack', '--ignore-scripts', '--pack-destination', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 120_000 })
  if (pack.status !== 0) throw new Error(`npm pack failed: ${pack.stderr}`)
  const name = (JSON.parse(pack.stdout) as { filename: string }[])[0]?.filename
  if (name === undefined) throw new Error('npm pack returned no tarball')
  const install = spawnSync('npm', ['install', '--prefix', consumer, '--ignore-scripts', '--no-package-lock', join(root, name)], { encoding: 'utf8', timeout: 180_000 })
  if (install.status !== 0) throw new Error(`consumer install failed: ${install.stderr}`)
  installedEntries = await readdir(consumer)
}, 300_000)

afterAll(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
})

describe('package distribution', () => {
  it('installs the CLI without creating an agent skill or runner', () => {
    expect(installedEntries).not.toContain('.focused-spec')
    expect(installedEntries).not.toContain('.agents')
    expect(installedEntries).not.toContain('.omp')
    expect(installedEntries).not.toContain('focused-spec.yaml')
  })

  it('installs and executes the packed CLI from a consumer project', async () => {
    await put(join(consumer, '.focused-spec/config.yaml'), [
      'version: 2',
      'specifications:',
      '  documents:',
      '    - match: specs/**/*.md',
      '      scope: current',
      'runners:',
      '  consumer:',
      '    module: ./runner.ts',
    ].join('\n'))
    await put(join(consumer, 'specs/example.md'), [
      '#### Scenario: Installed CLI checks evidence',
      '- **ID**: `consumer.cli.works`',
      '- **EVIDENCE**: `consumer::sample`',
      '- **WHEN** the installed CLI validates evidence',
      '- **THEN** it resolves one target',
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
      'export default { apiVersion: 1, async resolve() { return { targets: [], errors: [] } }, async run() { return { results: [] } } } satisfies RunnerPlugin',
    ].join('\n'))
    await put(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: true }, files: ['plugin.ts'] }))
    const tsc = spawnSync(process.execPath, [resolve(repository, 'node_modules/typescript/bin/tsc'), '-p', join(consumer, 'tsconfig.json')], { cwd: consumer, encoding: 'utf8' })
    expect(tsc.status, tsc.stdout + tsc.stderr).toBe(0)
  })
})
