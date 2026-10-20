import { access, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import goRunner from '../packages/runners/go/src/index.js'
import pytestRunner from '../packages/runners/pytest/src/index.js'
import vitestRunner from '../packages/runners/vitest/src/index.js'
import { runProcess as runGoProcess } from '../packages/runners/go/src/process.js'
import { runProcess as runPytestProcess } from '../packages/runners/pytest/src/process.js'
import { runProcess as runVitestProcess } from '../packages/runners/vitest/src/process.js'

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
  for (const [name, selected, sentinel, declarations] of [
    ['flattened-name collision', 'a > b c', 'a b > c', [
      "describe('a', () => { it('b c', selectedBody) })",
      "describe('a b', () => { it('c', sentinelBody) })",
    ]],
    ['literal hierarchy separator', 'literal > title', 'literal title', [
      "it('literal > title', selectedBody)",
      "it('literal title', sentinelBody)",
    ]],
  ] as const) {
    it(`executes only the selected Vitest target with a ${name}`, async () => {
      const root = await temporaryRoot('focused-spec-vitest-identity-')
      await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir')
      await writeFile(join(root, 'package.json'), '{"type":"module"}\n')
      await writeFile(join(root, 'identity.spec.ts'), [
        "import { writeFileSync } from 'node:fs'",
        "import { describe, it } from 'vitest'",
        "const selectedBody = () => { writeFileSync('selected-ran', 'yes') }",
        "const sentinelBody = () => { writeFileSync('unselected-ran', 'yes'); throw new Error('unselected sentinel') }",
        ...declarations,
      ].join('\n'))
      const context = { projectRoot: root, cwd: root, runnerId: 'vitest', options: null, signal: new AbortController().signal }
      const selector = `identity.spec.ts::${selected}`
      const resolution = await vitestRunner.resolve({ ...context, selectors: [selector, `identity.spec.ts::${sentinel}`] })
      expect(resolution.errors).toEqual([])
      expect(resolution.targets.map(target => target.selector)).toEqual([selector, `identity.spec.ts::${sentinel}`])
      const target = resolution.targets[0]!
      const execution = await vitestRunner.run({ ...context, targets: [target] })
      expect(execution.results).toEqual([{ targetId: target.targetId, status: 'pass' }])
      await expect(access(join(root, 'selected-ran'))).resolves.toBeUndefined()
      await expect(access(join(root, 'unselected-ran'))).rejects.toThrow()
    }, 60_000)
  }

  for (const [name, runProcess] of [
    ['Vitest', runVitestProcess],
    ['pytest', runPytestProcess],
    ['Go', runGoProcess],
  ] as const) {
    it(`preserves split UTF-8 stdout and stderr in the ${name} process helper`, async () => {
      const root = await temporaryRoot('focused-spec-split-utf8-')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5_000)
      const script = [
        "const { setTimeout: delay } = require('node:timers/promises');",
        'const write = (stream, bytes) => new Promise((resolve, reject) => stream.write(Buffer.from(bytes), error => error ? reject(error) : resolve()));',
        '(async () => {',
        '  await write(process.stdout, [0x41, 0xe2]);',
        '  await write(process.stderr, [0x42, 0xf0, 0x9f]);',
        '  await delay(150);',
        '  await write(process.stdout, [0x82]);',
        '  await write(process.stderr, [0x98]);',
        '  await delay(150);',
        '  await write(process.stdout, [0xac, 0x5a]);',
        '  await write(process.stderr, [0x80, 0x59]);',
        '})().catch(error => { console.error(error); process.exitCode = 1 });',
      ].join('\n')
      try {
        const result = await runProcess(process.execPath, ['-e', script], root, controller.signal)
        expect(result).toEqual({ code: 0, stdout: 'A€Z', stderr: 'B😀Y' })
      } finally {
        clearTimeout(timer)
        controller.abort()
      }
    }, 10_000)
  }

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
    await writeFile(join(root, 'test/other.spec.ts'), [
      "import { appendFileSync } from 'node:fs'",
      "import { describe, expect, it } from 'vitest'",
      "describe('exact', () => {",
      "  it('passes', () => { expect(2 + 2).toBe(6) })",
      "  it('unselected failure', () => { appendFileSync('unselected-ran', 'yes'); throw new Error('unselected sentinel') })",
      '})',
    ].join('\n'))
    const context = { projectRoot: root, cwd: root, runnerId: 'vitest', options: null, signal: new AbortController().signal }
    const passing = 'test/framework.spec.ts::exact > passes'
    const failing = 'test/framework.spec.ts::exact > fails'
    const skipped = 'test/framework.spec.ts::exact > skips'
    const missing = 'test/framework.spec.ts::exact > missing'
    const ambiguous = 'test/framework.spec.ts::exact > duplicate'
    const otherFile = 'test/other.spec.ts::exact > passes'
    const resolution = await vitestRunner.resolve({ ...context, selectors: [passing, failing, skipped, missing, ambiguous, otherFile] })
    expect(resolution.targets.map(target => target.selector)).toEqual([passing, failing, skipped, otherFile])
    expect(resolution.errors).toEqual([
      { selector: missing, message: expect.stringContaining('not found') },
      { selector: ambiguous, message: expect.stringContaining('ambiguous') },
    ])
    const execution = await vitestRunner.run({ ...context, targets: resolution.targets })
    expect(execution.results).toEqual([
      { targetId: passing, status: 'pass' },
      { targetId: failing, status: 'fail', diagnostic: expect.stringContaining('expected 4 to be 5') },
      { targetId: skipped, status: 'skip' },
      { targetId: otherFile, status: 'fail', diagnostic: expect.stringContaining('expected 4 to be 6') },
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
