import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import gherkinFormat from '../packages/formats/gherkin/src/index.js'
import inlineFormat from '../packages/formats/inline/src/index.js'
import markdownFormat from '../packages/formats/markdown/src/index.js'
import { loadEvidenceRegistry, parseEvidenceRegistry } from '@focused-spec/format-registry'
import type { NativeDocument } from '../packages/core/src/model.js'
import { parseEvidenceReference } from '../packages/core/src/parser.js'

const roots: string[] = []

function parseNativeDocument(path: string, source: string, scope: string): NativeDocument {
  const format = path.endsWith('.feature') ? gherkinFormat : markdownFormat
  const parsed = format.parse({ projectRoot: '/project', path, source, options: null, signal: new AbortController().signal })
  return {
    path,
    scope,
    items: parsed.items.map(item => ({ path, scope, ...item })),
    violations: parsed.diagnostics.map(diagnostic => ({
      path,
      ...(diagnostic.line === undefined ? {} : { line: diagnostic.line }),
      ...(diagnostic.focusedId === undefined ? {} : { scenarioId: diagnostic.focusedId }),
      message: diagnostic.message,
    })),
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('native specification parsing', () => {
  it('binds a marker to the immediately following Markdown item', () => {
    const document = parseNativeDocument('specs/auth.md', [
      '# Authentication',
      '<!-- focused-spec:id=auth.login.blocked-account -->',
      '## Blocked account login',
      '',
      'A blocked account is rejected.',
    ].join('\n'), 'current')

    expect(document).toMatchObject({ path: 'specs/auth.md', scope: 'current', violations: [] })
    expect(document.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'specs/auth.md',
        scope: 'current',
        line: 3,
        name: 'Blocked account login',
        markerId: 'auth.login.blocked-account',
      }),
    ]))
  })

  it('binds markers to Markdown paragraphs and list items', () => {
    const document = parseNativeDocument('specs/items.md', [
      '<!-- focused-spec:id=auth.login.paragraph -->',
      'A paragraph behavior.',
      '',
      '<!-- focused-spec:id=auth.login.list-before -->',
      '- A list behavior.',
      '',
      'An inline paragraph behavior. <!-- focused-spec:id=auth.login.paragraph-inline -->',
      '',
      '- An inline list behavior. <!-- focused-spec:id=auth.login.list-inline -->',
    ].join('\n'), 'current')

    expect(document.violations).toEqual([])
    expect(document.items.flatMap(item => item.markerId ?? [])).toEqual([
      'auth.login.paragraph',
      'auth.login.list-before',
      'auth.login.paragraph-inline',
      'auth.login.list-inline',
    ])
  })

  it('rejects detached and duplicate Markdown markers', () => {
    const detached = parseNativeDocument('specs/detached.md', [
      '<!-- focused-spec:id=auth.login.detached -->',
      '',
      '',
      '## Detached behavior',
    ].join('\n'), 'current')
    const duplicate = parseNativeDocument('specs/duplicate.md', [
      '<!-- focused-spec:id=auth.login.first -->',
      '<!-- focused-spec:id=auth.login.second -->',
      '## Duplicate marker target',
    ].join('\n'), 'current')

    expect(detached.violations.map(value => value.message).join('\n')).toMatch(/marker.*(?:immediate|attach|detached)/iu)
    expect(duplicate.violations.map(value => value.message).join('\n')).toMatch(/(?:duplicate|multiple).*marker/iu)
  })

  it('rejects inline focused markers on Markdown headings', () => {
    const invalid = parseNativeDocument('specs/heading.md',
      '## Heading behavior <!-- focused-spec:id=audit.markdown.heading -->', 'current')
    expect(invalid.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ scenarioId: 'audit.markdown.heading', message: expect.stringMatching(/inline|heading|placement/iu) }),
    ]))
    const valid = parseNativeDocument('specs/heading.md',
      '<!-- focused-spec:id=audit.markdown.heading -->\n\n## Heading behavior', 'current')
    expect(valid.violations).toEqual([])
    expect(valid.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Heading behavior', markerId: 'audit.markdown.heading' }),
    ]))
  })

  it('rejects inline focused markers before later list-item paragraphs', () => {
    const invalid = parseNativeDocument('specs/list.md', [
      '- First paragraph. <!-- focused-spec:id=audit.markdown.list-inline -->',
      '',
      '  Later paragraph in the same item.',
    ].join('\n'), 'current')
    expect(invalid.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ scenarioId: 'audit.markdown.list-inline', message: expect.stringMatching(/inline|follow|end|trailing/iu) }),
    ]))
    const valid = parseNativeDocument('specs/list.md', [
      '- First paragraph.',
      '',
      '  Final paragraph. <!-- focused-spec:id=audit.markdown.list-inline -->',
    ].join('\n'), 'current')
    expect(valid.violations).toEqual([])
    expect(valid.items.some(item => item.markerId === 'audit.markdown.list-inline')).toBe(true)
  })

  it('measures list-contained preceding marker adjacency from the neighboring paragraph', () => {
    for (const blankLines of [0, 1, 2, 3]) {
      const document = parseNativeDocument('specs/list-gap.md', [
        '- Earlier paragraph.',
        '',
        '  <!-- focused-spec:id=audit.markdown.list-gap -->',
        ...Array.from({ length: blankLines }, () => ''),
        '  Neighboring behavior paragraph.',
      ].join('\n'), 'current')
      if (blankLines <= 1) {
        expect(document.violations).toEqual([])
        expect(document.items).toEqual(expect.arrayContaining([
          expect.objectContaining({ line: 4 + blankLines, name: 'Neighboring behavior paragraph.', markerId: 'audit.markdown.list-gap' }),
        ]))
      } else {
        expect(document.violations).toEqual(expect.arrayContaining([
          expect.objectContaining({ line: 3, scenarioId: 'audit.markdown.list-gap', message: expect.stringMatching(/detach|adjacen|immediate/iu) }),
        ]))
        expect(document.items.some(item => item.markerId === 'audit.markdown.list-gap')).toBe(false)
      }
    }
  })

  it('ignores marker-looking text in fenced code blocks', () => {
    const document = parseNativeDocument('specs/example.md', [
      '# Literal example',
      '```md',
      '<!-- focused-spec:id=auth.login.not-a-marker -->',
      '## Not a native item',
      '```',
    ].join('\n'), 'current')

    expect(document.violations).toEqual([])
    expect(document.items.some(item => item.markerId === 'auth.login.not-a-marker')).toBe(false)
  })

  it('attaches Gherkin tags only to Scenario and Scenario Outline', () => {
    const valid = parseNativeDocument('features/auth.feature', [
      'Feature: Authentication',
      '',
      '  @focused.auth.login.blocked-account',
      '  Scenario: Blocked account',
      '    Given a blocked account',
      '    Then authentication is rejected',
      '',
      '  @focused.auth.login.expired-password',
      '  Scenario Outline: Expired password',
      '    Given an account named <name>',
      '    Then authentication is rejected',
      '',
      '    Examples:',
      '      | name |',
      '      | Ada  |',
    ].join('\n'), 'current')
    const invalidSources = [
      ['@focused.auth.login.feature', 'Feature: Authentication'],
      ['Feature: Authentication', '', '  @focused.auth.login.rule', '  Rule: Login policy', '    Scenario: Login', '      Given an account'],
      ['Feature: Authentication', '', '  Scenario Outline: Login', '    Given <account>', '', '    @focused.auth.login.examples', '    Examples:', '      | account |', '      | Ada     |'],
      ['Feature: Authentication', '', '  @focused.auth.login.background', '  Background:', '    Given an account', '', '  Scenario: Login', '    Then access is decided'],
      ['Feature: Authentication', '', '  @focused.auth.login.first @focused.auth.login.second', '  Scenario: Duplicate tags', '    Given an account'],
    ]

    expect(valid.violations).toEqual([])
    expect(valid.items.filter(item => item.markerId !== undefined).map(item => item.markerId)).toEqual([
      'auth.login.blocked-account',
      'auth.login.expired-password',
    ])
    for (const [index, source] of invalidSources.entries()) {
      const invalid = parseNativeDocument(`features/invalid-${index}.feature`, source.join('\n'), 'current')
      expect(invalid.violations.map(value => value.message).join('\n')).toMatch(/(?:focused.*(?:Scenario|Scenario Outline)|invalid Gherkin)/iu)
    }
  })

  it('rejects obsolete focused rows instead of interpreting the legacy format', () => {
    const document = parseNativeDocument('specs/legacy.md', [
      '#### Scenario: Legacy enrollment',
      '- **ID**: `auth.login.legacy`',
      '- **EVIDENCE**: `unit::legacy`',
      '- **WHEN** legacy input is supplied',
      '- **THEN** legacy output is observed',
    ].join('\n'), 'current')

    expect(document.items.some(item => item.markerId === 'auth.login.legacy')).toBe(false)
    const messages = document.violations.map(value => value.message).join('\n')
    expect(messages).toContain('@focused-spec/format-inline')
    expect(messages).toContain('instructions --protocol 1 --topic workflow --json')
  })
})

