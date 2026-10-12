import { access, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import goRunner from '../packages/runner-go/src/index.js'
import pytestRunner from '../packages/runner-pytest/src/index.js'
import vitestRunner from '../packages/runner-vitest/src/index.js'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix))
  roots.push(root)
  return root
}

describe('official framework runners', () => {
  it('reports exact Vitest outcomes', async () => {
    const root = await temporaryRoot('focused-spec-official-vitest-')
    await mkdir(join(root, 'test'))
    await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir')
    await writeFile(join(root, 'package.json'), '{"type":"module"}\n')
    await writeFile(join(root, 'test/framework.spec.ts'), [
      "import { appendFileSync } from 'node:fs'",
      "import { describe, expect, it } from 'vitest'",
      "describe('exact', () => {",
      "  it('passes', () => { expect(2 + 2).toBe(4) })",
      "  it('fails', () => { expect(2 + 2).toBe(5) })",
      "  it.skip('skips', () => {})",
      "  it('unselected failure', () => { appendFileSync('unselected-ran', 'yes'); expect(true).toBe(false) })",
      "  it('duplicate', () => {})",
      "  it('duplicate', () => {})",
      '})',
    ].join('\n'))
    const context = { projectRoot: root, cwd: root, runnerId: 'vitest', options: null, signal: new AbortController().signal }
    const passing = 'test/framework.spec.ts::exact > passes'
    const failing = 'test/framework.spec.ts::exact > fails'
    const skipped = 'test/framework.spec.ts::exact > skips'
    const missing = 'test/framework.spec.ts::exact > missing'
    const ambiguous = 'test/framework.spec.ts::exact > duplicate'
    const resolution = await vitestRunner.resolve({ ...context, selectors: [passing, failing, skipped, missing, ambiguous] })
    expect(resolution.targets.map(target => target.selector)).toEqual([passing, failing, skipped])
    expect(resolution.errors).toEqual([
      { selector: missing, message: expect.stringContaining('not found') },
      { selector: ambiguous, message: expect.stringContaining('ambiguous') },
    ])
    const execution = await vitestRunner.run({ ...context, targets: resolution.targets })
    expect(execution.results).toEqual([
      { targetId: passing, status: 'pass' },
      { targetId: failing, status: 'fail', diagnostic: expect.stringContaining('expected 4 to be 5') },
      { targetId: skipped, status: 'skip' },
    ])
    await expect(access(join(root, 'unselected-ran'))).rejects.toThrow()
  }, 60_000)

  it('reports exact pytest outcomes', async () => {
    const root = await temporaryRoot('focused-spec-official-pytest-')
    await writeFile(join(root, 'test_framework.py'), [
      'import pytest',
      'import os',
      '',
      'def test_passes():',
      '    assert 2 + 2 == 4',
      '',
      'def test_fails():',
      '    assert 2 + 2 == 5',
      '',
      '@pytest.mark.skip(reason="not supported")',
      'def test_skips():',
      '    pass',
      '',
      '@pytest.mark.parametrize("value", [1, 2])',
      'def test_parameterized(value):',
      '    assert value > 0',
      '',
      '@pytest.fixture',
      'def broken_setup():',
      '    raise RuntimeError("setup exploded")',
      '',
      'def test_setup_failure(broken_setup):',
      '    pass',
      '',
      '@pytest.fixture',
      'def broken_teardown():',
      '    yield',
      '    raise RuntimeError("teardown exploded")',
      '',
      'def test_teardown_failure(broken_teardown):',
      '    pass',
      '',
      'def test_aborts_process():',
      '    os._exit(0)',
    ].join('\n'))
    await writeFile(join(root, 'test_broken.py'), 'def test_broken(:\n    pass\n')
    const context = {
      projectRoot: root,
      cwd: root,
      runnerId: 'pytest',
      options: { command: 'uv', commandArgs: ['run', '--with', 'pytest>=8,<10', 'python'] },
      signal: new AbortController().signal,
    }
    const passing = 'test_framework.py::test_passes'
    const failing = 'test_framework.py::test_fails'
    const skipped = 'test_framework.py::test_skips'
    const parameterized = 'test_framework.py::test_parameterized[1]'
    const setupFailure = 'test_framework.py::test_setup_failure'
    const teardownFailure = 'test_framework.py::test_teardown_failure'
    const aborted = 'test_framework.py::test_aborts_process'
    const missing = 'test_framework.py::test_missing'
    const ambiguous = 'test_framework.py::test_parameterized'
    const collectionError = 'test_broken.py::test_broken'
    const resolution = await pytestRunner.resolve({
      ...context,
      selectors: [passing, failing, skipped, parameterized, setupFailure, teardownFailure, aborted, missing, ambiguous, collectionError],
    })
    expect(resolution.targets.map(target => target.selector)).toEqual([passing, failing, skipped, parameterized, setupFailure, teardownFailure, aborted])
    expect(resolution.errors).toEqual([
      { selector: missing, message: expect.stringContaining('not found') },
      { selector: ambiguous, message: expect.stringContaining('ambiguous') },
      { selector: collectionError, message: expect.stringContaining('SyntaxError') },
    ])
    const executionTargets = resolution.targets.filter(target => target.selector !== aborted)
    const execution = await pytestRunner.run({ ...context, targets: executionTargets })
    expect(execution.results).toEqual([
      { targetId: passing, status: 'pass' },
      { targetId: failing, status: 'fail', diagnostic: expect.stringContaining('assert (2 + 2) == 5') },
      { targetId: skipped, status: 'skip', diagnostic: expect.any(String) },
      { targetId: parameterized, status: 'pass' },
      { targetId: setupFailure, status: 'fail', diagnostic: expect.stringContaining('setup exploded') },
      { targetId: teardownFailure, status: 'fail', diagnostic: expect.stringContaining('teardown exploded') },
    ])
    const abortTarget = resolution.targets.find(target => target.selector === aborted)!
    await expect(pytestRunner.run({ ...context, targets: [abortTarget] })).rejects.toThrow('no result report')
  }, 120_000)

  it('reports exact Go outcomes', async () => {
    const root = await temporaryRoot('focused-spec-official-go-')
    await writeFile(join(root, 'go.mod'), 'module example.com/official-runner\n\ngo 1.22\n')
    const source = (includeRemoved: boolean): string => [
      'package officialrunner',
      '',
      'import "testing"',
      '',
      'func TestPasses(t *testing.T) {}',
      'func TestFails(t *testing.T) { t.Fatal("intentional failure") }',
      'func TestSkips(t *testing.T) { t.Skip("not supported") }',
      'func TestParent(t *testing.T) { t.Run("child", func(t *testing.T) { t.Skip("child skipped") }) }',
      ...(includeRemoved ? ['func TestRemoved(t *testing.T) {}'] : []),
      'func TestUnselectedFailure(t *testing.T) { t.Fatal("must not run") }',
    ].join('\n')
    await writeFile(join(root, 'framework_test.go'), source(true))
    const context = { projectRoot: root, cwd: root, runnerId: 'go', options: null, signal: new AbortController().signal }
    const passing = '.::TestPasses'
    const failing = '.::TestFails'
    const skipped = '.::TestSkips'
    const parent = '.::TestParent'
    const removed = '.::TestRemoved'
    const missing = '.::TestMissing'
    const resolution = await goRunner.resolve({ ...context, selectors: [passing, failing, skipped, parent, removed, missing] })
    expect(resolution.targets.map(target => target.selector)).toEqual([passing, failing, skipped, parent, removed])
    expect(resolution.errors).toEqual([{ selector: missing, message: expect.stringContaining('not found') }])
    await writeFile(join(root, 'framework_test.go'), source(false))
    const execution = await goRunner.run({ ...context, targets: resolution.targets })
    expect(execution.results).toEqual([
      { targetId: passing, status: 'pass' },
      { targetId: failing, status: 'fail', diagnostic: expect.stringContaining('intentional failure') },
      { targetId: skipped, status: 'skip', diagnostic: expect.stringContaining('not supported') },
      { targetId: parent, status: 'skip', diagnostic: expect.stringContaining('child skipped') },
      { targetId: removed, status: 'fail', diagnostic: expect.stringContaining('did not report one run and terminal event') },
    ])
  }, 60_000)
})
