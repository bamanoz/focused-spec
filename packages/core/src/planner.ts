import type { ExecutionPlan, FocusedSpecConfig, PlannedScenario, PlannedTarget, SpecDocument, Violation } from './model.js'
import { parseEvidenceReference } from './parser.js'
import { resolveRunnerTargets } from './runner-client.js'
import type { OperationTimings } from './timings.js'

interface EvidenceUse {
  readonly scope: string
  readonly raw: string
  readonly runnerId: string
  readonly selector: string
  readonly path: string
  readonly line: number
  readonly scenarioId: string
  readonly name: string
  readonly source: PlannedScenario['source']
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
  timings?: OperationTimings,
): Promise<PlanOutput> {
  const byRunner = new Map<string, Map<string, EvidenceUse[]>>()
  const scenarioUses = new Map<string, EvidenceUse[]>()
  let selectedScenarioFound = false
  for (const document of documents) {
    for (const scenario of document.scenarios) {
      const scenarioId = scenario.id
      if (options.scenarioId !== undefined && scenarioId !== options.scenarioId) continue
      selectedScenarioFound = true
      const selected: EvidenceUse[] = []
      for (const [index, raw] of scenario.evidence.entries()) {
        const reference = parseEvidenceReference(raw)
        if ('error' in reference || reference.planned) continue
        const location = scenario.evidenceLocations?.[index] ?? scenario.evidenceLocation
        const use = { scope: document.scope, raw, runnerId: reference.runnerId, selector: reference.selector, path: location?.path ?? scenario.path, line: location?.line ?? scenario.line, scenarioId, name: scenario.name, source: { path: scenario.path, line: scenario.line } }
        let selectors = byRunner.get(use.runnerId)
        if (selectors === undefined) byRunner.set(use.runnerId, selectors = new Map())
        let selectorUses = selectors.get(use.selector)
        if (selectorUses === undefined) selectors.set(use.selector, selectorUses = [])
        selectorUses.push(use)
        selected.push(use)
      }
      if (selected.length > 0) {
        const key = `${document.scope}\u0000${scenarioId}`
        const prior = scenarioUses.get(key)
        if (prior === undefined) scenarioUses.set(key, selected)
        else for (const use of selected) prior.push(use)
      }
    }
  }

  if (options.scenarioId !== undefined && (!selectedScenarioFound || scenarioUses.size === 0)) {
    return { violations: [{ path: options.scenarioId, message: `selected scenario has no executable evidence: ${options.scenarioId}` }] }
  }

  const violations: Violation[] = []
  const targetsByRunnerSelector = new Map<string, PlannedTarget>()
  for (const [runnerId, bySelector] of [...byRunner].sort(([left], [right]) => left.localeCompare(right))) {
    const runnerConfig = config.runners[runnerId]
    if (runnerConfig === undefined) {
      for (const selectorUses of bySelector.values()) for (const use of selectorUses) {
        violations.push({ path: use.path, line: use.line, scenarioId: use.scenarioId, message: `unknown evidence runner ${runnerId}` })
      }
      continue
    }
    const selectors = [...bySelector.keys()].sort()
    try {
      const resolved = timings === undefined
        ? await resolveRunnerTargets(projectRoot, runnerId, runnerConfig, selectors)
        : await timings.runner({ runnerId, operation: 'resolve', selectorCount: selectors.length }, () => resolveRunnerTargets(projectRoot, runnerId, runnerConfig, selectors))
      for (const error of resolved.errors) {
        for (const use of bySelector.get(error.selector) ?? []) {
          violations.push({ path: use.path, line: use.line, scenarioId: use.scenarioId, message: `unresolved evidence ${use.raw}: ${error.message}` })
        }
      }
      for (const target of resolved.targets) {
        const references = [...new Set((bySelector.get(target.selector) ?? []).map(use => use.raw))]
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
  for (const selectedUses of scenarioUses.values()) {
    const first = selectedUses[0]
    if (first === undefined) continue
    const evidence = selectedUses.map(use => {
      const target = targetsByRunnerSelector.get(`${use.runnerId}\u0000${use.selector}`)
      if (target === undefined) throw new Error(`planner lost resolved evidence ${use.raw}`)
      return { key: target.key, reference: use.raw }
    })
    scenarios.push({ scope: first.scope, id: first.scenarioId, name: first.name, source: first.source, evidence })
  }
  scenarios.sort((left, right) => left.scope.localeCompare(right.scope) || left.id.localeCompare(right.id))

  const targets = [...targetsByKey.values()].sort((left, right) => left.key.localeCompare(right.key))
  const grouped = new Map<string, PlannedTarget[]>()
  for (const target of targets) {
    let runnerTargets = grouped.get(target.runnerId)
    if (runnerTargets === undefined) grouped.set(target.runnerId, runnerTargets = [])
    runnerTargets.push(target)
  }
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
  let selectedExecutableScenarioFound = false

  for (const document of documents) {
    for (const scenario of document.scenarios) {
      const id = scenario.id
      if (options.scenarioId !== undefined && id !== options.scenarioId) continue
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
      if (evidence.length === 0) continue
      selectedExecutableScenarioFound = true
      scenarios.push({ scope: document.scope, id, name: scenario.name, source: { path: scenario.path, line: scenario.line }, evidence })
    }
  }

  if (options.scenarioId !== undefined && (!selectedScenarioFound || !selectedExecutableScenarioFound)) {
    return { violations: [{ path: options.scenarioId, message: `selected scenario has no executable evidence: ${options.scenarioId}` }] }
  }

  scenarios.sort((left, right) => left.scope.localeCompare(right.scope) || left.id.localeCompare(right.id))
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
