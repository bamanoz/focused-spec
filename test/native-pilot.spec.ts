import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { agentEvidenceGate, creationGate, evidenceGate, hostPrerequisiteGate, hostWorkflowGate, hostWriteConstraintGate, judged } from '../evals/native-pilot.ts'

const roots: string[] = []

function readTranscript(path: string, isError = false): string {
  return [
    JSON.stringify({ type: 'tool_execution_start', toolCallId: 'read-1', toolName: 'read', args: { path } }),
    JSON.stringify({ type: 'tool_execution_end', toolCallId: 'read-1', toolName: 'read', isError,
      result: { content: [{ type: 'text', text: isError ? 'Path not found' : 'Applicable host instructions' }] } }),
  ].join('\n')
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('native pilot evaluation boundaries', () => {
  it('recognizes a successful ranged workflow read without crediting failed reads or lookalike resources', () => {
    expect(hostWorkflowGate('gsd', readTranscript('.pi/gsd-core/workflows/new-project.md:1-150'), true).passed).toBe(true)
    expect(hostWorkflowGate('gsd', readTranscript('.pi/gsd-core/workflows/new-project.md', true), true).passed).toBe(false)
    expect(hostWorkflowGate('gsd', readTranscript('.pi/gsd-core/workflows/new-project.md.backup'), true).passed).toBe(false)
    expect(hostWorkflowGate('gsd', JSON.stringify({ type: 'tool_execution_start', toolCallId: 'read-1', toolName: 'read',
      args: { path: '.pi/gsd-core/workflows/new-project.md' } }), true).passed).toBe(false)
  })

  it('accepts only completed reads of applicable Spec Kit authoring guidance', () => {
    expect(hostWorkflowGate('spec-kit', readTranscript('skill://speckit-specify')).passed).toBe(true)
    expect(hostWorkflowGate('spec-kit', readTranscript('.omp/skills/speckit-specify/SKILL.md:1-160')).passed).toBe(true)
    expect(hostWorkflowGate('spec-kit', readTranscript('.omp/commands/speckit.specify.md:raw')).passed).toBe(true)
    expect(hostWorkflowGate('spec-kit', readTranscript('.specify/templates/spec-template.md')).passed).toBe(true)
    expect(hostWorkflowGate('spec-kit', readTranscript('skill://focused-spec')).passed).toBe(false)
    expect(hostWorkflowGate('spec-kit', readTranscript('.omp/commands/speckit.plan.md')).passed).toBe(false)
    expect(hostWorkflowGate('spec-kit', readTranscript('.omp/skills/speckit-specify/SKILL.md.backup')).passed).toBe(false)
    expect(hostWorkflowGate('spec-kit', readTranscript('skill://speckit-specify', true)).passed).toBe(false)
    expect(hostWorkflowGate('spec-kit', JSON.stringify({ type: 'tool_execution_start', toolCallId: 'read-1', toolName: 'read',
      args: { path: 'skill://speckit-specify' } })).passed).toBe(false)
  })

  it('requires the official BMad workflow even when integration guidance is loaded', () => {
    expect(hostWorkflowGate('bmad', readTranscript('skill://bmad-focused-spec-integration')).passed).toBe(false)
    expect(hostWorkflowGate('bmad', readTranscript('.omp/skills/bmad-focused-spec-integration/SKILL.md:raw')).passed).toBe(false)
    expect(hostWorkflowGate('bmad', readTranscript('skill://bmad-spec')).passed).toBe(true)
    expect(hostWorkflowGate('bmad', readTranscript('skill://focused-spec')).passed).toBe(false)
    expect(hostWorkflowGate('bmad', readTranscript('skill://bmad-focused-spec-integration', true)).passed).toBe(false)
  })

  it('accepts denial wording only for one unmarked atomic BMad CAP-1 outcome', () => {
    const generated = [
      '---',
      'id: SPEC-blocked-login',
      'companions: []',
      'sources: []',
      '---',
      '',
      '> **Canonical contract.** This SPEC and the files in `companions:` are the complete contract for what to build, test, and validate.',
      '',
      '# Blocked login',
      '',
      '## Why',
      '',
      'An administrator-blocked account must not regain access merely because its credentials are valid.',
      '',
      '## Capabilities',
      '',
      '- **CAP-1**',
      '  - **intent:** The system denies login to an account blocked by an administrator, even with valid credentials.',
      '  - **success:** Authentication returns denial when the account is blocked and the supplied credentials are valid.',
      '',
      '## Constraints',
      '',
      '- Administrator block status overrides valid credentials in the login decision.',
      '',
      '## Non-goals',
      '',
      '- Changing credential verification or login policy for accounts that are not blocked.',
      '',
      '## Success signal',
      '',
      '- Existing Go and Python authentication tests both observe denial for a blocked account with valid credentials.',
      '',
    ].join('\n')
    const duplicate = `${generated}\n- **CAP-1**\n  - **intent:** Reject blocked login.\n  - **success:** A blocked account with valid credentials receives denial.\n`

    expect(creationGate('bmad', generated).passed).toBe(true)
    expect(creationGate('bmad', generated.replace(' and the supplied credentials are valid.', '.')).passed).toBe(false)
    expect(creationGate('bmad', generated.replace('returns denial', 'returns an outcome')).passed).toBe(false)
    expect(creationGate('bmad', duplicate).passed).toBe(false)
    expect(creationGate('bmad', generated.replace('- **CAP-1**', '<!-- focused-spec:id=auth.login.blocked-account -->\n- **CAP-1**')).passed).toBe(false)
  })

  it('accepts the bound native outcome without requiring hidden host headings', () => {
    const identity = '<!-- focused-spec:id=account.login.blocked -->'
    const requirement = [
      '## ADDED Requirements', identity,
      '### Requirement: Administrator-blocked accounts cannot log in',
      'An account blocked by an administrator MUST be denied login even when its credentials are valid.',
      '', '#### Scenario: Blocked account presents valid credentials',
      '- **WHEN** the blocked account attempts login with valid credentials',
      '- **THEN** authentication is denied',
    ].join('\n')
    const shape = [
      '# Blocked Login — Shaping Notes', '', '## Scope',
      'Document the existing login rule.', '', identity,
      '### Blocked account with valid credentials cannot log in',
      'Given an administrator-blocked account, when it presents valid credentials, authentication is denied.',
      '', '## Decisions', '- Preserve existing product behavior.', '', '## Context', 'Existing authentication tests.',
    ].join('\n')
    expect(creationGate('agent-os', shape.replace('## Decisions', '## Requirement'))).toMatchObject({ passed: true })
    const paragraph = `${identity}\nAn account blocked by an administrator must not log in even when its credentials are valid.`
    const paragraphShape = shape.replace(`${identity}\n### Blocked account with valid credentials cannot log in\nGiven an administrator-blocked account, when it presents valid credentials, authentication is denied.`, paragraph)
    expect(creationGate('agent-os', paragraphShape)).toMatchObject({ passed: true })
    expect(creationGate('agent-os', paragraphShape.replace('must not log in', 'may log in'))).toMatchObject({ passed: false })
    for (const [host, source] of [['openspec', requirement], ['agent-os', shape]] as const) {
      expect(creationGate(host, source)).toMatchObject({ passed: true })
      expect(creationGate(host, source.replace(identity, ''))).toMatchObject({ passed: false })
      expect(creationGate(host, source.replace(identity, '').replace('## Context', `${identity}\n## Context`)
        .replace('### Requirement:', `${identity}\n### Requirement: Unrelated result\nThe active account is accepted.\n\n### Requirement:`)))
        .toMatchObject({ passed: false })
      expect(creationGate(host, `${source}\n${identity}\n### Another blocked result\nValid credentials are denied.\n`))
        .toMatchObject({ passed: false })
      expect(creationGate(host, source.replace(/valid credentials|credentials are valid/gu, 'credentials')))
        .toMatchObject({ passed: false })
    }
  })

  it('requires applicable authoring guidance rather than project implementation or initialization for revisions', () => {
    expect(hostWorkflowGate('openspec', readTranscript('skill://openspec-update-change')).passed).toBe(true)
    expect(hostWorkflowGate('openspec', readTranscript('skill://openspec-apply-change')).passed).toBe(false)
    expect(hostWorkflowGate('openspec', readTranscript('skill://openspec-propose'), true).passed).toBe(true)
    expect(hostWorkflowGate('openspec', readTranscript('skill://openspec-apply-change'), true).passed).toBe(false)
    expect(hostWorkflowGate('gsd', readTranscript('.pi/gsd-core/templates/requirements.md:raw')).passed).toBe(true)
    expect(hostWorkflowGate('gsd', readTranscript('.pi/gsd-core/workflows/new-project.md')).passed).toBe(false)
    expect(hostWorkflowGate('gsd', readTranscript('skill://gsd-requirements')).passed).toBe(true)
  })

  it('does not label a test as unexecuted when no valid evidence binding selected it', () => {
    const transcript = [
      JSON.stringify({ type: 'tool_execution_start', toolCallId: 'direct-go', toolName: 'bash',
        args: { command: "go test ./auth -run '^TestBlockedAccount$' -count=1" } }),
      JSON.stringify({ type: 'tool_execution_end', toolCallId: 'direct-go', toolName: 'bash',
        result: { content: [{ type: 'text', text: 'ok example.com/auth 0.2s' }] } }),
    ].join('\n')
    const blocked = agentEvidenceGate(transcript, [])
    expect(blocked).toMatchObject({ passed: null, blockedBy: 'evidence-only-registry' })
    expect(judged([blocked], ['agent-executed-selected-evidence']).status).toBe('unverified')
    expect(agentEvidenceGate(transcript, ['go-test::./auth::TestBlockedAccount']).passed).toBe(true)
    expect(agentEvidenceGate(transcript, ['pytest::tests/functional/test_auth.py::test_blocked_account']).passed).toBe(false)
  })

  it('recognizes completed selected CLI evidence without crediting validation or failed commands', () => {
    const reference = 'go-test::./auth::TestBlockedAccount'
    const events = (command: string, output: string, failed = false) => [
      JSON.stringify({ type: 'tool_execution_start', toolCallId: 'execution', toolName: 'bash', args: { command } }),
      JSON.stringify({ type: 'tool_execution_end', toolCallId: 'execution', toolName: 'bash', isError: failed,
        result: { content: [{ type: 'text', text: output }] } }),
    ].join('\n')
    const output = `PASS account.access.blocked\n  PASS ${reference}\nsummary: 1 PASS, 0 FAIL, 0 SKIP, 0 ERROR; 1 unique targets\n`
    expect(agentEvidenceGate(events('focused-spec run --scope current', output), [reference]).passed).toBe(true)
    expect(agentEvidenceGate(events('focused-spec validate --strict', output), [reference]).passed).toBe(false)
    expect(agentEvidenceGate(events('focused-spec run', output, true), [reference]).passed).toBe(false)
    expect(agentEvidenceGate(events('echo focused-spec run', output), [reference]).passed).toBe(false)
    expect(agentEvidenceGate(events('focused-spec run', output), ['pytest::tests/functional/test_auth.py::test_blocked_account']).passed).toBe(false)
    const jsonOutput = JSON.stringify({ success: true, executionStarted: true, scenarios: [{ evidence: [{ reference, status: 'PASS' }] }] })
    expect(agentEvidenceGate(events('node node_modules/focused-spec/dist/cli.js run --json', jsonOutput), [reference]).passed).toBe(true)
    expect(agentEvidenceGate(JSON.stringify({ type: 'tool_execution_start', toolCallId: 'execution', toolName: 'bash', args: { command: 'focused-spec run' } }), [reference]).passed).toBe(false)
  })

  it('does not certify authoring when genuine plan mode is unavailable', () => {
    const agentOs = hostPrerequisiteGate('agent-os')
    expect(agentOs).toMatchObject({ passed: null, blockedBy: 'host-plan-mode-and-confirmation' })
    expect(hostPrerequisiteGate('openspec')).toBeNull()
    expect(hostPrerequisiteGate('gsd')).toBeNull()
    expect(judged([agentOs!], ['host-authoring-prerequisites']).status).toBe('unverified')
    expect(judged([agentOs!, { name: 'host-write-constraints', passed: false, detail: 'unauthorized edit' }],
      ['host-authoring-prerequisites', 'host-write-constraints']).status).toBe('failed')
  })

  it('detects unapproved native revisions and newly created auxiliary evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-consent-'))
    roots.push(root)
    await mkdir(join(root, 'openspec'))
    await mkdir(join(root, '.focused-spec'))
    const path = 'openspec/spec.md'
    const original = 'Existing acceptance outcome'
    const before = new Map([[path, original]])
    await writeFile(join(root, path), original)
    expect((await hostWriteConstraintGate(root, 'openspec', before)).passed).toBe(true)
    await writeFile(join(root, path), 'Unapproved revised acceptance outcome')
    expect((await hostWriteConstraintGate(root, 'openspec', before)).passed).toBe(false)
    await writeFile(join(root, path), original)
    await writeFile(join(root, '.focused-spec/evidence.yaml'), 'scopes: {}')
    expect((await hostWriteConstraintGate(root, 'openspec', before)).passed).toBe(false)
    await rm(join(root, '.focused-spec/evidence.yaml'))
    expect((await hostWriteConstraintGate(root, 'openspec', before)).passed).toBe(true)
    await rm(join(root, path))
    expect((await hostWriteConstraintGate(root, 'openspec', before)).passed).toBe(false)
  })

  it('accepts only production registry data bound to the actual native item', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-registry-'))
    roots.push(root)
    await mkdir(join(root, '.focused-spec'))
    const source = '<!-- focused-spec:id=auth.login.blocked-account -->\n#### Scenario: Blocked login\n'
    const path = join(root, '.focused-spec/evidence.yaml')
    await writeFile(path, 'scopes:\n  current:\n    auth.login.blocked-account:\n      evidence: [go-test::./auth::TestBlockedAccount]\n')
    expect((await evidenceGate(root, 'openspec', source)).gate.passed).toBe(true)
    expect((await evidenceGate(root, 'openspec', source.replace('auth.login.blocked-account', 'auth.login.other'))).gate.passed).toBe(false)
    expect((await evidenceGate(root, 'openspec', `${source}- **EVIDENCE**: \`go-test::./auth::TestBlockedAccount\`\n`)).gate.passed).toBe(false)
    await writeFile(path, 'scopes:\n  current:\n    auth.login.blocked-account:\n      evidence: [go-test::./auth::TestBlockedAccount]\n      unknown: true\n')
    expect((await evidenceGate(root, 'openspec', source)).gate.passed).toBe(false)
    await writeFile(path, 'scopes: []\n')
    const malformed = await evidenceGate(root, 'openspec', source)
    expect(malformed.gate.passed).toBe(false)
    expect(malformed.references).toEqual([])
    await rm(path)
    const missing = await evidenceGate(root, 'openspec', source)
    expect(missing.gate.passed).toBe(false)
    expect(agentEvidenceGate('', missing.references).passed).toBeNull()
  })

  it('resolves generated BMad evidence only through an explicit native ID declaration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-external-source-'))
    roots.push(root)
    await mkdir(join(root, '.focused-spec'))
    await writeFile(join(root, '.focused-spec/evidence.yaml'), [
      'scopes:',
      '  current:',
      '    auth.login.blocked-account:',
      '      source:',
      '        path: _bmad-output/specs/spec-blocked-login/spec-blocked-login.md',
      '        nativeId: CAP-1',
      '      evidence: [go-test::./auth::TestBlockedAccount]',
    ].join('\n'))
    const explicit = '# Blocked Login\n\n- **CAP-1**\n  - **success:** A blocked account with valid credentials is denied login.\n'
    expect((await evidenceGate(root, 'bmad', explicit)).gate.passed).toBe(true)
    expect((await evidenceGate(root, 'bmad', '# CAP-1\n\nA blocked account with valid credentials is denied login.\n')).gate.passed).toBe(false)
  })
})