describe('inline specification parsing', () => {
  function parse(source: string) {
    return inlineFormat.parse({
      projectRoot: '/project',
      path: 'specs/inline.md',
      source,
      options: null,
      signal: new AbortController().signal,
    })
  }

  it('rejects missing duplicate and malformed inline metadata', () => {
    const invalidSources = [
      [
        '#### Scenario: Missing evidence',
        '- **ID**: `inline.missing-evidence`',
        '- **WHEN** input arrives',
        '- **THEN** output is observed',
      ],
      [
        '#### Scenario: Duplicate identity',
        '- **ID**: `inline.first`',
        '- **ID**: `inline.second`',
        '- **EVIDENCE**: `unit::duplicate`',
        '- **WHEN** input arrives',
        '- **THEN** output is observed',
      ],
      [
        '#### Scenario: Missing outcome',
        '- **ID**: `inline.missing-then`',
        '- **EVIDENCE**: `unit::missing`',
        '- **WHEN** input arrives',
      ],
      [
        '- **ID**: `inline.detached`',
        '- **EVIDENCE**: `unit::detached`',
        '#### Scenario: Metadata cannot be borrowed',
        '- **WHEN** input arrives',
        '- **THEN** output is observed',
      ],
      [
        '#### Scenario: Malformed reference',
        '- **ID**: `inline.malformed`',
        '- **EVIDENCE**: unit::missing-backticks',
        '- **WHEN** input arrives',
        '- **THEN** output is observed',
      ],
    ]
    for (const source of invalidSources) {
      const parsed = parse(source.join('\n'))
      expect(parsed.diagnostics, source.join('\n')).not.toEqual([])
    }
  })

  it('ignores literal inline scenario examples', () => {
    const parsed = parse([
      '```md',
      '#### Scenario: Fenced example',
      '- **ID**: `literal.fenced`',
      '- **EVIDENCE**: `unit::fenced`',
      '- **WHEN** example input arrives',
      '- **THEN** example output appears',
      '```',
      '',
      '    #### Scenario: Indented example',
      '    - **ID**: `literal.indented`',
      '    - **EVIDENCE**: `unit::indented`',
      '    - **WHEN** example input arrives',
      '    - **THEN** example output appears',
      '',
      '> #### Scenario: Quoted example',
      '> - **ID**: `literal.quoted`',
      '> - **EVIDENCE**: `unit::quoted`',
      '> - **WHEN** example input arrives',
      '> - **THEN** example output appears',
      '',
      '#### Scenario: Real inline outcome',
      '- **ID**: `inline.real`',
      '- **EVIDENCE**: `unit::real`',
      '- **WHEN** real input arrives',
      '- **THEN** real output is observed',
    ].join('\n'))

    expect(parsed.diagnostics).toEqual([])
    expect(parsed.items.filter(item => item.evidence !== undefined)).toEqual([
      expect.objectContaining({ markerId: 'inline.real', evidence: ['unit::real'] }),
    ])
  })

  it('rejects REVISES without inventing ancestry', () => {
    const parsed = parse([
      '#### Scenario: No ancestry',
      '- **ID**: `inline.no-ancestry`',
      '- **EVIDENCE**: `unit::current`',
      '- **REVISES**: `inline.previous`',
      '- **WHEN** the current outcome is read',
      '- **THEN** only its own evidence applies',
    ].join('\n'))

    expect(parsed.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ focusedId: 'inline.no-ancestry', message: expect.stringMatching(/REVISES.*(?:unsupported|not supported)/iu) }),
    ]))
    expect(parsed.items).toEqual([expect.objectContaining({ markerId: 'inline.no-ancestry', evidence: ['unit::current'] })])
  })
})

