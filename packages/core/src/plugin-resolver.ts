import { findPackageJSON } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ResolvedPackageReference } from './plugin-module.js'

// The eval caller supplies its native resolver so resolution starts at its cwd.
export function resolvePackageReference(reference: string, projectRoot: string, resolveImport: (specifier: string) => string): ResolvedPackageReference {
  const entryUrl = resolveImport(reference)
  if (!entryUrl.startsWith('file:')) throw new Error(`package ${reference} did not resolve to a file`)
  const manifestPath = findPackageJSON(reference, pathToFileURL(resolve(projectRoot, 'package.json')))
  if (manifestPath === undefined) throw new Error(`cannot find package manifest for ${reference}`)
  return { entryUrl, manifestPath }
}
