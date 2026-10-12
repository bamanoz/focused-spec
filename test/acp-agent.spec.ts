import { describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { grantsPlanApproval, parseElicitationDecision, readSubmittedPlan } from '../evals/acp-agent.ts'

const planSchema = { type: 'object', properties: { value: { type: 'string', enum: ['Approve and execute', 'Refine plan'] } } }

describe('genuine planning consent', () => {
  it('approves the current submitted file after edits and rejects unavailable resources', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-plan-resource-'))
    try {
      const path = join(root, 'login-plan.md')
      await writeFile(path, 'Document `agent-os/specs/login/shape.md`; companion resources are pending.')
      const resources = new Map([['local://login-plan.md', path]])
      const approvedPaths = ['agent-os/specs/login/references.md']
      const decision = JSON.stringify({ value: 'Approve and execute', approvedPaths })
      const initial = await readSubmittedPlan('login', resources)
      expect(() => parseElicitationDecision(decision, planSchema, '', initial)).toThrow('proposed')
      await writeFile(path, 'Create `agent-os/specs/login/references.md` with existing references.')
      const current = await readSubmittedPlan('login/Login Authoring', resources)
      expect(parseElicitationDecision(decision, planSchema, '', current)).toEqual({ value: 'Approve and execute', approvedPaths })
      await rm(path)
      await expect(readSubmittedPlan('login', resources)).rejects.toThrow()
      await expect(readSubmittedPlan('other', resources)).rejects.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('accepts only explicit proposed-path consent and preserves cancellation or refinement', () => {
    const proposed = 'Create agent-os/specs/login/shape.md and .focused-spec/evidence.yaml'
    expect(parseElicitationDecision('{"value":"Approve and execute","approvedPaths":["agent-os/specs/login/shape.md"]}', planSchema, proposed))
      .toEqual({ value: 'Approve and execute', approvedPaths: ['agent-os/specs/login/shape.md'] })
    expect(parseElicitationDecision('{"value":null,"approvedPaths":[]}', planSchema, proposed).value).toBeNull()
    expect(parseElicitationDecision('{"value":"Refine plan","approvedPaths":[]}', planSchema, proposed).value).toBe('Refine plan')
    expect(() => parseElicitationDecision('{"value":"yes","approvedPaths":[]}', planSchema, proposed)).toThrow('schema')
    expect(() => parseElicitationDecision('{"value":"Approve and execute","approvedPaths":["other.md"]}', planSchema, proposed)).toThrow('proposed')
    expect(() => parseElicitationDecision('{"value":null,"approvedPaths":["agent-os/specs/login/shape.md"]}', planSchema, proposed)).toThrow()
    expect(() => parseElicitationDecision('{"value":"Approve and execute","approvedPaths":["../shape.md"]}', planSchema, proposed)).toThrow()
    const confirmSchema = { type: 'object', properties: { value: { type: 'boolean' } } }
    expect(() => parseElicitationDecision('{"value":false,"approvedPaths":["agent-os/specs/login/shape.md"]}', confirmSchema, proposed)).toThrow()
  })

  it.each([
    'other/agent-os/specs/login/shape.md',
    'prefix-agent-os/specs/login/shape.md',
    'agent-os/specs/login/shape.md.backup',
    'agent-os/specs/login/shape.md/child',
  ])('rejects consent for a partial proposed path inside %s', proposedPath => {
    const approvedPath = 'agent-os/specs/login/shape.md'
    const decision = JSON.stringify({ value: 'Approve and execute', approvedPaths: [approvedPath] })
    expect(() => parseElicitationDecision(decision, planSchema, `Create \`${proposedPath}\`.`)).toThrow('proposed')
    expect(() => parseElicitationDecision(decision, planSchema, '', `Create \`${proposedPath}\`.`)).toThrow('proposed')
    expect(parseElicitationDecision(decision, planSchema, `Create \`${approvedPath}\`.`).approvedPaths).toEqual([approvedPath])
    expect(parseElicitationDecision(decision, planSchema, '', `Create \`${approvedPath}\`.`).approvedPaths).toEqual([approvedPath])
  })

  it('recognizes exact companion paths from the authoritative submitted plan', () => {
    const submittedPlan = [
      'Create the Agent OS specification at `agent-os/specs/2026-10-09-1200-blocked-login/shape.md` for the single outcome: an account blocked by an administrator cannot log in even with valid credentials.',
      'Create `agent-os/specs/2026-10-09-1200-blocked-login/` and write `shape.md` as the canonical native behavioral item.',
      'Write `plan.md` in that same folder as a compact copy of these two execution tasks, `standards.md` stating no project-specific standards apply, and `references.md` identifying `auth.Authenticate` with `TestBlockedAccount` and `app.auth.authenticate` with `test_blocked_account`, including their exact true/valid input and false result.',
      'Create `.focused-spec/evidence.yaml` with exactly the required evidence.',
    ].join('\n\n')
    const approvedPaths = [
      'agent-os/specs/2026-10-09-1200-blocked-login/shape.md',
      'agent-os/specs/2026-10-09-1200-blocked-login/plan.md',
      'agent-os/specs/2026-10-09-1200-blocked-login/standards.md',
      'agent-os/specs/2026-10-09-1200-blocked-login/references.md',
      '.focused-spec/evidence.yaml',
    ]
    const decision = JSON.stringify({ value: 'Approve and execute', approvedPaths })

    expect(parseElicitationDecision(decision, planSchema, 'Approve plan "blocked-login-spec"…', submittedPlan))
      .toEqual({ value: 'Approve and execute', approvedPaths })
    expect(() => parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths: [
      'agent-os/specs/other/references.md',
    ] }), planSchema, submittedPlan, submittedPlan)).toThrow('agent-os/specs/other/references.md')
    expect(() => parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths: [
      'agent-os/specs/2026-10-09-1200-blocked-login/plan.md',
    ] }), planSchema, 'The assistant mentioned `plan.md`.', '')).toThrow('proposed')
    const redirectedPlan = `${submittedPlan}\n\nCreate \`agent-os/specs/other/\`.\n\nWrite \`extra.md\` in that same folder.`
    expect(() => parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths: [
      'agent-os/specs/2026-10-09-1200-blocked-login/extra.md',
    ] }), planSchema, '', redirectedPlan)).toThrow('proposed')
    expect(parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths: [
      'agent-os/specs/other/extra.md',
    ] }), planSchema, '', redirectedPlan).approvedPaths).toEqual(['agent-os/specs/other/extra.md'])
  })

  it('authorizes compact companion lists only within their explicit directory', () => {
    const submittedPlan = 'Create `agent-os/specs/login/plan.md`, `shape.md`, `standards.md`, and `references.md` together before integration.'
    const approvedPaths = ['agent-os/specs/login/plan.md', 'agent-os/specs/login/shape.md', 'agent-os/specs/login/standards.md', 'agent-os/specs/login/references.md']
    expect(parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths }), planSchema, 'Approve plan "login"…', submittedPlan))
      .toEqual({ value: 'Approve and execute', approvedPaths })
    const folderPlan = 'Create `agent-os/specs/login/`. Create the following native files once.\n\nWrite native `plan.md` with authoring tasks.\n\nWrite `shape.md` as the outcome.\n\nWrite `standards.md` with applicable standards.\n\nWrite `references.md` with existing tests.'
    expect(parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths }), planSchema, '', folderPlan))
      .toEqual({ value: 'Approve and execute', approvedPaths })
    expect(() => parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths: ['agent-os/specs/login/unmentioned.md'] }), planSchema, '', folderPlan)).toThrow('proposed')
    for (const path of ['agent-os/specs/other/references.md', 'agent-os/specs/login/unmentioned.md']) {
      expect(() => parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths: [path] }), planSchema, '', submittedPlan)).toThrow('proposed')
    }
    const ambiguous = 'Create `agent-os/specs/login/plan.md`, `agent-os/specs/other/shape.md`, and `standards.md` together.'
    expect(() => parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths: ['agent-os/specs/login/standards.md'] }), planSchema, '', ambiguous)).toThrow('proposed')
  })

  it('resolves listed companions only in an unambiguous requested folder', () => {
    const plan = '# Plan\n\n## Context\nCreate `agent-os/specs/login/shape.md` for the accepted outcome.\n\nCreate the requested folder. Save these native files:\n\n1. `shape.md` with the accepted outcome.\n\n2. `standards.md` with applicable standards.\n\n3. `references.md` with existing code references.'
    const approvedPaths = ['agent-os/specs/login/standards.md', 'agent-os/specs/login/references.md']
    const decision = JSON.stringify({ value: 'Approve and execute', approvedPaths })
    expect(parseElicitationDecision(decision, planSchema, '', plan)).toEqual({ value: 'Approve and execute', approvedPaths })
    const specifiedFolder = plan.replace('the requested folder', 'the exact user-specified folder')
    expect(parseElicitationDecision(decision, planSchema, '', specifiedFolder)).toEqual({ value: 'Approve and execute', approvedPaths })
    const payloads = '# Plan\n\n## Context\nCreate `agent-os/specs/login/shape.md`.\n\n## Approach\n### Task 1: Save spec documentation\nAfter runtime approval, create the requested folder. Save `plan.md` as the approved plan.\n\n`standards.md`:\n\n```markdown\nNo applicable standards.\n```\n\n`references.md`:\n\n```markdown\nExisting implementation references.\n```'
    expect(parseElicitationDecision(decision, planSchema, '', payloads)).toEqual({ value: 'Approve and execute', approvedPaths })
    expect(() => parseElicitationDecision(decision, planSchema, '', payloads.replace('Create `agent-os/specs/login/shape.md`.', 'Create `agent-os/specs/login/shape.md` and `agent-os/specs/other/shape.md`.'))).toThrow('proposed')
    const exactContents = payloads.replaceAll(/`(standards|references)\.md`:/gu, 'Exact `$1.md` contents:') + '\n### Task 2: Bind existing evidence\nCreate `.focused-spec/evidence.yaml`.'
    expect(parseElicitationDecision(decision, planSchema, '', exactContents)).toEqual({ value: 'Approve and execute', approvedPaths })
    expect(() => parseElicitationDecision(decision, planSchema, '', exactContents.replace('Create `agent-os/specs/login/shape.md`.', 'Create `agent-os/specs/login/shape.md` and `agent-os/specs/other/shape.md`.'))).toThrow('proposed')
    const nestedFolder = payloads.replace('After runtime approval, create the requested folder.', 'After runtime approval, create `agent-os/specs/login/` and an empty `visuals/` subdirectory.')
    expect(parseElicitationDecision(decision, planSchema, '', nestedFolder)).toEqual({ value: 'Approve and execute', approvedPaths })
    expect(() => parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths: ['visuals/standards.md'] }), planSchema, '', nestedFolder)).toThrow('proposed')
    const explicitFileContext = payloads.replace('Create `agent-os/specs/login/shape.md`.', 'Author `agent-os/specs/login/shape.md`.').replace('After runtime approval, create the requested folder. Save `plan.md` as the approved plan.', 'Create `agent-os/specs/login/plan.md` from the approved plan.')
    expect(parseElicitationDecision(decision, planSchema, '', explicitFileContext)).toEqual({ value: 'Approve and execute', approvedPaths })
    expect(() => parseElicitationDecision(decision, planSchema, '', explicitFileContext.replace('Create `agent-os/specs/login/plan.md`', 'Create `agent-os/specs/login/plan.md` and `agent-os/specs/other/plan.md`'))).toThrow('proposed')
    const sentences = plan.slice(0, plan.indexOf('1. `shape.md`')) + 'Save `plan.md` as the approved plan. Save `standards.md` with paragraph `No applicable standards.` Save `references.md` with existing code references.'
    expect(parseElicitationDecision(decision, planSchema, '', sentences)).toEqual({ value: 'Approve and execute', approvedPaths })
    const compactLines = plan.replace(/\n\n(?=\d+\.)/gu, '\n')
    expect(parseElicitationDecision(decision, planSchema, '', compactLines)).toEqual({ value: 'Approve and execute', approvedPaths })
    const ambiguous = plan.replace('for the accepted outcome.', 'and `agent-os/specs/other/shape.md` for separate outcomes.')
    expect(() => parseElicitationDecision(decision, planSchema, '', ambiguous)).toThrow('proposed')
    expect(() => parseElicitationDecision(decision, planSchema, '', ambiguous.replace('the requested folder', 'the exact user-specified folder'))).toThrow('proposed')
    for (const path of ['agent-os/specs/other/references.md', 'agent-os/specs/login/unmentioned.md']) {
      expect(() => parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths: [path] }), planSchema, '', plan)).toThrow('proposed')
    }
    expect(() => parseElicitationDecision(decision, planSchema, '', 'Save these native files:\n\n1. `standards.md`\n\n2. `references.md`')).toThrow('proposed')
    const quoted = plan.replace('3. `references.md` with existing code references.', '```markdown\n\n3. `references.md` is an example, not a requested file.\n\n```')
    expect(() => parseElicitationDecision(JSON.stringify({ value: 'Approve and execute', approvedPaths: ['agent-os/specs/login/references.md'] }), planSchema, '', quoted)).toThrow('proposed')
  })

  it('keeps host questions independent from runtime plan approval', () => {
    const approved = { value: 'Approve and execute', approvedPaths: ['agent-os/specs/login/shape.md'] }
    expect(grantsPlanApproval('Approve plan "login" and start implementation?', 'plan', approved)).toBe(true)
    expect(() => grantsPlanApproval('Do you have any visuals to reference?', 'plan', approved)).toThrow('only explicit plan approval')
    expect(() => grantsPlanApproval('Approve plan "login" and start implementation?', 'default', approved)).toThrow('only explicit plan approval')
    expect(grantsPlanApproval('Do you have any visuals to reference?', 'plan', { value: 'none', approvedPaths: [] })).toBe(false)
  })
})
