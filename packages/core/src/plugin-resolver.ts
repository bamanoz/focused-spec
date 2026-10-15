import { findPackageJSON } from 'node:module'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { pluginUrl } from './plugin-module.js'

const reference = process.argv[2]
const projectRoot = process.argv[3]

try {
  if (reference === undefined || projectRoot === undefined) throw new Error('package resolver requires a package and project root')
  const entryUrl = pluginUrl(reference, projectRoot)
  if (!entryUrl.startsWith('file:')) throw new Error(`package ${reference} did not resolve to a file`)
  const manifestPath = findPackageJSON(reference, pathToFileURL(resolve(projectRoot, 'package.json')))
  if (manifestPath === undefined) throw new Error(`cannot find package manifest for ${reference}`)
  process.stdout.write(JSON.stringify({ entryUrl, manifestPath }))
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
