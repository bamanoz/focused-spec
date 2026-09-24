import { pathToFileURL } from 'node:url'
import type { JsonValue, ResolvedTarget, RunnerPlugin } from './runner-api.js'

interface HostRequestBase {
  readonly modulePath: string
  readonly projectRoot: string
  readonly cwd: string
  readonly runnerId: string
  readonly options: JsonValue
  readonly timeoutMs: number
}

interface ResolveHostRequest extends HostRequestBase {
  readonly operation: 'resolve'
  readonly selectors: readonly string[]
}

interface RunHostRequest extends HostRequestBase {
  readonly operation: 'run'
  readonly targets: readonly ResolvedTarget[]
}

interface PartitionHostRequest extends HostRequestBase {
  readonly operation: 'partition'
  readonly targets: readonly ResolvedTarget[]
}

type HostRequest = ResolveHostRequest | RunHostRequest | PartitionHostRequest

interface HostResponse {
  readonly ok: boolean
  readonly value?: unknown
  readonly error?: string
}

let handled = false
process.on('message', async message => {
  if (handled) return
  handled = true
  const request = message as HostRequest
  try {
    // The module path is selected by the repository configuration, so a static import cannot represent it.
    const loaded = await import(pathToFileURL(request.modulePath).href)
    const plugin = loaded.default as RunnerPlugin | undefined
    if (plugin === undefined || plugin.apiVersion !== 1 || typeof plugin.resolve !== 'function' || typeof plugin.run !== 'function') {
      throw new Error('runner module must default-export a RunnerPlugin with apiVersion 1')
    }
    if (plugin.partition !== undefined && typeof plugin.partition !== 'function') {
      throw new Error('runner partition must be a function when provided')
    }
    const context = {
      projectRoot: request.projectRoot,
      cwd: request.cwd,
      runnerId: request.runnerId,
      options: request.options,
      signal: AbortSignal.timeout(request.timeoutMs),
    }
    const value = request.operation === 'resolve'
      ? await plugin.resolve({ ...context, selectors: request.selectors })
      : request.operation === 'run'
        ? await plugin.run({ ...context, targets: request.targets })
        : plugin.partition === undefined
          ? { supported: false }
          : { supported: true, response: await plugin.partition({ ...context, targets: request.targets }) }
    process.send?.({ ok: true, value } satisfies HostResponse, () => process.disconnect())
  } catch (error) {
    process.send?.({
      ok: false,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    } satisfies HostResponse, () => process.disconnect())
  }
})
