import { isAbsolute } from 'node:path'
import type { FormatPlugin } from 'focused-spec/format'
import { CatalogError, encodeSelector, readCatalog } from './catalog.js'

interface Options { readonly runner: string; readonly command: string }

function options(value: unknown): Options {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('.NET scenario format requires { runner: "<registered runner ID>", command?: "dotnet" }')
  const fields = Object.keys(value)
  if (fields.some(field => field !== 'runner' && field !== 'command') || !('runner' in value) || typeof value.runner !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value.runner) || ('command' in value && typeof value.command !== 'string')) {
    throw new Error('.NET scenario format requires { runner: "<registered runner ID>", command?: "dotnet" }')
  }
  const command = 'command' in value ? value.command as string : 'dotnet'
  if (!command || command !== command.trim() || /[\u0000-\u001f\u007f-\u009f]/u.test(command) || (!isAbsolute(command) && /[\\/\s]/u.test(command))) throw new Error('.NET scenario command must be one executable name or absolute path')
  return { runner: value.runner, command }
}

export default {
  apiVersion: 2,
  async parse(request) {
    request.signal.throwIfAborted()
    try {
      const configured = options(request.options)
      const catalog = await readCatalog(request.path, request.source, request.signal, configured.command)
      return {
        items: catalog.scenarios.map(scenario => ({
          line: scenario.line,
          name: scenario.name,
          nativeIds: [scenario.id],
          markerId: scenario.id,
          evidence: [`${configured.runner}::${encodeSelector(request.path, scenario.id)}`],
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
