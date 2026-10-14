import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../packages/core/dist/config.js'
import { executePlan } from '../packages/core/dist/executor.js'
import { planEvidence } from '../packages/core/dist/planner.js'
import { resolveRunnerTargets, runRunnerTargets } from '../packages/core/dist/runner-client.js'
import { validateFocusedSpecs } from '../packages/core/dist/validate.js'
import type { ExecutionPlan, RunnerConfig } from '../packages/core/dist/model.js'

const roots: string[] = []

async function put(root: string, path: string, content: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, content)
}

async function fixture(status: 'pass' | 'skip' = 'pass'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-'))
  roots.push(root)
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
  await put(root, '.focused-spec/config.yaml', [
    'version: 4',
    'specifications:',
    '  formats: { markdown: { package: "@focused-spec/format-markdown" } }',
    '  documents:',
    '    - match: openspec/specs/**/spec.md',
    '      format: markdown',
    '      scope: current',
    '    - match: openspec/changes/{scope}/specs/**/spec.md',
    '      format: markdown',
    'runners:',
    '  fixture:',
    '    module: ./runner.ts',
  ].join('\n'))
  await put(root, '.focused-spec/evidence.yaml', [
    'scopes:',
    '  current:',
    '    fixture.runner.executes:',
    '      evidence: ["fixture::behavior"]',
  ].join('\n'))
  await put(root, 'openspec/specs/example/spec.md', [
    '### Requirement: Observable behavior',
    '<!-- focused-spec:id=fixture.runner.executes -->',
    '#### Scenario: Project runner proves behavior',
    '',
    'The project runner returns its observable result.',
  ].join('\n'))
  await put(root, 'runner.ts', [
    'type Selector = string',
    'export default {',
    '  apiVersion: 1,',
    '  async resolve(request: { selectors: Selector[] }) {',
    '    return { targets: request.selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] }',
    '  },',
    '  async run(request) {',
    `    return { results: request.targets.map(target => ({ targetId: target.targetId, status: '${status}' })) }`,
    '  },',
    '}',
  ].join('\n'))
  return root
}

interface TestRunner {
  readonly id: string
  readonly module: string
  readonly targetIds: readonly string[]
}

interface RunnerEvent {
  readonly phase: 'partition' | 'start' | 'end'
  readonly runnerId: string
  readonly targetIds: readonly string[]
  readonly invocation?: string
  readonly at?: number
}

function executionPlan(root: string, runners: readonly TestRunner[]): ExecutionPlan {
  const groups = runners.map(runner => {
    const config: RunnerConfig = { module: runner.module }
    const targets = runner.targetIds.map(targetId => ({
      key: `${runner.id}\u0000${targetId}`,
      runnerId: runner.id,
      config,
      target: { selector: targetId, targetId, displayName: targetId },
      references: [`${runner.id}::${targetId}`],
    }))
    return { runnerId: runner.id, config, targets }
  })
  const targets = groups.flatMap(group => group.targets)
  return {
    projectRoot: root,
    groups,
    targets,
    scenarios: targets.map(target => ({
      scope: 'current',
      id: `${target.runnerId}.${target.target.targetId}`,
      path: `specs/${target.runnerId}.md`,
      line: 1,
      name: target.target.displayName,
      evidence: [{ key: target.key, reference: target.references[0] as string }],
    })),
  }
}

function observedRunner(partitionBody?: string, failTarget?: string, lingerAfterResponse = false): string {
  const completion = lingerAfterResponse
    ? ['    setTimeout(() => { void record(projectRoot, { phase: "end", runnerId, targetIds, invocation, at: Date.now() }) }, 300)']
    : [
        '    const { promise, resolve } = Promise.withResolvers()',
        '    setTimeout(resolve, targetIds.includes("slow") ? 900 : 300)',
        '    await promise',
        '    await record(projectRoot, { phase: "end", runnerId, targetIds, invocation, at: Date.now() })',
      ]
  return [
    "import { appendFile, readFile } from 'node:fs/promises'",
    "import { join } from 'node:path'",
    ...(lingerAfterResponse ? ['process.on("SIGTERM", () => {})'] : []),
    'async function record(projectRoot, event) {',
    '  await appendFile(join(projectRoot, "events.jsonl"), JSON.stringify(event) + "\\n")',
    '}',
    'export default {',
    '  apiVersion: 1,',
    '  async resolve({ selectors }) {',
    '    return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] }',
    '  },',
    ...(partitionBody === undefined ? [] : [
      '  async partition(request) {',
      '    await record(request.projectRoot, { phase: "partition", runnerId: request.runnerId, targetIds: request.targets.map(target => target.targetId) })',
      ...partitionBody.split('\n').map(line => `    ${line}`),
      '  },',
    ]),
    '  async run({ projectRoot, runnerId, targets }) {',
    '    const targetIds = targets.map(target => target.targetId)',
    '    const invocation = runnerId + ":" + targetIds.join(",")',
    '    await record(projectRoot, { phase: "start", runnerId, targetIds, invocation, at: Date.now() })',
    ...completion,
    ...(failTarget === undefined ? [] : [`    if (targetIds.includes(${JSON.stringify(failTarget)})) throw new Error("group failed ${failTarget}")`]),
    '    return { results: targets.map(target => ({ targetId: target.targetId, status: "pass" })) }',
    '  },',
    '}',
  ].join('\n')
}

