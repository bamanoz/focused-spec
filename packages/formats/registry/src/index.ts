import type { FormatPlugin } from 'focused-spec/format'
import { bindRegistryCatalog, parseRegistryDocument } from './binding.js'

export type { NativeParserOptions, RegistryFormatOptions } from './binding.js'
export {
  loadEvidenceRegistry,
  parseEvidenceRegistry,
} from './registry.js'
export type {
  EvidenceEntry,
  EvidenceRegistry,
  RegistrySourceClaim,
  RegistryViolation,
} from './registry.js'

const registryFormat = {
  apiVersion: 2,
  parse: parseRegistryDocument,
  bind: bindRegistryCatalog,
} satisfies FormatPlugin

export default registryFormat
