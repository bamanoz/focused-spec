import { createHash } from 'node:crypto'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runProcess } from '../evals/process.ts'
import type { EvalReport } from '../evals/report.ts'

const reportEntrypoint = fileURLToPath(new URL('../evals/report.ts', import.meta.url))
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(): Promise<string> {
  const created = await mkdtemp(join(tmpdir(), 'focused-eval-report-'))
  const root = await realpath(created)
  roots.push(root)
  return root
}

async function putJson(root: string, name: string, value: unknown): Promise<string> {
  const path = join(root, name)
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
  return path
}

async function digest(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function report(argumentsList: readonly string[]): Promise<{ readonly parsed: EvalReport; readonly stderr: string }> {
  const result = await runProcess(process.execPath, ['--experimental-strip-types', reportEntrypoint, ...argumentsList, '--json'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), timeoutMs: 20_000,
  })
  expect(result.code, result.stderr).toBe(0)
  return { parsed: JSON.parse(result.stdout) as EvalReport, stderr: result.stderr }
}

function publicResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    caseId: 'public-case',
    passed: true,
    workspace: '/removed',
    turns: [{}],
    gates: [
      { name: 'agent-turn-1', passed: true, detail: 'completed' },
      { name: 'focused-skill-loaded', passed: true, detail: 'loader read' },
      { name: 'focused-workflow-acquired', passed: true, detail: 'workflow acquired' },
    ],
    observations: [],
    measurements: {
      durationMs: 10,
      usage: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, totalTokens: 10 },
      usageComplete: true,
    },
    diagnostic: null,
    ...overrides,
  }
}

function nativeResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    caseId: 'native-case',
    mode: 'revise',
    certified: false,
    authoring: { status: 'passed', detail: 'authored' },
    evidence: { status: 'passed', detail: 'executed' },
    nativeValidation: { status: 'unverified', detail: 'validator unavailable' },
    nativeLifecycle: { status: 'unverified', detail: 'lifecycle not exercised' },
    workspace: '/removed',
    gates: [
      { name: 'agent-turn', passed: true, detail: 'completed' },
      { name: 'focused-skill-loaded', passed: true, detail: 'loader read' },
      { name: 'focused-workflow-acquired', passed: true, detail: 'workflow acquired' },
      { name: 'host-workflow-loaded', passed: true, detail: 'host guidance read' },
      { name: 'host-validation', passed: null, blockedBy: 'runtime-unavailable', detail: 'not run' },
    ],
    transcript: '',
    diagnostic: null,
    ...overrides,
  }
}

