import { spawnSync } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cli, openSpecLayouts, baselineEntries, put, nativeScenario, configure, writeRegistry, fixture, emptyFixture, json, timingArrays, runnerFacts, formatFacts } from './fixtures/cli-suite.js'


describe('focused-spec CLI', () => {
  it('reports reached timings on unresolved evidence without starting execution', async () => {
    const root = await fixture()
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: [], errors: selectors.map(selector => ({ selector, message: "missing selected test" })) } }, async run() { throw new Error("must not execute") } }')
    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--json', '--timings'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    const output = json(result.stdout)
    expect(output).toMatchObject({ valid: false, executionStarted: false,
      timings: { validationMs: expect.any(Number), resolutionMs: expect.any(Number), totalMs: expect.any(Number) } })
    expect(output.timings).not.toHaveProperty('executionMs')
    expect(JSON.stringify(output.violations)).toContain('missing selected test')
    const timings = timingArrays(output)
    expect(runnerFacts(timings.runnerOperations)).toEqual([
      { runnerId: 'fixture', operation: 'resolve', selectorCount: 1, outcome: 'completed' },
    ])
    expect(timings.formatOperations).toHaveLength(1)
    expect(timings.runnerOperations.some(row => row.operation === 'run' || row.operation === 'partition')).toBe(false)
  })

  it('attributes timed runner operations to selected unique workloads', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/current/spec.md', [
      nativeScenario('timing.current.first', 'First selected workload'),
      nativeScenario('timing.current.second', 'Second selected workload'),
    ].join('\n\n'))
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('timing.add.dormant', 'Unselected workload'))
    await writeRegistry(root, [
      { scope: 'current', id: 'timing.current.first', evidence: ['alpha::shared', 'alpha::one', 'beta::two'] },
      { scope: 'current', id: 'timing.current.second', evidence: ['alpha::shared'] },
      { scope: 'add', id: 'timing.add.dormant', evidence: ['dormant::hidden'] },
    ])
    await configure(root, openSpecLayouts, [
      'runners:',
      '  alpha: { module: ./alpha-runner.ts }',
      '  beta: { module: ./beta-runner.ts }',
      '  dormant: { module: ./dormant-runner.ts }',
    ])
    const passingRunner = [
      'export default { apiVersion: 1,',
      '  async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async partition() { throw new Error("partition must stay dormant in serial execution") },',
      '  async run({ targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n')
    await put(root, 'alpha-runner.ts', passingRunner)
    await put(root, 'beta-runner.ts', passingRunner)
    await put(root, 'dormant-runner.ts', 'throw new Error("unselected runner must not load")')

    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--json', '--timings'], { encoding: 'utf8' })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    const output = json(result.stdout)
    expect(output).toMatchObject({ success: true, targetCount: 3, scenarios: [
      expect.objectContaining({ id: 'timing.current.first', status: 'PASS' }),
      expect.objectContaining({ id: 'timing.current.second', status: 'PASS' }),
    ] })
    const timings = timingArrays(output)
    expect(runnerFacts(timings.runnerOperations)).toEqual([
      { runnerId: 'alpha', operation: 'resolve', selectorCount: 2, outcome: 'completed' },
      { runnerId: 'beta', operation: 'resolve', selectorCount: 1, outcome: 'completed' },
      { runnerId: 'alpha', operation: 'run', targetCount: 2, outcome: 'completed' },
      { runnerId: 'beta', operation: 'run', targetCount: 1, outcome: 'completed' },
    ])
    expect(timings.runnerOperations.every(row => row.operation === 'resolve'
      ? row.targetCount === undefined
      : row.selectorCount === undefined)).toBe(true)

    const text = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--timings'], { encoding: 'utf8' })
    expect(text.status, text.stderr || text.stdout).toBe(0)
    expect(text.stdout).toMatch(/runner alpha resolve: .* selectors 2, completed/u)
    expect(text.stdout).toMatch(/runner beta resolve: .* selectors 1, completed/u)
    expect(text.stdout).toMatch(/runner alpha run: .* targets 2, completed/u)
    expect(text.stdout).toMatch(/runner beta run: .* targets 1, completed/u)
    expect(text.stdout).not.toContain('runner dormant')
    expect(text.stdout).not.toContain(' partition:')
  })

  it('attributes document parsing to configured formats and reused hosts', async () => {
    const root = await emptyFixture()
    await put(root, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats:',
      '    alpha:',
      '      package: "@focused-spec/format-registry"',
      '      options: { parser: { module: ./alpha-format.ts } }',
      '    beta: { module: ./beta-format.ts }',
      '  documents:',
      '    - match: "docs/*.md"',
      '      format: alpha',
      '      scope: current',
      '      exclude: ["docs/excluded.md"]',
      '    - match: "stories/*.story"',
      '      format: beta',
      '      scope: current',
      '    - match: "changes/{scope}/*.story"',
      '      format: beta',
      'runners: {}',
    ].join('\n'))
    await put(root, 'alpha-format.ts', [
      'export default { apiVersion: 2, parse({ source }) {',
      '  const markerId = source.trim()',
      '  return { items: [{ line: 1, name: markerId, nativeIds: [markerId], markerId }], diagnostics: [] }',
      '} }',
    ].join('\n'))
    await put(root, 'beta-format.ts', 'export default { apiVersion: 2, parse() { return { items: [], diagnostics: [{ message: "fixture native diagnostic" }] } } }')
    await put(root, 'docs/first.md', 'format.current.first')
    await put(root, 'docs/second.md', 'format.current.second')
    await put(root, 'docs/excluded.md', 'format.current.excluded')
    await put(root, 'stories/problem.story', 'diagnostic')
    await put(root, 'changes/add/dormant.story', 'unselected')
    await writeRegistry(root, [
      { scope: 'current', id: 'format.current.first', evidence: ['planned:fixture::first'] },
      { scope: 'current', id: 'format.current.second', evidence: ['planned:fixture::second'] },
    ])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'current', '--syntax-only', '--json', '--timings'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    const output = json(result.stdout)
    expect(JSON.stringify(output.violations)).toContain('fixture native diagnostic')
    const timings = timingArrays(output)
    expect(timings.runnerOperations).toEqual([])
    expect(formatFacts(timings.formatOperations)).toEqual([
      { formatId: 'alpha', path: 'docs/first.md', scope: 'current', coldStart: true, outcome: 'completed' },
      { formatId: 'alpha', path: 'docs/second.md', scope: 'current', coldStart: false, outcome: 'completed' },
      { formatId: 'beta', path: 'stories/problem.story', scope: 'current', coldStart: true, outcome: 'completed' },
    ])

    const text = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'current', '--syntax-only', '--timings'], { encoding: 'utf8' })
    expect(text.status).toBe(1)
    expect(text.stderr).toMatch(/format alpha \[current\] docs\/first\.md: .* cold-start, completed/u)
    expect(text.stderr).toMatch(/format alpha \[current\] docs\/second\.md: .* reused-host, completed/u)
    expect(text.stderr).toMatch(/format beta \[current\] stories\/problem\.story: .* cold-start, completed/u)
    expect(text.stderr).not.toContain('excluded.md')
    expect(text.stderr).not.toContain('dormant.story')
    expect(text.stderr).not.toContain('  runner ')
  })

  it('retains attempted plugin timings across errors and negative results', async () => {
    const parseRoot = await emptyFixture()
    await put(parseRoot, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats:',
      '    broken:',
      '      package: "@focused-spec/format-registry"',
      '      options: { parser: { module: ./broken-format.ts } }',
      '  documents:',
      '    - match: "specs/*.md"',
      '      format: broken',
      '      scope: current',
      'runners: {}',
    ].join('\n'))
    await put(parseRoot, 'broken-format.ts', 'export default { apiVersion: 2, parse() { return { items: "malformed", diagnostics: [] } } }')
    await put(parseRoot, 'specs/broken.md', 'malformed parse response')
    const parseFailure = spawnSync(process.execPath, [cli, 'validate', '--root', parseRoot, '--syntax-only', '--json', '--timings'], { encoding: 'utf8' })
    expect(parseFailure.status).toBe(1)
    const parseOutput = json(parseFailure.stdout)
    expect(JSON.stringify(parseOutput.violations)).toContain('format response')
    const parseTimings = timingArrays(parseOutput)
    expect(formatFacts(parseTimings.formatOperations)).toEqual([
      { formatId: 'broken', path: 'specs/broken.md', scope: 'current', coldStart: true, outcome: 'error' },
    ])
    expect(parseTimings.runnerOperations).toEqual([])

    const resolveRoot = await fixture()
    await rm(join(resolveRoot, 'openspec/changes'), { recursive: true })
    await writeRegistry(resolveRoot, [baselineEntries[0]!])
    await put(resolveRoot, 'runner.ts', [
      'export default { apiVersion: 1,',
      '  async resolve() { process.exit(23) },',
      '  async run() { throw new Error("run must not start") },',
      '}',
    ].join('\n'))
    const resolveFailure = spawnSync(process.execPath, [cli, 'run', '--root', resolveRoot, '--json', '--timings'], { encoding: 'utf8' })
    expect(resolveFailure.status).toBe(1)
    const resolveOutput = json(resolveFailure.stdout)
    expect(resolveOutput).toMatchObject({ valid: false, executionStarted: false })
    expect(JSON.stringify(resolveOutput.violations)).toContain('exited before responding with code 23')
    const resolveTimings = timingArrays(resolveOutput)
    expect(runnerFacts(resolveTimings.runnerOperations)).toEqual([
      { runnerId: 'fixture', operation: 'resolve', selectorCount: 1, outcome: 'error' },
    ])

    const runRoot = await fixture()
    await rm(join(runRoot, 'openspec/changes'), { recursive: true })
    await writeRegistry(runRoot, [baselineEntries[0]!])
    await configure(runRoot, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
      '    timeoutMs: 5',
    ])
    await put(runRoot, 'runner.ts', [
      'export default { apiVersion: 1,',
      '  async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run() { return Promise.withResolvers().promise },',
      '}',
    ].join('\n'))
    const runFailure = spawnSync(process.execPath, [cli, 'run', '--root', runRoot, '--json', '--timings'], { encoding: 'utf8', timeout: 10_000 })
    expect(runFailure.error).toBeUndefined()
    expect(runFailure.status).toBe(1)
    const runOutput = json(runFailure.stdout)
    expect(runOutput).toMatchObject({ success: false, scenarios: [expect.objectContaining({ status: 'ERROR' })] })
    expect(JSON.stringify(runOutput.scenarios)).toContain('timed out')
    const runTimings = timingArrays(runOutput)
    expect(runnerFacts(runTimings.runnerOperations)).toEqual([
      { runnerId: 'fixture', operation: 'resolve', selectorCount: 1, outcome: 'completed' },
      { runnerId: 'fixture', operation: 'run', targetCount: 1, outcome: 'error' },
    ])

    await configure(runRoot, openSpecLayouts)
    await put(runRoot, 'runner.ts', [
      'export default { apiVersion: 1,',
      '  async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run({ targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "fail", diagnostic: "assertion failed" })) } },',
      '}',
    ].join('\n'))
    const negative = spawnSync(process.execPath, [cli, 'run', '--root', runRoot, '--json', '--timings'], { encoding: 'utf8' })
    expect(negative.status).toBe(1)
    const negativeOutput = json(negative.stdout)
    expect(negativeOutput).toMatchObject({ success: false, scenarios: [expect.objectContaining({ status: 'FAIL' })] })
    expect(JSON.stringify(negativeOutput.scenarios)).toContain('assertion failed')
    const negativeTimings = timingArrays(negativeOutput)
    expect(runnerFacts(negativeTimings.runnerOperations)).toEqual([
      { runnerId: 'fixture', operation: 'resolve', selectorCount: 1, outcome: 'completed' },
      { runnerId: 'fixture', operation: 'run', targetCount: 1, outcome: 'completed' },
    ])
  })

  it('reports phase timings only when requested', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
    await writeRegistry(root, [baselineEntries[0]!])

    const ordinary = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    const timed = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json', '--timings'], { encoding: 'utf8' })
    const ordinaryText = spawnSync(process.execPath, [cli, 'run', '--root', root], { encoding: 'utf8' })
    const timedText = spawnSync(process.execPath, [cli, 'run', '--root', root, '--timings'], { encoding: 'utf8' })

    expect(ordinary.status).toBe(0)
    expect(timed.status).toBe(0)
    expect(ordinaryText.status).toBe(0)
    expect(timedText.status).toBe(0)
    const ordinaryOutput = json(ordinary.stdout)
    const timedOutput = json(timed.stdout)
    expect(ordinaryOutput).not.toHaveProperty('timings')
    const { timings: _timings, ...timedResult } = timedOutput
    expect(timedResult).toEqual(ordinaryOutput)
    expect(timedOutput).toMatchObject({
      success: true,
      timings: {
        validationMs: expect.any(Number),
        resolutionMs: expect.any(Number),
        executionMs: expect.any(Number),
        totalMs: expect.any(Number),
      },
    })
    const arrays = timingArrays(timedOutput)
    expect(runnerFacts(arrays.runnerOperations)).toEqual([
      { runnerId: 'fixture', operation: 'resolve', selectorCount: 1, outcome: 'completed' },
      { runnerId: 'fixture', operation: 'run', targetCount: 1, outcome: 'completed' },
    ])
    expect(formatFacts(arrays.formatOperations)).toEqual([
      { formatId: 'markdown', path: 'openspec/specs/current/spec.md', scope: 'current', coldStart: true, outcome: 'completed' },
    ])
    expect(ordinaryText.stdout).not.toContain('timings:')
    expect(ordinaryText.stdout).not.toContain('  runner ')
    expect(ordinaryText.stdout).not.toContain('  format ')
    const timingStart = timedText.stdout.indexOf('timings:')
    expect(timingStart).toBeGreaterThanOrEqual(0)
    expect(timedText.stdout.slice(0, timingStart)).toBe(ordinaryText.stdout)
    expect(timedText.stdout.slice(timingStart)).toMatch(/runner fixture resolve: .* selectors 1, completed/u)
    expect(timedText.stdout.slice(timingStart)).toMatch(/runner fixture run: .* targets 1, completed/u)
    expect(timedText.stdout.slice(timingStart)).toMatch(/format markdown \[current\] openspec\/specs\/current\/spec\.md: .* cold-start, completed/u)
  })
})
