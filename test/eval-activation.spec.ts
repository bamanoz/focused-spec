import { describe, expect, it } from 'vitest'
import { measureAgentTurns } from '../evals/activation.ts'
import type { AgentResult } from '../evals/types.ts'

function turn(durationMs: number, events: readonly unknown[]): AgentResult {
  return {
    success: true,
    exitCode: 0,
    durationMs,
    output: events.map(event => typeof event === 'string' ? event : JSON.stringify(event)).join('\n'),
  }
}

function assistantMessage(usage?: Record<string, unknown>): object {
  return {
    type: 'message_end',
    message: {
      role: 'assistant',
      ...(usage === undefined ? {} : { usage }),
    },
  }
}

describe('activation evaluation measurements', () => {
  it('counts only completed assistant message frames rather than repeated snapshots', () => {
    const usage = { input: 8336, output: 27, cacheRead: 0, cacheWrite: 0, totalTokens: 8363 }
    const message = { role: 'assistant', usage }
    const result = measureAgentTurns([turn(41, [
      'provider preamble that is not JSON',
      { type: 'message_end', message },
      { type: 'turn_end', message },
      { type: 'agent_end', message },
      { type: 'message_end', message: { role: 'user', usage } },
    ])])

    expect(result).toEqual({ durationMs: 41, usage, usageComplete: true })
  })

  it('retains valid metrics when a completed assistant message has incomplete or invalid usage', () => {
    const result = measureAgentTurns([turn(7, [
      assistantMessage({ input: 12, output: 3, cacheRead: 2, cacheWrite: 1, totalTokens: 18 }),
      assistantMessage({ input: 8, output: -1, cacheRead: Number.NaN, totalTokens: 8 }),
    ])])

    expect(result).toEqual({
      durationMs: 7,
      usage: { input: 20, output: 3, cacheRead: 2, cacheWrite: 1, totalTokens: 26 },
      usageComplete: false,
    })
  })

  it('reports usage as unavailable instead of fabricating zero usage', () => {
    const result = measureAgentTurns([turn(13, [
      '{malformed json',
      assistantMessage(),
      assistantMessage({ input: 'unknown', output: Number.POSITIVE_INFINITY }),
    ])])

    expect(result).toEqual({ durationMs: 13, usage: null, usageComplete: false })
  })

  it('sums wall duration and usage across agent turns', () => {
    const result = measureAgentTurns([
      turn(120, [assistantMessage({ input: 10, output: 4, cacheRead: 3, cacheWrite: 2, totalTokens: 19 })]),
      turn(85, [assistantMessage({ input: 6, output: 5, cacheRead: 1, cacheWrite: 0, totalTokens: 12 })]),
    ])

    expect(result).toEqual({
      durationMs: 205,
      usage: { input: 16, output: 9, cacheRead: 4, cacheWrite: 2, totalTokens: 31 },
      usageComplete: true,
    })
  })
})