describe('evaluation reports', () => {
  it('preserves mixed verdicts and measurement coverage without changing results', async () => {
    const root = await fixture()
    const publicPath = await putJson(root, 'public.json', publicResult({
      model: 'provider/model-a',
      passed: false,
      gates: [
        { name: 'agent-turn-1', passed: true, detail: 'completed' },
        { name: 'focused-skill-loaded', passed: true, detail: 'loader read' },
        { name: 'focused-workflow-acquired', passed: false, detail: 'workflow response invalid' },
        { name: 'behavior', passed: false, detail: 'observable failure' },
      ],
      measurements: { durationMs: 12, usage: null, usageComplete: false },
    }))
    const nativePath = await putJson(root, 'native.json', nativeResult({
      model: 'provider/model-a',
      phaseMeasurements: {
        authoring: {
          durationMs: 20,
          usage: { input: 2, output: 3, cacheRead: 5, cacheWrite: 7, totalTokens: 17 },
          usageComplete: true,
        },
      },
    }))
    const manifestPath = await putJson(root, 'manifest.json', {
      expected: 3,
      model: 'provider/model-a',
      candidateHash: 'candidate-a',
      entries: [
        { kind: 'public', id: 'public-case', mode: 'workflow', attempts: [{ number: 1, resultPath: publicPath, code: 1, providerStatuses: [429], rateLimited: true }] },
        { kind: 'native', id: 'native-case', mode: 'revise', attempts: [{ number: 1, resultPath: nativePath, code: 2 }] },
        { kind: 'public', id: 'provider-case', mode: 'workflow', attempts: [{ number: 1, code: 1, providerStatuses: [429], rateLimited: true }] },
      ],
    })
    const before = [await digest(publicPath), await digest(nativePath), await digest(manifestPath)]

    const { parsed } = await report(['--manifest', manifestPath])

    expect(parsed.verdicts.public).toEqual({ passed: 0, failed: 1 })
    expect(parsed.verdicts.native).toEqual({ certified: 0, notCertified: 1 })
    expect(parsed.verdicts.nativeAspects.nativeValidation).toEqual({ passed: 0, failed: 0, unverified: 1, missing: 0 })
    expect(parsed.verdicts.blockedGates).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'host-validation', blockedBy: 'runtime-unavailable' }),
    ]))
    expect(parsed.interruptions).toEqual({ provider: 2, provisioning: 0, missingResult: 1 })
    expect(parsed.invocations[0]).toMatchObject({ providerInterrupted: true, missingResult: false, status: 'provider-interrupted' })
    expect(parsed.sources.map(source => ({ path: source.path, sha256: source.sha256 }))).toEqual(expect.arrayContaining([
      { path: publicPath, sha256: before[0] },
      { path: nativePath, sha256: before[1] },
      { path: manifestPath, sha256: before[2] },
    ]))
    expect(parsed.measurements).toMatchObject({
      eligibleResults: 2,
      measuredResults: 2,
      usageMeasuredResults: 1,
      completeUsageResults: 1,
      incompleteUsageResults: 1,
      durationMs: 32,
      nativePhaseCoverage: { authoring: 1, lifecycle: 0 },
    })
    expect(parsed.measurements.usage.totalTokens).toBe(17)
    expect(await Promise.all([digest(publicPath), digest(nativePath), digest(manifestPath)])).toEqual(before)
  })

  it('retains missing-result invocations and attempts without duplicate result counts', async () => {
    const root = await fixture()
    const failedPath = await putJson(root, 'failed.json', publicResult({
      caseId: 'repeated-case', passed: false, gates: [{ name: 'agent-turn-1', passed: false, detail: 'first attempt failed' }], model: 'provider/model-a',
    }))
    const passedPath = await putJson(root, 'passed.json', publicResult({ caseId: 'repeated-case' }))
    const manifestPath = await putJson(root, 'manifest.json', {
      expected: 2,
      model: 'provider/model-a',
      candidateHash: 'candidate-a',
      entries: [
        {
          kind: 'public', id: 'repeated-case', mode: 'workflow', attempts: [
            { number: 1, resultPath: failedPath, code: 1 },
            { number: 2, resultPath: passedPath, code: 0 },
            { number: 3, resultPath: passedPath, code: 0 },
          ],
        },
        {
          kind: 'native', id: 'provision-case', mode: 'create', attempts: [
            { number: 1, resultPath: join(root, 'not-created.json'), code: 1, provisioningFailed: true, provisioningError: 'archive unavailable' },
          ],
        },
      ],
    })

    const { parsed } = await report(['--manifest', manifestPath, '--result', passedPath, '--result', passedPath])

    expect(parsed.coverage).toMatchObject({ attempts: 4, results: 2, missingResults: 1, uniqueCaseModes: 1, attemptedCaseModes: 2 })
    expect(parsed.duplicates).toHaveLength(3)
    expect(parsed.invocations.at(-1)).toMatchObject({
      missingResult: true,
      provisioningInterrupted: true,
      status: 'provisioning-interrupted',
      recordedResultPaths: [join(root, 'not-created.json')],
    })
    expect(parsed.verdicts.public).toEqual({ passed: 1, failed: 1 })
    expect(parsed.groups.byCaseMode.find(group => group.key === 'public:repeated-case:workflow')).toMatchObject({ attempts: 3, results: 2 })
    expect(parsed.groups.byModelCandidate).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'model=provider/model-a;candidate=candidate-a', attempts: 4 }),
    ]))
    expect(parsed.results.find(result => result.path === passedPath)).toMatchObject({
      model: { value: 'provider/model-a', source: 'manifest' },
      candidate: { value: 'candidate-a', source: 'manifest' },
    })
  })

  it('separates guidance failures from unobserved and interrupted judgments', async () => {
    const root = await fixture()
    const publicPath = await putJson(root, 'guidance.json', publicResult({
      turns: [{}, {}],
      gates: [
        { name: 'agent-turn-1', passed: true, detail: 'completed' },
        { name: 'focused-skill-loaded', passed: true, detail: 'loader read' },
        { name: 'focused-workflow-acquired', passed: false, detail: 'workflow response invalid' },
        { name: 'agent-turn-2', passed: false, detail: 'provider ended turn' },
      ],
    }))
    const nativePath = await putJson(root, 'native.json', nativeResult({
      gates: [
        { name: 'agent-turn', passed: true, detail: 'completed' },
        { name: 'focused-skill-loaded', passed: null, blockedBy: 'transport', detail: 'loader judgment blocked' },
        { name: 'focused-workflow-acquired', passed: true, detail: 'combined workflow judgment' },
        { name: 'host-workflow-loaded', passed: true, detail: 'combined host judgment' },
        { name: 'lifecycle-host-sync-guidance', passed: true, detail: 'sync guidance read' },
        { name: 'lifecycle-host-archive-guidance', passed: false, detail: 'archive guidance not read' },
      ],
    }))
    const manifestPath = await putJson(root, 'manifest.json', {
      entries: [
        { kind: 'public', id: 'public-case', mode: 'workflow', attempts: [{ resultPath: publicPath }] },
        { kind: 'native', id: 'native-case', mode: 'revise', attempts: [{ resultPath: nativePath }] },
        { kind: 'public', id: 'provider-case', mode: 'workflow', attempts: [{ providerErrorStatuses: [429], rateLimited: true }] },
      ],
    })

    const { parsed } = await report(['--manifest', manifestPath])

    expect(parsed.guidance.loader.totals).toMatchObject({ eligible: 4, observed: 1, passed: 1, failed: 0, blocked: 1, unobserved: 1, interrupted: 1, failureRate: 0 })
    expect(parsed.guidance.workflow.totals).toMatchObject({ eligible: 4, observed: 2, passed: 1, failed: 1, blocked: 0, unobserved: 1, interrupted: 1, failureRate: 0.5 })
    expect(parsed.guidance.hostGuidance.totals).toMatchObject({ eligible: 3, observed: 3, passed: 2, failed: 1 })
    expect(parsed.guidance.loader.publicTurns).toMatchObject({ eligible: 2, observed: 1, unobserved: 1 })
    expect(parsed.guidance.loader.nativeCombined).toMatchObject({ eligible: 1, blocked: 1 })
    expect(parsed.guidance.judgments).toEqual(expect.arrayContaining([
      expect.objectContaining({ caseId: 'provider-case', granularity: 'invocation', dimension: 'workflow', outcome: 'interrupted' }),
      expect.objectContaining({ caseId: 'native-case', granularity: 'native-combined', dimension: 'workflow', outcome: 'passed' }),
    ]))
  })

  it('keeps acquisition observations separate from saved task success', async () => {
    const root = await fixture()
    const resultPath = await putJson(root, 'observed.json', publicResult({
      passed: true,
      observations: [
        { name: 'focused-integration-acquired', passed: false, detail: 'historical non-gating acquisition miss' },
      ],
    }))

    const { parsed } = await report(['--result', resultPath])

    expect(parsed.verdicts.public).toEqual({ passed: 1, failed: 0 })
    expect(parsed.integrationObservations).toMatchObject({ passed: 0, failed: 1, blocked: 0 })
    expect(parsed.integrationObservations.records[0]).toMatchObject({
      name: 'focused-integration-acquired', outcome: 'failed', detail: 'historical non-gating acquisition miss',
    })
    expect(parsed.guidance.hostGuidance.totals).toMatchObject({ eligible: 0, observed: 0, failureRate: null })
    const readable = await runProcess(process.execPath, ['--experimental-strip-types', reportEntrypoint, '--result', resultPath], { cwd: root, timeoutMs: 20_000 })
    expect(readable.code, readable.stderr).toBe(0)
    expect(readable.stdout).toContain('Non-gating acquisition observations: passed=0; failed=1; blocked=0')
    expect(readable.stdout).toContain('failure-rate=unavailable')
  })

  it('rejects unreadable, malformed, and unsupported explicit inputs actionably', async () => {
    const root = await fixture()
    const malformed = join(root, 'malformed.json')
    const unsupported = await putJson(root, 'unsupported.json', { caseId: 'unsupported' })
    await writeFile(malformed, '{not-json')

    for (const [flag, path, message] of [
      ['--result', join(root, 'missing.json'), 'cannot read result'],
      ['--result', malformed, 'malformed JSON'],
      ['--result', unsupported, 'unsupported evaluation result shape'],
      ['--manifest', unsupported, 'entries[].attempts[]'],
    ] as const) {
      const result = await runProcess(process.execPath, ['--experimental-strip-types', reportEntrypoint, flag, path, '--json'], { cwd: root, timeoutMs: 20_000 })
      expect(result.code).toBe(1)
      expect(result.stderr).toContain(message)
    }
  })
})
