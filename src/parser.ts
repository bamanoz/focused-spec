import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin'
import { IdGenerator } from '@cucumber/messages'
import type { FeatureChild, Scenario as GherkinScenario, Tag } from '@cucumber/messages'
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Heading, ListItem, Nodes, Paragraph, Parent, PhrasingContent } from 'mdast'
import type { EvidenceReference, NativeDocument, NativeItem, Violation } from './model.js'

export const STABLE_ID = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/u
const MARKER = /^<!--\s*focused-spec:id=([^\s>]+)\s*-->$/u
const NATIVE_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/u

function text(node: Nodes): string {
  if ('children' in node) return node.children.map(child => child.type === 'html' ? '' : text(child)).join('')
  return 'value' in node ? node.value : ''
}

function markdownDocument(path: string, source: string, scope: string): NativeDocument {
  const items: NativeItem[] = []
  const violations: Violation[] = []
  const tree = fromMarkdown(source)
  type Pending = { readonly id: string; readonly node: Nodes }
  const at = (node: Nodes): number => node.position?.start.line ?? 1
  const report = (node: Nodes, message: string, id?: string): void => {
    violations.push({ path, line: at(node), message, ...(id === undefined ? {} : { scenarioId: id }) })
  }
  const marker = (node: Nodes): string | undefined => {
    if (node.type !== 'html' || !node.value.includes('focused-spec:')) return undefined
    const id = MARKER.exec(node.value.trim())?.[1]
    if (id === undefined || !STABLE_ID.test(id)) {
      report(node, 'malformed focused marker; expected <!-- focused-spec:id=<lowercase.dotted-id> -->', id)
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
      if (node.children.slice(index + 1).some(next => text(next).trim() !== '')) report(child, 'inline focused marker must follow its native item', id)
    }
    if (pending !== undefined) {
      if (at(item ?? node) - (pending.node.position?.end.line ?? at(pending.node)) > 2) report(pending.node, 'focused marker is detached from a native item', pending.id)
      else ids.unshift(pending.id)
    }
    if (ids.length > 1) for (const id of ids) report(item ?? node, 'multiple focused markers cannot bind one native item', id)
    const name = text(node).trim()
    if (ids.length > 0 && name === '') report(item ?? node, 'focused marker requires a non-empty native item', ids[0])
    const explicitAnchor = node.type === 'heading' ? /\{#([^}\s]+)\}\s*$/u.exec(name)?.[1] : undefined
    items.push({ path, scope, line: at(item ?? node), name,
      nativeIds: explicitAnchor === undefined ? leadingNativeId(node.children) : [explicitAnchor],
      ...(ids.length === 1 ? { markerId: ids[0]! } : {}) })
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
          if (firstChild?.type === 'strong' && /^(?:ID|EVIDENCE|REVISES)$/u.test(text(firstChild))) report(node, 'obsolete inline focused rows; migrate to a native binding and the evidence registry; obtain upgrade guidance from the installed CLI: `./node_modules/.bin/focused-spec instructions --protocol 1 --topic workflow --json`')
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
  return { path, scope, items, violations }
}

function featureDocument(path: string, source: string, scope: string): NativeDocument {
  const items: NativeItem[] = []
  const violations: Violation[] = []
  const inspectTags = (tags: readonly Tag[], scenario?: GherkinScenario): void => {
    const focused = tags.filter(tag => tag.name.startsWith('@focused.'))
    for (const tag of focused) {
      const id = tag.name.slice('@focused.'.length)
      if (scenario === undefined || !STABLE_ID.test(id) || focused.length !== 1) {
        violations.push({ path, line: tag.location.line, scenarioId: id, message: 'focused tag must uniquely bind a Scenario or Scenario Outline with a lowercase dotted ID' })
      }
    }
    if (scenario !== undefined) {
      items.push({ path, scope, line: scenario.location.line, name: scenario.name,
        nativeIds: tags.filter(tag => !tag.name.startsWith('@focused.')).map(tag => tag.name.slice(1)),
        ...(focused.length === 1 && STABLE_ID.test(focused[0]!.name.slice('@focused.'.length)) ? { markerId: focused[0]!.name.slice('@focused.'.length) } : {}) })
      for (const examples of scenario.examples) inspectTags(examples.tags)
    }
  }
  const visit = (children: readonly FeatureChild[]): void => {
    for (const child of children) {
      if (child.scenario !== undefined) inspectTags(child.scenario.tags, child.scenario)
      if (child.rule !== undefined) { inspectTags(child.rule.tags); visit(child.rule.children) }
    }
  }
  try {
    const document = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher()).parse(source)
    if (document.feature !== undefined) { inspectTags(document.feature.tags); visit(document.feature.children) }
  } catch (error) {
    violations.push({ path, message: `invalid Gherkin: ${error instanceof Error ? error.message : String(error)}` })
  }
  return { path, scope, items, violations }
}

export function parseNativeDocument(path: string, source: string, scope: string): NativeDocument {
  return /\.feature$/iu.test(path) ? featureDocument(path, source, scope) : markdownDocument(path, source, scope)
}

export function parseEvidenceReference(raw: string): EvidenceReference | { readonly error: string } {
  const planned = raw.startsWith('planned:')
  const value = planned ? raw.slice('planned:'.length) : raw
  const separator = value.indexOf('::')
  if (separator <= 0 || separator === value.length - 2) return { error: 'expected [planned:]<runner-id>::<selector>' }
  return { raw, planned, runnerId: value.slice(0, separator), selector: value.slice(separator + 2) }
}
