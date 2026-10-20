import { loadEvidenceRegistry } from '../packages/formats/registry/dist/index.js'
import type { EvidenceRegistry, RegistryViolation } from '../packages/formats/registry/dist/index.js'
import type { FocusedSpecConfig } from '../packages/core/dist/index.js'

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function registrySources(config: FocusedSpecConfig): readonly (readonly string[] | undefined)[] {
  return Object.values(config.specifications.formats).flatMap(format => {
    if (format.package !== '@focused-spec/format-registry') return []
    const options = object(format.options)
    const files = options?.files
    if (files === undefined) return [undefined]
    return Array.isArray(files) && files.every(value => typeof value === 'string')
      ? [files as string[]]
      : []
  })
}

export async function loadConfiguredRegistries(
  projectRoot: string,
  config: FocusedSpecConfig,
  selectedScope?: string,
  selectedScenarioId?: string,
): Promise<EvidenceRegistry> {
  const entries: EvidenceRegistry['entries'][number][] = []
  const files: string[] = []
  const violations: RegistryViolation[] = []
  const sourceClaims: EvidenceRegistry['sourceClaims'][number][] = []
  for (const sources of registrySources(config)) {
    const registry = await loadEvidenceRegistry(projectRoot, sources, selectedScope, selectedScenarioId)
    entries.push(...registry.entries)
    files.push(...registry.files)
    violations.push(...registry.violations)
    sourceClaims.push(...registry.sourceClaims)
  }
  return { entries, files, violations, sourceClaims }
}
