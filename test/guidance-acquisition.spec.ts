import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-guidance-acquisition-'))
  roots.push(root)
  await mkdir(join(root, '.focused-spec'), { recursive: true })
  await writeFile(join(root, '.focused-spec/config.yaml'), 'invalid: [')
  await writeFile(join(root, '.focused-spec/evidence.yaml'), 'invalid: [')
  await writeFile(join(root, 'package.json'), '{"name":"consumer","version":"1.0.0"}')
  return root
}

function invoke(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [cli, 'instructions', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, npm_config_offline: 'true', HTTPS_PROXY: 'http://127.0.0.1:1' },
  })
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('combined guidance acquisition', () => {
  it('serves the exact installed operation identity and both complete sections offline without project changes', async () => {
    const root = await fixture()
    await writeFile(join(root, 'guidance-placeholder'), 'consumer-owned')
    const before = await readdir(root, { recursive: true })
    const metadata = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8')) as { version: string }
    const workflow = await readFile(new URL('../guidance/workflow.md', import.meta.url), 'utf8')
    const operation = await readFile(new URL('../guidance/review.md', import.meta.url), 'utf8')
    const result = invoke(root, '--protocol', '1', '--topic', 'review', '--json')
    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual({
      protocolVersion: 1,
      package: { name: 'focused-spec', version: metadata.version },
      topic: 'review',
      content: `## Workflow router\n\n${workflow}\n\n## review guidance\n\n${operation}`,
    })
    expect(await readdir(root, { recursive: true })).toEqual(before)
  })

  it('keeps a workflow request router-only and leaves shared topics distinct', async () => {
    const root = await fixture()
    const workflow = await readFile(new URL('../guidance/workflow.md', import.meta.url), 'utf8')
    const routed = invoke(root, '--protocol', '1', '--topic', 'workflow', '--json')
    expect(routed.status, routed.stderr).toBe(0)
    expect(JSON.parse(routed.stdout)).toMatchObject({ topic: 'workflow', content: workflow })
    expect(JSON.parse(routed.stdout).content).not.toContain('## review guidance')

    const integration = await readFile(new URL('../guidance/integration.md', import.meta.url), 'utf8')
    const shared = invoke(root, '--protocol', '1', '--topic', 'integration', '--json')
    expect(shared.status, shared.stderr).toBe(0)
    expect(JSON.parse(shared.stdout)).toMatchObject({ topic: 'integration', content: integration })
  })

  it('rejects unsupported protocol and invalid topic without emitting guidance', async () => {
    const root = await fixture()
    for (const [args, diagnostic] of [
      [['--protocol', '2', '--topic', 'review', '--json'], /unsupported loader protocol 2.*supported protocols: 1/u],
      [['--protocol', '1', '--topic', 'unknown', '--json'], /unknown guidance topic unknown.*choose/u],
    ] as const) {
      const result = invoke(root, ...args)
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toMatch(diagnostic)
    }
  })

  it('fails closed when either installed combined asset is absent or empty', async () => {
    const root = await fixture()
    const packageRoot = fileURLToPath(new URL('../packages/core/', import.meta.url))
    const installation = join(root, 'installation')
    await mkdir(join(installation, 'guidance'), { recursive: true })
    await cp(join(packageRoot, 'dist'), join(installation, 'dist'), { recursive: true })
    await cp(join(packageRoot, 'package.json'), join(installation, 'package.json'))
    await cp(join(packageRoot, 'guidance'), join(installation, 'guidance'), { recursive: true })
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(installation, 'node_modules'), 'dir')
    for (const topic of ['workflow', 'review']) {
      const asset = join(installation, 'guidance', `${topic}.md`)
      const original = await readFile(asset, 'utf8')
      for (const content of [undefined, '  \n']) {
        if (content !== undefined) await writeFile(asset, content)
        else await rm(asset)
        const result = spawnSync(process.execPath, [join(installation, 'dist/cli.js'), 'instructions', '--protocol', '1', '--topic', 'review', '--json'], { cwd: root, encoding: 'utf8' })
        expect(result.status).toBe(1)
        expect(result.stdout).toBe('')
        expect(result.stderr).toMatch(/incomplete installed focused-spec package.*review/iu)
      }
      await writeFile(asset, original)
    }
  })
})
