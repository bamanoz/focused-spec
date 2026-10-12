import { pluginUrl } from './plugin-module.js'
import type { FormatPlugin } from './format-api.js'
import type { JsonValue } from './runner-api.js'

interface Request {
  readonly id: number
  readonly reference: string
  readonly projectRoot: string
  readonly path: string
  readonly source: string
  readonly options: JsonValue
  readonly timeoutMs: number
}

let plugin: FormatPlugin | undefined
let busy = false
process.on('message', async message => {
  const request = message as Request
  try {
    if (busy) throw new Error('format host received concurrent parsing requests')
    busy = true
    if (plugin === undefined) {
      const loaded = await import(pluginUrl(request.reference, request.projectRoot))
      const candidate: unknown = loaded.default
      if (typeof candidate !== 'object' || candidate === null || !('apiVersion' in candidate) || candidate.apiVersion !== 1 || !('parse' in candidate) || typeof candidate.parse !== 'function') throw new Error('format module must default-export a FormatPlugin with apiVersion 1')
      plugin = candidate as FormatPlugin
    }
    const value = await plugin.parse({ path: request.path, source: request.source, options: request.options, signal: AbortSignal.timeout(request.timeoutMs) })
    const json = JSON.stringify(value)
    if (json === undefined || json.length > 8_000_000) throw new Error('format response exceeded the JSON output limit')
    process.send?.({ id: request.id, ok: true, json })
  } catch (error) {
    process.send?.({ id: request.id, ok: false, error: (error instanceof Error ? error.message : String(error)).slice(0, 16_384) })
  } finally {
    busy = false
  }
})
