import type { FormatPlugin } from 'focused-spec/format'
import { CatalogError, encodeSelector, readCatalog } from './catalog.js'

function runnerOption(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1
    || !('runner' in value) || typeof value.runner !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value.runner)) {
    throw new Error('Go scenario format requires exactly { runner: "<registered runner ID>" }')
  }
  return value.runner
}

export default {
  apiVersion: 2,
  async parse(request) {
    request.signal.throwIfAborted()
    try {
      const runner = runnerOption(request.options)
      const catalog = await readCatalog(request.path, request.source, request.signal)
      return {
        items: catalog.scenarios.map(scenario => ({
          line: scenario.line,
          name: scenario.name,
          nativeIds: [scenario.id],
          markerId: scenario.id,
          evidence: [`${runner}::${encodeSelector(request.path, scenario.id)}`],
        })),
        diagnostics: [],
      }
    } catch (error) {
      request.signal.throwIfAborted()
      return {
        items: [],
        diagnostics: [{
          line: error instanceof CatalogError ? error.line : 1,
          message: error instanceof Error ? error.message : String(error),
        }],
      }
    }
  },
} satisfies FormatPlugin
