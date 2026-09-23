import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { executePlan } from '../src/executor.js'
import { planEvidence } from '../src/planner.js'
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
    'export default {',
    '  apiVersion: 1,',
    '  async resolve(request) {',
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
})
