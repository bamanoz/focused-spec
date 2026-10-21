import { cp, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  agentEvidenceGate, canonicalMemlogReadGate, companionGate, creationGate, evidenceGate, focusedCliGates, hostPrerequisiteGate, hostWorkflowGate,
  infrastructureIntegrityGate, infrastructureSnapshot,
  hostWriteConstraintGate, judged, nativeSingleSourceGate,
} from '../evals/native-pilot.ts'
import * as nativePilot from '../evals/native-pilot.ts'
import { OmpAgentDriver } from '../evals/omp-agent.ts'
import type { AgentRequest } from '../evals/types.ts'
import { saveEvalResult } from '../evals/result.ts'

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
  vi.restoreAllMocks()
})

describe('native pilot evaluation boundaries', () => {
  it('preserves distinct immutable native result artifacts when timestamps collide', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-results-'))
    roots.push(root)
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
    const first = { caseId: 'bmad', transcript: 'first captured run', certified: false }
    const second = { caseId: 'bmad', transcript: 'second captured run', certified: false }
    const path = await saveEvalResult(root, 'native-bmad', first)
    const bytes = await readFile(path, 'utf8')
    const other = await saveEvalResult(root, 'native-bmad', second)
    expect(other).not.toBe(path)
    expect(await readdir(root)).toHaveLength(2)
    expect(await readFile(path, 'utf8')).toBe(bytes)
    expect(JSON.parse(await readFile(other, 'utf8'))).toEqual(second)
  })

  it('requires a successful in-project canonical memlog read before regeneration starts', () => {
    const workspace = join(tmpdir(), 'focused-native-read-contract')
    const memlog = '_bmad-output/specs/spec-blocked-login/.memlog.md'
    const kernel = '_bmad-output/specs/spec-blocked-login/spec-blocked-login.md'
    const read = (path: string, failed = false, complete = true) => [
      { type: 'tool_execution_start', toolName: 'read', toolCallId: 'source', args: { path } },
      ...(complete ? [{ type: 'tool_execution_end', toolName: 'read', toolCallId: 'source', isError: failed,
        result: { isError: failed } }] : []),
    ]
    const write = [
      { type: 'tool_execution_start', toolName: 'write', toolCallId: 'kernel', args: { path: join(workspace, kernel) } },
      { type: 'tool_execution_end', toolName: 'write', toolCallId: 'kernel', isError: false, result: {} },
    ]
    const trace = (events: object[]) => events.map(event => JSON.stringify(event)).join('\n')
    expect(canonicalMemlogReadGate(workspace, trace([...read(join(workspace, memlog)), ...write])).passed).toBe(true)
    expect(canonicalMemlogReadGate(workspace, trace([...read(`${memlog}:1-80`), ...write])).passed).toBe(true)
    expect(canonicalMemlogReadGate(workspace, trace([...read(memlog, true), ...write])).passed).toBe(false)
    expect(canonicalMemlogReadGate(workspace, trace([...read(memlog, false, false), ...write])).passed).toBe(false)
    expect(canonicalMemlogReadGate(workspace, trace([...write, ...read(memlog)])).passed).toBe(false)
    expect(canonicalMemlogReadGate(workspace, trace([...read(join(workspace, '..', 'other-project', memlog)), ...write])).passed).toBe(false)
  })

  it('accepts named-system EARS outcomes while rejecting missing triggers, obligations and denial', () => {
    const source = [
      '# Requirements',
      '**User Story:** As an administrator, I want blocked accounts denied login.',
      '## Acceptance Criteria',
      '<!-- focused-spec:id=account.login.blocked -->',
      '1. WHEN an account blocked by an administrator attempts to log in with valid credentials, THE authentication system SHALL deny login.',
    ].join('\n')
    expect(creationGate('kiro', source).passed).toBe(true)
    expect(creationGate('kiro', source.replace('WHEN', 'GIVEN')).passed).toBe(false)
    expect(creationGate('kiro', source.replace('SHALL', 'MAY')).passed).toBe(false)
    expect(creationGate('kiro', source.replace('deny login', 'allow login')).passed).toBe(false)
  })

  it('judges opaque marker IDs through the native parser rather than a dotted naming convention', () => {
    const source = '# Requirements\n\n<!-- focused-spec:id=Blocked-账户 -->\nWHEN a blocked account submits valid credentials\nTHE login service SHALL reject authentication\n'
    expect(creationGate('kiro', source).passed).toBe(true)
    expect(nativeSingleSourceGate('kiro', source).passed).toBe(true)
    expect(creationGate('kiro', source.replace('-->\nWHEN', '-->\n\n\nWHEN')).passed).toBe(false)
    expect(creationGate('kiro', `${source}\n${source}`).passed).toBe(false)
    const feature = 'Feature: Login\n  @focused.Blocked-账户\n  Scenario: Blocked login\n    Given a blocked account with valid credentials\n    When it logs in\n    Then authentication is rejected\n'
    expect(creationGate('gherkin', feature).passed).toBe(true)
    expect(creationGate('gherkin', feature.replace('Then authentication is rejected', 'Then authentication succeeds')).passed).toBe(false)
  })

  it('blocks CLI judgment rather than inventing execution failures without a valid selection', async () => {
    const gates = await focusedCliGates('/not-an-evaluation-workspace', { references: [] })
    expect(gates).toEqual([
      expect.objectContaining({ name: 'focused-cli-validation', passed: null, blockedBy: 'normalized-evidence' }),
      expect.objectContaining({ name: 'focused-cli-execution', passed: null, blockedBy: 'normalized-evidence' }),
    ])
    expect(judged(gates, gates.map(item => item.name)).status).toBe('unverified')
  })

  it('separates installed GSD resources from project behavior without permitting infrastructure edits', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-gsd-boundary-'))
    roots.push(root)
    await mkdir(join(root, '.planning'), { recursive: true })
    await mkdir(join(root, '.pi/gsd-core/workflows'), { recursive: true })
    await mkdir(join(root, '.home/.npm/installed-workflow'), { recursive: true })
    const item = '- [ ] **AUTH-01**: A blocked account with valid credentials is denied login. <!-- focused-spec:id=auth.blocked-account -->\n'
    const example = '#### Scenario: Workflow example\n- **ID**: `example.workflow`\n'
    await writeFile(join(root, '.planning/REQUIREMENTS.md'), item)
    await writeFile(join(root, '.pi/gsd-core/workflows/audit-fix.md'), example)
    await writeFile(join(root, '.home/.npm/installed-workflow/audit-fix.md'), example)
    const before = await infrastructureSnapshot(root)
    expect((await companionGate(root, 'gsd')).passed).toBe(true)
    await writeFile(join(root, '.pi/gsd-core/workflows/audit-fix.md'), 'Changed installed workflow\n')
    expect((await infrastructureIntegrityGate(root, before)).passed).toBe(false)
    await writeFile(join(root, '.planning/duplicate.md'), item)
    expect((await companionGate(root, 'gsd')).passed).toBe(false)
  })

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
      '  - **success:** Authentication denies access when the account is blocked and the supplied credentials are valid.',
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
    const colonDeclaration = generated.replace('- **CAP-1**', '- **CAP-1**:')
    expect(creationGate('bmad', colonDeclaration).passed).toBe(true)
    expect(nativeSingleSourceGate('bmad', colonDeclaration).passed).toBe(true)
    expect(creationGate('bmad', `${colonDeclaration}\n- **CAP-1**:\n  - **intent:** Reject blocked login.\n  - **success:** A blocked account with valid credentials receives denial.\n`).passed).toBe(false)
    expect(creationGate('bmad', generated.replace('Authentication denies access when the account is blocked and the supplied credentials are valid.', 'A blocked account with valid credentials is not authenticated.')).passed).toBe(true)
    expect(creationGate('bmad', generated.replace(' and the supplied credentials are valid.', '.')).passed).toBe(false)
    expect(creationGate('bmad', generated.replace('denies access', 'returns an outcome')).passed).toBe(false)
    expect(creationGate('bmad', duplicate).passed).toBe(false)
    expect(creationGate('bmad', generated.replace('- **CAP-1**', '<!-- focused-spec:id=auth.login.blocked-account -->\n- **CAP-1**')).passed).toBe(false)
  })

  it('binds Spec Kit identity to the actual parser-native item', () => {
    const identity = '<!-- focused-spec:id=account.login.blocked -->'
    const story = [
      '# Feature Specification: Blocked Account Login',
      '',
      '## User Scenarios & Testing *(mandatory)*',
      '',
      identity,
      '### User Story 1 - Reject Blocked Account Login (Priority: P1)',
      '',
      'An administrator-blocked account cannot sign in even with valid credentials.',
      '',
      '**Acceptance Scenarios**:',
      '',
      '1. **Given** an account is blocked and credentials are valid, **When** it attempts to sign in, **Then** authentication is denied.',
      '',
      '## Requirements *(mandatory)*',
      '',
      '### Functional Requirements',
      '',
      '- **FR-001**: The system MUST reject blocked accounts with valid credentials.',
    ].join('\n')
    const acceptanceBound = story.replace(`${identity}\n### User Story`, '### User Story')
      .replace('1. **Given**', `${identity}\n1. **Given**`)

    expect(creationGate('spec-kit', story).passed).toBe(true)
    expect(nativeSingleSourceGate('spec-kit', story).passed).toBe(true)
    expect(creationGate('spec-kit', acceptanceBound).passed).toBe(true)
    expect(creationGate('spec-kit', story.replace(`${identity}\n`, '')).passed).toBe(false)
    expect(creationGate('spec-kit', story.replace('1. **Given**', `${identity}\n1. **Given**`)).passed).toBe(false)
    expect(creationGate('spec-kit', story.replace(`${identity}\n### User Story`, `${identity}\n\n\n### User Story`)).passed).toBe(false)

    const echoedElsewhere = story
      .replace('An administrator-blocked account cannot sign in even with valid credentials.', 'An account holder can attempt to sign in.')
      .replace('1. **Given** an account is blocked and credentials are valid, **When** it attempts to sign in, **Then** authentication is denied.',
        '1. **Given** an account exists, **When** it attempts to sign in, **Then** the request is processed.')
    expect(creationGate('spec-kit', echoedElsewhere).passed).toBe(false)
  })

  it('excludes ephemeral approved plans but rejects discoverable duplicate behavior sources', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-companions-'))
    roots.push(root)
    const identity = '<!-- focused-spec:id=account.login.blocked -->'
    await mkdir(join(root, 'agent-os/specs/blocked-login'), { recursive: true })
    await mkdir(join(root, '.omp-authoring-sessions/session/local'), { recursive: true })
    await writeFile(join(root, 'agent-os/specs/blocked-login/shape.md'), `${identity}\nBlocked account outcome\n`)
    await writeFile(join(root, '.omp-authoring-sessions/session/local/approved-plan.md'), `${identity}\nApproved plan copy\n`)
    expect((await companionGate(root, 'agent-os')).passed).toBe(true)

    await mkdir(join(root, 'notes'), { recursive: true })
    await writeFile(join(root, 'notes/duplicate.md'), `${identity}\nDuplicate behavior\n`)
    const duplicate = await companionGate(root, 'agent-os')
    expect(duplicate.passed).toBe(false)
    expect(duplicate.detail).toContain('agent-os/specs/blocked-login/shape.md (1)')
    expect(duplicate.detail).toContain('notes/duplicate.md (1)')
    expect(duplicate.detail).not.toContain('.omp-authoring-sessions')

    await writeFile(join(root, 'notes/scenarios.md'), 'Obsolete companion\n')
    const companion = await companionGate(root, 'agent-os')
    expect(companion.passed).toBe(false)
    expect(companion.detail).toContain('companion files=notes/scenarios.md')
  })

  it('ignores quoted native payloads but rejects live duplicates and detached markers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-quoted-plan-'))
    roots.push(root)
    const directory = join(root, 'agent-os/specs/blocked-login')
    await mkdir(directory, { recursive: true })
    const item = '<!-- focused-spec:id=account.login.blocked -->\nAn administrator-blocked account with valid credentials is rejected.\n'
    const shape = join(directory, 'shape.md')
    const plan = join(directory, 'plan.md')
    await writeFile(shape, item)
    await writeFile(plan, `# Approved execution plan\n\nSave shape.md with this payload:\n\n\`\`\`markdown\n${item}\`\`\`\n`)
    expect((await companionGate(root, 'agent-os')).passed).toBe(true)
    await rm(shape)
    expect((await companionGate(root, 'agent-os')).passed).toBe(false)
    await writeFile(shape, item)
    await writeFile(plan, item)
    expect((await companionGate(root, 'agent-os')).passed).toBe(false)
    await writeFile(plan, '<!-- focused-spec:id=account.login.blocked -->\n')
    expect((await companionGate(root, 'agent-os')).passed).toBe(false)
  })

  it('counts live external BMad capabilities rather than fenced kernel examples', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-quoted-kernel-'))
    roots.push(root)
    const capability = '- **CAP-1**\n  - **success:** Reject blocked accounts with valid credentials.\n'
    await writeFile(join(root, 'kernel.md'), capability)
    await writeFile(join(root, 'plan.md'), `# Regeneration plan\n\n~~~markdown\n${capability}~~~\n`)
    expect((await companionGate(root, 'bmad')).passed).toBe(true)
    await writeFile(join(root, 'plan.md'), capability)
    expect((await companionGate(root, 'bmad')).passed).toBe(false)
  })

  it('counts focused Gherkin scenarios rather than quoted tags', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-quoted-feature-'))
    roots.push(root)
    const feature = 'Feature: Login\n\n  @focused.account.login.blocked\n  Scenario: Blocked login\n    Given a blocked account with valid credentials\n    Then login is rejected\n'
    await writeFile(join(root, 'login.feature'), feature)
    await writeFile(join(root, 'plan.md'), `# Approved feature\n\n\`\`\`gherkin\n${feature}\`\`\`\n`)
    expect((await companionGate(root, 'gherkin')).passed).toBe(true)
    await writeFile(join(root, 'duplicate.feature'), feature)
    expect((await companionGate(root, 'gherkin')).passed).toBe(false)
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
        args: { command: "go test ./auth -v -run '^TestBlockedAccount$' -count=1" } }),
      JSON.stringify({ type: 'tool_execution_end', toolCallId: 'direct-go', toolName: 'bash',
        result: { content: [{ type: 'text', text: '=== RUN   TestBlockedAccount\n--- PASS: TestBlockedAccount (0.00s)\nPASS\nok example.com/auth 0.2s' }] } }),
    ].join('\n')
    const blocked = agentEvidenceGate(transcript, [])
    expect(blocked).toMatchObject({ passed: null, blockedBy: 'normalized-evidence' })
    expect(judged([blocked], ['agent-executed-selected-evidence']).status).toBe('unverified')
    expect(agentEvidenceGate(transcript, ['go::./auth::TestBlockedAccount']).passed).toBe(true)
    expect(agentEvidenceGate(transcript, ['pytest::tests/functional/test_auth.py::test_blocked_account']).passed).toBe(false)
  })

  it('recognizes completed selected CLI evidence without crediting validation or failed commands', () => {
    const reference = 'go::./auth::TestBlockedAccount'
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
    const wrapperResult = JSON.stringify({ success: true, executionStarted: true, scenarios: [{ scope: 'current', id: 'account.access.blocked', status: 'PASS', evidence: [{ reference, status: 'PASS' }] }] }, null, 2)
    expect(agentEvidenceGate(events('python3 /tmp/proof.py', `Baseline\n ${wrapperResult}\nRestored\n ${wrapperResult}`), [reference]).passed).toBe(true)
    expect(agentEvidenceGate(events('python3 /tmp/proof.py', wrapperResult, true), [reference]).passed).toBe(false)
    expect(agentEvidenceGate(events('python3 /tmp/proof.py', wrapperResult.replace('"executionStarted": true', '"executionStarted": false')), [reference]).passed).toBe(false)
    expect(agentEvidenceGate(events('python3 /tmp/proof.py', wrapperResult.replace('"status": "PASS"', '"status": "FAIL"')), [reference]).passed).toBe(false)
    expect(agentEvidenceGate(events('python3 /tmp/proof.py', wrapperResult.slice(0, -4)), [reference]).passed).toBe(false)
    expect(agentEvidenceGate(events('echo recorded-result', wrapperResult), [reference]).passed).toBe(false)
    expect(agentEvidenceGate(JSON.stringify({ type: 'tool_execution_start', toolCallId: 'execution', toolName: 'bash', args: { command: 'focused-spec run' } }), [reference]).passed).toBe(false)
  })

  it('rejects zero-match Go and wrong-file Python execution while accepting observed exact tests', () => {
    const events = (command: string, output: string) => [
      JSON.stringify({ type: 'tool_execution_start', toolCallId: 'direct', toolName: 'bash', args: { command } }),
      JSON.stringify({ type: 'tool_execution_end', toolCallId: 'direct', toolName: 'bash',
        result: { details: { exitCode: 0 }, content: [{ type: 'text', text: output }] } }),
    ].join('\n')
    const go = ['go::./auth::TestBlockedAccount']
    expect(agentEvidenceGate(events("go test ./auth -run '^NotTestBlockedAccount$' -count=1", 'ok example.com/auth 0.2s [no tests to run]'), go).passed).toBe(false)
    expect(agentEvidenceGate(events("go test ./auth -run '^TestBlockedAccount$' -count=1", 'ok example.com/auth 0.2s [no tests to run]'), go).passed).toBe(false)
    expect(agentEvidenceGate(events("go test ./other -v -run '^TestBlockedAccount$'", '=== RUN   TestBlockedAccount\n--- PASS: TestBlockedAccount (0.00s)\nPASS\nok example.com/other 0.2s'), go).passed).toBe(false)
    expect(agentEvidenceGate(events("go test ./auth -v -run '^TestBlockedAccount$' -count=1", '=== RUN   TestBlockedAccount\n--- PASS: TestBlockedAccount (0.00s)\nPASS\nok example.com/auth 0.2s'), go).passed).toBe(true)
    const python = ['pytest::tests/functional/test_auth.py::test_blocked_account']
    expect(agentEvidenceGate(events('python -m pytest -v tests/other/test_auth.py::test_blocked_account', 'tests/other/test_auth.py::test_blocked_account PASSED\n1 passed in 0.01s'), python).passed).toBe(false)
    expect(agentEvidenceGate(events('python -m pytest -v tests/functional/test_auth.py::test_blocked_account', 'tests/functional/test_auth.py::test_blocked_account PASSED\n1 passed in 0.01s'), python).passed).toBe(true)
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

  it('accepts registry and inline production evidence bound to the actual native item', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-registry-'))
    roots.push(root)
    await mkdir(join(root, '.focused-spec'))
    await symlink(join(nativePilot.nativePilotRoot, 'node_modules'), join(root, 'node_modules'), 'junction')
    const registryConfig = "version: 5\nspecifications:\n  formats:\n    markdown:\n      package: '@focused-spec/format-registry'\n      options:\n        parser:\n          package: '@focused-spec/format-markdown'\n  documents: [{ match: specs/*.md, scope: current, format: markdown }]\nrunners: {}\n"
    await writeFile(join(root, '.focused-spec/config.yaml'), registryConfig)
    const source = '<!-- focused-spec:id=auth.login.blocked-account -->\n#### Scenario: Blocked login\n'
    await mkdir(join(root, 'specs'))
    await writeFile(join(root, 'specs/auth.md'), source)
    const path = join(root, '.focused-spec/evidence.yaml')
    await writeFile(path, 'scopes:\n  current:\n    auth.login.blocked-account:\n      evidence: [go::./auth::TestBlockedAccount]\n')
    const registryEvidence = await evidenceGate(root, 'openspec', source)
    expect(registryEvidence.gate.passed, registryEvidence.gate.detail).toBe(true)
    await writeFile(path, 'scopes:\n  current:\n    auth.login.blocked-account:\n      evidence: [go::./auth::TestBlockedAccount]\n      unknown: true\n')
    expect((await evidenceGate(root, 'openspec', source)).gate.passed).toBe(false)
    await rm(path)
    await writeFile(join(root, '.focused-spec/config.yaml'), "version: 5\nspecifications:\n  formats:\n    inline:\n      package: '@focused-spec/format-inline'\n  documents: [{ match: specs/*.md, scope: current, format: inline }]\nrunners: {}\n")
    const inline = '#### Scenario: Blocked login\n- **ID**: `Opaque/Auth 账户`\n- **EVIDENCE**: `go::./auth::TestBlockedAccount`\n- **WHEN** a blocked account has valid credentials\n- **THEN** authentication is rejected\n'
    await writeFile(join(root, 'specs/auth.md'), inline)
    const inlineEvidence = await evidenceGate(root, 'openspec', inline)
    expect(inlineEvidence.gate.passed, inlineEvidence.gate.detail).toBe(true)
    expect(nativeSingleSourceGate('openspec', inline, inlineEvidence.binding).passed).toBe(true)
    expect((await companionGate(root, 'openspec', inlineEvidence.binding)).passed).toBe(true)
    const malformed = await evidenceGate(root, 'openspec', inline.replace('Opaque/Auth 账户', ''))
    expect(malformed.gate.passed).toBe(false)
    expect(agentEvidenceGate('', malformed.references).passed).toBeNull()
  })

  it('judges an external Kiro native-ID binding without requiring a second marker', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-kiro-binding-'))
    roots.push(root)
    await mkdir(join(root, '.focused-spec'))
    await mkdir(join(root, '.kiro/specs/blocked-login'), { recursive: true })
    await symlink(join(nativePilot.nativePilotRoot, 'node_modules'), join(root, 'node_modules'), 'junction')
    const path = '.kiro/specs/blocked-login/requirements.md'
    const source = '# Requirements\n\n## Acceptance Criteria\n\n1. **BLOCKED-LOGIN-1**: WHEN an administrator-blocked account logs in with valid credentials, THE authentication service SHALL reject login.\n'
    await writeFile(join(root, path), source)
    await writeFile(join(root, '.focused-spec/config.yaml'), `version: 5\nspecifications:\n  formats:\n    native:\n      package: '@focused-spec/format-registry'\n      options:\n        parser: { package: '@focused-spec/format-markdown' }\n  documents: [{ match: ${path}, scope: current, format: native }]\nrunners: {}\n`)
    const absent = await evidenceGate(root, 'kiro', source)
    expect(absent.gate.passed).toBe(false)
    expect(nativeSingleSourceGate('kiro', source).passed).toBe(false)
    expect(await focusedCliGates(root, absent)).toEqual([
      expect.objectContaining({ name: 'focused-cli-validation', passed: null, blockedBy: 'normalized-evidence' }),
      expect.objectContaining({ name: 'focused-cli-execution', passed: null, blockedBy: 'normalized-evidence' }),
    ])
    await writeFile(join(root, '.focused-spec/evidence.yaml'), `scopes:\n  current:\n    login-denied:\n      source: { path: ${path}, nativeId: BLOCKED-LOGIN-1 }\n      evidence: [go::./auth::TestBlockedAccount]\n`)
    const evidence = await evidenceGate(root, 'kiro', source)
    expect(evidence.gate.passed, evidence.gate.detail).toBe(true)
    expect(creationGate('kiro', source, evidence.binding).passed).toBe(true)
    expect(nativeSingleSourceGate('kiro', source, evidence.binding).passed).toBe(true)
    expect((await companionGate(root, 'kiro', evidence.binding)).passed).toBe(true)
    expect(creationGate('kiro', source.replace('SHALL reject', 'MAY reject'), evidence.binding).passed).toBe(false)
    expect(creationGate('kiro', source.replace('SHALL reject', 'SHALL allow'), evidence.binding).passed).toBe(false)
    await writeFile(join(root, '.kiro/specs/blocked-login/duplicate.md'), source)
    expect((await companionGate(root, 'kiro', evidence.binding)).passed).toBe(false)
    await writeFile(join(root, path), source + '\n' + source)
    expect((await evidenceGate(root, 'kiro', source + '\n' + source)).gate.passed).toBe(false)
  })

  it('resolves generated BMad evidence only through an explicit native ID declaration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-external-source-'))
    roots.push(root)
    await mkdir(join(root, '.focused-spec'))
    await symlink(join(nativePilot.nativePilotRoot, 'node_modules'), join(root, 'node_modules'), 'junction')
    await writeFile(join(root, '.focused-spec/config.yaml'), "version: 5\nspecifications:\n  formats:\n    markdown:\n      package: '@focused-spec/format-registry'\n      options:\n        parser:\n          package: '@focused-spec/format-markdown'\n  documents: [{ match: _bmad-output/specs/**/*.md, scope: current, format: markdown }]\nrunners: {}\n")
    await writeFile(join(root, '.focused-spec/evidence.yaml'), [
      'scopes:',
      '  current:',
      '    auth.login.blocked-account:',
      '      source:',
      '        path: _bmad-output/specs/spec-blocked-login/spec-blocked-login.md',
      '        nativeId: CAP-1',
      '      evidence: [go::./auth::TestBlockedAccount]',
    ].join('\n'))
    const explicit = '# Blocked Login\n\n- **CAP-1**\n  - **success:** A blocked account with valid credentials is denied login.\n'
    await mkdir(join(root, '_bmad-output/specs/spec-blocked-login'), { recursive: true })
    await writeFile(join(root, '_bmad-output/specs/spec-blocked-login/spec-blocked-login.md'), explicit)
    const externalEvidence = await evidenceGate(root, 'bmad', explicit)
    expect(externalEvidence.gate.passed, externalEvidence.gate.detail).toBe(true)
    expect((await evidenceGate(root, 'bmad', '# CAP-1\n\nA blocked account with valid credentials is denied login.\n')).gate.passed).toBe(false)
  })

  it('rejects native implementation reads and directory searches without rejecting docs types or CLI execution', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-inspection-'))
    roots.push(root)
    const before = await infrastructureSnapshot(root)
    // Include both authoring and regeneration transcripts at the existing integrity boundary.
    const integrity = infrastructureIntegrityGate as (workspace: string, before: ReadonlyMap<string, string>, transcripts: readonly string[]) => ReturnType<typeof infrastructureIntegrityGate>
    const event = (toolName: string, args: object) => JSON.stringify({ type: 'tool_execution_start', toolName, args })
    for (const transcript of [
      event('read', { path: 'node_modules/focused-spec/dist/cli.js' }),
      event('grep', { path: 'node_modules/focused-spec/dist', pattern: 'run' }),
    ]) {
      expect(await integrity(root, before, [transcript])).toMatchObject({ passed: false })
      expect(await integrity(root, before, ['', transcript])).toMatchObject({ passed: false })
    }
    for (const transcript of [
      event('read', { path: 'node_modules/focused-spec/README.md' }),
      event('read', { path: 'node_modules/focused-spec/docs/reference/runner-api.md' }),
      event('read', { path: 'node_modules/focused-spec/dist/runner-api.d.ts' }),
      event('bash', { command: 'node node_modules/focused-spec/dist/cli.js run --json' }),
    ]) expect(await integrity(root, before, [transcript])).toMatchObject({ passed: true })
  })

  it.each([false, true])('retains the failed BMad regeneration request for diagnosis of its own session without rescoring (throws=%s)', async throws => {
    const root = await mkdtemp(join(tmpdir(), 'focused-native-bmad-diagnostic-'))
    roots.push(root)
    await cp(join(nativePilot.nativePilotRoot, 'evals/fixtures/polyglot'), root, { recursive: true })
    await mkdir(join(root, '.focused-spec'))
    await writeFile(join(root, '.focused-spec/config.yaml'), "version: 5\nspecifications:\n  formats:\n    markdown:\n      package: '@focused-spec/format-registry'\n      options:\n        parser:\n          package: '@focused-spec/format-markdown'\n  documents: [{ match: _bmad-output/specs/**/*.md, scope: current, format: markdown }]\nrunners: {}\n")
    const sourcePath = '_bmad-output/specs/spec-blocked-login/spec-blocked-login.md'
    await mkdir(join(root, '_bmad-output/specs/spec-blocked-login'), { recursive: true })
    await writeFile(join(root, sourcePath), '# Blocked Login\n\n- **CAP-1**\n  - **success:** A blocked account with valid credentials is denied login.\n')
    await writeFile(join(root, '.focused-spec/evidence.yaml'), `scopes:\n  current:\n    auth.login.blocked-account:\n      source:\n        path: ${sourcePath}\n        nativeId: CAP-1\n      evidence: [go::./auth::TestBlockedAccount]\n`)
    await mkdir(join(root, '.omp-eval-sessions'))
    await writeFile(join(root, '.omp-eval-sessions/authoring.jsonl'), 'successful authoring journal')
    const requests: AgentRequest[] = []
    vi.spyOn(OmpAgentDriver.prototype, 'run').mockImplementation(async request => {
      requests.push(request)
      if (request.resume !== undefined) {
        expect(await readFile(request.resume, 'utf8')).toBe('failed regeneration journal')
        return { success: true, exitCode: 0, durationMs: 1, output: JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'Diagnose the failed regeneration, not the successful authoring.' }] } }) }
      }
      expect(request.sessionDir).toBe(join(root, '.omp-regeneration-sessions'))
      await mkdir(request.sessionDir!, { recursive: true })
      await writeFile(join(request.sessionDir!, 'regeneration.jsonl'), 'failed regeneration journal')
      if (throws) throw Object.assign(new Error('regeneration transport failed'), { output: 'regeneration failed after starting' })
      return { success: false, exitCode: 17, durationMs: 1, output: 'regeneration failed after starting' }
    })
    const authoringRequest: AgentRequest = { workspace: root, model: 'test-model', sessionDir: join(root, '.omp-eval-sessions'), skills: ['focused-spec', 'bmad-spec'], prompt: 'The original blind authoring task', timeoutMs: 600_000 }
    const phase = await nativePilot.evaluateBmadLifecycle(root, 'test-model', new OmpAgentDriver(), authoringRequest)
    expect(phase.verdict.status).toBe('failed')
    expect(phase.transcript).toContain('regeneration failed after starting')
    expect(phase.request).toEqual(requests[0])
    expect(phase.gates).toEqual([expect.objectContaining({ name: 'bmad-regenerated-kernel', passed: false })])
    expect(phase.diagnostic).toMatchObject({ status: 'answered', answer: expect.stringContaining('failed regeneration') })
    expect(requests).toHaveLength(2)
    expect(requests[1]?.resume).toBe(join(root, '.omp-regeneration-sessions/regeneration.jsonl'))
  })
})
