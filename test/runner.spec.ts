import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import runner from '../.focused-spec/runners/vitest.js'

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
  })
})