describe('evidence registry parsing', () => {
  it('parses planned evidence and opaque runner selectors', () => {
    const registry = parseEvidenceRegistry([
      'scopes:',
      '  current:',
      '    auth.login.blocked-account:',
      '      evidence:',
      '        - planned:pytest::tests/test_auth.py::test_blocked',
    ].join('\n'))

    expect(registry.violations).toEqual([])
    expect(registry.entries).toEqual([
      expect.objectContaining({
        scope: 'current',
        id: 'auth.login.blocked-account',
        evidence: ['planned:pytest::tests/test_auth.py::test_blocked'],
      }),
    ])
    expect(parseEvidenceReference('planned:pytest::tests/test_auth.py::test_blocked')).toEqual({
      raw: 'planned:pytest::tests/test_auth.py::test_blocked',
      planned: true,
      runnerId: 'pytest',
      selector: 'tests/test_auth.py::test_blocked',
    })
  })

  it('rejects unknown and duplicate registry keys', () => {
    const duplicate = parseEvidenceRegistry([
      'scopes:',
      '  current:',
      '    auth.login.blocked-account:',
      '      evidence: ["unit::first"]',
      '    auth.login.blocked-account:',
      '      evidence: ["unit::second"]',
    ].join('\n'))
    const unknown = parseEvidenceRegistry([
      'scopes:',
      '  current:',
      '    auth.login.blocked-account:',
      '      evidence: ["unit::first"]',
      '      behavior: must remain in the native document',
    ].join('\n'))

    expect(duplicate.violations.map(value => value.message).join('\n')).toMatch(/(?:duplicate|unique)/iu)
    expect(unknown.violations.map(value => value.message).join('\n')).toMatch(/unknown registry entry key behavior/iu)
  })

  it('reports a missing evidence registry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-registry-'))
    roots.push(root)

    const registry = await loadEvidenceRegistry(root)

    expect(registry.entries).toEqual([])
    expect(registry.violations.map(value => value.message).join('\n')).toMatch(/(?:cannot read|missing).*evidence\.yaml/iu)
  })
})
