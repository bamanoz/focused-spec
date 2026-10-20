import type { ExecutionEvent } from './runner-api.js'
import { isJsonValue } from './config.js'

const MAX_EVENTS = 256
const MAX_BYTES = 65_536
const TRUNCATED: ExecutionEvent = { kind: 'truncated', message: 'Additional execution events omitted' }
const MARKER_BYTES = Buffer.byteLength(JSON.stringify(TRUNCATED)) + 1

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function event(value: unknown): ExecutionEvent {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid execution event: expected an object')
  const item = value as Record<string, unknown>
  if (!nonblank(item.kind) || !nonblank(item.message) || (Object.hasOwn(item, 'data') && !isJsonValue(item.data))) {
    throw new Error('invalid execution event: requires nonblank kind and message and optional JSON data')
  }
  if (Object.keys(item).some(key => key !== 'kind' && key !== 'message' && key !== 'data')) throw new Error('invalid execution event fields')
  return value as ExecutionEvent
}

/** Retains whole records; callers own this collector and its synchronous sink. */
export function createEventCollector(): { events: ExecutionEvent[]; emit: (value: ExecutionEvent) => void } {
  const events: ExecutionEvent[] = []
  let bytes = 2 // JSON array delimiters
  let stopped = false
  return {
    events,
    emit(value) {
      if (stopped) return
      const size = Buffer.byteLength(JSON.stringify(value)) + (events.length === 0 ? 0 : 1)
      if (events.length >= MAX_EVENTS - 1 || bytes + size + MARKER_BYTES > MAX_BYTES) {
        events.push({ ...TRUNCATED })
        stopped = true
      } else {
        events.push(value)
        bytes += size
      }
    },
  }
}

/** Validates the complete supplied stream, including the omitted suffix. */
export function retainExecutionEvents(value: unknown): ExecutionEvent[] {
  if (!Array.isArray(value)) throw new Error('invalid execution events: expected an array')
  const collector = createEventCollector()
  for (const candidate of value) {
    const validated = event(candidate)
    collector.emit(validated)
  }
  return collector.events
}
