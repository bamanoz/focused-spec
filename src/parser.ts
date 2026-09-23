import type { EvidenceReference, SpecDocument, SpecOperation } from './model.js'

const ID = /^- \*\*ID\*\*: `([^`]+)`$/u
const EVIDENCE = /^- \*\*EVIDENCE\*\*: `([^`]+)`$/u
const WHEN = /^- \*\*WHEN\*\*/u
const THEN = /^- \*\*THEN\*\*/u
const REQUIREMENT = /^### Requirement: (.+)$/u
const SCENARIO = /^#### Scenario: (.+)$/u
const MALFORMED_SCENARIO = /^(?:#{1,3}|#{5,}) Scenario:/u
const OPERATION = /^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements$/u

export const STABLE_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u

export function parseFocusedSpecDocument(path: string, source: string): SpecDocument {
  const lines = source.split('\n')
  const scenarios: SpecDocument['scenarios'][number][] = []
  const malformedScenarioHeadings: number[] = []
  let operation: SpecOperation = 'CURRENT'
  let requirement: string | undefined

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const operationMatch = OPERATION.exec(line)
    if (operationMatch?.[1] !== undefined) operation = operationMatch[1] as SpecOperation
    const requirementMatch = REQUIREMENT.exec(line)
    if (requirementMatch?.[1] !== undefined) requirement = requirementMatch[1]
    if (MALFORMED_SCENARIO.test(line)) malformedScenarioHeadings.push(index + 1)

    const scenarioMatch = SCENARIO.exec(line)
    if (scenarioMatch?.[1] === undefined) continue
    const body: string[] = []
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor] ?? ''
      if (SCENARIO.test(candidate) || REQUIREMENT.test(candidate) || candidate.startsWith('## ')) break
      body.push(candidate)
    }
    scenarios.push({
      path,
      line: index + 1,
      name: scenarioMatch[1],
      ...(requirement === undefined ? {} : { requirement }),
      operation,
      ids: body.flatMap(value => ID.exec(value)?.[1] ?? []),
      evidence: body.flatMap(value => EVIDENCE.exec(value)?.[1] ?? []),
      whenCount: body.filter(value => WHEN.test(value)).length,
      thenCount: body.filter(value => THEN.test(value)).length,
    })
  }

  return { path, scenarios, malformedScenarioHeadings }
}

export function parseEvidenceReference(raw: string): EvidenceReference | { readonly error: string } {
  const planned = raw.startsWith('planned:')
  const value = planned ? raw.slice('planned:'.length) : raw
  const separator = value.indexOf('::')
  if (separator <= 0 || separator === value.length - 2) {
    return { error: 'expected [planned:]<runner-id>::<selector>' }
  }
  return {
    raw,
    planned,
    runnerId: value.slice(0, separator),
    selector: value.slice(separator + 2),
  }
}
