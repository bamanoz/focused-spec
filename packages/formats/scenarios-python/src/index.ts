import type { FormatPlugin } from 'focused-spec/format'
import { CatalogError, encodeSelector, readCatalog, validPythonCommand } from './catalog.js'

interface FormatOptions {
  readonly runner: string
  readonly command: string
}

function formatOptions(value: unknown): FormatOptions {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Python scenario format options must be { runner: "<registered runner ID>", command?: "python3" }')
  }
  const candidate = value as Record<string, unknown>
  if (Object.keys(candidate).some(key => key !== 'runner' && key !== 'command')
    || typeof candidate.runner !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(candidate.runner)
    || (candidate.command !== undefined && (typeof candidate.command !== 'string' || !validPythonCommand(candidate.command)))) {
    throw new Error('Python scenario format options must be exactly { runner: "<registered runner ID>", command?: "<Python executable>" }')
  }
  return { runner: candidate.runner, command: typeof candidate.command === 'string' ? candidate.command : 'python3' }
}

export default {
  apiVersion: 2,
  async parse(request) {
    request.signal.throwIfAborted()
    try {
      const options = formatOptions(request.options)
      const catalog = await readCatalog(request.path, request.source, request.signal, options.command)
      return {
        items: catalog.scenarios.map(scenario => ({
          line: scenario.line,
          name: scenario.name,
          nativeIds: [scenario.id],
          markerId: scenario.id,
          evidence: [`${options.runner}::${encodeSelector(request.path, scenario.id)}`],
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
