import type { EvidenceReference, SpecDocument } from './model.js'

const ID = /^- \*\*ID\*\*: `([^`]+)`$/u
const ID_ROW = /^\s*-\s*\*\*ID\*\*/u
const EVIDENCE = /^- \*\*EVIDENCE\*\*: `([^`]+)`$/u
const EVIDENCE_ROW = /^\s*-\s*\*\*EVIDENCE\*\*/u
const REVISION = /^- \*\*REVISES\*\*: (\S+)$/u
const REVISION_ROW = /^\s*-\s*\*\*REVISES\*\*/u
const WHEN = /^- \*\*WHEN\*\*/u
const THEN = /^- \*\*THEN\*\*/u
const REQUIREMENT = /^### Requirement: (.+)$/u
const SCENARIO = /^#### Scenario: (.+)$/u
const MALFORMED_SCENARIO = /^(?:#{1,3}|#{5,}) Scenario:/u

export const STABLE_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u

export function parseFocusedSpecDocument(path: string, source: string, scope: string): SpecDocument {
  const lines = source.split('\n')
  const scenarios: SpecDocument['scenarios'][number][] = []
  let unenrolledScenarios = 0
  const malformedScenarioHeadings: number[] = []
  let requirement: string | undefined

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const requirementMatch = REQUIREMENT.exec(line)
    if (requirementMatch?.[1] !== undefined) requirement = requirementMatch[1]
    if (MALFORMED_SCENARIO.test(line)) malformedScenarioHeadings.push(index + 1)

    const scenarioMatch = SCENARIO.exec(line)
    if (scenarioMatch?.[1] === undefined) continue
    const body: string[] = []
    const malformedEvidenceLines: number[] = []
    const malformedIdLines: number[] = []
    const malformedRevisionLines: number[] = []
    let enrolled = false
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor] ?? ''
      if (SCENARIO.test(candidate) || REQUIREMENT.test(candidate) || candidate.startsWith('## ')) break
      if (ID_ROW.test(candidate) || EVIDENCE_ROW.test(candidate) || REVISION_ROW.test(candidate)) enrolled = true
      if (ID_ROW.test(candidate) && !ID.test(candidate)) malformedIdLines.push(cursor + 1)
      if (EVIDENCE_ROW.test(candidate) && !EVIDENCE.test(candidate)) malformedEvidenceLines.push(cursor + 1)
      if (REVISION_ROW.test(candidate) && !REVISION.test(candidate)) malformedRevisionLines.push(cursor + 1)
      body.push(candidate)
    }
    if (!enrolled) {
      unenrolledScenarios += 1
      continue
    }
    scenarios.push({
      scope,
      path,
      line: index + 1,
      name: scenarioMatch[1],
      ...(requirement === undefined ? {} : { requirement }),
      revisions: body.flatMap(value => REVISION.exec(value)?.[1] ?? []),
      malformedRevisionLines,
      malformedIdLines,
      ids: body.flatMap(value => ID.exec(value)?.[1] ?? []),
      evidence: body.flatMap(value => EVIDENCE.exec(value)?.[1] ?? []),
      malformedEvidenceLines,
      whenCount: body.filter(value => WHEN.test(value)).length,
      thenCount: body.filter(value => THEN.test(value)).length,
    })
  }

  return { path, scope, scenarios, unenrolledScenarios, malformedScenarioHeadings }
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
