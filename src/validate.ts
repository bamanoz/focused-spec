import type { FocusedSpecConfig, Scenario, SpecDocument, Violation } from './model.js'
import { parseEvidenceReference, STABLE_ID } from './parser.js'
import { discoverDocuments, isScopeName } from './sources.js'

function diagnostic(scenario: Scenario, message: string): Violation {
  return {
    path: scenario.path,
    line: scenario.line,
    ...(scenario.ids[0] === undefined ? {} : { scenarioId: scenario.ids[0] }),
    message,
  }
}

interface DocumentValidation {
  readonly violations: readonly Violation[]
}

export function validateDocuments(
  documents: readonly SpecDocument[],
  config: FocusedSpecConfig,
  options: { readonly allowPlanned: boolean },
): DocumentValidation {
  const violations: Violation[] = []
  const scenarioByScopedId = new Map<string, Scenario>()

  for (const document of documents) {
    if (!isScopeName(document.scope)) {
      violations.push({ path: document.path, message: `invalid document scope name ${document.scope}` })
    }
    for (const line of document.malformedScenarioHeadings) {
      violations.push({ path: document.path, line, message: 'scenario headings must use exactly four hashes' })
    }
    for (const scenario of document.scenarios) {
      if (scenario.scope !== document.scope) {
        violations.push(diagnostic(scenario, `scenario scope ${scenario.scope} does not match document scope ${document.scope}`))
      }
      if (scenario.ids.length !== 1) {
        violations.push(diagnostic(scenario, `expected exactly one ID row, found ${scenario.ids.length}`))
      } else {
        const id = scenario.ids[0] as string
        if (!STABLE_ID.test(id)) violations.push(diagnostic(scenario, `invalid stable ID ${id}`))
        const key = `${scenario.scope}\u0000${id}`
        const previous = scenarioByScopedId.get(key)
        if (previous === undefined) scenarioByScopedId.set(key, scenario)
        else violations.push(diagnostic(scenario, `duplicate stable ID within scope ${scenario.scope}; first owned by ${previous.path}:${previous.line}`))
      }
      if (scenario.evidence.length === 0) violations.push(diagnostic(scenario, 'expected at least one EVIDENCE row'))
      if (scenario.revisions.length > 1) violations.push(diagnostic(scenario, 'expected at most one REVISES row'))
      if (scenario.revisions[0] !== undefined && !isScopeName(scenario.revisions[0])) {
        violations.push(diagnostic(scenario, `invalid REVISES scope name ${scenario.revisions[0]}`))
      }
      if (scenario.revisions[0] === scenario.scope) {
        violations.push(diagnostic(scenario, `REVISES cannot reference its own scope ${scenario.scope}`))
      }
      for (const line of scenario.malformedRevisionLines) {
        violations.push({ ...diagnostic(scenario, 'malformed REVISES row; expected - **REVISES**: <source-scope>'), line })
      }
      for (const line of scenario.malformedEvidenceLines) {
        violations.push({ ...diagnostic(scenario, 'malformed EVIDENCE row; expected - **EVIDENCE**: `<runner-id>::<selector>`'), line })
      }
      if (scenario.whenCount !== 1) violations.push(diagnostic(scenario, `expected exactly one WHEN row, found ${scenario.whenCount}`))
      if (scenario.thenCount !== 1) violations.push(diagnostic(scenario, `expected exactly one THEN row, found ${scenario.thenCount}`))

      for (const raw of scenario.evidence) {
        const reference = parseEvidenceReference(raw)
        if ('error' in reference) {
          violations.push(diagnostic(scenario, `invalid evidence ${raw}: ${reference.error}`))
          continue
        }
        if (reference.planned && !options.allowPlanned) {
          violations.push(diagnostic(scenario, `planned evidence is not allowed in strict validation: ${raw}; use non-strict validate while planning, then replace planned evidence before strict validation or run`))
        }
        if (config.runners[reference.runnerId] === undefined) {
          violations.push(diagnostic(scenario, `unknown evidence runner ${reference.runnerId}`))
        }
      }
    }
  }
  return { violations }
}

