import { describe, expect, it } from 'vitest'
import type { AgentDriver, AgentRequest, AgentResult } from '../evals/types.ts'
import { runEval } from '../evals/harness.ts'

class FakeDriver implements AgentDriver {
  async run(request: AgentRequest): Promise<AgentResult> {
    return {
      success: false,
      output: `fake agent rejected ${request.skills.join(',')}`,
      exitCode: 17,
      durationMs: 1,
    }
  }
}

describe('agent eval harness', () => {
  it('records a failed agent turn without running downstream judges', async () => {
    const result = await runEval({ caseId: 'files-source-bootstrap' }, new FakeDriver())
    expect(result.passed).toBe(false)
    expect(result.gates).toEqual([{ name: 'agent-turn-1', passed: false, detail: 'exit=17 durationMs=1' }])
  }, 30_000)
})
