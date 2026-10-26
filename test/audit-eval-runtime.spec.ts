import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentDriver, EvalCase, EvalResult } from '../evals/types.ts'

const state = vi.hoisted(() => ({ repository: '', sandbox: '', workspaces: [] as string[] }))
vi.mock('../evals/provision.ts', () => ({
  evalRepositoryRoot: () => state.sandbox,
  readEvalPrompt: async () => 'The unchanged fixture request',
  provisionWorkspace: async (selected: EvalCase) => {
    const path = await mkdtemp(join(state.sandbox, 'workspace-'))
    state.workspaces.push(path)
    await cp(join(state.repository, 'evals/fixtures/polyglot'), path, { recursive: true })
    await mkdir(join(path, 'node_modules/focused-spec/guidance'), { recursive: true })
    await writeFile(join(path, 'node_modules/focused-spec/package.json'), JSON.stringify({ name: 'focused-spec', version: '0.9.0' }))
    await writeFile(join(path, 'node_modules/focused-spec/guidance/workflow.md'), '# Workflow\nUse exact evidence.\n')
    await mkdir(join(path, 'node_modules/focused-spec/dist'), { recursive: true })
    await writeFile(join(path, 'node_modules/focused-spec/dist/cli.js'), '#!/usr/bin/env node\n')
    if (selected.overlay !== undefined) await cp(join(state.repository, 'evals', selected.overlay), path, { recursive: true })
    return { path, finish: async () => {}, cleanup: async () => { await rm(path, { recursive: true, force: true }) } }
  },
}))

import { runEval } from '../evals/harness.ts'
import { runProcess } from '../evals/process.ts'

async function put(root: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}

async function savedResults(): Promise<{ path: string; bytes: string; result: EvalResult }[]> {
  const directory = join(state.sandbox, 'evals/results')
  const files = await readdir(directory)
  return Promise.all(files.map(async file => {
    const path = join(directory, file)
    const bytes = await readFile(path, 'utf8')
    return { path, bytes, result: JSON.parse(bytes) as EvalResult }
  }))
}

beforeEach(async () => {
  state.repository = fileURLToPath(new URL('..', import.meta.url))
  state.sandbox = await mkdtemp(join(tmpdir(), 'focused-audit-eval-runtime-'))
  state.workspaces = []
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(state.sandbox, { recursive: true, force: true })
})

