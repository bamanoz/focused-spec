import { describe, expect, it } from 'vitest'
import type { FocusedSpecConfig } from '../src/model.js'
import { parseEvidenceReference, parseFocusedSpecDocument } from '../src/parser.js'
import { validateDocuments } from '../src/validate.js'

const config: FocusedSpecConfig = {
  version: 2,
  specifications: { documents: [{ match: 'specs/**/*.md', scope: 'current' }] },
  runners: { unit: { module: './runner.ts' } },
}

function scenario(id = 'auth.login.blocked', evidence = 'unit::auth test'): string {
  return [
    '### Requirement: Authentication',
    '#### Scenario: Blocked account logs in',
    `- **ID**: \`${id}\``,
    `- **EVIDENCE**: \`${evidence}\``,
    '- **WHEN** a blocked account supplies valid credentials',
    '- **THEN** authentication is rejected',
  ].join('\n')
}

describe('focused specification parsing', () => {
  it('parses a focused scenario and opaque runner selector', () => {
    const document = parseFocusedSpecDocument('specs/auth.md', scenario(), 'current')
    expect(document.scope).toBe('current')
    expect(document.scenarios).toEqual([expect.objectContaining({
      name: 'Blocked account logs in',
      ids: ['auth.login.blocked'],
      evidence: ['unit::auth test'],
      whenCount: 1,
      thenCount: 1,
    })])
    expect(parseEvidenceReference('planned:pytest::tests/test_auth.py::test_blocked')).toEqual({
      raw: 'planned:pytest::tests/test_auth.py::test_blocked',
      planned: true,
      runnerId: 'pytest',
      selector: 'tests/test_auth.py::test_blocked',
    })
  })

  it('rejects malformed shape, unknown runners, and duplicate ownership', () => {
    const first = parseFocusedSpecDocument('specs/one.md', scenario(), 'current')
    const second = parseFocusedSpecDocument('specs/two.md', scenario('auth.login.blocked', 'missing::target'), 'current')
    const validation = validateDocuments([first, second], config, { allowPlanned: false })
    expect(validation.violations.map(item => item.message)).toEqual(expect.arrayContaining([
      expect.stringContaining('duplicate stable ID'),
      'unknown evidence runner missing',
    ]))
  })

  it('allows planned evidence only during non-strict scope validation', () => {
    const document = parseFocusedSpecDocument('scopes/add/spec.md', scenario('auth.login.new', 'planned:unit::future test'), 'add')
    expect(validateDocuments([document], config, { allowPlanned: true }).violations).toEqual([])
    expect(validateDocuments([document], config, { allowPlanned: false }).violations).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('planned evidence is not allowed') }),
    )
  })
  it('rejects scenarios without exactly one ID WHEN and THEN', () => {
    const missing = scenario().split('\n').filter(line => !line.startsWith('- **ID**') && !line.startsWith('- **WHEN**') && !line.startsWith('- **THEN**')).join('\n')
    const repeated = `${scenario()}\n- **ID**: \`auth.login.other\`\n- **WHEN** again\n- **THEN** another result`
    const documents = [missing, repeated].map((source, index) => parseFocusedSpecDocument(`specs/${index}.md`, source, 'current'))
    const violations = validateDocuments(documents, config, { allowPlanned: false }).violations
    for (const count of [0, 2]) {
      for (const field of ['ID', 'WHEN', 'THEN']) {
        expect(violations).toContainEqual(expect.objectContaining({ message: `expected exactly one ${field} row, found ${count}` }))
      }
    }
  })

  it('rejects a scenario without evidence', () => {
    const source = scenario().split('\n').filter(line => !line.startsWith('- **EVIDENCE**')).join('\n')
    const document = parseFocusedSpecDocument('specs/auth.md', source, 'current')
    expect(validateDocuments([document], config, { allowPlanned: false }).violations).toContainEqual(
      expect.objectContaining({ message: 'expected at least one EVIDENCE row' }),
    )
  })
  it('rejects evidence without a scenario ID in a mixed document', () => {
    const source = [
      '#### Scenario: Historical outcome',
      '- **WHEN** historical input is supplied',
      '- **THEN** historical output is observed',
      '#### Scenario: Evidence without identity',
      '- **EVIDENCE**: `unit::auth test`',
      '- **WHEN** input is supplied',
      '- **THEN** output is observed',
    ].join('\n')
    const document = parseFocusedSpecDocument('specs/auth.md', source, 'current')
    expect(document.unenrolledScenarios).toBe(1)
    expect(document.scenarios).toHaveLength(1)
    expect(validateDocuments([document], config, { allowPlanned: false }).violations).toContainEqual(
      expect.objectContaining({ line: 4, message: 'expected exactly one ID row, found 0' }),
    )
  })

  it('rejects malformed ID evidence and revision markers', () => {
    for (const marker of ['- **ID**: auth.blocked', '- **EVIDENCE**: unit::auth', '- **REVISES**:']) {
      const document = parseFocusedSpecDocument('specs/auth.md', [
        '#### Scenario: Incomplete enrollment',
        marker,
        '- **WHEN** input is supplied',
        '- **THEN** output is observed',
      ].join('\n'), 'current')
      expect(document.unenrolledScenarios).toBe(0)
      expect(document.scenarios).toHaveLength(1)
      const violations = validateDocuments([document], config, { allowPlanned: false }).violations
      expect(violations).toContainEqual(expect.objectContaining({ message: 'expected exactly one ID row, found 0' }))
      expect(violations).toContainEqual(expect.objectContaining({ line: 2, message: expect.stringContaining(`malformed ${marker.match(/\*\*(\w+)\*\*/u)?.[1]} row`) }))
    }
  })

})
