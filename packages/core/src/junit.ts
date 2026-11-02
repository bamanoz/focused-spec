import type { ExecutionResult, ScenarioResult, Violation } from './model.js'

function xmlText(value: string): string {
  return value.replace(/[&<>"'\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu, character => {
    switch (character) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&apos;'
      default: return '\uFFFD'
    }
  })
}

function caseIdentity(scenario: ScenarioResult): string {
  return `${scenario.scope.length}:${scenario.scope}${scenario.id.length}:${scenario.id}`
}

function testcase(scenario: ScenarioResult): string {
  const properties = [
    ['focused-spec.scope', scenario.scope],
    ['focused-spec.id', scenario.id],
    ['focused-spec.source', `${scenario.source.path}${scenario.source.line === undefined ? '' : `:${scenario.source.line}`}`],
    ...scenario.evidence.map((evidence, index) => [`focused-spec.evidence.${index + 1}`, evidence.reference]),
  ].map(([name, value]) => `<property name="${xmlText(name!)}" value="${xmlText(value!)}"/>`).join('')
  const diagnostics = scenario.evidence
    .filter(evidence => evidence.status !== 'PASS' && evidence.diagnostic !== undefined)
    .map(evidence => `${evidence.status} ${evidence.reference}: ${evidence.diagnostic}`)
  const detail = diagnostics.length === 0 ? '' : `<system-out>${xmlText(diagnostics.join('\n'))}</system-out>`
  const outcome = scenario.status === 'FAIL'
    ? `<failure message="${xmlText(`${scenario.id} failed`)}">${xmlText(diagnostics.join('\n') || 'Evidence failed')}</failure>`
    : scenario.status === 'ERROR'
      ? `<error message="${xmlText(`${scenario.id} errored`)}">${xmlText(diagnostics.join('\n') || 'Evidence errored')}</error>`
      : scenario.status === 'SKIP'
        ? `<skipped message="${xmlText(`${scenario.id} skipped`)}"/>`
        : ''
  return `<testcase classname="${xmlText(scenario.scope)}" name="${xmlText(scenario.name)}" id="${xmlText(caseIdentity(scenario))}"><properties>${properties}</properties>${outcome}${detail}</testcase>`
}

export function renderJUnit(result: ExecutionResult, violations: readonly Violation[] = []): string {
  const failed = result.scenarios.filter(scenario => scenario.status === 'FAIL').length
  const errors = result.scenarios.filter(scenario => scenario.status === 'ERROR').length
  const skipped = result.scenarios.filter(scenario => scenario.status === 'SKIP').length
  const suite = `<testsuite name="focused-spec" tests="${result.scenarios.length}" failures="${failed}" errors="${errors + (violations.length === 0 ? 0 : 1)}" skipped="${skipped}">`
  const preflight = violations.length === 0 ? '' : `<properties><property name="focused-spec.preflight" value="failed"/></properties><system-err>${xmlText(violations.map(item => `${item.path}${item.line === undefined ? '' : `:${item.line}`}: ${item.message}`).join('\n'))}</system-err>`
  return `<?xml version="1.0" encoding="UTF-8"?>\n${suite}${preflight}${result.scenarios.map(testcase).join('')}</testsuite>\n`
}
