import gherkin from '@focused-spec/format-gherkin'
import markdown from '@focused-spec/format-markdown'
import type { NativeDocument } from '../packages/core/dist/index.js'

export type TrustedFormat = 'gherkin' | 'markdown'

export function parseTrustedNativeDocument(
  format: TrustedFormat,
  path: string,
  source: string,
  scope: string,
): NativeDocument {
  const plugin = format === 'gherkin' ? gherkin : markdown
  const parsed = plugin.parse({ path, source, options: null, signal: new AbortController().signal })
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
