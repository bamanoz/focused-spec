import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentDriver, AgentRequest, EvalDiagnostic } from './types.ts'
import { lastAssistantMessage } from './dialogue.ts'
import { OmpAgentDriver } from './omp-agent.ts'

export async function interviewFailedAgent(
  request: AgentRequest,
  gates: readonly { name: string; passed: boolean | null; detail: string; blockedBy?: string }[],
  intendedOutcome: string,
  driver: AgentDriver = new OmpAgentDriver(),
): Promise<EvalDiagnostic> {
  const failures = gates.filter(item => item.passed !== true).map(item => `- ${item.name}${item.blockedBy === undefined ? '' : ` (blocked by ${item.blockedBy})`}: ${item.detail}`).join('\n')
  const prompt = `This is a post-run evaluation research interview. The scored task is over; this turn is not a retry or an assessment of you. The evaluator observed these gaps (some may be dependent checks or harness limitations):\n${failures}\n\nThe intended outcome was:\n${intendedOutcome}\n\nPropose concrete fixes that would help a future agent achieve the intended outcome. For each independent gap: (1) cite the instruction you actually received and the observed action or result; (2) decide whether the issue is a missing, unclear, poorly placed, or conflicting instruction, an unavailable host capability, an incorrect eval fixture/gate, or a sufficient instruction that was not followed; (3) propose the smallest change, naming the file/section and suggested wording or a precise fixture/gate change; (4) say how to check that the change helped.\n\nThe portable focused-spec loader and CLI-owned guidance must remain framework-agnostic. Do not recommend putting host-specific skill names, paths, URLs, commands, branches, or framework-specific examples there. Put host-specific guidance in the host's own workflow, or install/expose the genuine host workflow through the eval fixture; adjust an evaluator gate if it expects an unavailable or overly specific action. Preserve the blind agent-facing task: do not propose revealing skill names, marker or registry mechanics, exact evidence selectors, or gate expectations in its prompt or fixture-provided task context. If the portable instruction is already sufficient, recommend no change to it; do not duplicate a rule or propose a gate that already exists just to explain this run. Separate primary causes from dependent checks. Do not apologize, justify the previous answer, edit files, or attempt to repair the scored task. Provide recommendations, not a confession.`
  try {
    if (request.sessionDir === undefined) throw new Error('failure interview requires a persisted eval session')
    const sessions = (await readdir(request.sessionDir)).filter(file => file.endsWith('.jsonl'))
    if (sessions.length !== 1) throw new Error(`expected one persisted eval session, found ${sessions.length}`)
    const agent = await driver.run({ ...request, resume: join(request.sessionDir, sessions[0]!), tools: 'read', timeoutMs: 120_000, prompt })
    const answer = lastAssistantMessage(agent.output)
    return { status: agent.success && answer ? 'answered' : 'unavailable', answer, transcript: agent.output,
      detail: `exit=${agent.exitCode}; ${answer ? 'answer captured' : 'no answer captured'}` }
  } catch (error) {
    return { status: 'unavailable', answer: '', transcript: '', detail: String(error) }
  }
}
