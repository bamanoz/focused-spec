import type { AgentResult } from './types.ts'

const USAGE_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens'] as const

type UsageKey = typeof USAGE_KEYS[number]

interface AgentTurnUsage {
  readonly input: number
  readonly output: number
  readonly cacheRead: number
  readonly cacheWrite: number
  readonly totalTokens: number
}

export interface AgentTurnMeasurements {
  readonly durationMs: number
  readonly usage: AgentTurnUsage | null
  readonly usageComplete: boolean
}

interface TranscriptEvent {
  readonly type?: unknown
  readonly message?: unknown
}

interface TranscriptMessage {
  readonly role?: unknown
  readonly usage?: unknown
}

export function measureAgentTurns(turns: readonly AgentResult[]): AgentTurnMeasurements {
  const totals: Record<UsageKey, number> = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
  }
  let sawUsageValue = false
  let usageComplete = true
  let assistantMessageCount = 0

  for (const turn of turns) {
    const messagesBefore = assistantMessageCount
    for (const line of turn.output.split(/\r?\n/u)) {
      let event: unknown
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }
      if (typeof event !== 'object' || event === null) continue
      const { type, message } = event as TranscriptEvent
      if (type !== 'message_end' || typeof message !== 'object' || message === null
        || (message as TranscriptMessage).role !== 'assistant') continue

      assistantMessageCount += 1
      const usage = (message as TranscriptMessage).usage
      if (typeof usage !== 'object' || usage === null) {
        usageComplete = false
        continue
      }
      for (const key of USAGE_KEYS) {
        const value = (usage as Partial<Record<UsageKey, unknown>>)[key]
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          usageComplete = false
          continue
        }
        const total = totals[key] + value
        if (!Number.isFinite(total)) {
          usageComplete = false
          continue
        }
        totals[key] = total
        sawUsageValue = true
      }
    }
    if (assistantMessageCount === messagesBefore) usageComplete = false
  }

  return {
    durationMs: turns.reduce((total, turn) => total + turn.durationMs, 0),
    usage: sawUsageValue ? totals : null,
    usageComplete: assistantMessageCount > 0 && sawUsageValue && usageComplete,
  }
}