async function schedulerRoot(runners: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-scheduler-'))
  roots.push(root)
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
  for (const [path, source] of Object.entries(runners)) await put(root, path, source)
  await put(root, '.focused-spec/config.yaml', [
    'version: 4',
    'specifications:',
    '  formats: { markdown: { package: "@focused-spec/format-markdown" } }',
    '  documents:',
    '    - match: specs/**/*.md',
    '      format: markdown',
    '      scope: current',
    'runners: {}',
  ].join('\n'))
  await put(root, '.focused-spec/evidence.yaml', 'scopes: {}\n')
  return root
}

async function runnerEvents(root: string): Promise<readonly RunnerEvent[]> {
  const content = await readFile(join(root, 'events.jsonl'), 'utf8')
  return content.trim().split('\n').filter(line => line.length > 0).map(line => JSON.parse(line) as RunnerEvent)
}

function interval(events: readonly RunnerEvent[], invocation: string): { readonly start: number; readonly end: number } {
  const start = events.find(event => event.phase === 'start' && event.invocation === invocation)?.at
  const end = events.find(event => event.phase === 'end' && event.invocation === invocation)?.at
  if (start === undefined || end === undefined) throw new Error(`missing observed interval for ${invocation}`)
  return { start, end }
}

function overlaps(left: { readonly start: number; readonly end: number }, right: { readonly start: number; readonly end: number }): boolean {
  return left.start < right.end && right.start < left.end
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('project-local TypeScript runners', () => {
  it('resolve and execute exact evidence through an isolated runner host', async () => {
    const root = await fixture()
    const loaded = await loadConfig(root)
    expect(loaded.violations).toEqual([])
    expect(loaded.config).toBeDefined()
    const validation = await validateFocusedSpecs(root, loaded.config!)
    expect(validation.violations).toEqual([])
    const planned = await planEvidence(root, loaded.config!, validation.targetDocuments)
    expect(planned.violations).toEqual([])
    expect(planned.plan?.targets).toHaveLength(1)
    const result = await executePlan(planned.plan!)
    expect(result).toMatchObject({
      success: true,
      targetCount: 1,
      scenarios: [{ id: 'fixture.runner.executes', status: 'PASS' }],
    })
  })

  it('does not claim skipped evidence as passing', async () => {
    const root = await fixture('skip')
    const loaded = await loadConfig(root)
    const validation = await validateFocusedSpecs(root, loaded.config!)
    const planned = await planEvidence(root, loaded.config!, validation.targetDocuments)
    await expect(executePlan(planned.plan!)).resolves.toMatchObject({ success: false, scenarios: [{ status: 'SKIP' }] })
    await expect(executePlan(planned.plan!, { allowSkip: true })).resolves.toMatchObject({ success: true, scenarios: [{ status: 'SKIP' }] })
  })

  it('reports an unresponsive runner as an error after timeout', async () => {
    const root = await fixture()
    await put(root, 'runner.ts', 'export default { apiVersion: 1, resolve: async () => Promise.withResolvers().promise, run: async () => ({ results: [] }) }')
    await expect(resolveRunnerTargets(root, 'fixture', { module: './runner.ts', timeoutMs: 10 }, ['behavior']))
      .rejects.toThrow('runner fixture timed out after 10ms')
  })

  it('rejects duplicate missing and unknown selector resolutions', async () => {
    const root = await fixture()
    for (const [targets, diagnostic] of [
      [[], 'received 0'],
      [[{ selector: 'behavior', targetId: 'one', displayName: 'one' }, { selector: 'behavior', targetId: 'two', displayName: 'two' }], 'received 2'],
      [[{ selector: 'other', targetId: 'other', displayName: 'other' }], 'unknown selector other'],
    ] as const) {
      await put(root, 'runner.ts', `export default { apiVersion: 1, async resolve() { return { targets: ${JSON.stringify(targets)}, errors: [] } }, async run() { return { results: [] } } }`)
      await expect(resolveRunnerTargets(root, 'fixture', { module: './runner.ts' }, ['behavior'])).rejects.toThrow(diagnostic)
    }
  })

  it('rejects a resolved source outside the project root', async () => {
    const root = await fixture()
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve() { return { targets: [{ selector: "behavior", targetId: "behavior", displayName: "behavior", source: { path: "../escape.ts" } }], errors: [] } }, async run() { return { results: [] } } }')
    await expect(resolveRunnerTargets(root, 'fixture', { module: './runner.ts' }, ['behavior']))
      .rejects.toThrow('runner source path must stay inside project root')
  })

  it('rejects missing duplicate and unknown target results', async () => {
    const root = await fixture()
    const target = { selector: 'behavior', targetId: 'behavior', displayName: 'behavior' }
    for (const [results, diagnostic] of [
      [[], 'did not return target behavior'],
      [[{ targetId: 'behavior', status: 'pass' }, { targetId: 'behavior', status: 'pass' }], 'duplicate target behavior'],
      [[{ targetId: 'other', status: 'pass' }], 'unknown target other'],
    ] as const) {
      await put(root, 'runner.ts', `export default { apiVersion: 1, async resolve() { return { targets: [], errors: [] } }, async run() { return { results: ${JSON.stringify(results)} } } }`)
      await expect(runRunnerTargets(root, 'fixture', { module: './runner.ts' }, [target])).rejects.toThrow(diagnostic)
    }
  })

  it('runs one shared target once for two scenarios', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/example/spec.md', [
      '### Requirement: Shared result',
      '<!-- focused-spec:id=fixture.shared.first -->',
      '#### Scenario: First consumer',
      '',
      'The first consumer receives the target result.',
      '',
      '<!-- focused-spec:id=fixture.shared.second -->',
      '#### Scenario: Second consumer',
      '',
      'The second consumer receives the same target result.',
    ].join('\n'))
    await put(root, '.focused-spec/evidence.yaml', [
      'scopes:',
      '  current:',
      '    fixture.shared.first:',
      '      evidence: ["fixture::behavior"]',
      '    fixture.shared.second:',
      '      evidence: ["fixture::behavior"]',
    ].join('\n'))
    await put(root, 'runner.ts', [
      "import { appendFile } from 'node:fs/promises'",
      "import { join } from 'node:path'",
      'export default { apiVersion: 1,',
      '  async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run({ projectRoot, targets }) { await appendFile(join(projectRoot, "invocations"), "x"); return { results: targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))
    const loaded = await loadConfig(root)
    const validated = await validateFocusedSpecs(root, loaded.config!)
    const planned = await planEvidence(root, loaded.config!, validated.targetDocuments)
    const result = await executePlan(planned.plan!)
    expect(await readFile(join(root, 'invocations'), 'utf8')).toBe('x')
    expect(result).toMatchObject({ targetCount: 1, scenarios: [{ status: 'PASS' }, { status: 'PASS' }] })
  })

  it('propagates a failing target to the scenario and process result', async () => {
    const root = await fixture()
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run({ targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "fail" })) } } }')
    const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))
    const output = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(output.status).toBe(1)
    expect(JSON.parse(output.stdout)).toMatchObject({ success: false, scenarios: [{ status: 'FAIL', evidence: [{ status: 'FAIL' }] }] })
  })

  it('executes real Vitest evidence from a declarative scope layout', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-vitest-'))
    roots.push(root)
    await put(root, 'package.json', '{"private":true,"type":"module"}\n')
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'junction')
    await put(root, '.focused-spec/config.yaml', [
      'version: 4',
      'specifications:',
      '  formats: { markdown: { package: "@focused-spec/format-markdown" } }',
      '  documents:',
      '    - match: features/{scope}/spec.md',
      '      format: markdown',
      'runners:',
      '  vitest:',
      '    package: "@focused-spec/runner-vitest"',
      '    timeoutMs: 120000',
    ].join('\n'))
    await put(root, '.focused-spec/evidence.yaml', [
      'scopes:',
      '  account-lock:',
      '    fixture.vitest.scope:',
      '      evidence: ["vitest::test/contract.spec.ts::fixture contract > accepts configured value"]',
    ].join('\n'))
    await put(root, 'features/account-lock/spec.md', [
      '<!-- focused-spec:id=fixture.vitest.scope -->',
      '#### Scenario: Vitest proves the named scope',
      '',
      'The real Vitest result determines the scenario status.',
    ].join('\n'))
    const testPath = 'test/contract.spec.ts'
    await put(root, testPath, [
      "import { describe, expect, it } from 'vitest'",
      "describe('fixture contract', () => {",
      "  it('accepts configured value', () => { expect(2 + 2).toBe(4) })",
      '})',
    ].join('\n'))
    const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))
    const args = [cli, 'run', '--root', root, '--scope', 'account-lock', '--json']

    const passing = spawnSync(process.execPath, args, { encoding: 'utf8' })
    expect(passing.status).toBe(0)
    expect(JSON.parse(passing.stdout)).toMatchObject({
      success: true,
      validationScope: { scopes: { mode: 'selected', name: 'account-lock' } },
      executionSelection: { scopes: { mode: 'selected', name: 'account-lock' } },
      scenarios: [{ id: 'fixture.vitest.scope', scope: 'account-lock', status: 'PASS' }],
    })

    await put(root, testPath, [
      "import { describe, expect, it } from 'vitest'",
      "describe('fixture contract', () => {",
      "  it('accepts configured value', () => { expect(2 + 2).toBe(5) })",
      '})',
    ].join('\n'))
    const failing = spawnSync(process.execPath, args, { encoding: 'utf8' })
    expect(failing.status).toBe(1)
    expect(JSON.parse(failing.stdout)).toMatchObject({
      success: false,
      scenarios: [{ id: 'fixture.vitest.scope', status: 'FAIL', evidence: [{ status: 'FAIL' }] }],
    })
  }, 120_000)

  it('reports runner execution errors without a false pass', async () => {
    const root = await fixture()
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run() { throw new Error("execution failed") } }')
    const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))
    const output = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(output.status).toBe(1)
    expect(JSON.parse(output.stdout)).toMatchObject({ success: false, scenarios: [{ status: 'ERROR', evidence: [{ status: 'ERROR', diagnostic: expect.stringContaining('execution failed') }] }] })
  })

  it('partitions only selected targets into exact executable groups', async () => {
    const partition = [
      'const policy = JSON.parse(await readFile(join(request.projectRoot, "runner-policy.json"), "utf8"))',
      'const selected = new Set(request.targets.map(target => target.targetId))',
      'return { groups: policy.groups.map(group => ({ ...group, targetIds: group.targetIds.filter(targetId => selected.has(targetId)) })).filter(group => group.targetIds.length > 0) }',
    ].join('\n')
    const root = await schedulerRoot({ 'selected.ts': observedRunner(partition) })
    await put(root, 'runner-policy.json', JSON.stringify({ groups: [
      { targetIds: ['selected-a'], resources: ['database:accounts'] },
      { targetIds: ['selected-b'], resources: [] },
      { targetIds: ['not-selected'], resources: [] },
    ] }))
    await put(root, '.focused-spec/config.yaml', [
      'version: 4',
      'specifications:',
      '  formats: { markdown: { package: "@focused-spec/format-markdown" } }',
      '  documents:',
      '    - match: specs/**/*.md',
      '      format: markdown',
      '      scope: current',
      'runners:',
      '  selected:',
      '    module: ./selected.ts',
      'execution:',
      '  maxConcurrentGroups: 2',
    ].join('\n'))

    const loaded = await loadConfig(root)
    expect(loaded.violations).toEqual([])
    expect(loaded.config?.execution?.maxConcurrentGroups).toBe(2)
    const plan = executionPlan(root, [{ id: 'selected', module: './selected.ts', targetIds: ['selected-a', 'selected-b'] }])
    const result = await executePlan(plan, { maxConcurrentGroups: loaded.config?.execution?.maxConcurrentGroups ?? 1 })
    const events = await runnerEvents(root)

    expect(events.filter(event => event.phase === 'partition')).toEqual([
      { phase: 'partition', runnerId: 'selected', targetIds: ['selected-a', 'selected-b'] },
    ])
    expect(events.filter(event => event.phase === 'start').flatMap(event => event.targetIds).sort()).toEqual(['selected-a', 'selected-b'])
    expect(result).toMatchObject({ success: true, targetCount: 2, scenarios: [{ status: 'PASS' }, { status: 'PASS' }] })

    for (const invalid of ['0', '1.5', 'nope']) {
      await put(root, '.focused-spec/config.yaml', [
        'version: 4',
        'specifications:',
        '  formats: { markdown: { package: "@focused-spec/format-markdown" } }',
        '  documents:',
        '    - match: specs/**/*.md',
        '      format: markdown',
        '      scope: current',
        'runners: {}',
        'execution:',
        `  maxConcurrentGroups: ${invalid}`,
      ].join('\n'))
      const invalidConfig = await loadConfig(root)
      expect(invalidConfig.config).toBeUndefined()
      expect(invalidConfig.violations).toContainEqual({
        path: join(root, '.focused-spec/config.yaml'),
        message: 'execution.maxConcurrentGroups must be a positive integer',
      })
    }
  })

  it('rejects an invalid partition without running that runner\'s targets', async () => {
    const invalidPartitions = [
      'return { groups: [] }',
      'return { groups: [{ targetIds: ["a"], resources: [] }, { targetIds: ["a"], resources: [] }] }',
      'return { groups: [{ targetIds: ["invented"], resources: [] }] }',
      'return { groups: [{ targetIds: [], resources: [] }] }',
      'return { groups: [{ targetIds: ["a"], resources: [""] }] }',
      'return { groups: [{ targetIds: ["a"], resources: ["shared", "shared"] }] }',
      'return { groups: [{ targetIds: ["a"], resources: [], exclusive: true }] }',
      'return { groups: [{ targetIds: ["a"] }] }',
      'return { groups: [{ targetIds: ["a"], exclusive: false }] }',
      'throw new Error("partition failed")',
    ]
    for (let index = 0; index < invalidPartitions.length; index += 1) {
      const module = `invalid-${index}.ts`
      const root = await schedulerRoot({ [module]: observedRunner(invalidPartitions[index]) })
      const plan = executionPlan(root, [{ id: `invalid-${index}`, module: `./${module}`, targetIds: ['a'] }])
      const result = await executePlan(plan, { maxConcurrentGroups: 2 })
      const events = await runnerEvents(root)
      expect(events.some(event => event.phase === 'start')).toBe(false)
      expect(result).toMatchObject({ success: false, targetCount: 1, scenarios: [{ status: 'ERROR', evidence: [{ status: 'ERROR' }] }] })
    }

    const validPartition = 'return { groups: [{ targetIds: request.targets.map(target => target.targetId), resources: [] }] }'
    const mixedRoot = await schedulerRoot({
      'invalid.ts': observedRunner('return { groups: [] }'),
      'valid.ts': observedRunner(validPartition),
    })
    const mixedPlan = executionPlan(mixedRoot, [
      { id: 'invalid', module: './invalid.ts', targetIds: ['a'] },
      { id: 'valid', module: './valid.ts', targetIds: ['b'] },
    ])
    const mixedResult = await executePlan(mixedPlan, { maxConcurrentGroups: 2 })
    const mixedEvents = await runnerEvents(mixedRoot)
    expect(mixedEvents.filter(event => event.phase === 'start').map(event => event.runnerId)).toEqual(['valid'])
    expect(mixedResult.scenarios.map(scenario => `${scenario.id}:${scenario.status}`)).toEqual([
      'invalid.a:ERROR',
      'valid.b:PASS',
    ])
  })

  it('runs an unmodified runner exclusively with bounded concurrency', async () => {
    const partition = 'return { groups: [{ targetIds: request.targets.map(target => target.targetId), resources: [] }] }'
    const root = await schedulerRoot({
      'participating.ts': observedRunner(partition),
      'legacy.ts': observedRunner(undefined, undefined, true),
    })
    const plan = executionPlan(root, [
      { id: 'legacy', module: './legacy.ts', targetIds: ['unknown'] },
      { id: 'participating', module: './participating.ts', targetIds: ['safe'] },
    ])
    const result = await executePlan(plan, { maxConcurrentGroups: 2 })
    const events = await runnerEvents(root)

    expect(overlaps(interval(events, 'participating:safe'), interval(events, 'legacy:unknown'))).toBe(false)
    expect(result.scenarios.map(scenario => scenario.status)).toEqual(['PASS', 'PASS'])
  })

  it('leaves partition dormant with the default serial limit', async () => {
    const root = await schedulerRoot({
      'serial.ts': observedRunner('throw new Error("partition must stay dormant")'),
    })
    const plan = executionPlan(root, [{ id: 'serial', module: './serial.ts', targetIds: ['a', 'b'] }])
    const result = await executePlan(plan)
    const events = await runnerEvents(root)

    expect(events.filter(event => event.phase === 'partition')).toEqual([])
    expect(events.filter(event => event.phase === 'start').map(event => event.targetIds)).toEqual([['a', 'b']])
    expect(result.scenarios.map(scenario => scenario.status)).toEqual(['PASS', 'PASS'])
  })

  it('keeps targets with unknown resource compatibility exclusive', async () => {
    const partition = 'return { groups: [{ targetIds: ["known"], resources: [] }, { targetIds: ["unknown"], exclusive: true }] }'
    const root = await schedulerRoot({ 'coverage.ts': observedRunner(partition) })
    const plan = executionPlan(root, [{ id: 'coverage', module: './coverage.ts', targetIds: ['known', 'unknown'] }])
    const result = await executePlan(plan, { maxConcurrentGroups: 2 })
    const events = await runnerEvents(root)

    expect(overlaps(interval(events, 'coverage:known'), interval(events, 'coverage:unknown'))).toBe(false)
    expect(result.success).toBe(true)
  })

  it('overlaps independent groups within the configured limit', async () => {
    const partition = 'return { groups: request.targets.map(target => ({ targetIds: [target.targetId], resources: [] })) }'
    const root = await schedulerRoot({ 'parallel.ts': observedRunner(partition) })
    const plan = executionPlan(root, [{ id: 'parallel', module: './parallel.ts', targetIds: ['slow', 'fast-a', 'fast-b'] }])
    const result = await executePlan(plan, { maxConcurrentGroups: 2 })
    const events = await runnerEvents(root)
    const intervals = ['slow', 'fast-a', 'fast-b'].map(targetId => interval(events, `parallel:${targetId}`))
    const boundaries = intervals.flatMap(value => [{ at: value.start, delta: 1 }, { at: value.end, delta: -1 }])
      .sort((left, right) => left.at - right.at || left.delta - right.delta)
    let active = 0
    let maximumActive = 0
    for (const boundary of boundaries) {
      active += boundary.delta
      maximumActive = Math.max(maximumActive, active)
    }

    expect(intervals.some((left, leftIndex) => intervals.some((right, rightIndex) => leftIndex < rightIndex && overlaps(left, right)))).toBe(true)
    expect(maximumActive).toBe(2)
    expect(events.filter(event => event.phase === 'end')[0]?.targetIds).not.toContain('slow')
    expect(result.scenarios.map(scenario => `${scenario.id}:${scenario.status}`)).toEqual([
      'parallel.slow:PASS',
      'parallel.fast-a:PASS',
      'parallel.fast-b:PASS',
    ])
  })

  it('serializes groups with a shared resource across runners', async () => {
    const shared = 'return { groups: [{ targetIds: request.targets.map(target => target.targetId), resources: ["database:shared"] }] }'
    const independent = 'return { groups: [{ targetIds: request.targets.map(target => target.targetId), resources: [] }] }'
    const root = await schedulerRoot({
      'first.ts': observedRunner(shared),
      'second.ts': observedRunner(shared),
      'free.ts': observedRunner(independent),
    })
    const plan = executionPlan(root, [
      { id: 'first', module: './first.ts', targetIds: ['a'] },
      { id: 'second', module: './second.ts', targetIds: ['b'] },
      { id: 'free', module: './free.ts', targetIds: ['c'] },
    ])
    const result = await executePlan(plan, { maxConcurrentGroups: 2 })
    const events = await runnerEvents(root)
    const first = interval(events, 'first:a')
    const second = interval(events, 'second:b')
    const free = interval(events, 'free:c')

    expect(overlaps(first, second)).toBe(false)
    expect(overlaps(free, first) || overlaps(free, second)).toBe(true)
    expect(result.success).toBe(true)
  })

  it('reports overlapping admitted group intervals without summing wall time', async () => {
    const groupedTargets = [
      ['holder'],
      ['free-skip', 'free-pass'],
      ['middle-a', 'middle-b', 'middle-c'],
      ['release-a', 'release-b', 'release-c', 'release-d'],
      ['queued-a', 'queued-b', 'queued-c', 'queued-d', 'queued-e'],
    ] as const
    const targets = groupedTargets.flat()
    const root = await schedulerRoot({
      'barrier.ts': [
        "import { access, mkdir, watch, writeFile } from 'node:fs/promises'",
        "import { basename, dirname, join } from 'node:path'",
        'async function present(path) {',
        '  try { await access(path); return true } catch { return false }',
        '}',
        'async function waitFor(path) {',
        '  const events = watch(dirname(path))',
        '  try {',
        '    if (await present(path)) return',
        '    for await (const event of events) {',
        '      if (event.filename === basename(path) && await present(path)) return',
        '    }',
        '  } finally {',
        '    await events.return()',
        '  }',
        '}',
        'export default {',
        '  apiVersion: 1,',
        '  async resolve({ selectors }) {',
        '    return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] }',
        '  },',
        '  async partition() {',
        '    return { groups: [',
        `      { targetIds: ${JSON.stringify(groupedTargets[0])}, resources: ["database:shared"] },`,
        `      { targetIds: ${JSON.stringify(groupedTargets[1])}, resources: ["pipeline:free"] },`,
        `      { targetIds: ${JSON.stringify(groupedTargets[2])}, resources: ["pipeline:free"] },`,
        `      { targetIds: ${JSON.stringify(groupedTargets[3])}, resources: ["pipeline:free"] },`,
        `      { targetIds: ${JSON.stringify(groupedTargets[4])}, resources: ["database:shared"] },`,
        '    ] }',
        '  },',
        '  async run({ projectRoot, targets }) {',
        '    const barriers = join(projectRoot, ".barriers")',
        '    await mkdir(barriers, { recursive: true })',
        '    await writeFile(join(barriers, `started-${targets.length}`), "")',
        '    if (targets.length === 1) await waitFor(join(barriers, "started-4"))',
        '    return { results: targets.map(target => ({ targetId: target.targetId, status: target.targetId === "free-skip" ? "skip" : "pass" })) }',
        '  },',
        '}',
      ].join('\n'),
    })
    await put(root, '.focused-spec/config.yaml', [
      'version: 4',
      'specifications:',
      '  formats: { markdown: { package: "@focused-spec/format-markdown" } }',
      '  documents:',
      '    - match: specs/**/*.md',
      '      format: markdown',
      '      scope: current',
      'runners:',
      '  barrier:',
      '    module: ./barrier.ts',
      'execution:',
      '  maxConcurrentGroups: 2',
    ].join('\n'))
    await put(root, '.focused-spec/evidence.yaml', [
      'scopes:',
      '  current:',
      ...targets.flatMap(target => [
        `    timing.${target.replaceAll('-', '.')}:`,
        `      evidence: ["barrier::${target}"]`,
      ]),
    ].join('\n'))
    await put(root, 'specs/timings.md', [
      '### Requirement: Scheduler timing fixture',
      '',
      ...targets.flatMap(target => [
        `<!-- focused-spec:id=timing.${target.replaceAll('-', '.')} -->`,
        `#### Scenario: ${target} retains its result`,
        '',
        `The ${target} target keeps its status when timings are requested.`,
        '',
      ]),
    ].join('\n'))

    type OperationTiming = {
      readonly runnerId: string
      readonly startedMs: number
      readonly durationMs: number
      readonly outcome: 'completed' | 'error'
    } & (
      | { readonly operation: 'resolve'; readonly selectorCount: number }
      | { readonly operation: 'partition' | 'run'; readonly targetCount: number }
    )
    interface CliResult {
      readonly success: boolean
      readonly targetCount: number
      readonly scenarios: readonly {
        readonly id: string
        readonly status: string
        readonly evidence: readonly { readonly status: string }[]
      }[]
      readonly timings?: {
        readonly executionMs: number
        readonly runnerOperations: readonly OperationTiming[]
      }
    }
    const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))
    const args = [cli, 'run', '--root', root, '--json', '--allow-skip']
    const ordinary = spawnSync(process.execPath, args, { encoding: 'utf8' })
    expect(ordinary.status, ordinary.stderr || ordinary.stdout).toBe(0)
    const ordinaryOutput = JSON.parse(ordinary.stdout) as CliResult
    expect(ordinaryOutput).not.toHaveProperty('timings')

    await rm(join(root, '.barriers'), { recursive: true, force: true })
    const timed = spawnSync(process.execPath, [...args, '--timings'], { encoding: 'utf8' })
    expect(timed.status, timed.stderr || timed.stdout).toBe(0)
    const timedOutput = JSON.parse(timed.stdout) as CliResult
    const timings = timedOutput.timings
    expect(timings).toBeDefined()
    const ordinaryResults = {
      success: ordinaryOutput.success,
      targetCount: ordinaryOutput.targetCount,
      scenarios: ordinaryOutput.scenarios.map(scenario => ({
        id: scenario.id,
        status: scenario.status,
        evidence: scenario.evidence.map(item => item.status),
      })),
    }
    const timedResults = {
      success: timedOutput.success,
      targetCount: timedOutput.targetCount,
      scenarios: timedOutput.scenarios.map(scenario => ({
        id: scenario.id,
        status: scenario.status,
        evidence: scenario.evidence.map(item => item.status),
      })),
    }
    expect(timedResults).toEqual(ordinaryResults)
    expect(timedOutput).toMatchObject({
      success: true,
      targetCount: targets.length,
      scenarios: expect.arrayContaining(targets.map(target => expect.objectContaining({
        id: `timing.${target.replaceAll('-', '.')}`,
        status: target === 'free-skip' ? 'SKIP' : 'PASS',
      }))),
    })

    const operations = timings!.runnerOperations
    expect(operations.map(row => row.operation === 'resolve'
      ? { runnerId: row.runnerId, operation: row.operation, count: row.selectorCount, outcome: row.outcome }
      : { runnerId: row.runnerId, operation: row.operation, count: row.targetCount, outcome: row.outcome })).toEqual([
      { runnerId: 'barrier', operation: 'resolve', count: targets.length, outcome: 'completed' },
      { runnerId: 'barrier', operation: 'partition', count: targets.length, outcome: 'completed' },
      ...groupedTargets.map(group => ({ runnerId: 'barrier', operation: 'run', count: group.length, outcome: 'completed' })),
    ])
    expect(operations.every((row, index) => index === 0 || operations[index - 1]!.startedMs <= row.startedMs)).toBe(true)
    expect(operations.every(row => Number.isFinite(row.startedMs) && row.startedMs >= 0
      && Number.isFinite(row.durationMs) && row.durationMs >= 0)).toBe(true)

    const runs = operations.filter((row): row is OperationTiming & { readonly operation: 'run'; readonly targetCount: number } => row.operation === 'run')
    const byCount = new Map(runs.map(row => [row.targetCount, row]))
    const holder = byCount.get(1)!
    const free = byCount.get(2)!
    const middle = byCount.get(3)!
    const release = byCount.get(4)!
    const queued = byCount.get(5)!
    const end = (row: OperationTiming): number => row.startedMs + row.durationMs

    expect(free.startedMs).toBeLessThan(end(holder))
    expect(end(free)).toBeLessThanOrEqual(middle.startedMs)
    expect(end(middle)).toBeLessThanOrEqual(release.startedMs)
    expect(release.startedMs).toBeLessThan(end(holder))
    expect(end(free)).toBeLessThan(end(holder))
    expect(queued.startedMs).toBeGreaterThanOrEqual(end(holder))

    const runDurationSum = runs.reduce((sum, row) => sum + row.durationMs, 0)
    const runWallSpan = Math.max(...runs.map(end)) - Math.min(...runs.map(row => row.startedMs))
    const partition = operations.find((row): row is OperationTiming & { readonly operation: 'partition'; readonly targetCount: number } => row.operation === 'partition')!
    expect(runDurationSum).toBeGreaterThan(runWallSpan)
    expect(timings!.executionMs).toBeGreaterThanOrEqual(runWallSpan)
    expect(timings!.executionMs).toBeLessThan(partition.durationMs + runDurationSum)
  })

  it('reports grouped runner failures without claiming evidence passed', async () => {
    const partition = 'return { groups: request.targets.map(target => ({ targetIds: [target.targetId], resources: [] })) }'
    const root = await schedulerRoot({ 'mixed.ts': observedRunner(partition, 'bad') })
    const plan = executionPlan(root, [{ id: 'mixed', module: './mixed.ts', targetIds: ['bad', 'good'] }])
    const result = await executePlan(plan, { maxConcurrentGroups: 2 })
    const events = await runnerEvents(root)

    expect(events.filter(event => event.phase === 'end').map(event => event.targetIds)).toEqual(expect.arrayContaining([['bad'], ['good']]))
    expect(result).toMatchObject({
      success: false,
      targetCount: 2,
      scenarios: [
        { id: 'mixed.bad', status: 'ERROR', evidence: [{ status: 'ERROR', diagnostic: expect.stringContaining('group failed bad') }] },
        { id: 'mixed.good', status: 'PASS', evidence: [{ status: 'PASS' }] },
      ],
    })
  })
})