function scenariosById(scopes: ReadonlyMap<string, readonly SpecDocument[]>): ReadonlyMap<string, readonly Scenario[]> {
  const grouped = new Map<string, Scenario[]>()
  for (const documents of scopes.values()) {
    for (const document of documents) {
      for (const scenario of document.scenarios) {
        const id = scenario.ids.length === 1 ? scenario.ids[0] : undefined
        if (id === undefined) continue
        const existing = grouped.get(id)
        if (existing === undefined) grouped.set(id, [scenario])
        else existing.push(scenario)
      }
    }
  }
  return grouped
}

function revisionChainProblem(start: Scenario, occurrences: readonly Scenario[]): string | undefined {
  const id = start.ids[0] as string
  const visited = new Set<string>()
  const chain: string[] = []
  let current = start
  while (true) {
    if (visited.has(current.scope)) return `revision cycle for stable ID ${id}: ${[...chain, current.scope].join(' -> ')}`
    visited.add(current.scope)
    chain.push(current.scope)

    if (current.malformedRevisionLines.length > 0 || current.revisions.length > 1) {
      return `revision chain for stable ID ${id} reaches invalid REVISES metadata in scope ${current.scope}`
    }
    const sourceScope = current.revisions[0]
    if (sourceScope === undefined) return undefined
    if (!isScopeName(sourceScope)) return `REVISES ${sourceScope} is not a path-safe scope name`
    if (sourceScope === current.scope) return `REVISES cannot reference its own scope ${current.scope}`
    const sources = occurrences.filter(candidate => candidate.scope === sourceScope)
    if (sources.length === 0) return `REVISES ${sourceScope} requires an existing scenario with stable ID ${id} in that scope`
    if (sources.length > 1) return `REVISES ${sourceScope} is ambiguous because that scope contains ${sources.length} scenarios with stable ID ${id}`
    current = sources[0] as Scenario
  }
}

function ownershipViolations(
  scopes: ReadonlyMap<string, readonly SpecDocument[]>,
  selectedScope?: string,
  selectedScenarioId?: string,
): Violation[] {
  const violations: Violation[] = []
  for (const [id, occurrences] of scenariosById(scopes)) {
    if (selectedScenarioId !== undefined && id !== selectedScenarioId) continue
    if (selectedScope !== undefined) {
      for (const scenario of occurrences.filter(candidate => candidate.scope === selectedScope)) {
        if (scenario.malformedRevisionLines.length > 0 || scenario.revisions.length > 1) continue
        if (scenario.revisions.length === 0) {
          const competingOwners = occurrences.filter(candidate => candidate !== scenario && candidate.revisions.length === 0)
          if (competingOwners.length > 0) {
            const owner = competingOwners[0] as Scenario
            violations.push(diagnostic(scenario, `stable ID ${id} is also unmarked in scope ${owner.scope} at ${owner.path}:${owner.line}; declare exactly one REVISES: <source-scope> for this repeated ID`))
          }
          continue
        }
        const problem = revisionChainProblem(scenario, occurrences)
        if (problem !== undefined) violations.push(diagnostic(scenario, problem))
      }
      continue
    }

    if (occurrences.length === 1) {
      const scenario = occurrences[0] as Scenario
      if (scenario.revisions.length === 1) {
        violations.push(diagnostic(scenario, `REVISES ${scenario.revisions[0]} requires an existing same-ID scenario in another scope`))
      }
      continue
    }

    const owners = occurrences.filter(scenario => scenario.revisions.length === 0 && scenario.malformedRevisionLines.length === 0)
    if (owners.length !== 1) {
      const message = owners.length === 0
        ? `stable ID ${id} has no unmarked owning scope; revision chains must terminate at exactly one owner`
        : `stable ID ${id} has ${owners.length} unmarked owning scopes (${owners.map(owner => owner.scope).join(', ')}); repeated IDs require exactly one owner`
      for (const scenario of occurrences) violations.push(diagnostic(scenario, message))
    }
    for (const scenario of occurrences) {
      if (scenario.revisions.length !== 1 || scenario.malformedRevisionLines.length > 0) continue
      const problem = revisionChainProblem(scenario, occurrences)
      if (problem !== undefined) violations.push(diagnostic(scenario, problem))
    }
  }
  return violations
}

