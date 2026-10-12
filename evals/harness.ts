import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { glob } from 'glob'
import type { AgentDriver, AgentRequest, EvalGate, EvalResult, EvalRunOptions } from './types.ts'
import { evalCase } from './cases.ts'
import { guidanceActivationGate, judgeCompletedWorkspace, judgeProposalCheckpoint, judgeWorkingCheckpoint, skillActivationGate, snapshotProtectedFiles, snapshotProposalFiles } from './judge.ts'
import type { WorkingEvidenceCheckpoint } from './judge.ts'
import { OmpAgentDriver } from './omp-agent.ts'
import { evalRepositoryRoot, provisionWorkspace, readEvalPrompt } from './provision.ts'
import { interviewFailedAgent } from './diagnostic.ts'
import { isUpgradeArtifact, upgradeArtifactsGate, upgradePreservationGate } from './upgrade.ts'
import { runAgentTurn, saveEvalResult } from './result.ts'

export async function runEval(
  options: EvalRunOptions,
  driver: AgentDriver = new OmpAgentDriver(),
): Promise<EvalResult> {
  const selected = evalCase(options.caseId)
  if (selected === undefined) throw new Error(`unknown eval case ${options.caseId}`)
  const workspace = await provisionWorkspace(selected, options.openspecSkillsDir)
  const turns = []
  const gates: EvalGate[] = []
  const transcripts: string[] = []
  let workingCheckpoint: WorkingEvidenceCheckpoint | undefined
  let selectedScenarioId = selected.prescribedScenarioId
  const timeoutMs = options.timeoutMs ?? 1_200_000
  let lastRequest: AgentRequest | undefined

  try {
    try {
    const snapshots = new Map(await snapshotProtectedFiles(workspace.path, selected.editablePaths))
    const proposalBefore = await snapshotProposalFiles(workspace.path)
    if (workspace.upgrade !== undefined) {
      for (const path of snapshots.keys()) if (isUpgradeArtifact(path)) snapshots.delete(path)
      const unrelated = await glob('node_modules/yaml/**/*', { cwd: workspace.path, nodir: true, dot: true, follow: true, nocase: false })
      for (const path of ['.npmrc', 'README.md', 'go.mod', ...unrelated]) {
        snapshots.set(path, await readFile(join(workspace.path, path), 'utf8'))
      }
    }
    for (const turn of selected.turns) {
      const prompt = await readEvalPrompt(turn.promptPath)
      const request: AgentRequest = {
        workspace: workspace.path,
        sessionDir: join(workspace.path, '..', 'sessions', String(turns.length + 1)),
        prompt,
        skills: turn.skills,
        ...(options.model === undefined ? {} : { model: options.model }),
        timeoutMs,
      }
      lastRequest = request
      const result = await runAgentTurn(driver, request)
      turns.push(result)
      transcripts.push(result.output)
      gates.push({
        name: `agent-turn-${turns.length}`,
        passed: result.success,
        detail: `exit=${String(result.exitCode)} durationMs=${result.durationMs}`,
      })
      if (!result.success) break
      gates.push(skillActivationGate(result.output), await guidanceActivationGate(workspace.path, [result.output]))
      if (gates.some(item => !item.passed)) break
      if (turn.checkpoint === 'proposal') {
        const checkpoint = await judgeProposalCheckpoint(workspace.path, selected, proposalBefore)
        gates.push(...checkpoint.gates)
        selectedScenarioId ??= checkpoint.selectedScenarioId
      }
      if (turn.checkpoint === 'working-evidence') {
        const checkpoint = await judgeWorkingCheckpoint(workspace.path, selected, selectedScenarioId)
        gates.push(...checkpoint.gates)
        workingCheckpoint = checkpoint
        selectedScenarioId ??= checkpoint.selectedScenarioId
      }
      if (gates.some(item => !item.passed)) break
    }

    if (turns.length === selected.turns.length && gates.every(item => item.passed)) {
      try {
        if (workspace.upgrade !== undefined) gates.push(await upgradeArtifactsGate(workspace.path, workspace.upgrade), await upgradePreservationGate(workspace.path, workspace.upgrade))
        if (gates.every(item => item.passed)) gates.push(...await judgeCompletedWorkspace(workspace.path, selected, snapshots, transcripts, workingCheckpoint, selectedScenarioId))
      } catch (error) {
        gates.push({ name: 'evaluation-error', passed: false, detail: error instanceof Error ? error.message : String(error) })
      }
    }
    } catch (error) {
      gates.push({ name: 'evaluation-error', passed: false, detail: error instanceof Error ? error.message : String(error) })
    }
    const passed = gates.length > 0 && gates.every(item => item.passed)
    const diagnostic = !passed && lastRequest !== undefined
      ? await interviewFailedAgent(lastRequest, gates, selected.description, driver) : null
    const result: EvalResult = {
      caseId: selected.id,
      passed,
      workspace: workspace.path,
      turns,
      gates,
      diagnostic,
    }
    const resultsDirectory = join(evalRepositoryRoot(), 'evals', 'results')
    await saveEvalResult(resultsDirectory, selected.id, result)
    return result
  } finally {
    await workspace.finish()
    if (options.keepWorkspace !== true) await workspace.cleanup()
  }
}
