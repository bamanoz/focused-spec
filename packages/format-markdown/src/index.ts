import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Heading, ListItem, Nodes, Paragraph, Parent, PhrasingContent } from 'mdast'
import type { FormatDiagnostic, FormatPlugin, ParsedItem, ParseRequest } from 'focused-spec/format'

const validFocusedId = (id: string): boolean => id.trim() !== '' && !/\p{Cc}/u.test(id)
const MARKER = /^<!--\s*focused-spec:id=([^\s>]+)\s*-->$/u
const NATIVE_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/u

function text(node: Nodes): string {
  if ('children' in node) return node.children.map(child => child.type === 'html' ? '' : text(child)).join('')
  return 'value' in node ? node.value : ''
}

function parseMarkdown(source: string): { items: ParsedItem[]; diagnostics: FormatDiagnostic[] } {
  const items: ParsedItem[] = []
  const diagnostics: FormatDiagnostic[] = []
  const tree = fromMarkdown(source)
  type Pending = { readonly id: string; readonly node: Nodes }
  const at = (node: Nodes): number => node.position?.start.line ?? 1
  const report = (node: Nodes, message: string, id?: string): void => {
    diagnostics.push({ line: at(node), message, ...(id === undefined ? {} : { focusedId: id }) })
  }
  const marker = (node: Nodes): string | undefined => {
    if (node.type !== 'html' || !node.value.includes('focused-spec:')) return undefined
    const id = MARKER.exec(node.value.trim())?.[1]
    if (id === undefined || !validFocusedId(id)) {
      report(node, 'malformed focused marker; expected <!-- focused-spec:id=<opaque-id> -->', id)
      return undefined
    }
    return id
  }
  const leadingNativeId = (children: readonly PhrasingContent[]): string[] => {
    let index = 0
    while (children[index]?.type === 'text' && /^(?:\s*\[[ xX]\]\s*)?\s*$/u.test(text(children[index]!))) index += 1
    const first = children[index]
    if (first?.type !== 'strong' && first?.type !== 'inlineCode') return []
    const id = text(first)
    if (!NATIVE_ID.test(id)) return []
    const rest = children.slice(index + 1).map(child => text(child)).join('')
    return rest.trim() === '' || /^\s*:/u.test(rest) ? [id] : []
  }
  const register = (node: Heading | Paragraph, pending?: Pending, item?: ListItem): void => {
    const ids: string[] = []
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index]!
      const id = marker(child)
      if (id === undefined) continue
      ids.push(id)
      if (node.type === 'heading') report(child, 'inline focused markers are not supported on headings', id)
      if (node.children.slice(index + 1).some(next => (next.position?.end.offset ?? 0) > (child.position?.end.offset ?? 0) && (text(next).trim() !== '' || next.type !== 'text'))) report(child, 'inline focused marker must follow its native item', id)
      if (item !== undefined && (node.position?.end.offset ?? 0) < (item.children.at(-1)?.position?.end.offset ?? 0)) report(child, 'inline focused marker must be at the end of its list item', id)
    }
    if (pending !== undefined) {
      if (at(node) - (pending.node.position?.end.line ?? at(pending.node)) > 2) report(pending.node, 'focused marker is detached from a native item', pending.id)
      else ids.unshift(pending.id)
    }
    if (ids.length > 1) for (const id of ids) report(item ?? node, 'multiple focused markers cannot bind one native item', id)
    const name = text(node).trim()
    if (ids.length > 0 && name === '') report(item ?? node, 'focused marker requires a non-empty native item', ids[0])
    const explicitAnchor = node.type === 'heading' ? /\{#([^}\s]+)\}\s*$/u.exec(name)?.[1] : undefined
    items.push({
      line: at(node),
      name,
      nativeIds: explicitAnchor === undefined ? leadingNativeId(node.children) : [explicitAnchor],
      ...(ids.length === 1 ? { markerId: ids[0]! } : {}),
    })
  }
  const visit = (parent: Parent, initial?: Pending, item?: ListItem): void => {
    let pending = initial
    for (const node of parent.children) {
      if (node.type === 'html') {
        const id = marker(node)
        if (pending !== undefined) report(pending.node, id === undefined ? 'focused marker is detached from a native item' : 'multiple focused markers cannot bind one native item', pending.id)
        pending = id === undefined ? undefined : { id, node }
        continue
      }
      if (node.type === 'heading' || node.type === 'paragraph') {
        register(node, pending, item)
      } else if (node.type === 'list') {
        visit(node, pending)
      } else if (node.type === 'listItem') {
        const first = node.children[0]
        if (first?.type === 'paragraph') {
          const firstChild = first.children[0]
          if (firstChild?.type === 'strong' && /^(?:ID|EVIDENCE|REVISES)$/u.test(text(firstChild))) report(node, 'inline focused rows require the explicitly selected @focused-spec/format-inline adapter; REVISES is unsupported; obtain guidance from the installed CLI: `./node_modules/.bin/focused-spec instructions --protocol 1 --topic workflow --json`')
        }
        visit(node, pending, node)
      } else {
        if (pending !== undefined) report(pending.node, 'focused marker is detached from a native item', pending.id)
        if ('children' in node) visit(node)
      }
      pending = undefined
    }
    if (pending !== undefined) report(pending.node, 'focused marker is detached from a native item', pending.id)
  }
  visit(tree)
  return { items, diagnostics }
}

export default {
  apiVersion: 2,
  parse({ source }: ParseRequest) {
    return parseMarkdown(source)
  },
} satisfies FormatPlugin
