import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig, loadEvidenceRegistry } from '../packages/core/dist/index.js'
import { parseTrustedNativeDocument } from './native-parse.ts'
import { evalRepositoryRoot } from './provision.ts'
import type { EvalCase, EvalGate } from './types.ts'

export async function specRevisionGate(workspace: string, evalCase: EvalCase): Promise<EvalGate> {
  const fail = (detail: string): EvalGate => ({ name: 'spec-evidence-reconciliation', passed: false, detail })
  const baseline = join(evalRepositoryRoot(), 'evals', evalCase.overlay ?? '')
  const [before, after] = await Promise.all([loadConfig(baseline), loadConfig(workspace)])
  if (before.config === undefined || after.config === undefined) return fail('valid original and revised configuration required')
  const [original, registry] = await Promise.all([
    loadEvidenceRegistry(baseline, before.config.evidence?.files),
    loadEvidenceRegistry(workspace, after.config.evidence?.files),
  ])
  if (original.violations.length > 0 || registry.violations.length > 0) return fail('registry is invalid')
  const selected = registry.entries.filter(entry => entry.scope === 'current' && entry.id === evalCase.prescribedScenarioId)
  const target = selected.length === 1 ? selected[0] : undefined
  const originalTarget = original.entries.find(entry => entry.scope === 'current' && entry.id === evalCase.prescribedScenarioId)
  const retained = original.entries.filter(entry => entry !== originalTarget).every(entry => registry.entries.some(actual =>
    actual.scope === entry.scope && actual.id === entry.id && actual.registryPath === entry.registryPath
    && JSON.stringify(actual.evidence) === JSON.stringify(entry.evidence)
    && JSON.stringify(actual.source) === JSON.stringify(entry.source)))
  const ownership = target !== undefined && originalTarget !== undefined
    && target.registryPath === originalTarget.registryPath
    && JSON.stringify(target.source) === JSON.stringify(originalTarget.source)
    && JSON.stringify(original.files) === JSON.stringify(registry.files)
    && registry.entries.length === original.entries.length
  const path = 'specs/account-authentication.md'
  const source = await readFile(join(workspace, path), 'utf8')
  const parsed = parseTrustedNativeDocument('markdown', path, source, 'current')
  const bound = parsed.items.filter(item => item.markerId !== undefined)
  const item = bound.length === 1 && bound[0]?.markerId === evalCase.prescribedScenarioId ? bound[0] : undefined
  let outcome = item?.name ?? ''
  if (item !== undefined) {
    const lines = source.split('\n')
    const start = item.line - 1
    const heading = lines[start]?.match(/^(#{1,6})\s/u)?.[1]
    if (heading !== undefined) {
      let end = start + 1
      while (end < lines.length) {
        const nextHeading = lines[end]?.match(/^(#{1,6})\s/u)?.[1]
        if (nextHeading !== undefined && nextHeading.length <= heading.length) break
        end += 1
      }
      outcome = lines.slice(start, end).join('\n').replace(/```[^]*?```/gu, '')
    }
  }
  const revised = parsed.violations.length === 0 && item !== undefined
    && /\bblocked\b/iu.test(outcome) && /\bvalid\s+credentials\b|\bcredentials\s+(?:are|remain)\s+valid\b/iu.test(outcome)
    && /reject|den(?:y|ies|ied|ial)|cannot|prevent|(?:must|is|are) not (?:log\s*in|authenticated?)/iu.test(outcome)
  return { name: 'spec-evidence-reconciliation', passed: revised && retained && ownership,
    detail: `revised bound blocked/valid/rejected outcome=${revised}; owning registry preserved=${ownership}; unrelated registrations retained=${retained}` }
}
