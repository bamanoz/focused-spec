import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseUserDecision, runAuthoringDialogue } from '../evals/dialogue.ts'
import type { AgentDriver, AgentResult } from '../evals/types.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
const message = (text: string): AgentResult => ({ success: true, exitCode: 0, durationMs: 1,
  output: JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text }] } }),
})
async function fixture() {
  const workspace = await mkdtemp(join(tmpdir(), 'focused-dialogue-'))
  roots.push(workspace)
  const sessionDir = join(workspace, 'sessions')
  await mkdir(sessionDir)
  await writeFile(join(sessionDir, 'actor.jsonl'), '')
  await writeFile(join(workspace, 'spec.md'), 'old outcome')
  const snapshot = async () => {
    const files = new Map<string, string>()
    for (const path of ['spec.md', 'evidence.yaml']) {
      const content = await readFile(join(workspace, path), 'utf8').catch(() => undefined)
      if (content !== undefined) files.set(path, content)
    }
    return files
  }
  return { workspace, sessionDir, snapshot }
}
function scripted(steps: (() => Promise<AgentResult>)[]): AgentDriver {
  return { async run() {
    const step = steps.shift()
    if (step === undefined) throw new Error('unexpected extra dialogue turn')
    return step()
  } }
}

describe('authoring dialogue consent', () => {
  it('permits the confirmed revision without authorizing a different metadata file', async () => {
    const { workspace, sessionDir, snapshot } = await fixture()
    const driver = scripted([
      async () => message('I propose clarifying the blocked-login outcome in the existing scenario. Do you approve?'),
      async () => message(JSON.stringify({ reply: 'Yes, make that revision.', approvedPaths: ['spec.md'] })),
      async () => {
        await writeFile(join(workspace, 'spec.md'), 'approved outcome')
        await writeFile(join(workspace, 'evidence.yaml'), 'unapproved metadata')
        return message('Revision completed.')
      },
      async () => message(JSON.stringify({ reply: null, approvedPaths: [] })),
    ])
    const result = await runAuthoringDialogue({ workspace, sessionDir, skills: [], prompt: 'Clarify blocked login in spec.md.', timeoutMs: 1000 }, driver, snapshot, true)
    expect(result.completed).toBe(true)
    expect(result.unauthorizedPaths).toEqual(['evidence.yaml'])
    expect(await readFile(join(workspace, 'spec.md'), 'utf8')).toBe('approved outcome')
  })

  it('does not retroactively approve an edit made before the user response', async () => {
    const { workspace, sessionDir, snapshot } = await fixture()
    const driver = scripted([
      async () => {
        await writeFile(join(workspace, 'spec.md'), 'premature revision')
        return message('I propose updating spec.md. Do you approve?')
      },
      async () => message(JSON.stringify({ reply: 'Yes.', approvedPaths: ['spec.md'] })),
      async () => {
        await writeFile(join(workspace, 'spec.md'), 'later approved revision')
        return message('Done.')
      },
      async () => message(JSON.stringify({ reply: null, approvedPaths: [] })),
    ])
    const result = await runAuthoringDialogue({ workspace, sessionDir, skills: [], prompt: 'Clarify blocked login.', timeoutMs: 1000 }, driver, snapshot, true)
    expect(result.unauthorizedPaths).toEqual(['spec.md'])
  })

  it('fails unfinished dialogue at the turn limit instead of claiming completion', async () => {
    const { workspace, sessionDir, snapshot } = await fixture()
    const driver = scripted([
      async () => message('May I revise spec.md?'),
      async () => message(JSON.stringify({ reply: 'Yes.', approvedPaths: ['spec.md'] })),
    ])
    const result = await runAuthoringDialogue({ workspace, sessionDir, skills: [], prompt: 'Clarify blocked login.', timeoutMs: 1000 }, driver, snapshot, true, 1)
    expect(result.completed).toBe(false)
    expect(result.agent.success).toBe(false)
    expect(await readFile(join(workspace, 'spec.md'), 'utf8')).toBe('old outcome')
  })

  it('rejects approval without a user reply and paths escaping the workspace', () => {
    expect(() => parseUserDecision('{"reply":null,"approvedPaths":["spec.md"]}')).toThrow()
    expect(() => parseUserDecision('{"reply":"Yes","approvedPaths":["../spec.md"]}')).toThrow()
  })
})
