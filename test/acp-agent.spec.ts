import { describe, expect, it } from 'vitest'
import { grantsPlanApproval, parseElicitationDecision } from '../evals/acp-agent.ts'

const planSchema = { type: 'object', properties: { value: { type: 'string', enum: ['Approve and execute', 'Refine plan'] } } }

describe('genuine planning consent', () => {
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

  it('keeps host questions independent from runtime plan approval', () => {
    const approved = { value: 'Approve and execute', approvedPaths: ['agent-os/specs/login/shape.md'] }
    expect(grantsPlanApproval('Approve plan "login" and start implementation?', 'plan', approved)).toBe(true)
    expect(() => grantsPlanApproval('Do you have any visuals to reference?', 'plan', approved)).toThrow('only explicit plan approval')
    expect(() => grantsPlanApproval('Approve plan "login" and start implementation?', 'default', approved)).toThrow('only explicit plan approval')
    expect(grantsPlanApproval('Do you have any visuals to reference?', 'plan', { value: 'none', approvedPaths: [] })).toBe(false)
  })
})
