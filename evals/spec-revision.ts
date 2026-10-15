import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { discoverDocuments, loadConfig } from '../packages/core/dist/index.js'
import { loadConfiguredRegistries } from './evidence.ts'
import { evalRepositoryRoot } from './provision.ts'
import type { EvalCase, EvalGate } from './types.ts'
import { nativeItemText, parseTrustedNativeDocument } from './native-parse.ts'

export async function specRevisionGate(workspace: string, evalCase: EvalCase): Promise<EvalGate> {
  const fail = (detail: string): EvalGate => ({ name: 'spec-evidence-reconciliation', passed: false, detail })
  const baseline = join(evalRepositoryRoot(), 'evals', evalCase.overlay ?? '')
  const [before, after] = await Promise.all([loadConfig(baseline), loadConfig(workspace)])
  if (before.config === undefined || after.config === undefined) return fail('valid original and revised configuration required')
  const [originalDiscovery, revisedDiscovery, originalRegistry, revisedRegistry] = await Promise.all([
    discoverDocuments(baseline, before.config),
    discoverDocuments(workspace, after.config),
    loadConfiguredRegistries(baseline, before.config),
    loadConfiguredRegistries(workspace, after.config),
  ])
  if (originalDiscovery.violations.length > 0 || revisedDiscovery.violations.length > 0
    || originalRegistry.violations.length > 0 || revisedRegistry.violations.length > 0) return fail('normalized evidence is invalid')
  const originalScenarios = [...originalDiscovery.scopes.values()].flat().flatMap(document => document.scenarios)
  const revisedScenarios = [...revisedDiscovery.scopes.values()].flat().flatMap(document => document.scenarios)
  const originalTarget = originalScenarios.find(item => item.scope === 'current' && item.id === evalCase.prescribedScenarioId)
  const target = revisedScenarios.find(item => item.scope === 'current' && item.id === evalCase.prescribedScenarioId)
  if (originalTarget === undefined || target === undefined) return fail('the exact scope-local identity was not preserved')
  const retained = originalScenarios.filter(item => item !== originalTarget).every(item => revisedScenarios.some(actual =>
    actual.scope === item.scope && actual.id === item.id && actual.path === item.path
    && JSON.stringify(actual.evidence) === JSON.stringify(item.evidence)))
  const originalEntry = originalRegistry.entries.find(entry => entry.scope === originalTarget.scope && entry.id === originalTarget.id)
  const targetEntry = revisedRegistry.entries.find(entry => entry.scope === target.scope && entry.id === target.id)
  const originalRepresentation = originalEntry === undefined ? 'inline' : 'registry'
  const revisedRepresentation = targetEntry === undefined ? 'inline' : 'registry'
  const ownership = originalRepresentation === revisedRepresentation
    && (revisedRepresentation === 'inline'
      ? originalTarget.path === target.path
      : originalEntry !== undefined && targetEntry !== undefined
        && originalEntry.registryPath === targetEntry.registryPath
        && JSON.stringify(originalEntry.source) === JSON.stringify(targetEntry.source)
        && JSON.stringify(originalRegistry.files) === JSON.stringify(revisedRegistry.files)
        && originalRegistry.entries.length === revisedRegistry.entries.length)
  const source = await readFile(join(workspace, target.path), 'utf8')
  const lines = source.split(/\r?\n/u)
  const format = revisedRepresentation === 'inline' ? 'inline' : target.path.endsWith('.feature') ? 'gherkin' : 'markdown'
  const parsed = parseTrustedNativeDocument(format, target.path, source, target.scope, workspace)
  const bound = parsed.items.filter(item => item.line === target.line
    && (targetEntry?.source === undefined ? item.markerId === target.id : item.nativeIds.includes(targetEntry.source.nativeId)))
  const outcome = bound.length === 1 ? nativeItemText(format, source, bound[0]!) : ''
  const inlineIdentity = revisedRepresentation !== 'inline'
    || lines.filter(line => line === `- **ID**: \`${target.id}\``).length === 1
  const revised = parsed.violations.length === 0 && bound.length === 1 && inlineIdentity
    && /\bblocked\b/iu.test(outcome) && /\bvalid\s+credentials\b|\bcredentials\s+(?:are|remain)\s+valid\b/iu.test(outcome)
    && /reject|den(?:y|ies|ied|ial)|cannot|prevent|(?:must|is|are) not (?:log\s*in|authenticated?)/iu.test(outcome)
  return { name: 'spec-evidence-reconciliation', passed: revised && retained && ownership,
    detail: `revised bound blocked/valid/rejected outcome=${revised}; ${revisedRepresentation} ownership preserved=${ownership}; unrelated registrations retained=${retained}` }
}
