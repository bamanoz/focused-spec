import { fromMarkdown } from 'mdast-util-from-markdown'
import type { ListItem, Nodes, Paragraph } from 'mdast'
import type { FormatDiagnostic, FormatPlugin, ParsedItem, ParseRequest, ParseResult, SourceLocation } from 'focused-spec/format'

const METADATA = new Set(['ID', 'EVIDENCE', 'WHEN', 'THEN', 'REVISES'])
const validId = (id: string): boolean => id.trim() !== '' && !/\p{Cc}/u.test(id)

function text(node: Nodes): string {
  if ('children' in node) return node.children.map(text).join('')
  return 'value' in node ? node.value : ''
}

interface Row {
  readonly label: string
  readonly line: number
  readonly value?: string
  readonly valid: boolean
}

function metadata(item: ListItem, source: string): Row | undefined {
  const paragraph = item.children[0]
  if (paragraph?.type !== 'paragraph') return undefined
  const first = paragraph.children[0]
  const label = first?.type === 'strong' ? text(first) : /^(ID|EVIDENCE|WHEN|THEN|REVISES)\b/u.exec(text(paragraph))?.[1]
  if (label === undefined || !METADATA.has(label)) return undefined
  const line = item.position?.start.line ?? 1
  if (first?.type !== 'strong' || item.children.length !== 1) return { label, line, valid: false }
  const tail = paragraph.children.slice(1)
  if (label === 'WHEN' || label === 'THEN') {
    const value = tail.map(text).join('').trim()
    return { label, line, value, valid: value !== '' }
  }
  const code = tail.find(node => node.type === 'inlineCode')
  const prefix = tail[0]
  if (code === undefined || prefix?.type !== 'text' || !/^:\s*$/u.test(prefix.value)
    || tail.some(node => node !== code && (node !== prefix && text(node).trim() !== '' || node.type !== 'text' && node !== code))) {
    return { label, line, valid: false }
  }
  const start = code.position?.start.offset
  const end = code.position?.end.offset
  const literal = start === undefined || end === undefined ? undefined : source.slice(start, end)
  const matched = literal === undefined ? undefined : /^(`+)([\s\S]*?)\1$/u.exec(literal)
  const value = matched?.[2] ?? code.value
  return { label, line, value, valid: value.trim() !== '' && !/[\r\n]/u.test(value) }
}

function parseInline({ path, source }: ParseRequest): ParseResult {
  const tree = fromMarkdown(source)
  const items: ParsedItem[] = []
  const diagnostics: FormatDiagnostic[] = []
  let scenario: { line: number; name: string; rows: Row[] } | undefined
  const report = (line: number, message: string, ids: readonly string[]): void => {
    if (ids.length === 0) diagnostics.push({ line, message })
    else for (const focusedId of new Set(ids)) diagnostics.push({ line, message, focusedId })
  }
  const finish = (): void => {
    if (scenario === undefined) return
    const { line, name, rows } = scenario
    const idRows = rows.filter(row => row.label === 'ID')
    const ids = idRows.flatMap(row => row.value === undefined ? [] : [row.value])
    for (const label of ['ID', 'WHEN', 'THEN']) {
      const matches = rows.filter(row => row.label === label)
      if (matches.length !== 1) report(matches[1]?.line ?? line, `inline scenario requires exactly one ${label} row; found ${matches.length}`, ids)
    }
    const evidenceRows = rows.filter(row => row.label === 'EVIDENCE')
    if (evidenceRows.length === 0) report(line, 'inline scenario requires at least one EVIDENCE row', ids)
    if (name.trim() === '') report(line, 'inline scenario requires a non-empty name', ids)
    for (const row of rows) {
      if (row.label === 'REVISES') report(row.line, 'REVISES is unsupported; inline identity has no ancestry or evidence inheritance; obtain guidance: `./node_modules/.bin/focused-spec instructions --protocol 1 --topic workflow --json`', ids)
      else if (!row.valid) report(row.line, `malformed inline ${row.label} metadata`, ids)
    }
    const id = idRows.length === 1 && idRows[0]!.valid ? idRows[0]!.value : undefined
    if (id !== undefined && !validId(id)) report(idRows[0]!.line, 'inline ID must be nonblank and contain no control characters', ids)
    if (id !== undefined && validId(id)) {
      const evidence = evidenceRows.flatMap(row => row.valid && row.value !== undefined ? [row.value] : [])
      const evidenceLocations: SourceLocation[] = evidenceRows.flatMap(row => row.valid && row.value !== undefined ? [{ path, line: row.line }] : [])
      items.push({ line, name, nativeIds: [], markerId: id, evidence, evidenceLocations })
    }
    scenario = undefined
  }
  const row = (item: ListItem): void => {
    const parsed = metadata(item, source)
    if (parsed === undefined) return
    if (scenario === undefined) report(parsed.line, `detached inline ${parsed.label} metadata`, [])
    else scenario.rows.push(parsed)
  }
  for (const node of tree.children) {
    if (node.type === 'heading') {
      if (node.depth <= 4) finish()
      const heading = text(node)
      if (node.depth === 4 && /^Scenario:/u.test(heading)) scenario = { line: node.position?.start.line ?? 1, name: heading.slice('Scenario:'.length).trim(), rows: [] }
    } else if (node.type === 'list') {
      for (const item of node.children) row(item)
    } else if (node.type === 'paragraph') {
      // Metadata is a list grammar; a lookalike paragraph must not vanish.
      const first = (node as Paragraph).children[0]
      if (first?.type === 'strong' && METADATA.has(text(first))) report(node.position?.start.line ?? 1, 'inline metadata must be a scenario-local list row', scenario?.rows.flatMap(value => value.label === 'ID' && value.value !== undefined ? [value.value] : []) ?? [])
    }
    // Code and block quotes are literal examples, never scenario declarations.
  }
  finish()
  return { items, diagnostics }
}

export default {
  apiVersion: 2,
  parse: parseInline,
} satisfies FormatPlugin
