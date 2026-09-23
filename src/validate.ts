import type { FocusedSpecConfig, Scenario, SpecDocument, Violation } from './model.js'
import { parseEvidenceReference, STABLE_ID } from './parser.js'
import { loadActiveChanges, loadChangeDocuments, loadCurrentDocuments, validateSourceSelection } from './sources.js'

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
  readonly identifiers: ReadonlyMap<string, Scenario>
}

export function validateDocuments(
  documents: readonly SpecDocument[],
  config: FocusedSpecConfig,
  options: { readonly allowPlanned: boolean },
): DocumentValidation {
  const violations: Violation[] = []
  const identifiers = new Map<string, Scenario>()

  for (const document of documents) {
    for (const line of document.malformedScenarioHeadings) {
      violations.push({ path: document.path, line, message: 'scenario headings must use exactly four hashes' })
    }
    for (const scenario of document.scenarios) {
      if (scenario.ids.length !== 1) {
        violations.push(diagnostic(scenario, `expected exactly one ID row, found ${scenario.ids.length}`))
      } else {
        const id = scenario.ids[0] as string
        if (!STABLE_ID.test(id)) violations.push(diagnostic(scenario, `invalid stable ID ${id}`))
        const previous = identifiers.get(id)
        if (previous === undefined) identifiers.set(id, scenario)
        else violations.push(diagnostic(scenario, `duplicate stable ID; first owned by ${previous.path}:${previous.line}`))
      }
      if (scenario.evidence.length === 0) violations.push(diagnostic(scenario, 'expected at least one EVIDENCE row'))
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
          violations.push(diagnostic(scenario, `planned evidence is not allowed here: ${raw}; use non-strict validate --change <name> while planning, then replace planned evidence before strict validation or run`))
        }
        if (config.runners[reference.runnerId] === undefined) {
          violations.push(diagnostic(scenario, `unknown evidence runner ${reference.runnerId}`))
        }
      }
    }
  }
  return { violations, identifiers }
}

function collisionViolations(current: ReadonlyMap<string, Scenario>, documents: readonly SpecDocument[]): Violation[] {
  const violations: Violation[] = []
  for (const document of documents) {
    for (const scenario of document.scenarios) {
      const id = scenario.ids[0]
      const owner = id === undefined ? undefined : current.get(id)
      if (owner === undefined || scenario.operation === 'MODIFIED' || scenario.operation === 'REMOVED') continue
      violations.push(diagnostic(scenario, `stable ID already belongs to current scenario ${owner.path}:${owner.line}`))
    }
  }
  return violations
}

export interface ValidationOptions {
  readonly changeName?: string
  readonly strict?: boolean
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
  const violations = validateSourceSelection(config, options.changeName)
  const currentDocuments = await loadCurrentDocuments(projectRoot, config)
  const current = validateDocuments(currentDocuments, config, { allowPlanned: false })
  violations.push(...current.violations)

  if (options.changeName !== undefined) {
    const changeDocuments = await loadChangeDocuments(projectRoot, config, options.changeName)
    if (changeDocuments.length === 0) {
      violations.push({ path: options.changeName, message: `OpenSpec change has no delta specifications: ${options.changeName}` })
    }
    const active = validateDocuments(changeDocuments, config, { allowPlanned: !options.strict })
    violations.push(...active.violations, ...collisionViolations(current.identifiers, changeDocuments))
    return {
      violations: deduplicate(violations),
      targetDocuments: changeDocuments,
      resolutionDocuments: [...currentDocuments, ...changeDocuments],
    }
  }

  const resolutionDocuments = [...currentDocuments]
  const activeIdentifiers = new Map<string, Scenario>()
  if (config.specifications.source === 'openspec') {
    for (const documents of (await loadActiveChanges(projectRoot, config)).values()) {
      const active = validateDocuments(documents, config, { allowPlanned: true })
      for (const document of documents) {
        for (const scenario of document.scenarios) {
          const id = scenario.ids[0]
          if (id === undefined || scenario.ids.length !== 1 || current.identifiers.has(id)) continue
          const previous = activeIdentifiers.get(id)
          if (previous === undefined) activeIdentifiers.set(id, scenario)
          else violations.push(diagnostic(scenario, `duplicate stable ID; first owned by ${previous.path}:${previous.line}`))
        }
      }
      violations.push(...active.violations, ...collisionViolations(current.identifiers, documents))
      resolutionDocuments.push(...documents)
    }
  }
  return { violations: deduplicate(violations), targetDocuments: currentDocuments, resolutionDocuments }
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
