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
  readonly identifiers: ReadonlyMap<string, Scenario>
}

export function validateDocuments(
  documents: readonly SpecDocument[],
  config: FocusedSpecConfig,
  options: { readonly allowPlanned: boolean; readonly baseline?: boolean },
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
      if (scenario.revisions.length > 1) violations.push(diagnostic(scenario, 'expected at most one REVISES row'))
      if (options.baseline && scenario.revisions.length > 0) violations.push(diagnostic(scenario, 'baseline scenario cannot declare REVISES'))
      for (const line of scenario.malformedRevisionLines) {
        violations.push({ ...diagnostic(scenario, 'malformed REVISES row; expected - **REVISES**: baseline'), line })
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
          violations.push(diagnostic(scenario, `planned evidence is not allowed here: ${raw}; use non-strict validate --scope <name> while planning, then replace planned evidence before strict validation or run`))
        }
        if (config.runners[reference.runnerId] === undefined) {
          violations.push(diagnostic(scenario, `unknown evidence runner ${reference.runnerId}`))
        }
      }
    }
  }
  return { violations, identifiers }
}

function collisionViolations(baseline: ReadonlyMap<string, Scenario>, documents: readonly SpecDocument[]): Violation[] {
  const violations: Violation[] = []
  for (const document of documents) {
    for (const scenario of document.scenarios) {
      if (scenario.ids.length !== 1) continue
      const id = scenario.ids[0] as string
      const owner = baseline.get(id)
      if (scenario.revisions.length > 0) {
        if (owner === undefined) violations.push(diagnostic(scenario, `REVISES baseline requires an existing baseline scenario with ID ${id}`))
      } else if (owner !== undefined) {
        violations.push(diagnostic(scenario, `stable ID already belongs to baseline scenario ${owner.path}:${owner.line}; declare REVISES: baseline to revise it`))
      }
    }
  }
  return violations
}

export interface ValidationOptions {
  readonly scopeName?: string
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
  if (options.scopeName !== undefined && !isScopeName(options.scopeName)) {
    return { violations: [{ path: '.focused-spec/config.yaml', message: `invalid scope name ${options.scopeName}` }], targetDocuments: [], resolutionDocuments: [] }
  }

  const discovery = await discoverDocuments(projectRoot, config, options.scopeName)
  const violations = [...discovery.violations]
  const baseline = validateDocuments(discovery.baseline, config, { allowPlanned: false, baseline: true })
  violations.push(...baseline.violations)

  const resolutionDocuments = [...discovery.baseline]
  const introduced = new Map<string, Scenario>()
  for (const [name, documents] of discovery.scopes) {
    if (documents.every(document => document.scenarios.length === 0)) {
      violations.push({ path: name, message: `scope has no focused scenarios: ${name}` })
    }
    const scoped = validateDocuments(documents, config, { allowPlanned: !options.strict })
    violations.push(...scoped.violations, ...collisionViolations(baseline.identifiers, documents))
    for (const [id, scenario] of scoped.identifiers) {
      if (baseline.identifiers.has(id)) continue
      const previous = introduced.get(id)
      if (previous === undefined) introduced.set(id, scenario)
      else violations.push(diagnostic(scenario, `duplicate stable ID; first owned by ${previous.path}:${previous.line}`))
    }
    resolutionDocuments.push(...documents)
  }

  if (options.scopeName !== undefined && !discovery.scopes.has(options.scopeName)) {
    violations.push({ path: options.scopeName, message: `scope has no matching documents: ${options.scopeName}` })
  }
  return {
    violations: deduplicate(violations),
    targetDocuments: options.scopeName === undefined ? discovery.baseline : discovery.scopes.get(options.scopeName) ?? [],
    resolutionDocuments,
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
