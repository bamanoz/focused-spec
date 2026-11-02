import { cp, mkdtemp, mkdir, readFile, rm, symlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentDriver } from '../evals/types.ts'
import { runEval } from '../evals/harness.ts'
import { createGuidanceSession, guidanceActivationGate, skillActivationGate } from '../evals/judge.ts'
import { evalCase } from '../evals/cases.ts'
import * as provisionModule from '../evals/provision.ts'
import { runProcess } from '../evals/process.ts'
import { roots, repository, WORKFLOW_GUIDANCE, put, installFocusedPackage, skillReadTranscript, guidanceTranscript, artifactGuidanceTranscript, activationFixture, openSpecSkillsFixture } from './fixtures/evals-suite.js'
import type { GuideTranscriptOptions } from './fixtures/evals-suite.js'

vi.mock('../evals/result.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../evals/result.ts')>()
  return {
    ...actual,
    async saveEvalResult(_directory: string, prefix: string, result: unknown) {
      const directory = await mkdtemp(join(tmpdir(), 'focused-eval-test-results-'))
      roots.push(directory)
      return actual.saveEvalResult(directory, prefix, result)
    },
  }
})
describe('agent eval harness', () => {
  it('rejects agent turns that never load the focused-spec skill', () => {
    expect(skillActivationGate(skillReadTranscript({ path: 'skill://openspec-propose' }))).toMatchObject({ passed: false })
    expect(skillActivationGate(skillReadTranscript({ path: 'skill://focused-spec/references/runners.md' }))).toMatchObject({ passed: false })
    expect(skillActivationGate(skillReadTranscript({ complete: false }))).toMatchObject({ passed: false })
    expect(skillActivationGate(skillReadTranscript({ failed: true }))).toMatchObject({ passed: false })
    expect(skillActivationGate(skillReadTranscript())).toMatchObject({ passed: true })
  })

  it('requires completed local workflow guidance after loader activation', async () => {
    const root = await activationFixture()
    expect(skillActivationGate(skillReadTranscript())).toMatchObject({ passed: true })
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { complete: false })])).toMatchObject({ passed: false })
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { failed: true })])).toMatchObject({ passed: false })
    expect(await guidanceActivationGate(root, [guidanceTranscript(root)])).toMatchObject({
      name: 'focused-workflow-acquired', passed: true,
    })
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root)])).toMatchObject({ passed: true })
    const rawCliOutput = '{"protocolVersion":1,"content":"# Workflow…[+5931]\n[raw output: artifact://0]\n\n\nWall time: 0.21 seconds'
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root, { rawCliOutput })])).toMatchObject({ passed: true })
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root, { rawCliOutput, readComplete: false })])).toMatchObject({ passed: false })
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root, { rawCliOutput, artifact: 'artifact://1' })])).toMatchObject({ passed: false })
    for (const transcript of [
      artifactGuidanceTranscript(root, { artifact: 'artifact://1' }),
      artifactGuidanceTranscript(root, { readBeforeCommand: true }),
      artifactGuidanceTranscript(root, { cliComplete: false }),
      artifactGuidanceTranscript(root, { cliFailed: true }),
      artifactGuidanceTranscript(root, { readComplete: false }),
      artifactGuidanceTranscript(root, { readFailed: true }),
      artifactGuidanceTranscript(root, { omitCommand: true }),
      artifactGuidanceTranscript(root, { rawArtifactOutput: '{"protocolVersion":1}' }),
      artifactGuidanceTranscript(root, { response: { protocolVersion: 1, package: { name: 'focused-spec', version: '0.6.0' },
        topic: 'workflow', content: '# Wrong workflow' } }),
    ]) expect(await guidanceActivationGate(root, [transcript])).toMatchObject({ passed: false })
  })

  it('resolves guidance with the evaluated driver executable search path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-driver-path-'))
    roots.push(root)
    await installFocusedPackage(root)
    await mkdir(join(root, 'node_modules/.bin'), { recursive: true })
    await symlink('../focused-spec/dist/cli.js', join(root, 'node_modules/.bin/focused-spec'))
    const args = ['instructions', '--protocol', '1', '--topic', 'workflow', '--json']
    const result = await runProcess('focused-spec', args, { cwd: root, timeoutMs: 30_000,
      env: { ...process.env, PATH: `${join(root, 'node_modules/.bin')}${delimiter}${process.env.PATH ?? ''}` } })
    expect(result.code).toBe(0)
    const response: unknown = JSON.parse(result.stdout)
    const command = `focused-spec ${args.join(' ')}`
    const transcript = artifactGuidanceTranscript(root, { response, command })
    expect(await guidanceActivationGate(root, [transcript])).toMatchObject({ passed: true })
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root, { response, command, artifact: 'artifact://1' })])).toMatchObject({ passed: false })
    const localNpx = `npx --no-install focused-spec ${args.join(' ')}`
    const npmResult = await runProcess('npx', ['--no-install', 'focused-spec', ...args], {
      cwd: root, timeoutMs: 30_000, env: { ...process.env, npm_config_offline: 'true' },
    })
    expect(npmResult.code, npmResult.stderr).toBe(0)
    const npmResponse: unknown = JSON.parse(npmResult.stdout)
    expect(await guidanceActivationGate(root, [artifactGuidanceTranscript(root, { response: npmResponse, command: localNpx })])).toMatchObject({ passed: true })
    for (const command of [localNpx.replace('--no-install ', ''), localNpx.replace('focused-spec ', 'focused-spec@latest '), `${localNpx} && echo done`]) {
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, { response: npmResponse, command })])).toMatchObject({ passed: false })
    }
    await rm(join(root, 'node_modules/.bin/focused-spec'))
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { response: npmResponse, command: localNpx })])).toMatchObject({ passed: false })
  })

  it('rejects chained guidance until a standalone request completes', async () => {
    const root = await activationFixture()
    const cli = `${JSON.stringify(process.execPath)} ${JSON.stringify(join(root, 'node_modules/focused-spec/dist/cli.js'))}`
    const combined = artifactGuidanceTranscript(root, { command: `${cli} --version && ${cli} instructions --protocol 1 --topic workflow --json` })
    expect(await guidanceActivationGate(root, [combined])).toMatchObject({ passed: false })
    expect(await guidanceActivationGate(root, [combined + '\n' + guidanceTranscript(root)])).toMatchObject({ passed: true })
  })

  it('accepts guidance from the selected installed CLI', async () => {
    const root = await activationFixture()
    const external = await activationFixture()
    const cli = join(external, 'node_modules/focused-spec/dist/cli.js')
    const version = '8.0.0'
    const content = '# Selected external workflow\n'
    await put(external, 'node_modules/focused-spec/package.json', JSON.stringify({ name: 'focused-spec', version }))
    await put(external, 'node_modules/focused-spec/guidance/workflow.md', content)
    const response = { protocolVersion: 1, package: { name: 'focused-spec', version }, topic: 'workflow', content }
    const args = 'instructions --protocol 1 --topic workflow --json'
    const direct = `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} ${args}`
    const bin = `${JSON.stringify(join(external, 'node_modules/.bin/focused-spec'))} ${args}`
    for (const command of [direct, bin]) {
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command, response })])).toMatchObject({ passed: true })
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command })])).toMatchObject({ passed: false })
    }
    await rm(join(root, 'node_modules/.bin/focused-spec'))
    const originalPath = process.env.PATH
    try {
      const binDirectory = join(external, 'node_modules/.bin')
      process.env.PATH = binDirectory
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: `focused-spec ${args}`, response })])).toMatchObject({ passed: true })
      await symlink(process.execPath, join(root, 'node_modules/.bin/focused-spec'))
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: `focused-spec ${args}`, response })])).toMatchObject({ passed: false })
    } finally {
      if (originalPath === undefined) delete process.env.PATH
      else process.env.PATH = originalPath
    }
    await rm(join(root, 'node_modules'), { recursive: true })
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: direct, response })])).toMatchObject({ passed: true })
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: direct, response, failed: true })])).toMatchObject({ passed: false })
  })

  it('rejects absent or legacy local guidance activation', async () => {
    const root = await activationFixture()
    expect(await guidanceActivationGate(root, [skillReadTranscript()])).toMatchObject({ passed: false })
    const cli = join(root, 'node_modules', 'focused-spec', 'dist', 'cli.js')
    const help = `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} --help`
    expect(await guidanceActivationGate(root, [guidanceTranscript(root, { command: help,
      rawOutput: 'Usage: focused-spec <command> [options]' })])).toMatchObject({ passed: false })
    await rm(join(root, 'node_modules', 'focused-spec', 'package.json'))
    expect(await guidanceActivationGate(root, [guidanceTranscript(root)])).toMatchObject({ passed: false })
  })

  it('rejects completed but unusable guidance responses', async () => {
    const root = await activationFixture()
    const valid = {
      protocolVersion: 1,
      package: { name: 'focused-spec', version: '0.6.0' },
      topic: 'workflow',
      content: WORKFLOW_GUIDANCE,
    }
    const invalid: GuideTranscriptOptions[] = [
      { rawOutput: '{not json}' },
      { response: { ...valid, protocolVersion: 2 } },
      { response: { ...valid, topic: 'runners' } },
      { response: { ...valid, package: { ...valid.package, name: 'other' } } },
      { response: { ...valid, package: { ...valid.package, version: '9.9.9' } } },
      { response: { ...valid, content: '  ' } },
      { response: { ...valid, extra: true } },
      { command: `${join(root, 'node_modules', '.bin', 'focused-spec')} agent-guide --protocol 1 --topic workflow --json` },
      { command: `${join(root, 'node_modules', '.bin', 'focused-spec')} instructions --help`,
        rawOutput: 'Usage: focused-spec instructions [options]' },
      { command: `${join(root, 'node_modules', '.bin', 'focused-spec')} instructions --protocol 1 --topic runners --json`,
        response: { ...valid, topic: 'runners' } },
    ]
    for (const options of invalid) {
      expect(await guidanceActivationGate(root, [guidanceTranscript(root, options)]), JSON.stringify(options)).toMatchObject({ passed: false })
    }
  })

  it('reuses unchanged guidance across a resumed approval dialogue', async () => {
    const root = await activationFixture()
    const sessionDir = join(root, '.authoring')
    const session = createGuidanceSession(root)
    const acquired = artifactGuidanceTranscript(root)
    await session.record({ sessionDir }, acquired)
    expect(session.verdict()).toMatchObject({ passed: true })
    await session.record({ sessionDir, resume: join(sessionDir, 'session.jsonl') }, '')
    expect(session.verdict()).toMatchObject({ passed: true })
    expect(session.observations).toEqual([expect.objectContaining({ name: 'focused-workflow-reacquired', passed: false,
      detail: expect.stringContaining('reuse allowed') })])
    await session.record({ sessionDir, resume: join(sessionDir, 'session.jsonl') }, acquired)
    expect(session.verdict()).toMatchObject({ passed: true })
    expect(session.observations[1]).toMatchObject({ passed: false })
    await session.record({ sessionDir, resume: join(sessionDir, 'session.jsonl') }, guidanceTranscript(root))
    expect(session.verdict()).toMatchObject({ passed: true })
    expect(session.observations[2]).toMatchObject({ passed: true })
  })

  it('invalidates retained guidance without retroactively rejecting an acquired version', async () => {
    for (const mutation of ['version', 'content', 'canonical', 'shadowed', 'missing'] as const) {
      const root = await activationFixture()
      const replacement = await activationFixture()
      const sessionDir = join(root, '.authoring')
      const initial = { sessionDir }
      const resumed = { sessionDir, resume: join(sessionDir, 'session.jsonl') }
      const args = 'instructions --protocol 1 --topic workflow --json'
      const command = mutation === 'shadowed' ? `focused-spec ${args}` : `${JSON.stringify(join(root, 'node_modules/.bin/focused-spec'))} ${args}`
      const old = guidanceTranscript(root, { command })
      const stale = createGuidanceSession(root)
      const refreshed = createGuidanceSession(root)
      await stale.record(initial, old)
      await refreshed.record(initial, old)
      const acquiredVerdict = refreshed.verdict()
      let version = '0.6.0'
      let content = WORKFLOW_GUIDANCE
      if (mutation === 'version') {
        version = '0.7.0'
        await put(root, 'node_modules/focused-spec/package.json', JSON.stringify({ name: 'focused-spec', version }))
      } else if (mutation === 'content') {
        content = '# Replacement workflow with unchanged version\n'
        await put(root, 'node_modules/focused-spec/guidance/workflow.md', content)
      } else if (mutation === 'canonical' || mutation === 'shadowed') {
        await rm(join(root, 'node_modules/.bin/focused-spec'))
        await symlink(join(replacement, 'node_modules/focused-spec/dist/cli.js'), join(root, 'node_modules/.bin/focused-spec'))
      } else {
        await rm(join(root, 'node_modules/focused-spec/package.json'))
      }
      await stale.record(resumed, '')
      expect(stale.verdict(), mutation).toMatchObject({ passed: false })
      expect(stale.observations[0], mutation).toMatchObject({ passed: false, detail: expect.stringContaining('invalidated') })
      expect(acquiredVerdict, mutation).toMatchObject({ passed: true })
      if (mutation === 'missing') await put(root, 'node_modules/focused-spec/package.json', JSON.stringify({ name: 'focused-spec', version }))
      await refreshed.record(resumed, guidanceTranscript(root, { command, response: {
        protocolVersion: 1, package: { name: 'focused-spec', version }, topic: 'workflow', content,
      } }))
      expect(refreshed.verdict(), mutation).toMatchObject({ passed: true })
      await refreshed.record(resumed, '')
      expect(refreshed.verdict(), mutation).toMatchObject({ passed: true })
    }
  })

  it('does not repair missing initial acquisition with a later read', async () => {
    const root = await activationFixture()
    const sessionDir = join(root, '.authoring')
    for (const first of ['', guidanceTranscript(root, { failed: true }), guidanceTranscript(root, { complete: false }),
      guidanceTranscript(root, { rawOutput: '{broken}' }), artifactGuidanceTranscript(root, { readComplete: false }),
      artifactGuidanceTranscript(root, { artifact: 'artifact://wrong' }), artifactGuidanceTranscript(root, { omitCommand: true })]) {
      const session = createGuidanceSession(root)
      await session.record({ sessionDir }, first)
      expect(session.verdict()).toMatchObject({ passed: false })
      await session.record({ sessionDir, resume: join(sessionDir, 'session.jsonl') }, guidanceTranscript(root))
      expect(session.verdict()).toMatchObject({ passed: false, detail: expect.stringContaining('execution 1') })
    }
  })

  it('requires independent acquisition for a fresh execution context', async () => {
    const root = await activationFixture()
    const sessionDir = join(root, '.authoring')
    for (const context of [{ sessionDir }, { sessionDir: join(root, '.publication'), resume: join(root, '.publication/session.jsonl') },
      { sessionDir, resume: join(sessionDir, 'different.jsonl') }, { resume: join(sessionDir, 'session.jsonl') },
      { sessionDir, resume: join(root, '.regeneration/session.jsonl') }]) {
      const session = createGuidanceSession(root)
      await session.record({ sessionDir }, guidanceTranscript(root))
      await session.record({ sessionDir, resume: join(sessionDir, 'session.jsonl') }, '')
      expect(session.verdict()).toMatchObject({ passed: true })
      await session.record(context, '')
      expect(session.verdict()).toMatchObject({ passed: false, detail: expect.stringContaining('fresh execution context') })
      const fresh = createGuidanceSession(root)
      await fresh.record(context, guidanceTranscript(root))
      expect(fresh.verdict()).toMatchObject({ passed: true })
    }
    const publication = createGuidanceSession(root)
    await publication.record({ sessionDir: join(root, '.publication') }, '')
    expect(publication.verdict()).toMatchObject({ passed: false })
  })

  it('rejects SDK-only BDD turns without skill and local workflow activation', async () => {
    for (const missing of ['focused-skill-loaded', 'focused-workflow-acquired'] as const) {
      const driver: AgentDriver = {
        async run(request) {
          const workflow = await runProcess(process.execPath, [join(request.workspace, 'node_modules/focused-spec/dist/cli.js'),
            'instructions', '--protocol', '1', '--topic', 'workflow', '--json'], { cwd: request.workspace, timeoutMs: 10_000 })
          expect(workflow.code, workflow.stderr).toBe(0)
          const output = [
            ...(missing === 'focused-skill-loaded' ? [] : [skillReadTranscript()]),
            guidanceTranscript(request.workspace, { rawOutput: workflow.stdout, complete: missing !== 'focused-workflow-acquired' }),
          ].join('\n')
          return { success: true, output, exitCode: 0, durationMs: 1 }
        },
      }
      const result = await runEval({ caseId: 'integration-standalone-typescript-sdk' }, driver)
      expect(result.gates.find(gate => gate.name === 'agent-turn-1')).toMatchObject({ passed: true })
      expect(result.passed).toBe(false)
      expect(result.gates.find(gate => gate.name === missing)).toMatchObject({ passed: false })
      expect(result.gates.some(gate => ['integration-composition', 'executable-application-sensitivity'].includes(gate.name))).toBe(false)
    }
  }, 540_000)

  it('exempts only editorial cleanup from per-turn skill and guidance activation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-eval-trigger-boundaries-'))
    roots.push(root)
    await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
    await installFocusedPackage(root)
    const sdk = join(root, 'node_modules/@focused-spec/scenarios-typescript')
    await mkdir(sdk, { recursive: true })
    await cp(join(repository, 'packages/sdk/typescript/dist'), join(sdk, 'dist'), { recursive: true })
    await cp(join(repository, 'packages/sdk/typescript/package.json'), join(sdk, 'package.json'))
    const provision = vi.spyOn(provisionModule, 'provisionWorkspace').mockResolvedValue({
      path: root,
      finish: async () => {},
      cleanup: async () => {},
    })
    try {
      const run = async (invalid?: { turn: number; missing: 'skill' | 'guidance' }) => {
        let turn = 0
        const driver: AgentDriver = {
          async run(request) {
            const current = turn++
            if (current === 0) {
              await put(request.workspace, 'guidance-task/editorial.md', '# Account status\n\nThe account is active.\n')
              return { success: true, output: '', exitCode: 0, durationMs: 1 }
            }
            if (current === 1) await put(request.workspace, 'guidance-task/requirement.md', '# Authentication\n\nA blocked account SHALL be rejected even with valid credentials.\n')
            if (current === 2) {
              const path = 'guidance-task/sdk/scenarios.mjs'
              const source = await readFile(join(request.workspace, path), 'utf8')
              const active = source.slice(source.indexOf('scenarios: ') + 'scenarios: '.length, source.lastIndexOf(' });'))
              const scenarios = [...(JSON.parse(active) as unknown[]), {
                id: 'auth.blocked', name: 'Blocked valid credentials are rejected',
                given: { blocked: true }, when: { credentialsValid: true }, expect: false,
              }]
              await put(request.workspace, path, `import { defineSuite } from '@focused-spec/scenarios-typescript';\nexport default defineSuite({ driver: './driver.mjs', scenarios: ${JSON.stringify(scenarios)} });\n`)
            }
            if (current === 3) await put(request.workspace, 'guidance-task/driver/driver.mjs', "import { authenticate } from '../application.mjs';\nexport default { given: value => value, when: (subject, command) => authenticate({ ...subject, ...command }) };\n")
            const workflow = await runProcess(process.execPath, [join(request.workspace, 'node_modules/focused-spec/dist/cli.js'),
              'instructions', '--protocol', '1', '--topic', 'workflow', '--json'], { cwd: request.workspace, timeoutMs: 10_000 })
            expect(workflow.code, workflow.stderr).toBe(0)
            const response = JSON.parse(workflow.stdout) as Record<string, unknown>
            const output = [
              ...(invalid?.turn === current && invalid.missing === 'skill' ? [] : [skillReadTranscript()]),
              guidanceTranscript(request.workspace, { response: invalid?.turn === current && invalid.missing === 'guidance'
                ? { ...response, content: 'wrong installed guidance' } : response }),
            ].join('\n')
            return { success: true, output, exitCode: 0, durationMs: 1 }
          },
        }
        return runEval({ caseId: 'guidance-skill-trigger-boundaries' }, driver)
      }
      const result = await run()
      expect(result.passed).toBe(true)
      expect(result.gates).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'focused-skill-not-required', passed: true }),
        expect.objectContaining({ name: 'guidance-editorial-outcome', passed: true }),
        expect.objectContaining({ name: 'focused-skill-loaded', passed: true }),
        expect.objectContaining({ name: 'focused-routed-guidance-acquired', passed: true }),
        expect.objectContaining({ name: 'guidance-sdd-outcome', passed: true }),
        expect.objectContaining({ name: 'guidance-sdk-outcome', passed: true }),
        expect.objectContaining({ name: 'guidance-driver-outcome', passed: true }),
      ]))
      expect(result.gates.filter(gate => gate.name === 'focused-routed-guidance-acquired')).toHaveLength(3)

      for (const turn of [1, 2, 3]) {
        for (const missing of ['skill', 'guidance'] as const) {
          const rejected = await run({ turn, missing })
          expect(rejected.passed, `${turn}: ${missing}`).toBe(false)
          expect(rejected.turns).toHaveLength(turn + 1)
          const gateName = missing === 'skill' ? 'focused-skill-loaded' : 'focused-routed-guidance-acquired'
          expect(rejected.gates.filter(gate => gate.name === gateName).at(-1)).toMatchObject({ passed: false })
          expect(rejected.gates.find(gate => gate.name === 'focused-skill-not-required')).toMatchObject({ passed: true })
          expect(rejected.gates.some(gate => gate.name === 'guidance-case-complete')).toBe(false)
        }
      }
    } finally {
      provision.mockRestore()
    }
  }, 120_000)

  it('stops an OpenSpec turn before judging artifacts if the agent skipped the skill', async () => {
    const driver: AgentDriver = {
      async run() {
        return { success: true, output: skillReadTranscript({ path: 'skill://openspec-propose' }), exitCode: 0, durationMs: 1 }
      },
    }
    const hostSkills = await openSpecSkillsFixture()
    const result = await runEval({ caseId: 'full-skill-routing', openspecSkillsDir: hostSkills }, driver)
    expect(result.passed).toBe(false)
    expect(result.gates.find(gate => gate.name === 'focused-skill-loaded')).toMatchObject({ passed: false })
    expect(result.gates.some(gate => ['proposal-artifacts', 'planning-boundary', 'planned-evidence', 'focused-validation'].includes(gate.name))).toBe(false)
  }, 480_000)

  it('exposes every competing skill without replacing candidate guidance and fails skipped activation', async () => {
    const source = await mkdtemp(join(tmpdir(), 'focused-eval-competing-'))
    roots.push(source)
    const document = '---\nname: diagnose\ndescription: Diagnose application failures.\n---\n\nRead references first.\n'
    await put(source, 'diagnose/SKILL.md', document)
    await put(source, 'diagnose/references/details.txt', 'diagnostic reference\n')
    await put(source, 'focused-spec/SKILL.md', 'untrusted replacement')
    let invoked = false
    const hostSkills = await openSpecSkillsFixture()
    const result = await runEval({ caseId: 'blind-skill-activation', openspecSkillsDir: hostSkills, competingSkillsDir: source }, {
      async run(request) {
        if (request.tools === '') return { success: true, output: '', exitCode: 0, durationMs: 0 }
        invoked = true
        expect(request.skills).toContain('diagnose')
        expect(request.skills).toContain('focused-spec')
        expect(request.skills).toContain('openspec-propose')
        expect(request.prompt).not.toMatch(/focused-spec|evidence/iu)
        expect(await readFile(join(request.workspace, '.omp/skills/diagnose/references/details.txt'), 'utf8')).toBe('diagnostic reference\n')
        expect(await readFile(join(request.workspace, '.omp/skills/focused-spec/SKILL.md'), 'utf8')).toBe(await readFile(join(request.workspace, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8'))
        return { success: true, output: skillReadTranscript({ path: 'skill://openspec-propose' }), exitCode: 0, durationMs: 1 }
      },
    })
    expect(invoked).toBe(true)
    expect(result.passed).toBe(false)
    expect(result.gates.find(gate => gate.name === 'focused-skill-loaded')).toMatchObject({ passed: false })
    expect(result.skillInventory?.find(skill => skill.name === 'diagnose')?.files).toEqual({
      'SKILL.md': createHash('sha256').update(document).digest('hex'),
      'references/details.txt': createHash('sha256').update('diagnostic reference\n').digest('hex'),
    })
  }, 480_000)

  it('refuses blind activation with an empty competing catalog rather than silently running the baseline', async () => {
    const source = await mkdtemp(join(tmpdir(), 'focused-eval-no-competing-'))
    roots.push(source)
    await expect(provisionModule.provisionWorkspace(evalCase('blind-skill-activation')!, await openSpecSkillsFixture(), source))
      .rejects.toThrow('at least one additional skill')
  }, 480_000)
})
