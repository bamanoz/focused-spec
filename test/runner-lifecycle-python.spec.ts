import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import pytestRunner from '../packages/runners/pytest/src/index.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('pytest runner lifecycle', () => {
  it('reports selected outcomes with xdist addopts and leaves an unselected failing test unrun', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-pytest-xdist-'))
    roots.push(root)
    await writeFile(join(root, 'pytest.ini'), '[pytest]\naddopts = -n 2\n')
    await writeFile(join(root, 'test_xdist.py'), 'def test_selected():\n    assert True\n\ndef test_unselected_failure():\n    raise RuntimeError("unselected test ran")\n')
    const context = {
      projectRoot: root, cwd: root, runnerId: 'pytest',
      options: { command: 'uv', commandArgs: ['run', '--with', 'pytest>=8,<10', '--with', 'pytest-xdist', 'python'] },
      signal: new AbortController().signal,
    }
    const selector = 'test_xdist.py::test_selected'
    const resolved = await pytestRunner.resolve({ ...context, selectors: [selector] })
    expect(resolved.errors).toEqual([])
    expect((await pytestRunner.run({ ...context, targets: resolved.targets })).results).toEqual([
      { targetId: selector, status: 'pass' },
    ])
  }, 120000)
})