function activatedTranscript(workspace: string): string {
  const response = { protocolVersion: 1, package: { name: 'focused-spec', version: '0.9.0' }, topic: 'workflow', content: '# Workflow\nUse exact evidence.\n' }
  return [
    { type: 'tool_execution_start', toolCallId: 'skill', toolName: 'read', args: { path: 'skill://focused-spec' } },
    { type: 'tool_execution_end', toolCallId: 'skill', toolName: 'read', result: { content: [{ type: 'text', text: '# focused-spec' }] } },
    { type: 'tool_execution_start', toolCallId: 'guidance', toolName: 'bash', args: { command: `node ${join(workspace, 'node_modules/focused-spec/dist/cli.js')} instructions --protocol 1 --topic workflow --json` } },
    { type: 'tool_execution_end', toolCallId: 'guidance', toolName: 'bash', result: { details: { exitCode: 0 }, content: [{ type: 'text', text: JSON.stringify(response) }] } },
  ].map(event => JSON.stringify(event)).join('\n')
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

async function eventuallyDead(pid: number): Promise<boolean> {
  for (let index = 0; index < 100 && alive(pid); index += 1) await new Promise(resolve => setTimeout(resolve, 20))
  return !alive(pid)
}

async function waitForFile(path: string): Promise<string> {
  for (let index = 0; index < 100; index += 1) {
    try { return await readFile(path, 'utf8') } catch { await new Promise(resolve => setTimeout(resolve, 20)) }
  }
  throw new Error('process did not announce its descendant')
}

describe('audit eval runtime boundaries', () => {
  it('preserves initial events across large eval transcripts', async () => {
    const prefix = 'required initial workflow event\n'
    const output = prefix + 'x'.repeat(1_100_000)
    const result = await runProcess(process.execPath, ['-e', `process.stdout.write(${JSON.stringify(prefix)} + 'x'.repeat(1100000))`], { cwd: state.sandbox, timeoutMs: 10_000 })
    expect(result.code).toBe(0)
    expect(result.stdout).toBe(output)
  })

  it('persists a thrown driver as a failed turn without claiming downstream success', async () => {
    const driver: AgentDriver = { async run() { throw Object.assign(new Error('driver transport failed'), { output: 'transcript captured before driver throw' }) } }
    const result = await runEval({ caseId: 'files-source-bootstrap' }, driver)
    expect(result.passed).toBe(false)
    expect(result.turns).toHaveLength(1)
    expect(result.turns[0]).toMatchObject({ success: false })
    expect(JSON.stringify(result)).toContain('driver transport failed')
    expect(result.turns[0]?.output).toContain('transcript captured before driver throw')
    expect(result.gates.some(gate => gate.name === 'focused-validation')).toBe(false)
    expect((await savedResults()).map(item => item.result)).toEqual([result])
    for (const workspace of state.workspaces) await expect(readFile(join(workspace, 'package.json'))).rejects.toThrow()
  })

  it('saves distinct immutable same-case results when the clock collides', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
    const driver = (output: string): AgentDriver => ({ async run() { return { success: false, output, exitCode: 17, durationMs: 1 } } })
    const first = await runEval({ caseId: 'files-source-bootstrap' }, driver('first captured transcript'))
    const original = (await savedResults())[0]!
    const second = await runEval({ caseId: 'files-source-bootstrap' }, driver('second captured transcript'))
    const artifacts = await savedResults()
    expect(artifacts).toHaveLength(2)
    expect(new Set(artifacts.map(item => item.path)).size).toBe(2)
    expect(await readFile(original.path, 'utf8')).toBe(original.bytes)
    expect(artifacts.map(item => item.result)).toEqual(expect.arrayContaining([first, second]))
  })

  it.each(['app/auth.py', 'auth/auth_test.go', 'tests/functional/test_auth.py', 'new-product.py'])
    ('stops a proposal modifying %s before an apply turn can restore it', async path => {
      let turns = 0
      let original = ''
      const driver: AgentDriver = {
        async run(request) {
          turns += 1
          if (turns === 1) {
            original = await readFile(join(request.workspace, path), 'utf8').catch(() => '')
            const addition = path.endsWith('.go') ? '\nfunc unauthorizedProposalImplementation() bool { return true }\n' : '\ndef unauthorized_proposal_implementation():\n    return True\n'
            await put(request.workspace, path, original + addition)
            const change = 'openspec/changes/add-blocked-account-focused-spec'
            for (const file of ['proposal.md', 'design.md', 'tasks.md', '.openspec.yaml']) await put(request.workspace, `${change}/${file}`, 'planning artifact')
            await put(request.workspace, `${change}/specs/auth/spec.md`, '## ADDED Requirements\n### Requirement: Authentication\n<!-- focused-spec:id=auth.blocked -->\n#### Scenario: Blocked account\n- **WHEN** blocked with valid credentials\n- **THEN** rejected\n')
          } else {
            if (original === '') await rm(join(request.workspace, path))
            else await put(request.workspace, path, original)
          }
          return { success: turns === 1, output: activatedTranscript(request.workspace), exitCode: turns === 1 ? 0 : 17, durationMs: 1 }
        },
      }
      const result = await runEval({ caseId: 'openspec-propose-apply' }, driver)
      expect(result.gates.find(gate => gate.name === 'focused-workflow-acquired')).toMatchObject({ passed: true })
      expect(result.gates.find(gate => gate.name === 'planning-boundary')).toMatchObject({ passed: false })
      expect(turns).toBe(1)
      expect(result.turns).toHaveLength(1)
      expect(result.passed).toBe(false)
    })

  it('terminates owned descendants on timeout and persists the captured failed transcript', async () => {
    const pidFile = join(state.sandbox, 'pids.json')
    const script = [
      "const { spawn } = require('node:child_process')",
      "const fs = require('node:fs')",
      "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' })",
      `fs.writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify([process.pid, child.pid]))`,
      "console.log('captured before timeout')",
      "console.error('stderr before timeout')",
      'setInterval(() => {}, 1000)',
    ].join(';')
    let pids: number[] = []
    const driver: AgentDriver = {
      async run(request) {
        const result = await runProcess(process.execPath, ['-e', script], { cwd: request.workspace, timeoutMs: 800 })
        return { success: result.code === 0, output: `${result.stdout}\n${result.stderr}`, exitCode: result.code, durationMs: result.durationMs }
      },
    }
    try {
      // Attach rejection handling immediately, so the pre-fix throw is an assertion failure rather than an unhandled rejection.
      const pending = runEval({ caseId: 'files-source-bootstrap' }, driver).then(result => ({ result }), error => ({ error }))
      pids = JSON.parse(await waitForFile(pidFile)) as number[]
      let timer: ReturnType<typeof setTimeout> | undefined
      const settled = await Promise.race([
        pending,
        new Promise<{ error: Error }>(resolve => { timer = setTimeout(() => resolve({ error: new Error('eval timeout did not settle') }), 5_000) }),
      ]).finally(() => { if (timer !== undefined) clearTimeout(timer) })
      expect(await eventuallyDead(pids[0]!)).toBe(true)
      expect(await eventuallyDead(pids[1]!)).toBe(true)
      expect(settled).toHaveProperty('result')
      if (!('result' in settled)) throw settled.error
      expect(settled.result.passed).toBe(false)
      expect(JSON.stringify(settled.result)).toContain('captured before timeout')
      expect(JSON.stringify(settled.result)).toContain('stderr before timeout')
      expect(settled.result.gates.some(gate => gate.name === 'focused-validation')).toBe(false)
      expect((await savedResults()).map(item => item.result)).toEqual([settled.result])
    } finally {
      if (pids.length === 0) pids = JSON.parse(await readFile(pidFile, 'utf8').catch(() => '[]')) as number[]
      for (const pid of pids.reverse()) if (alive(pid)) { try { process.kill(pid, 'SIGKILL') } catch {} }
      await Promise.all(pids.map(eventuallyDead))
    }
  }, 15_000)
})
