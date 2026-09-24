import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../src/config.js'
import { executePlan } from '../src/executor.js'
import { planEvidence } from '../src/planner.js'
import { resolveRunnerTargets, runRunnerTargets } from '../src/runner-client.js'
import { validateFocusedSpecs } from '../src/validate.js'

const roots: string[] = []

async function put(root: string, path: string, content: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, content)
}

async function fixture(status: 'pass' | 'skip' = 'pass'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-'))
  roots.push(root)
  await put(root, '.focused-spec/config.yaml', [
    'version: 1',
    'specifications:',
    '  source: openspec',
    'runners:',
    '  fixture:',
    '    module: ./runner.ts',
  ].join('\n'))
  await put(root, 'openspec/specs/example/spec.md', [
    '### Requirement: Observable behavior',
    '#### Scenario: Project runner proves behavior',
    '- **ID**: `fixture.runner.executes`',
    '- **EVIDENCE**: `fixture::behavior`',
    '- **WHEN** focused evidence is requested',
    '- **THEN** the project runner returns its observable result',
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
      '#### Scenario: First consumer',
      '- **ID**: `fixture.shared.first`',
      '- **EVIDENCE**: `fixture::behavior`',
      '- **WHEN** the first consumer requests the shared target',
      '- **THEN** it receives the target result',
      '#### Scenario: Second consumer',
      '- **ID**: `fixture.shared.second`',
      '- **EVIDENCE**: `fixture::behavior`',
      '- **WHEN** the second consumer requests the shared target',
      '- **THEN** it receives the same target result',
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
    const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
    const output = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(output.status).toBe(1)
    expect(JSON.parse(output.stdout)).toMatchObject({ success: false, scenarios: [{ status: 'FAIL', evidence: [{ status: 'FAIL' }] }] })
  })

  it('reports runner execution errors without a false pass', async () => {
    const root = await fixture()
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run() { throw new Error("execution failed") } }')
    const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
    const output = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(output.status).toBe(1)
    expect(JSON.parse(output.stdout)).toMatchObject({ success: false, scenarios: [{ status: 'ERROR', evidence: [{ status: 'ERROR', diagnostic: expect.stringContaining('execution failed') }] }] })
  })
})
