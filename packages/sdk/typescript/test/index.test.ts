import { AssertionError } from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import { ScenarioMismatchError, type Driver, type JsonValue, type Scenario, verifySpecification } from '../src/index.ts'

type State = { readonly value: { count: number } }
type ScenarioData = { readonly input: number }
type Result = { count: number }

const scenario: Scenario<ScenarioData, ScenarioData, Result> = {
  id: 'counter',
  name: 'returns the count',
  given: { input: 1 },
  when: { input: 1 },
  expect: { count: 1 },
}

describe('TypeScript executable scenarios', () => {
  it('cleanup mutation preserves actual result and mismatch snapshots', async () => {
    const matchingDriver: Driver<State, ScenarioData, ScenarioData, Result> = {
      given: () => ({ value: { count: 1 } }),
      when: subject => subject.value,
      cleanup: subject => { subject.value.count = 99 },
    }

    await expect(verifySpecification(matchingDriver, scenario)).resolves.toEqual({ count: 1 })

    const expected = { count: 1 }
    const mismatchingScenario: Scenario<ScenarioData, ScenarioData, Result> = { ...scenario, expect: expected }
    const mismatchingDriver: Driver<State, ScenarioData, ScenarioData, Result> = {
      given: () => ({ value: { count: 2 } }),
      when: subject => subject.value,
      cleanup: subject => {
        subject.value.count = 99
        expected.count = 88
      },
    }

    const rejection = verifySpecification(mismatchingDriver, mismatchingScenario)
    await expect(rejection).rejects.toBeInstanceOf(ScenarioMismatchError)
    try {
      await rejection
      throw new Error('mismatch unexpectedly passed')
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioMismatchError)
      const mismatch = error as ScenarioMismatchError
      expect(mismatch.expected).toEqual({ count: 1 })
      expect(mismatch.actual).toEqual({ count: 2 })
    }
  })

  it('mismatch exposes typed scenario diagnostics and comparison detail', async () => {
    const mismatchScenario: Scenario<ScenarioData, ScenarioData, Result> = {
      ...scenario,
      id: 'counter.mismatch',
      name: 'reports a changed count',
      expect: { count: 4 },
    }
    const driver: Driver<State, ScenarioData, ScenarioData, Result> = {
      given: () => ({ value: { count: 3 } }),
      when: subject => subject.value,
    }

    try {
      await verifySpecification(driver, mismatchScenario)
      throw new Error('mismatch unexpectedly passed')
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioMismatchError)
      expect(error).toBeInstanceOf(AssertionError)
      const mismatch = error as ScenarioMismatchError
      expect(mismatch.scenarioId).toBe('counter.mismatch')
      expect(mismatch.scenarioName).toBe('reports a changed count')
      expect(mismatch.expected).toEqual({ count: 4 })
      expect(mismatch.actual).toEqual({ count: 3 })
      expect(mismatch.cause).toBeInstanceOf(AssertionError)
      expect(mismatch.cause.message).toContain('counter.mismatch: reports a changed count')
      expect(mismatch.message).toContain('counter.mismatch: reports a changed count')
      expect(mismatch.message).toContain('count')
      expect(mismatch.cause.message).toContain('count: 3')
      expect(mismatch.cause.message).toContain('count: 4')
    }
  })

  it.each([false, true])('validates invalid explanations with observer=%s', async observer => {
    for (const invalid of [{ message: '' }, { message: 'valid', data: { invalid: Number.NaN } as unknown as JsonValue }]) {
      const events: unknown[] = []
      const driver: Driver<number, ScenarioData, ScenarioData, number> = {
        given: () => 1,
        when: (_subject, _when, context) => {
          context.explain(invalid.message, invalid.data)
          return 1
        },
      }
      const result = verifySpecification(driver, { ...scenario, expect: 1 }, observer ? { onEvent: event => events.push(event) } : {})
      await expect(result).rejects.toThrow(TypeError)
      if (observer) expect(events).not.toContainEqual(expect.objectContaining({ kind: 'explanation' }))
      else expect(events).toEqual([])
    }
  })

  it('keeps valid explanations silent without an observer', async () => {
    const driver: Driver<number, ScenarioData, ScenarioData, number> = {
      given: () => 1,
      when: (_subject, _when, context) => {
        context.explain('valid explanation', { count: 1 })
        return 1
      },
    }

    await expect(verifySpecification(driver, { ...scenario, expect: 1 })).resolves.toBe(1)
  })
})
