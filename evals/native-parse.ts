import gherkin from '@focused-spec/format-gherkin'
import markdown from '@focused-spec/format-markdown'
import inline from '@focused-spec/format-inline'
import type { NativeDocument, NativeItem } from '../packages/core/dist/index.js'

export type TrustedFormat = 'gherkin' | 'markdown' | 'inline'

export function parseTrustedNativeDocument(
  format: TrustedFormat,
  path: string,
  source: string,
  scope: string,
  projectRoot = process.cwd(),
): NativeDocument {
  const plugin = format === 'gherkin' ? gherkin : format === 'inline' ? inline : markdown
  const parsed = plugin.parse({ projectRoot, path, source, options: null, signal: new AbortController().signal })
  return {
    path,
    scope,
    items: parsed.items.map(item => ({ ...item, path, scope })),
    violations: parsed.diagnostics.map(diagnostic => ({
      path,
      ...(diagnostic.line === undefined ? {} : { line: diagnostic.line }),
      ...(diagnostic.focusedId === undefined ? {} : { scenarioId: diagnostic.focusedId }),
      message: diagnostic.message,
    })),
  }
}

export function nativeItemText(format: TrustedFormat, source: string, item: NativeItem): string {
  const lines = source.split(/\r?\n/u)
  const start = item.line - 1
  if (format === 'gherkin') {
    let end = item.line
    while (end < lines.length && !/^\s*(?:Feature|Rule|Background|Scenario(?: Outline)?):/u.test(lines[end]!)) end += 1
    return lines.slice(start, end).join('\n')
  }
  const heading = lines[start]?.match(/^(#{1,6})\s/u)?.[1]
  if (heading === undefined) return item.name
  let end = start + 1
  while (end < lines.length) {
    const nextHeading = lines[end]?.match(/^(#{1,6})\s/u)?.[1]
    if (nextHeading !== undefined && nextHeading.length <= heading.length) break
    end += 1
  }
  return lines.slice(start, end).join('\n').replace(/(`{3,}|~{3,})[^]*?\1/gu, '')
}
