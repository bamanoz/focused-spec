import { spawnSync } from 'node:child_process'
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runDistributionPlan } from '../scripts/release-publisher.mjs'

const repository = fileURLToPath(new URL('..', import.meta.url))
const roots = []
function invoke(script, args, env = process.env) {
  return spawnSync(process.execPath, [join(repository, script), ...args], { cwd: repository, encoding: 'utf8', env })
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('release automation', () => {
  it('fails the requested native preflight with actionable missing-tool detail', () => {
    const result = invoke('scripts/release-preflight.mjs', ['--tier', 'go', '--json'], { ...process.env, PATH: '' })
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({ tier: 'go', ready: false, missing: expect.arrayContaining(['npm', 'go']) })
  })

  it('reports checked active changes and leaves every fixture byte unchanged', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-release-guard-'))
    roots.push(root)
    const changes = join(root, 'openspec/changes')
    const completed = join(changes, 'completed')
    const incomplete = join(changes, 'incomplete')
    const skipped = join(changes, 'skipped')
    const archived = join(changes, 'archive/old')
    for (const directory of [completed, incomplete, skipped, archived]) await mkdir(directory, { recursive: true })
    const files = [
      [join(completed, 'tasks.md'), '# Tasks\n- [x] done\n'],
      [join(incomplete, 'tasks.md'), '# Tasks\n- [ ] pending\n'],
      [join(skipped, 'tasks.md'), '# Tasks\n- [x] ignored\n'],
      [join(skipped, '.openspec.yaml'), 'skip_specs: true\n'],
      [join(archived, 'tasks.md'), '# Tasks\n- [x] archived\n'],
    ]
    for (const [path, content] of files) await writeFile(path, content)
    const before = await Promise.all(files.map(async ([path]) => [path, await readFile(path)]))
    const tree = await readdir(changes, { recursive: true })
    const result = invoke('scripts/openspec-guard.mjs', ['--json'], { ...process.env, FOCUSED_SPEC_OPENSPEC_ROOT: root })
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ count: 1, lifecycleChanged: false, completed: [{ change: 'completed', signal: '1 task(s) checked' }] })
    for (const [path, content] of before) expect(await readFile(path)).toEqual(content)
    expect(await readdir(changes, { recursive: true })).toEqual(tree)
  })

  it('preserves verified immutable results and leaves dependent distributions pending after failure', async () => {
    const attempts = []
    const result = await runDistributionPlan(['core', 'format', 'runner'], {
      dryRun: false,
      exists: name => name === 'core',
      publish: name => { attempts.push(name); if (name === 'format') throw new Error('registry unavailable') },
      verify: name => name === 'core',
    })
    expect(result).toEqual({ published: ['core'], pending: ['format', 'runner'], failed: 'format: registry unavailable', complete: false, dryRun: false })
    expect(attempts).toEqual(['format'])
  })

  it('reports a dry-run distribution plan without calling any publisher client', async () => {
    const calls = []
    const result = await runDistributionPlan(['npm:core', 'pypi:sdk', 'github:asset', 'go:tag'], {
      dryRun: true,
      exists: name => { calls.push(`exists:${name}`); return false },
      publish: name => { calls.push(`publish:${name}`) },
      verify: name => { calls.push(`verify:${name}`); return true },
    })
    expect(result).toEqual({ published: [], pending: ['npm:core', 'pypi:sdk', 'github:asset', 'go:tag'], failed: null, complete: false, dryRun: true })
    expect(calls).toEqual([])
  })

  it('keeps published-version certification separate from explicit publisher approval', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-release-registry-'))
    roots.push(root)
    const bin = join(root, 'bin')
    await mkdir(bin)
    const npm = join(bin, 'npm')
    await writeFile(npm, '#!/usr/bin/env node\nconst a=process.argv.slice(2).join(" "); if (a.includes("whoami")) process.stdout.write(JSON.stringify("publisher")); else { process.stderr.write("npm ERR! code E404\\n"); process.exit(1) }\n')
    await chmod(npm, 0o755)
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` }
    const published = invoke('scripts/release-registry.mjs', ['--json'], env)
    expect(published.status).toBe(1)
    expect(JSON.parse(published.stdout)).toMatchObject({ mode: 'published-versions', ready: false, certificationComplete: false })
    const unapproved = invoke('scripts/release-registry.mjs', ['--publisher', '--json'], { ...env, FOCUSED_SPEC_NATIVE_NAMES_APPROVED: '0' })
    expect(unapproved.status).toBe(1)
    expect(JSON.parse(unapproved.stdout)).toMatchObject({ mode: 'publisher', approved: false, ready: false })
  })
})
