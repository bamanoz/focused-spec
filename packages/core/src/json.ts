import type { JsonValue } from './runner-api.js'

export function isJsonValue(value: unknown): value is JsonValue {
  const active = new Set<object>()
  function visit(candidate: unknown): boolean {
    if (candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean') return true
    if (typeof candidate === 'number') return Number.isFinite(candidate)
    if (typeof candidate !== 'object') return false
    if (active.has(candidate)) return false
    active.add(candidate)
    try {
      const array = Array.isArray(candidate)
      const prototype: unknown = Object.getPrototypeOf(candidate)
      if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false
      const keys = Reflect.ownKeys(candidate)
      if (array) {
        if (keys.length !== candidate.length + 1) return false
        for (let index = 0; index < candidate.length; index += 1) {
          const property = Object.getOwnPropertyDescriptor(candidate, String(index))
          if (property === undefined || !property.enumerable || !('value' in property) || !visit(property.value)) return false
        }
        return true
      }
      for (const key of keys) {
        if (typeof key !== 'string') return false
        const property = Object.getOwnPropertyDescriptor(candidate, key)!
        if (!property.enumerable || !('value' in property) || !visit(property.value)) return false
      }
      return true
    } finally {
      active.delete(candidate)
    }
  }
  return visit(value)
}
