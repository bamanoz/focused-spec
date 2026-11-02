import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import goRunner from '../packages/runners/go/src/index.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Go runner lifecycle', () => {
  it('batches discovery by package and preserves exact selector cardinality', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-go-discovery-batch-'))
    roots.push(root)
    await writeFile(join(root, 'go.mod'), 'module example.com/batched\n\ngo 1.22\n')
    await mkdir(join(root, 'one'))
    await mkdir(join(root, 'two'))
    await writeFile(join(root, 'one', 'one_test.go'), 'package one\nimport "testing"\nfunc TestOne(t *testing.T) {}\nfunc TestTwo(t *testing.T) {}\n')
    await writeFile(join(root, 'two', 'two_test.go'), 'package two\nimport "testing"\nfunc TestThree(t *testing.T) {}\n')
    const calls = join(root, 'go-calls')
    const wrapper = join(root, 'go-wrapper.mjs')
    await writeFile(wrapper, `import { appendFileSync } from 'node:fs'; import { spawnSync } from 'node:child_process'; const args = process.argv.slice(2); appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n'); const result = spawnSync('go', args, { encoding: 'utf8' }); process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? ''); process.exit(result.status ?? 1);`)
    const context = {
      projectRoot: root, cwd: root, runnerId: 'go', options: { command: process.execPath, commandArgs: [wrapper] },
      signal: new AbortController().signal,
    }
    const selectors = ['./one::TestOne', './one::TestTwo', './one::TestMissing', './two::TestThree', './one::testInvalid']
    const resolved = await goRunner.resolve({ ...context, selectors })
    expect(resolved.targets.map(target => target.selector)).toEqual(selectors.slice(0, 2).concat(selectors[3]!))
    expect(resolved.errors.map(error => error.selector)).toEqual([selectors[2], selectors[4]])
    expect(resolved.errors[0]?.message).toContain('not found')
    expect(resolved.errors[1]?.message).toContain('expected')
    expect((await readFile(calls, 'utf8')).trim().split('\n')).toHaveLength(2)
  }, 60000)

  it('rejects ambiguous discovery and package failures without losing unique selectors', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-go-cardinality-'))
    roots.push(root)
    const calls = join(root, 'calls.jsonl')
    const wrapper = join(root, 'go-controlled.mjs')
    await writeFile(wrapper, `import { appendFileSync } from 'node:fs'; const args = process.argv.slice(2); const pkg = args.at(-1); appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n'); if (pkg === './broken') { console.log('TestFalsePass'); console.error('package discovery failed'); process.exitCode = 1; } else if (pkg === './first') console.log('TestUnique\\nTestAmbiguous\\nTestAmbiguous'); else console.log('TestOther');`)
    const selectors = ['./first::TestUnique', './second::TestOther', './first::TestAmbiguous', './first::TestMissing', './broken::TestFalsePass']
    const context = { projectRoot: root, cwd: root, runnerId: 'go', options: { command: process.execPath, commandArgs: [wrapper] }, signal: new AbortController().signal }
    const result = await goRunner.resolve({ ...context, selectors })
    expect(result.targets.map(target => target.selector)).toEqual(selectors.slice(0, 2))
    expect(result.errors).toEqual([
      { selector: selectors[2], message: expect.stringContaining('ambiguous (2 matches)') },
      { selector: selectors[3], message: expect.stringContaining('not found') },
      { selector: selectors[4], message: expect.stringContaining('package discovery failed') },
    ])
    const invocations = (await readFile(calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as string[])
    expect(invocations.map(args => args.at(-1))).toEqual(['./first', './second', './broken'])
    const first = invocations[0]!
    const pattern = new RegExp(first[first.indexOf('-list') + 1]!)
    expect(pattern.test('TestUnique')).toBe(true)
    expect(pattern.test('TestUniqueSuffix')).toBe(false)
    expect(pattern.test('PrefixTestUnique')).toBe(false)
  }, 10000)
})
