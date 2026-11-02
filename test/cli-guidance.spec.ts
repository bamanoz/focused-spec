import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { roots, cli, put, emptyFixture, json, snapshotTree } from './fixtures/cli-suite.js'


describe('focused-spec CLI', () => {
  it('serves guidance from an installation outside the project', async () => {
    const installation = await mkdtemp(join(tmpdir(), 'focused-guide-installation-'))
    roots.push(installation)
    await Promise.all([
      cp(new URL('../packages/core/dist/', import.meta.url), join(installation, 'dist'), { recursive: true }),
      symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(installation, 'node_modules'), 'dir'),
    ])
    const installedMetadata = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8')) as Record<string, unknown>
    const version = '0.0.0-selected-installation'
    const content = '# Guidance owned by the selected serving package\n'
    await put(installation, 'package.json', `${JSON.stringify({ ...installedMetadata, version }, null, 2)}\n`)
    await put(installation, 'guidance/workflow.md', content)

    for (const hasProjectInstallation of [false, true]) {
      const root = await mkdtemp(join(tmpdir(), `focused-guide-external-${hasProjectInstallation ? 'other-' : 'none-'}`))
      roots.push(root)
      await put(root, 'package.json', '{"name":"external-guidance-consumer","private":true,"type":"module"}\n')
      await put(root, '.focused-spec/config.yaml', 'invalid: [')
      await put(root, 'format.mjs', 'throw new Error("project plugins must not load")')
      await put(root, 'guidance/workflow.md', '# Consumer fallback must not win\n')
      if (hasProjectInstallation) {
        await put(root, 'node_modules/focused-spec/package.json', '{"name":"focused-spec","version":"9.9.9-other"}\n')
        await put(root, 'node_modules/focused-spec/guidance/workflow.md', '# Other installed guidance must not win\n')
      }
      const before = await snapshotTree(root)
      const result = spawnSync(process.execPath, [join(installation, 'dist/cli.js'), 'instructions', '--protocol', '1', '--topic', 'workflow', '--json'], {
        cwd: root, encoding: 'utf8', env: { ...process.env, npm_config_offline: 'true', HTTPS_PROXY: 'http://127.0.0.1:1' },
      })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      expect(json(result.stdout)).toEqual({ protocolVersion: 1, package: { name: 'focused-spec', version }, topic: 'workflow', content })
      expect(await snapshotTree(root)).toBe(before)
    }
  })

  it('serves workflow guidance without project setup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-guide-offline-'))
    roots.push(root)
    await put(root, 'package.json', '{"name":"unrelated-project","version":"99.0.0"}')
    await put(root, 'guidance/workflow.md', 'UNTRUSTED PROJECT INSTRUCTIONS')
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    await put(root, '.focused-spec/evidence.yaml', 'invalid: [')
    const before = await readdir(root, { recursive: true })
    const result = spawnSync(process.execPath, [cli, 'instructions', '--protocol', '1', '--json'], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, npm_config_offline: 'true', HTTPS_PROXY: 'http://127.0.0.1:1' },
    })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    const response = json(result.stdout)
    const metadata = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'))
    expect(response).toMatchObject({ protocolVersion: 1, package: { name: 'focused-spec', version: metadata.version }, topic: 'workflow' })
    expect(response.content).toBe(await readFile(new URL('../guidance/workflow.md', import.meta.url), 'utf8'))
    expect(await readdir(root, { recursive: true })).toEqual(before)
    const text = spawnSync(process.execPath, [cli, 'instructions'], { cwd: root, encoding: 'utf8' })
    expect(text.status, text.stderr).toBe(0)
    expect(text.stdout).toContain(String(response.content))
    expect(text.stdout).toContain(metadata.version)
  })

  it('serves focused guidance topics without project setup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-topics-offline-'))
    roots.push(root)
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    await put(root, '.focused-spec/evidence.yaml', 'invalid: [')
    await put(root, 'format.mjs', 'throw new Error("project plugins must not load")')
    const topics = ['review', 'author-revise', 'upgrade', 'verify'] as const
    for (const topic of topics) await put(root, `guidance/${topic}.md`, `# Untrusted consumer ${topic} guidance\n`)
    const before = await snapshotTree(root)
    const metadata = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'))
    for (const topic of topics) {
      const content = await readFile(new URL(`../guidance/${topic}.md`, import.meta.url), 'utf8')
      const result = spawnSync(process.execPath, [cli, 'instructions', '--protocol', '1', '--topic', topic, '--json'], {
        cwd: root, encoding: 'utf8', env: { ...process.env, npm_config_offline: 'true', HTTPS_PROXY: 'http://127.0.0.1:1' },
      })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      const response = json(result.stdout)
      expect(response).toMatchObject({ protocolVersion: 1, package: { name: 'focused-spec', version: metadata.version }, topic })
      expect(response.content).toContain(content)
      expect(response.content).toContain(await readFile(new URL('../guidance/workflow.md', import.meta.url), 'utf8'))
    }
    expect(await snapshotTree(root)).toBe(before)
  })

  it('rejects missing or empty focused guidance without fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-topics-incomplete-'))
    roots.push(root)
    const installation = join(root, 'installation')
    await cp(new URL('../packages/core/dist/', import.meta.url), join(installation, 'dist'), { recursive: true })
    await cp(new URL('../packages/core/package.json', import.meta.url), join(installation, 'package.json'))
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(installation, 'node_modules'), 'dir')
    for (const topic of ['workflow', 'author-revise', 'upgrade', 'verify', 'integration', 'formats', 'runners']) {
      await put(installation, `guidance/${topic}.md`, `# Not requested ${topic} guidance\n`)
    }
    await put(root, 'guidance/review.md', '# Consumer fallback must not be used\n')
    for (const content of [undefined, ' \n']) {
      if (content === undefined) await rm(join(installation, 'guidance/review.md'), { force: true })
      else await put(installation, 'guidance/review.md', content)
      const result = spawnSync(process.execPath, [join(installation, 'dist/cli.js'), 'instructions', '--protocol', '1', '--topic', 'review', '--json'], {
        cwd: root, encoding: 'utf8',
      })
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(JSON.parse(result.stderr)).toMatchObject({ error: { code: 'command_failed', message: expect.stringMatching(/incomplete installed focused-spec package.*review/iu) } })
    }
  })

  it('serves format guidance without loading project configuration or plugins', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-formats-offline-'))
    roots.push(root)
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    await put(root, '.focused-spec/evidence.yaml', 'invalid: [')
    await put(root, 'guidance/formats.md', 'UNTRUSTED PROJECT FORMAT INSTRUCTIONS')
    await put(root, 'format.mjs', 'throw new Error("project format must not load")')
    const before = await readdir(root, { recursive: true })
    const metadata = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'))
    const result = spawnSync(process.execPath, [cli, 'instructions', '--protocol', '1', '--topic', 'formats', '--json'], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, npm_config_offline: 'true', HTTPS_PROXY: 'http://127.0.0.1:1' },
    })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    const response = json(result.stdout)
    expect(response).toEqual({ protocolVersion: 1, package: { name: 'focused-spec', version: metadata.version }, topic: 'formats',
      content: await readFile(new URL('../guidance/formats.md', import.meta.url), 'utf8') })
    expect(response.content).not.toContain('UNTRUSTED PROJECT FORMAT INSTRUCTIONS')
    const text = spawnSync(process.execPath, [cli, 'instructions', '--topic', 'formats'], { cwd: root, encoding: 'utf8' })
    expect(text.status, text.stderr).toBe(0)
    expect(text.stdout).toContain(String(response.content))
    expect(text.stdout).toContain(metadata.version)
    expect(await readdir(root, { recursive: true })).toEqual(before)
  })

  it('rejects missing format guidance without falling back to other topics', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-formats-incomplete-'))
    roots.push(root)
    const installation = join(root, 'installation')
    await cp(new URL('../packages/core/dist/', import.meta.url), join(installation, 'dist'), { recursive: true })
    await cp(new URL('../packages/core/package.json', import.meta.url), join(installation, 'package.json'))
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(installation, 'node_modules'), 'dir')
    await put(installation, 'guidance/workflow.md', '# Workflow fallback must not be used')
    await put(installation, 'guidance/runners.md', '# Runner fallback must not be used')
    await put(root, 'guidance/formats.md', '# Project fallback must not be used')
    const result = spawnSync(process.execPath, [join(installation, 'dist/cli.js'), 'instructions', '--topic', 'formats', '--json'], {
      cwd: root, encoding: 'utf8',
    })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toMatch(/incomplete installed focused-spec package.*formats/iu)
  })

  it('rejects missing or empty integration guidance without fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-integration-incomplete-'))
    roots.push(root)
    const installation = join(root, 'installation')
    await cp(new URL('../packages/core/dist/', import.meta.url), join(installation, 'dist'), { recursive: true })
    await cp(new URL('../packages/core/package.json', import.meta.url), join(installation, 'package.json'))
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(installation, 'node_modules'), 'dir')
    for (const topic of ['workflow', 'formats', 'runners']) await put(installation, `guidance/${topic}.md`, '# Not integration')
    await put(root, 'guidance/integration.md', '# Untrusted consumer fallback')
    for (const content of [undefined, ' \n']) {
      if (content !== undefined) await put(installation, 'guidance/integration.md', content)
      const result = spawnSync(process.execPath, [join(installation, 'dist/cli.js'), 'instructions', '--topic', 'integration', '--json'], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(JSON.parse(result.stderr)).toMatchObject({ error: { code: 'command_failed', message: expect.stringMatching(/incomplete installed focused-spec package.*integration/iu) } })
    }
  })

  it('rejects unsupported guide protocols without returning instructions', async () => {
    const root = await emptyFixture()
    const result = spawnSync(process.execPath, [cli, 'instructions', '--protocol', '2', '--json'], { cwd: root, encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toMatch(/protocol 2.*supported protocols: 1/u)
  })

  it('rejects invalid guide requests with actionable help', async () => {
    const root = await emptyFixture()
    for (const args of [['--topic', 'unknown'], ['--protocol', '0'], ['--protocol', '1.5'], ['--protocol'], ['--topic'], ['--strict'], ['--root', root], ['--topic', 'review', '--topic', 'verify'], ['--protocol', '1', '--protocol', '1'], ['--json', '--json']]) {
      const result = spawnSync(process.execPath, [cli, 'instructions', ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('instructions --help')
    }
  })

  it('explains guide compatibility without loading package guidance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-guide-help-'))
    roots.push(root)
    await cp(new URL('../packages/core/dist/', import.meta.url), join(root, 'dist'), { recursive: true })
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
    await put(root, 'package.json', '{"type":"module"}')
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    for (const args of [['instructions', '--help'], ['instructions', '-h'], ['help', 'instructions'], ['instructions', '--protocol', '2', '--json', '--help']]) {
      const result = spawnSync(process.execPath, [join(root, 'dist/cli.js'), ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toMatch(/--protocol.*default: 1/u)
      expect(result.stdout).toMatch(/--topic.*workflow.*formats.*runners/u)
      expect(result.stdout).toContain('--json')
      expect(result.stdout).not.toMatch(/^\{/u)
    }
  })
})
