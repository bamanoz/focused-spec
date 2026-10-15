import type { FocusedSpecConfig, Scenario, SpecDocument, Violation } from './model.js'
import { isFocusedId, isScopeName } from './model.js'
import { parseEvidenceReference } from './parser.js'
import { discoverDocuments } from './sources.js'
import type { OperationTimings } from './timings.js'

function diagnostic(scenario: Scenario, message: string): Violation {
  return { path: scenario.evidenceLocation?.path ?? scenario.path, line: scenario.evidenceLocation?.line ?? scenario.line, scenarioId: scenario.id, message }
}
function evidenceDiagnostic(scenario: Scenario, index: number, message: string): Violation {
  const location = scenario.evidenceLocations?.[index] ?? scenario.evidenceLocation
  return { path: location?.path ?? scenario.path, line: location?.line ?? scenario.line, scenarioId: scenario.id, message }
}

export function validateDocuments(
  documents: readonly SpecDocument[],
  config: FocusedSpecConfig,
  options: { readonly allowPlanned: boolean },
): { readonly violations: readonly Violation[] } {
  const violations: Violation[] = []
  const byScopedId = new Map<string, Scenario>()
  for (const document of documents) {
    if (!isScopeName(document.scope)) violations.push({ path: document.path, message: `invalid document scope name ${document.scope}` })
    for (const scenario of document.scenarios) {
      if (scenario.scope !== document.scope) violations.push(diagnostic(scenario, `scenario scope ${scenario.scope} does not match document scope ${document.scope}`))
      if (!isFocusedId(scenario.id)) violations.push(diagnostic(scenario, `invalid focused ID ${scenario.id}`))
      const key = `${scenario.scope}\u0000${scenario.id}`
      const previous = byScopedId.get(key)
      if (previous === undefined) byScopedId.set(key, scenario)
      else violations.push(diagnostic(scenario, `duplicate focused ID within scope ${scenario.scope}; first bound at ${previous.path}:${previous.line}`))
      if (scenario.evidence.length === 0) violations.push(diagnostic(scenario, 'expected at least one format-provided evidence reference'))
      for (const [index, raw] of scenario.evidence.entries()) {
        const reference = parseEvidenceReference(raw)
        if ('error' in reference) { violations.push(evidenceDiagnostic(scenario, index, `invalid evidence ${raw}: ${reference.error}`)); continue }
        if (reference.planned && !options.allowPlanned) violations.push(evidenceDiagnostic(scenario, index, `planned evidence is not allowed in strict validation: ${raw}; use non-strict validate while planning, then replace planned evidence before strict validation or run`))
        if (!Object.hasOwn(config.runners, reference.runnerId)) violations.push(evidenceDiagnostic(scenario, index, `unknown evidence runner ${reference.runnerId}`))
      }
    }
  }
  return { violations }
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

export async function validateFocusedSpecs(projectRoot: string, config: FocusedSpecConfig, options: ValidationOptions = {}, timings?: OperationTimings): Promise<ValidationOutput> {
  if (options.scopeName !== undefined && !isScopeName(options.scopeName)) {
    return { violations: [{ path: '.focused-spec/config.yaml', message: `invalid scope name ${options.scopeName}` }], targetDocuments: [], resolutionDocuments: [] }
  }
  const discovery = await discoverDocuments(projectRoot, config, options.scopeName, options.scenarioId, timings)
  const violations = [...discovery.violations]
  const selected = options.scopeName === undefined ? [...discovery.scopes.values()].flat() : [...(discovery.scopes.get(options.scopeName) ?? [])]
  if (options.scopeName !== undefined && !discovery.scopes.has(options.scopeName)) violations.push({ path: options.scopeName, message: `scope has no matching documents: ${options.scopeName}` })
  const id = options.scenarioId
  if (id !== undefined && !selected.some(document => document.scenarios.some(scenario => scenario.id === id))) violations.push({ path: id, message: `selected scenario not found in selected scopes: ${id}` })
  const documents = id === undefined ? selected : selected.flatMap(document => {
    const scenarios = document.scenarios.filter(scenario => scenario.id === id)
    return scenarios.length === 0 ? [] : [{ ...document, scenarios }]
  })
  documents.sort((left, right) => left.scope.localeCompare(right.scope) || left.path.localeCompare(right.path))
  if (id === undefined && selected.length > 0 && selected.every(document => document.scenarios.length === 0)) {
    violations.push({ path: options.scopeName ?? '.focused-spec/config.yaml', message: options.scopeName === undefined ? 'no enrolled native items in discovered documents' : `scope has no enrolled native items: ${options.scopeName}` })
  }
  violations.push(...validateDocuments(documents, config, { allowPlanned: !options.strict }).violations)
  const unique = new Map<string, Violation>()
  for (const violation of violations) unique.set(`${violation.path}:${violation.line ?? ''}:${violation.scenarioId ?? ''}:${violation.message}`, violation)
  return { violations: [...unique.values()].sort((left, right) => left.path.localeCompare(right.path) || (left.line ?? 0) - (right.line ?? 0)), targetDocuments: documents, resolutionDocuments: documents }
}
