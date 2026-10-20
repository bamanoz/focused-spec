import type { FormatPlugin } from 'focused-spec/format'
import { CatalogError, decodeSelector, encodeSelector, readCatalog } from './catalog.js'

export default {
  apiVersion: 2,
  parse(request) {
    request.signal.throwIfAborted()
    try {
      const options = request.options
      if (options === null || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).length !== 1
        || !('runner' in options) || typeof options.runner !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(options.runner)) {
        throw new Error('scenario format requires exactly { runner: "<registered runner ID>" }')
      }
      decodeSelector(encodeSelector(request.path, 'catalog'))
      const catalog = readCatalog(request.path, request.source)
      return {
        items: catalog.scenarios.map(({ scenario, line }) => ({
          line, name: scenario.name, nativeIds: [scenario.id], markerId: scenario.id,
          evidence: [`${options.runner}::${encodeSelector(request.path, scenario.id)}`],
        })),
        diagnostics: [],
      }
    } catch (error) {
      return { items: [], diagnostics: [{ line: error instanceof CatalogError ? error.line : 1, message: error instanceof Error ? error.message : String(error) }] }
    }
  },
} satisfies FormatPlugin
