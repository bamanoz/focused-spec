import { loadConfig } from './config.js'
import type { Scenario, Violation } from './model.js'
import { validateFocusedSpecs } from './validate.js'

export type InspectionScopeSelection =
  | { readonly mode: 'all' }
  | { readonly mode: 'selected'; readonly name: string }

export interface InspectionSelection {
  readonly scopes: InspectionScopeSelection
  readonly scenario?: string
}

export interface InspectionSource {
  readonly path: string
  readonly line: number
}

export interface InspectedEvidence {
  readonly reference: string
  readonly source: InspectionSource
}

export interface InspectedScenario {
  readonly scope: string
  readonly id: string
  readonly name: string
  readonly source: InspectionSource
  readonly evidence: readonly InspectedEvidence[]
}

export type InspectionResult =
  | {
    readonly valid: true
    readonly selection: InspectionSelection
    readonly scenarios: readonly InspectedScenario[]
  }
  | {
    readonly valid: false
    readonly selection: InspectionSelection
    readonly violations: readonly Violation[]
  }

export interface InspectionOptions {
  readonly scopeName?: string
  readonly scenarioId?: string
}

function compareRaw(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function inspectScenario(scenario: Scenario): InspectedScenario {
  const nativeSource = { path: scenario.path, line: scenario.line }
  return {
    scope: scenario.scope,
    id: scenario.id,
    name: scenario.name,
    source: nativeSource,
    evidence: scenario.evidence.map((reference, index) => ({
      reference,
      source: scenario.evidenceLocations?.[index] ?? scenario.evidenceLocation ?? nativeSource,
    })),
  }
}

export async function inspectEnrollments(
  root: string,
  configPath?: string,
  options: InspectionOptions = {},
): Promise<InspectionResult> {
  const selection: InspectionSelection = {
    scopes: options.scopeName === undefined
      ? { mode: 'all' }
      : { mode: 'selected', name: options.scopeName },
    ...(options.scenarioId === undefined ? {} : { scenario: options.scenarioId }),
  }
  const loaded = await loadConfig(root, configPath)
  if (loaded.config === undefined) return { valid: false, selection, violations: loaded.violations }

  const validation = await validateFocusedSpecs(root, loaded.config, {
    strict: false,
    ...(options.scopeName === undefined ? {} : { scopeName: options.scopeName }),
    ...(options.scenarioId === undefined ? {} : { scenarioId: options.scenarioId }),
  })
  if (validation.violations.length > 0) {
    return { valid: false, selection, violations: validation.violations }
  }

  const scenarios: InspectedScenario[] = []
  for (const document of validation.targetDocuments) {
    for (const scenario of document.scenarios) scenarios.push(inspectScenario(scenario))
  }
  scenarios.sort((left, right) => compareRaw(left.scope, right.scope) || compareRaw(left.id, right.id))
  return { valid: true, selection, scenarios }
}

function displaySelection(selection: InspectionSelection): string {
  const scopes = selection.scopes.mode === 'all'
    ? 'all discovered scopes'
    : `selected scope ${selection.scopes.name}`
  const scenario = selection.scenario === undefined ? '' : `, scenario ${selection.scenario}`
  return `inspection selection: ${scopes}${scenario}\n`
}

export function displayInspection(result: InspectionResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }

  if (!result.valid) {
    process.stderr.write(displaySelection(result.selection))
    for (const violation of result.violations) {
      const location = violation.line === undefined ? violation.path : `${violation.path}:${violation.line}`
      process.stderr.write(`${location}: ${violation.message}\n`)
    }
    return
  }

  process.stdout.write(displaySelection(result.selection))
  for (const scenario of result.scenarios) {
    process.stdout.write(`[${scenario.scope}] ${scenario.id}: ${scenario.name}\n`)
    process.stdout.write(`  native: ${scenario.source.path}:${scenario.source.line}\n`)
    for (const evidence of scenario.evidence) {
      process.stdout.write(`  evidence: ${evidence.reference} (${evidence.source.path}:${evidence.source.line})\n`)
    }
  }
}
