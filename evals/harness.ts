import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { glob } from 'glob'
import { evalCase } from './cases.ts'
import type { AgentDriver, AgentRequest, EvalGate, EvalResult, EvalRunOptions } from './types.ts'
import { guidanceActivationGate, combinedGuidanceGate, integrityGate, judgeCompletedWorkspace, judgeProposalCheckpoint, judgeWorkingCheckpoint, skillActivationGate, snapshotProtectedFiles, snapshotProposalFiles } from './judge.ts'
import { guidanceBoundaryGate, guidanceEditablePaths, guidanceOutcomeGate, prepareGuidanceFixture } from './guidance.ts'
import type { WorkingEvidenceCheckpoint } from './judge.ts'
import { OmpAgentDriver } from './omp-agent.ts'
import { evalRepositoryRoot, provisionWorkspace, readEvalPrompt } from './provision.ts'
import { interviewFailedAgent } from './diagnostic.ts'
import { isUpgradeArtifact, upgradeArtifactsGate, upgradePreservationGate } from './upgrade.ts'
import { runAgentTurn, saveEvalResult } from './result.ts'
import { integrationRoutingGate, judgeIntegrationWorkspace } from './integration.ts'
import { measureAgentTurns } from './activation.ts'

export async function runEval(
  options: EvalRunOptions,
  driver: AgentDriver = new OmpAgentDriver(),
): Promise<EvalResult> {
  const selected = evalCase(options.caseId)
  if (selected === undefined) throw new Error(`unknown eval case ${options.caseId}`)
  const workspace = await provisionWorkspace(selected, options.openspecSkillsDir, options.competingSkillsDir)
  const turns = []
  const gates: EvalGate[] = []
  const observations: EvalGate[] = []
  const transcripts: string[] = []
  let workingCheckpoint: WorkingEvidenceCheckpoint | undefined
  let selectedScenarioId = selected.prescribedScenarioId
  const timeoutMs = options.timeoutMs ?? 1_200_000
  let lastRequest: AgentRequest | undefined

  try {
    try {
    if (selected.id === 'guidance-skill-trigger-boundaries') await prepareGuidanceFixture(workspace.path)
    const snapshots = workspace.integration === undefined ? new Map(await snapshotProtectedFiles(workspace.path, selected.editablePaths)) : new Map<string, string>()
    const proposalBefore = await snapshotProposalFiles(workspace.path)
    if (workspace.skillInventory !== undefined) {
      for (const skill of workspace.skillInventory) {
        for (const path of Object.keys(skill.files)) {
          const relative = `.omp/skills/${skill.name}/${path}`
          snapshots.set(relative, await readFile(join(workspace.path, relative), 'utf8'))
        }
      }
    }
    if (workspace.upgrade !== undefined) {
      for (const path of snapshots.keys()) if (isUpgradeArtifact(path)) snapshots.delete(path)
      const unrelated = await glob('node_modules/yaml/**/*', { cwd: workspace.path, nodir: true, dot: true, follow: true, nocase: false })
      for (const path of ['.npmrc', 'go.mod', ...unrelated]) {
        snapshots.set(path, await readFile(join(workspace.path, path), 'utf8'))
      }
    }
    for (const turn of selected.turns) {
      const guidanceBefore = selected.guidanceOnly === true ? await snapshotProposalFiles(workspace.path) : undefined
      const prompt = await readEvalPrompt(turn.promptPath)
      const request: AgentRequest = {
        workspace: workspace.path,
        sessionDir: join(workspace.path, '..', 'sessions', String(turns.length + 1)),
        prompt,
        skills: workspace.skillInventory === undefined ? turn.skills : workspace.skillInventory.map(skill => skill.name),
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
      if (guidanceBefore !== undefined) gates.push(guidanceBoundaryGate(guidanceBefore, await snapshotProposalFiles(workspace.path), selected.id === 'guidance-skill-trigger-boundaries' ? guidanceEditablePaths[turns.length - 1] : []))
      if (selected.id === 'guidance-skill-trigger-boundaries') gates.push(await guidanceOutcomeGate(workspace.path, turns.length - 1))
      if (turn.requiresFocusedSkill === false) {
        const activated = skillActivationGate(result.output)
        gates.push({ name: 'focused-skill-not-required', passed: !activated.passed, detail: activated.passed ? 'editorial-only turn loaded focused-spec' : 'editorial-only turn did not load focused-spec' })
      } else {
        gates.push(skillActivationGate(result.output))
        if (turn.guidanceTopics !== undefined) {
          const acquisition = await Promise.all(turn.guidanceTopics.map(topic => guidanceActivationGate(workspace.path, [result.output], topic)))
          gates.push({ name: 'focused-routed-guidance-acquired', passed: acquisition.some(item => item.passed), detail: acquisition.filter(item => item.passed).map(item => item.name).join(', ') || `no complete installed response for an eligible router/operation: ${turn.guidanceTopics.join(', ')}` })
        } else if (turn.guidanceTopic === 'review' || turn.guidanceTopic === 'author-revise' || turn.guidanceTopic === 'upgrade' || turn.guidanceTopic === 'verify') {
          gates.push(await combinedGuidanceGate(workspace.path, result.output, turn.guidanceTopic))
        } else {
          gates.push(await guidanceActivationGate(workspace.path, [result.output], turn.guidanceTopic ?? 'workflow'))
        }
      }
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
    if (selected.guidanceOnly === true) {
      if (turns.length === selected.turns.length && gates.every(item => item.passed)) {
        gates.push(await integrityGate(workspace.path, snapshots, transcripts))
        if (gates.every(item => item.passed)) gates.push({ name: 'guidance-case-complete', passed: true, detail: 'isolated guidance case completed without project mutation judgment' })
      }
    } else if (turns.length === selected.turns.length && gates.every(item => item.passed)) {
      try {
        if (workspace.upgrade !== undefined) gates.push(await upgradeArtifactsGate(workspace.path, workspace.upgrade), await upgradePreservationGate(workspace.path, workspace.upgrade))
        if (gates.every(item => item.passed)) {
          if (workspace.integration === undefined) {
            gates.push(...await judgeCompletedWorkspace(workspace.path, selected, snapshots, transcripts, workingCheckpoint, selectedScenarioId))
          } else {
            const choice = selected.integration!
            if (choice.mode !== 'revise' && choice.mode !== 'install') observations.push(await integrationRoutingGate(workspace.path, transcripts, choice, workspace.integration))
            gates.push(...await judgeIntegrationWorkspace(workspace.path, selected, workspace.integration, transcripts))
          }
        }
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
      ...(options.model === undefined ? {} : { model: options.model }),
      passed,
      workspace: workspace.path,
      turns,
      gates,
      observations,
      ...(workspace.skillInventory === undefined ? {} : { skillInventory: workspace.skillInventory }),
      measurements: measureAgentTurns(turns),
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
