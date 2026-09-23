import type { EvidenceResult, ExecutionPlan, ExecutionResult, EvidenceStatus } from './model.js'
import { runRunnerTargets } from './runner-client.js'

function aggregate(statuses: readonly EvidenceStatus[]): EvidenceStatus {
  if (statuses.includes('ERROR')) return 'ERROR'
  if (statuses.includes('FAIL')) return 'FAIL'
  if (statuses.includes('SKIP')) return 'SKIP'
  return 'PASS'
}

export async function executePlan(plan: ExecutionPlan, options: { readonly allowSkip?: boolean } = {}): Promise<ExecutionResult> {
  const resultByKey = new Map<string, Omit<EvidenceResult, 'reference'>>()
  for (const group of plan.groups) {
    try {
      const output = await runRunnerTargets(
        plan.projectRoot,
        group.runnerId,
        group.config,
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
      const diagnostic = error instanceof Error ? error.message : String(error)
      for (const target of group.targets) resultByKey.set(target.key, { status: 'ERROR', diagnostic })
    }
  }

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
