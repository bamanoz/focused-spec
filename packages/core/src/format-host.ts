import { pluginUrl } from './plugin-module.js'
import { isJsonValue } from './config.js'
import type { FormatPlugin } from './format-api.js'
import type { JsonValue } from './runner-api.js'

interface Request {
  readonly id: number
  readonly reference: string
  readonly operation: 'parse' | 'bind'
  readonly projectRoot: string
  readonly path?: string
  readonly source?: string
  readonly documents?: unknown
  readonly selection?: unknown
  readonly options: JsonValue
  readonly timeoutMs: number
}

let plugin: FormatPlugin | undefined
let busy = false
process.on('message', async message => {
  const request = message as Request
  try {
    if (busy) throw new Error('format host received concurrent requests')
    busy = true
    if (plugin === undefined) {
      const loaded = await import(pluginUrl(request.reference, request.projectRoot))
      const candidate: unknown = loaded.default
      if (typeof candidate !== 'object' || candidate === null || !('apiVersion' in candidate) || candidate.apiVersion !== 2 || !('parse' in candidate) || typeof candidate.parse !== 'function') {
        throw new Error('format module must default-export a FormatPlugin with apiVersion 2; migrate this project format using `./node_modules/.bin/focused-spec instructions --protocol 1 --topic workflow --json`')
      }
      if ('bind' in candidate && candidate.bind !== undefined && typeof candidate.bind !== 'function') throw new Error('format module bind must be a function when provided')
      plugin = candidate as FormatPlugin
    }
    let value: unknown
    if (request.operation === 'parse') {
      if (typeof request.path !== 'string' || typeof request.source !== 'string') throw new Error('format host received an invalid parse request')
      value = await plugin.parse({ projectRoot: request.projectRoot, path: request.path, source: request.source, options: request.options, signal: AbortSignal.timeout(request.timeoutMs) })
    } else {
      if (plugin.bind === undefined) {
        process.send?.({ id: request.id, ok: true, hasBind: false, json: 'null' })
        return
      }
      if (!Array.isArray(request.documents) || typeof request.selection !== 'object' || request.selection === null) throw new Error('format host received an invalid bind request')
      value = await plugin.bind({ projectRoot: request.projectRoot, documents: request.documents, selection: request.selection, options: request.options, signal: AbortSignal.timeout(request.timeoutMs) } as Parameters<NonNullable<FormatPlugin['bind']>>[0])
    }
    if (!isJsonValue(value)) throw new Error('format response must be JSON-compatible before transport')
    const json = JSON.stringify(value)
    if (json === undefined || json.length > 8_000_000) throw new Error('format response exceeded the JSON output limit')
    process.send?.({ id: request.id, ok: true, hasBind: plugin.bind !== undefined, json })
  } catch (error) {
    process.send?.({ id: request.id, ok: false, error: (error instanceof Error ? error.message : String(error)).slice(0, 16_384) })
  } finally {
    busy = false
  }
})
