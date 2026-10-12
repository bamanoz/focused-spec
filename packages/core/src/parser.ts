import { FormatClient } from './format-client.js'
import type { EvidenceReference, FormatConfig, NativeDocument } from './model.js'


export async function parseNativeDocument(projectRoot: string, path: string, source: string, scope: string, format: FormatConfig): Promise<NativeDocument> {
  const client = new FormatClient(projectRoot, format)
  try { return await client.parse(path, source, scope) }
  finally { client.close() }
}

export function parseEvidenceReference(raw: string): EvidenceReference | { readonly error: string } {
  const planned = raw.startsWith('planned:')
  const value = planned ? raw.slice('planned:'.length) : raw
  const separator = value.indexOf('::')
  if (separator <= 0 || separator === value.length - 2) return { error: 'expected [planned:]<runner-id>::<selector>' }
  return { raw, planned, runnerId: value.slice(0, separator), selector: value.slice(separator + 2) }
}
