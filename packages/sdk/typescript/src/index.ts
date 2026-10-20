import { deepStrictEqual } from 'node:assert/strict'

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }

export type ObservationEvent =
  | { readonly kind: 'observation'; readonly name: string; readonly value: JsonValue; readonly text?: never }
  | { readonly kind: 'observation'; readonly name: string; readonly text: string; readonly value?: never }

export type ExecutionEvent =
  | ObservationEvent
  | { readonly kind: 'explanation'; readonly message: string; readonly data?: JsonValue }
  | { readonly kind: 'truncated'; readonly message: string }

export interface Scenario<Given = JsonValue, When = JsonValue, Expect = JsonValue> {
  readonly id: string
  readonly name: string
  readonly given: Given
  readonly when: When
  readonly expect: Expect
}

export interface Suite<Given = JsonValue, When = JsonValue, Expect = JsonValue> {
  readonly driver: string
  readonly scenarios: readonly Scenario<Given, When, Expect>[]
}

export interface DriverContext {
  readonly scenarioId: string
  readonly signal?: AbortSignal
  readonly explain: (message: string, data?: JsonValue) => void
}

export interface Driver<Subject, Given = JsonValue, When = JsonValue, Expect = JsonValue> {
  given(value: Given, context: DriverContext): Subject | Promise<Subject>
  when(subject: Subject, value: When, context: DriverContext): Expect | Promise<Expect>
  cleanup?(subject: Subject, context: DriverContext): void | Promise<void>
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError(`${label} must be a plain data object`)
  }
  return value as Record<string, unknown>
}

function dataProperties(value: object, label: string): Record<string, PropertyDescriptor> {
  if (Object.getOwnPropertySymbols(value).length !== 0) throw new TypeError(`${label} cannot have symbol keys`)
  const properties = Object.getOwnPropertyDescriptors(value)
  for (const [key, property] of Object.entries(properties)) {
    if (!('value' in property) || (!property.enumerable && !(Array.isArray(value) && key === 'length'))) {
      throw new TypeError(`${label}.${key} must be an enumerable data property`)
    }
  }
  return properties
}

function fields(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  const object = record(value, label)
  const properties = dataProperties(object, label)
  if (Object.keys(properties).length !== keys.length || keys.some(key => !Object.hasOwn(properties, key))) {
    throw new TypeError(`${label} requires exactly ${keys.join(', ')}`)
  }
  return object
}

export function validateJson(value: unknown): asserts value is JsonValue {
  const ancestors = new Set<object>()
  function visit(item: unknown, label: string): void {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return
    if (typeof item === 'number' && Number.isFinite(item)) return
    if (typeof item !== 'object' || item === null) throw new TypeError(`${label} must be JSON-compatible`)
    if (ancestors.has(item)) throw new TypeError(`${label} cannot contain a cycle`)
    if (!Array.isArray(item)) record(item, label)
    const properties = dataProperties(item, label)
    ancestors.add(item)
    try {
      if (Array.isArray(item)) {
        if (Object.keys(properties).length !== item.length + 1) throw new TypeError(`${label} must be a dense array without extra properties`)
        for (let index = 0; index < item.length; index++) {
          const property = properties[String(index)]
          if (property === undefined) throw new TypeError(`${label} must not contain array holes`)
          visit(property.value, `${label}[${index}]`)
        }
      } else {
        for (const [key, property] of Object.entries(properties)) visit(property.value, `${label}.${key}`)
      }
    } finally {
      ancestors.delete(item)
    }
  }
  visit(value, 'value')
}

export function validateScenario(value: unknown): asserts value is Scenario {
  const scenario = fields(value, ['id', 'name', 'given', 'when', 'expect'], 'scenario')
  if (typeof scenario.id !== 'string' || !scenario.id.trim() || /[\u0000-\u001f\u007f-\u009f]/u.test(scenario.id)) {
    throw new TypeError('scenario.id must contain non-whitespace and no control characters')
  }
  if (typeof scenario.name !== 'string' || !scenario.name.trim()) throw new TypeError('scenario.name must be nonblank')
  validateJson(scenario.given)
  validateJson(scenario.when)
  validateJson(scenario.expect)
}

