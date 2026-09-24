import type { EvidenceResult, ExecutionPlan, ExecutionResult, EvidenceStatus, PlannedTarget, RunnerGroup } from './model.js'
import { partitionRunnerTargets, runRunnerTargets } from './runner-client.js'

function aggregate(statuses: readonly EvidenceStatus[]): EvidenceStatus {
  if (statuses.includes('ERROR')) return 'ERROR'
  if (statuses.includes('FAIL')) return 'FAIL'
  if (statuses.includes('SKIP')) return 'SKIP'
  return 'PASS'
}

interface ScheduledGroup {
  readonly id: number
  readonly runner: RunnerGroup
  readonly targets: readonly PlannedTarget[]
  readonly resources?: readonly string[]
  readonly exclusive: boolean
}

function diagnostic(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function setErrors(
  resultByKey: Map<string, Omit<EvidenceResult, 'reference'>>,
  targets: readonly PlannedTarget[],
  message: string,
): void {
  for (const target of targets) resultByKey.set(target.key, { status: 'ERROR', diagnostic: message })
}

async function runGroup(
  plan: ExecutionPlan,
  group: ScheduledGroup,
  resultByKey: Map<string, Omit<EvidenceResult, 'reference'>>,
): Promise<void> {
  try {
    const output = await runRunnerTargets(
      plan.projectRoot,
      group.runner.runnerId,
      group.runner.config,
      group.targets.map(target => target.target),
    )
    const outputById = new Map(output.results.map(result => [result.targetId, result]))
    for (const target of group.targets) {
      const result = outputById.get(target.target.targetId)
      if (result === undefined) {
        resultByKey.set(target.key, { status: 'ERROR', diagnostic: 'runner omitted the target result' })
        continue
      }
      resultByKey.set(target.key, {
        status: result.status === 'pass' ? 'PASS' : result.status === 'fail' ? 'FAIL' : 'SKIP',
        ...(result.diagnostic === undefined ? {} : { diagnostic: result.diagnostic }),
      })
    }
  } catch (error) {
    setErrors(resultByKey, group.targets, diagnostic(error))
  }
}

async function buildSchedule(
  plan: ExecutionPlan,
  maxConcurrentGroups: number,
  resultByKey: Map<string, Omit<EvidenceResult, 'reference'>>,
): Promise<readonly ScheduledGroup[]> {
  if (maxConcurrentGroups === 1) {
    return plan.groups.map((runner, id) => ({ id, runner, targets: runner.targets, exclusive: true }))
  }

  const scheduledByRunner = await Promise.all(plan.groups.map(async (runner): Promise<readonly Omit<ScheduledGroup, 'id'>[]> => {
    try {
      const groups = await partitionRunnerTargets(
        plan.projectRoot,
        runner.runnerId,
        runner.config,
        runner.targets.map(target => target.target),
      )
      if (groups === undefined) return [{ runner, targets: runner.targets, exclusive: true }]

      const targetsById = new Map(runner.targets.map(target => [target.target.targetId, target]))
      return groups.map(group => ({
        runner,
        targets: group.targetIds.map(targetId => {
          const target = targetsById.get(targetId)
          if (target === undefined) throw new Error(`runner ${runner.runnerId} partition lost selected target ${targetId}`)
          return target
        }),
        ...(group.exclusive === true ? { exclusive: true } : { exclusive: false, resources: group.resources }),
      }))
    } catch (error) {
      setErrors(resultByKey, runner.targets, diagnostic(error))
      return []
    }
  }))
  return scheduledByRunner.flat().map((group, id) => ({ id, ...group }))
}

async function runSchedule(
  plan: ExecutionPlan,
  schedule: readonly ScheduledGroup[],
  maxConcurrentGroups: number,
  resultByKey: Map<string, Omit<EvidenceResult, 'reference'>>,
): Promise<void> {
  const queued = [...schedule]
  const active = new Map<number, Promise<number>>()
  const activeGroups = new Map<number, ScheduledGroup>()
  const activeResources = new Set<string>()
  let exclusiveActive = false

  const compatible = (group: ScheduledGroup): boolean => {
    if (exclusiveActive) return false
    if (group.exclusive) return active.size === 0
    return group.resources?.every(resource => !activeResources.has(resource)) ?? true
  }

  while (queued.length > 0 || active.size > 0) {
    while (active.size < maxConcurrentGroups) {
      const index = queued.findIndex(compatible)
      if (index < 0) break
      const [group] = queued.splice(index, 1)
      if (group === undefined) throw new Error('scheduler lost a queued execution group')
      exclusiveActive = group.exclusive
      for (const resource of group.resources ?? []) activeResources.add(resource)
      activeGroups.set(group.id, group)
      active.set(group.id, runGroup(plan, group, resultByKey).then(() => group.id))
    }

    if (active.size === 0) throw new Error('scheduler cannot start a queued execution group')
    const completedId = await Promise.race(active.values())
    const completed = activeGroups.get(completedId)
    if (completed === undefined) throw new Error('scheduler lost an active execution group')
    active.delete(completedId)
    activeGroups.delete(completedId)
    exclusiveActive = false
    for (const resource of completed.resources ?? []) activeResources.delete(resource)
  }
}

export async function executePlan(
  plan: ExecutionPlan,
  options: { readonly allowSkip?: boolean; readonly maxConcurrentGroups?: number } = {},
): Promise<ExecutionResult> {
  const maxConcurrentGroups = options.maxConcurrentGroups ?? 1
  if (!Number.isInteger(maxConcurrentGroups) || maxConcurrentGroups <= 0) {
    throw new Error('maxConcurrentGroups must be a positive integer')
  }

  const resultByKey = new Map<string, Omit<EvidenceResult, 'reference'>>()
  const schedule = await buildSchedule(plan, maxConcurrentGroups, resultByKey)
  await runSchedule(plan, schedule, maxConcurrentGroups, resultByKey)

  const scenarios = plan.scenarios.map(scenario => {
    const evidence = scenario.evidence.map(item => {
      const result = resultByKey.get(item.key) ?? { status: 'ERROR' as const, diagnostic: 'execution plan lost the evidence result' }
      return { reference: item.reference, ...result }
    })
    return { id: scenario.id, status: aggregate(evidence.map(item => item.status)), evidence }
  })
  const success = scenarios.every(scenario => scenario.status === 'PASS' || (options.allowSkip === true && scenario.status === 'SKIP'))
  return { success, scenarios, targetCount: plan.targets.length }
}