export interface ValidationOptions {
  readonly scopeName?: string
  readonly strict?: boolean
  readonly scenarioId?: string
}

export interface ValidationOutput {
  readonly violations: readonly Violation[]
  readonly targetDocuments: readonly SpecDocument[]
  readonly resolutionDocuments: readonly SpecDocument[]
}

export async function validateFocusedSpecs(
  projectRoot: string,
  config: FocusedSpecConfig,
  options: ValidationOptions = {},
): Promise<ValidationOutput> {
  if (options.scopeName !== undefined && !isScopeName(options.scopeName)) {
    return { violations: [{ path: '.focused-spec/config.yaml', message: `invalid scope name ${options.scopeName}` }], targetDocuments: [], resolutionDocuments: [] }
  }

  const discovery = await discoverDocuments(projectRoot, config, options.scopeName)
  const violations = [...discovery.violations]
  const selected = options.scopeName === undefined
    ? [...discovery.scopes.values()].flat()
    : [...(discovery.scopes.get(options.scopeName) ?? [])]

  if (options.scopeName !== undefined && !discovery.scopes.has(options.scopeName)) {
    violations.push({ path: options.scopeName, message: `scope has no matching documents: ${options.scopeName}` })
  }

  const selectedScenarioId = options.scenarioId
  if (selectedScenarioId !== undefined && !selected.some(document => document.scenarios.some(scenario => scenario.ids.includes(selectedScenarioId)))) {
    violations.push({ path: selectedScenarioId, message: `selected scenario not found in selected scopes: ${selectedScenarioId}` })
  }

  const documents = selectedScenarioId === undefined
    ? [...selected]
    : selected.flatMap(document => {
      const scenarios = document.scenarios.filter(scenario => scenario.ids.includes(selectedScenarioId))
      return scenarios.length === 0 ? [] : [{ ...document, scenarios, malformedScenarioHeadings: [] }]
    })
  documents.sort((left, right) => left.scope.localeCompare(right.scope) || left.path.localeCompare(right.path))

  if (options.scopeName === undefined) {
    for (const [name, scopedDocuments] of discovery.scopes) {
      if (options.scenarioId === undefined && scopedDocuments.every(document => document.scenarios.length === 0)) {
        violations.push({ path: name, message: `scope has no focused scenarios: ${name}` })
      }
    }
  } else if (options.scenarioId === undefined && selected.length > 0 && selected.every(document => document.scenarios.length === 0)) {
    violations.push({ path: options.scopeName, message: `scope has no focused scenarios: ${options.scopeName}` })
  }
  violations.push(...validateDocuments(documents, config, { allowPlanned: !options.strict }).violations)
  violations.push(...ownershipViolations(discovery.scopes, options.scopeName, options.scenarioId))

  return {
    violations: deduplicate(violations),
    targetDocuments: documents,
    resolutionDocuments: documents,
  }
}

function deduplicate(violations: readonly Violation[]): Violation[] {
  const byKey = new Map<string, Violation>()
  for (const violation of violations) {
    const key = `${violation.path}:${violation.line ?? ''}:${violation.scenarioId ?? ''}:${violation.message}`
    byKey.set(key, violation)
  }
  return [...byKey.values()].sort((left, right) => {
    const path = left.path.localeCompare(right.path)
    return path !== 0 ? path : (left.line ?? 0) - (right.line ?? 0)
  })
}