export function defineSuite<const S extends Suite<unknown, unknown, unknown>>(value: S): S {
  const suite = fields(value, ['driver', 'scenarios'], 'suite')
  if (typeof suite.driver !== 'string' || !suite.driver.trim() || suite.driver.includes('\0')) throw new TypeError('suite.driver must be a nonblank module path')
  if (!Array.isArray(suite.scenarios)) throw new TypeError('suite.scenarios must be an array')
  const properties = dataProperties(suite.scenarios, 'suite.scenarios')
  if (Object.keys(properties).length !== suite.scenarios.length + 1) throw new TypeError('suite.scenarios must be a dense array without extra properties')
  const ids = new Set<string>()
  for (let index = 0; index < suite.scenarios.length; index++) {
    const scenario: unknown = properties[String(index)]?.value
    validateScenario(scenario)
    if (ids.has(scenario.id)) throw new TypeError(`duplicate scenario ID: ${scenario.id}`)
    ids.add(scenario.id)
  }
  return value
}

export interface VerifyOptions {
  readonly signal?: AbortSignal
  readonly onEvent?: (event: ExecutionEvent) => void
}

const ignoreExplanation = (_message: string, _data?: JsonValue): void => {}

function observation(onEvent: VerifyOptions['onEvent'], name: string, value: JsonValue): void {
  if (onEvent === undefined) return
  onEvent({ kind: 'observation', name, value: structuredClone(value) })
}

function explanation(onEvent: NonNullable<VerifyOptions['onEvent']>): DriverContext['explain'] {
  return (message, data) => {
    if (typeof message !== 'string' || !message.trim()) throw new TypeError('explanation message must be nonblank')
    if (data === undefined) {
      onEvent({ kind: 'explanation', message })
      return
    }
    validateJson(data)
    onEvent({ kind: 'explanation', message, data: structuredClone(data) })
  }
}

export async function verifySpecification<Subject, Given, When, Expect>(
  driver: Driver<Subject, Given, When, Expect>,
  scenario: Scenario<Given, When, Expect>,
  options: VerifyOptions = {},
): Promise<Expect> {
  validateScenario(scenario)
  options.signal?.throwIfAborted()
  if (driver === null || typeof driver !== 'object' || typeof driver.given !== 'function' || typeof driver.when !== 'function'
    || (driver.cleanup !== undefined && typeof driver.cleanup !== 'function')) throw new TypeError('driver requires given/when methods and optional cleanup')
  if (options.onEvent !== undefined && typeof options.onEvent !== 'function') throw new TypeError('onEvent must be a function')
  const context: DriverContext = {
    scenarioId: scenario.id,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    explain: options.onEvent === undefined ? ignoreExplanation : explanation(options.onEvent),
  }
  // One clone keeps mutable driver inputs separate from the reusable declaration and expectation.
  const input = structuredClone({ given: scenario.given, when: scenario.when })
  observation(options.onEvent, 'Given', scenario.given as JsonValue)
  observation(options.onEvent, 'When', scenario.when as JsonValue)
  observation(options.onEvent, 'Expect', scenario.expect as JsonValue)
  const subject = await driver.given(input.given, context)
  let actual: Expect | undefined
  let failed = false
  let failure: unknown
  try {
    options.signal?.throwIfAborted()
    actual = await driver.when(subject, input.when, context)
    options.signal?.throwIfAborted()
    validateJson(actual)
    observation(options.onEvent, 'Actual', actual)
    deepStrictEqual(actual, scenario.expect, `${scenario.id}: ${scenario.name}`)
  } catch (error) {
    failed = true
    failure = error
  }
  try {
    if (driver.cleanup !== undefined) await driver.cleanup(subject, options.signal === undefined
      ? context : { scenarioId: context.scenarioId, explain: context.explain })
  } catch (error) {
    if (failed) throw new AggregateError([failure, error], `${scenario.id}: execution and cleanup failed`)
    throw error
  }
  if (failed) throw failure
  return actual as Expect
}
