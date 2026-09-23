import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentDriver, EvalGate, EvalResult, EvalRunOptions } from './types.ts'
import { evalCase } from './cases.ts'
import { judgeCompletedWorkspace, judgeProposalCheckpoint, snapshotProtectedFiles } from './judge.ts'
import { OmpAgentDriver } from './omp-agent.ts'
import { evalRepositoryRoot, provisionWorkspace, readEvalPrompt } from './provision.ts'

export async function runEval(
  options: EvalRunOptions,
  driver: AgentDriver = new OmpAgentDriver(),
): Promise<EvalResult> {
  const selected = evalCase(options.caseId)
  if (selected === undefined) throw new Error(`unknown eval case ${options.caseId}`)
  const workspace = await provisionWorkspace(selected, options.openspecSkillsDir)
  const snapshots = await snapshotProtectedFiles(workspace.path)
  const turns = []
  const gates: EvalGate[] = []
  const transcripts: string[] = []
  const timeoutMs = options.timeoutMs ?? 1_200_000

  try {
    for (const turn of selected.turns) {
      const prompt = await readEvalPrompt(turn.promptPath)
      const result = await driver.run({
        workspace: workspace.path,
        prompt,
        skills: turn.skills,
        ...(options.model === undefined ? {} : { model: options.model }),
        timeoutMs,
      })
      turns.push(result)
      transcripts.push(result.output)
      gates.push({
        name: `agent-turn-${turns.length}`,
        passed: result.success,
        detail: `exit=${String(result.exitCode)} durationMs=${result.durationMs}`,
      })
      if (!result.success) break
      if (turn.checkpoint === 'proposal') gates.push(...await judgeProposalCheckpoint(workspace.path, selected))
      if (gates.some(item => !item.passed)) break
    }

    if (turns.length === selected.turns.length && gates.every(item => item.passed)) {
      gates.push(...await judgeCompletedWorkspace(workspace.path, selected, snapshots, transcripts))
    }
    const result: EvalResult = {
      caseId: selected.id,
      passed: gates.length > 0 && gates.every(item => item.passed),
      workspace: workspace.path,
      turns,
      gates,
    }
    const resultsDirectory = join(evalRepositoryRoot(), 'evals', 'results')
    await mkdir(resultsDirectory, { recursive: true })
    await writeFile(join(resultsDirectory, `${selected.id}-${Date.now()}.json`), `${JSON.stringify(result, null, 2)}\n`)
    return result
  } finally {
    if (options.keepWorkspace !== true) await workspace.cleanup()
  }
}
