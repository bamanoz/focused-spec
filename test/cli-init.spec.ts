import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, mkdir, readFile, readdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { roots, cli, initTargets, put, json } from './fixtures/cli-suite.js'


describe('focused-spec CLI', () => {
  it('requires explicit init targets without interactive input', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-explicit-'))
    roots.push(root)
    await mkdir(join(root, '.claude'))
    for (const args of [[], ['--json']]) {
      const result = spawnSync(process.execPath, [cli, 'init', ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('--tools')
      expect(await readdir(root, { recursive: true })).toEqual(['.claude'])
    }
  })

  it('rejects invalid init arguments before writing files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-invalid-'))
    roots.push(root)
    for (const args of [['--tools', 'unknown'], ['--tools', 'all'], ['--tools', 'none'], ['--tools', 'claude,'], ['--tools', ''], ['--tools'], ['--wat'], ['--tools', 'claude', '--tools', 'codex'], [root, root, '--tools', 'claude']]) {
      const result = spawnSync(process.execPath, [cli, 'init', ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('init --help')
      expect(await readdir(root)).toEqual([])
    }
  })

  it('rejects unavailable init roots without creating a project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-root-'))
    roots.push(root)
    await put(root, 'file', 'not a directory')
    for (const path of [join(root, 'missing'), join(root, 'file')]) {
      const result = spawnSync(process.execPath, [cli, 'init', path, '--tools', 'claude', '--json'], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(json(result.stdout)).toMatchObject({ root: null, files: [], errors: expect.arrayContaining([expect.objectContaining({ message: expect.any(String) })]) })
    }
    expect(await readdir(root)).toEqual(['file'])
  })

  it('reports actual init actions and conflicts as one JSON document', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-json-'))
    roots.push(root)
    const invoke = (...args: string[]) => spawnSync(process.execPath, [cli, 'init', root, '--tools', ' agents,codex,agents ', '--json', ...args], { encoding: 'utf8' })
    const preview = invoke('--dry-run')
    expect(preview.status, preview.stderr).toBe(0)
    expect(json(preview.stdout)).toMatchObject({ tools: ['agents', 'codex'], dryRun: true, files: [{ path: '.agents/skills/focused-spec/SKILL.md', action: 'install', applied: false }], errors: [] })
    const installed = invoke()
    expect(installed.status, installed.stderr).toBe(0)
    expect(json(installed.stdout)).toMatchObject({ files: [{ path: '.agents/skills/focused-spec/SKILL.md', action: 'install', applied: true }], errors: [] })
    await put(root, '.agents/skills/focused-spec/SKILL.md', 'custom loader')
    const conflict = invoke()
    expect(conflict.status).toBe(1)
    expect(json(conflict.stdout)).toMatchObject({ files: [{ path: '.agents/skills/focused-spec/SKILL.md', action: 'conflict', applied: false }], errors: expect.arrayContaining([expect.objectContaining({ path: '.agents/skills/focused-spec/SKILL.md' })]) })
    expect(await readFile(join(root, '.agents/skills/focused-spec/SKILL.md'), 'utf8')).toBe('custom loader')
  })

  it('explains initialization without reading or modifying project state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-help-'))
    roots.push(root)
    await cp(new URL('../packages/core/dist/', import.meta.url), join(root, 'dist'), { recursive: true })
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
    await put(root, 'package.json', '{"type":"module"}')
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    const before = await readdir(root, { recursive: true })
    const home = join(root, 'missing-home')
    for (const args of [['init', '--help'], ['init', '-h'], ['help', 'init'], ['init', '--json', '--help']]) {
      const result = spawnSync(process.execPath, [join(root, 'dist/cli.js'), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('--replace')
      expect(result.stdout).toContain('--dry-run')
      expect(result.stdout).toContain('--no-animation')
      expect(result.stdout).toContain('Space to toggle')
      for (const target of initTargets) {
        expect(result.stdout).toContain(target.id)
        expect(result.stdout).toContain(`${target.home ? '~/' : ''}${target.skill}`)
        if (target.command !== null) expect(result.stdout).toContain(target.command)
      }
      expect(result.stdout).toMatch(/windsurf\s*->\s*devin/)
      expect(result.stdout).toMatch(/global-only/i)
      expect(result.stdout).toMatch(/canonical absolute/i)
      expect(await readdir(root, { recursive: true })).toEqual(before)
    }
  })
})
