import { pathToFileURL } from 'node:url'
import { isAbsolute } from 'node:path'
import { createEventCollector } from 'focused-spec/runner'
import { verifySpecification, validateScenario } from '@focused-spec/scenarios-typescript'
import type { Driver } from '@focused-spec/scenarios-typescript'
import type { WorkItem } from './index.js'

const controller = new AbortController()
let started = false
// A terminated plugin host must not leave an orphan worker running application code.
process.once('disconnect', () => process.exit(1))
process.on('message', (value: unknown) => {
  if (value === null || typeof value !== 'object' || !('kind' in value)) throw new Error('invalid worker request')
  if (value.kind === 'abort') { controller.abort(); return }
  if (value.kind !== 'run' || started || !('work' in value) || !Array.isArray(value.work)) throw new Error('invalid worker execution request')
  started = true
  void run(value.work).catch(error => { console.error(error); process.exit(1) })
})

async function send(value: unknown): Promise<void> {
  await new Promise<void>((done, reject) => {
    if (!process.send) return reject(new Error('worker IPC unavailable'))
    process.send(value, error => error ? reject(error) : done())
  })
}

async function run(items: unknown[]): Promise<void> {
  for (const item of items) {
    if (item === null || typeof item !== 'object' || !('targetId' in item) || typeof item.targetId !== 'string'
      || !('driver' in item) || typeof item.driver !== 'string' || !isAbsolute(item.driver) || !('scenario' in item)) throw new Error('invalid worker target')
    validateScenario(item.scenario)
    const work = item as WorkItem
    const collector = createEventCollector()
    try {
      controller.signal.throwIfAborted()
      // The driver module is selected by the consumer's runtime suite declaration.
      const module: { default?: unknown } = await import(pathToFileURL(work.driver).href)
      await verifySpecification(module.default as Driver<unknown>, work.scenario, {
        signal: controller.signal,
        onEvent(event) {
          collector.emit(event.kind === 'observation'
            ? { kind: event.kind, message: event.name, data: 'value' in event ? { value: event.value! } : { text: event.text } }
            : event)
        },
      })
      await send({ targetId: work.targetId, status: 'pass', events: collector.events })
    } catch (error) {
      const diagnostic = error instanceof Error ? (error.stack ?? error.message) : String(error)
      await send({ targetId: work.targetId, status: 'fail', diagnostic: diagnostic.slice(0, 8000), events: collector.events })
    }
  }
  process.exit(0)
}
