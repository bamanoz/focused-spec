import type { ExecutionPlan, FocusedSpecConfig, PlannedScenario, PlannedTarget, SpecDocument, Violation } from './model.js'
import { parseEvidenceReference } from './parser.js'
import { resolveRunnerTargets } from './runner-client.js'

interface EvidenceUse {
  readonly raw: string
  readonly runnerId: string
  readonly selector: string
  readonly path: string
  readonly line: number
  readonly scenarioId: string
}

export interface PlanOptions {
  readonly scenarioId?: string
}

export interface PlanOutput {
  readonly plan?: ExecutionPlan
  readonly violations: readonly Violation[]
}

export async function planEvidence(
  projectRoot: string,
  config: FocusedSpecConfig,
  documents: readonly SpecDocument[],
  options: PlanOptions = {},
): Promise<PlanOutput> {
  const uses: EvidenceUse[] = []
  const scenarioUses = new Map<string, EvidenceUse[]>()
  for (const document of documents) {
    for (const scenario of document.scenarios) {
      const scenarioId = scenario.ids[0]
      if (scenarioId === undefined || (options.scenarioId !== undefined && scenarioId !== options.scenarioId)) continue
      const selected: EvidenceUse[] = []
      for (const raw of scenario.evidence) {
        const reference = parseEvidenceReference(raw)
        if ('error' in reference || reference.planned) continue
        const use = { raw, runnerId: reference.runnerId, selector: reference.selector, path: scenario.path, line: scenario.line, scenarioId }
        uses.push(use)
        selected.push(use)
      }
      if (selected.length > 0) scenarioUses.set(scenarioId, selected)
    }
  }

  if (options.scenarioId !== undefined && !scenarioUses.has(options.scenarioId)) {
    return { violations: [{ path: options.scenarioId, message: `selected scenario has no executable evidence: ${options.scenarioId}` }] }
  }

  const byRunner = new Map<string, EvidenceUse[]>()
  for (const use of uses) byRunner.set(use.runnerId, [...(byRunner.get(use.runnerId) ?? []), use])

  const violations: Violation[] = []
  const targetsByRunnerSelector = new Map<string, PlannedTarget>()
  for (const [runnerId, runnerUses] of [...byRunner].sort(([left], [right]) => left.localeCompare(right))) {
    const runnerConfig = config.runners[runnerId]
    if (runnerConfig === undefined) continue
    const selectors = [...new Set(runnerUses.map(use => use.selector))].sort()
    try {
      const resolved = await resolveRunnerTargets(projectRoot, runnerId, runnerConfig, selectors)
      for (const error of resolved.errors) {
        for (const use of runnerUses.filter(candidate => candidate.selector === error.selector)) {
          violations.push({ path: use.path, line: use.line, scenarioId: use.scenarioId, message: `unresolved evidence ${use.raw}: ${error.message}` })
        }
      }
      for (const target of resolved.targets) {
        const references = [...new Set(runnerUses.filter(use => use.selector === target.selector).map(use => use.raw))]
        const key = `${runnerId}\u0000${target.targetId}`
        const prior = targetsByRunnerSelector.get(`${runnerId}\u0000${target.selector}`)
        if (prior !== undefined && prior.key !== key) {
          violations.push({ path: runnerId, message: `runner ${runnerId} resolved selector ${target.selector} inconsistently` })
          continue
        }
        targetsByRunnerSelector.set(`${runnerId}\u0000${target.selector}`, {
          key,
          runnerId,
          config: runnerConfig,
          target,
          references,
        })
      }
    } catch (error) {
      violations.push({ path: runnerId, message: error instanceof Error ? error.message : String(error) })
    }
  }
  if (violations.length > 0) return { violations }

  const targetsByKey = new Map<string, PlannedTarget>()
  for (const target of targetsByRunnerSelector.values()) {
    const existing = targetsByKey.get(target.key)
    if (existing === undefined) targetsByKey.set(target.key, target)
    else targetsByKey.set(target.key, {
      ...existing,
      references: [...new Set([...existing.references, ...target.references])].sort(),
    })
  }

  const scenarios: PlannedScenario[] = []
  for (const [id, selectedUses] of scenarioUses) {
    const evidence = selectedUses.map(use => {
      const target = targetsByRunnerSelector.get(`${use.runnerId}\u0000${use.selector}`)
      if (target === undefined) throw new Error(`planner lost resolved evidence ${use.raw}`)
      return { key: target.key, reference: use.raw }
    })
    scenarios.push({ id, evidence })
  }
  scenarios.sort((left, right) => left.id.localeCompare(right.id))

  const targets = [...targetsByKey.values()].sort((left, right) => left.key.localeCompare(right.key))
  const grouped = new Map<string, PlannedTarget[]>()
  for (const target of targets) grouped.set(target.runnerId, [...(grouped.get(target.runnerId) ?? []), target])
  const groups = [...grouped].sort(([left], [right]) => left.localeCompare(right)).map(([runnerId, runnerTargets]) => ({
    runnerId,
    config: config.runners[runnerId] as NonNullable<typeof config.runners[string]>,
    targets: runnerTargets,
  }))

  return { violations: [], plan: { projectRoot, scenarios, targets, groups } }
}

export function projectExecutionPlan(
  plan: ExecutionPlan,
  documents: readonly SpecDocument[],
  options: PlanOptions = {},
): PlanOutput {
  const targetsByRunnerReference = new Map<string, PlannedTarget>()
  for (const target of plan.targets) {
    for (const reference of target.references) {
      targetsByRunnerReference.set(`${target.runnerId}\u0000${reference}`, target)
    }
  }

  const scenarios: PlannedScenario[] = []
  const targetsByKey = new Map<string, PlannedTarget>()
  const referencesByKey = new Map<string, Set<string>>()
  let selectedScenarioFound = false

  for (const document of documents) {
    for (const scenario of document.scenarios) {
      const id = scenario.ids[0]
      if (id === undefined || (options.scenarioId !== undefined && id !== options.scenarioId)) continue
      selectedScenarioFound = true

      const evidence = scenario.evidence.flatMap(raw => {
        const reference = parseEvidenceReference(raw)
        if ('error' in reference || reference.planned) return []
        const target = targetsByRunnerReference.get(`${reference.runnerId}\u0000${raw}`)
        if (target === undefined) throw new Error(`planner lost resolved evidence ${raw}`)
        targetsByKey.set(target.key, target)
        const references = referencesByKey.get(target.key) ?? new Set<string>()
        references.add(raw)
        referencesByKey.set(target.key, references)
        return [{ key: target.key, reference: raw }]
      })
      scenarios.push({ id, evidence })
    }
  }

  if (options.scenarioId !== undefined && !selectedScenarioFound) {
    return { violations: [{ path: options.scenarioId, message: `selected scenario has no executable evidence: ${options.scenarioId}` }] }
  }

  scenarios.sort((left, right) => left.id.localeCompare(right.id))
  const targets = [...targetsByKey.values()]
    .map(target => ({ ...target, references: [...(referencesByKey.get(target.key) ?? [])].sort() }))
    .sort((left, right) => left.key.localeCompare(right.key))
  const grouped = new Map<string, PlannedTarget[]>()
  for (const target of targets) grouped.set(target.runnerId, [...(grouped.get(target.runnerId) ?? []), target])
  const groups = [...grouped].sort(([left], [right]) => left.localeCompare(right)).map(([runnerId, runnerTargets]) => ({
    runnerId,
    config: runnerTargets[0]!.config,
    targets: runnerTargets,
  }))

  return { violations: [], plan: { projectRoot: plan.projectRoot, scenarios, targets, groups } }
}
