import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.js'
import type { PluginConfig, Violation } from './model.js'
import { isDocumentationPath, isInside, pluginReference, resolvePackageReference } from './plugin-module.js'

export type PluginDocumentationSelection =
  | { readonly kind: 'format'; readonly name: string }
  | { readonly kind: 'runner'; readonly name: string }
  | { readonly kind: 'package'; readonly name: string }

export type PluginDocumentation = {
  readonly selection: PluginDocumentationSelection
  readonly plugin:
    | { readonly package: string; readonly name: string; readonly version: string; readonly root: string }
    | { readonly module: string; readonly root: string }
  readonly document: { readonly path: string; readonly content: string }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function strictText(bytes: Uint8Array, description: string): string {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) }
  catch { throw new Error(`${description} must contain valid UTF-8`) }
}

async function canonicalDirectory(path: string, description: string): Promise<string> {
  let canonical: string
  try { canonical = await realpath(path) } catch (error) {
    throw new Error(`cannot resolve ${description}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!(await stat(canonical)).isDirectory()) throw new Error(`${description} must be a directory`)
  return canonical
}

async function readDocument(ownerRoot: string, relativePath: unknown): Promise<{ path: string; content: string }> {
  if (!isDocumentationPath(relativePath)) throw new Error('plugin documentation must name a safe relative .md or .markdown file')
  const lexicalPath = resolve(ownerRoot, relativePath)
  if (!isInside(ownerRoot, lexicalPath)) throw new Error('plugin documentation must stay inside its owner')
  let canonicalPath: string
  try { canonicalPath = await realpath(lexicalPath) } catch (error) {
    throw new Error(`cannot resolve plugin documentation ${relativePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!isInside(ownerRoot, canonicalPath)) throw new Error('plugin documentation must stay inside its owner after resolving symlinks')
  const info = await stat(canonicalPath)
  if (!info.isFile()) throw new Error(`plugin documentation ${relativePath} must be a regular file`)
  const bytes = await readFile(canonicalPath)
  const content = strictText(bytes, `plugin documentation ${relativePath}`)
  if (content.trim() === '') throw new Error(`plugin documentation ${relativePath} must not be empty`)
  return { path: canonicalPath, content }
}

function displayViolation(violation: Violation): string {
  return `${violation.path}${violation.line === undefined ? '' : `:${violation.line}`}: ${violation.message}`
}

async function installedPackageRoot(projectRoot: string, specifier: string): Promise<string> {
  const parts = specifier.split('/')
  const packageName = specifier.startsWith('@') ? `${String(parts[0])}/${String(parts[1])}` : String(parts[0])
  for (let directory = projectRoot; ; directory = dirname(directory)) {
    try { return await realpath(join(directory, 'node_modules', packageName)) } catch { /* Continue through Node's ancestor package search. */ }
    const parent = dirname(directory)
    if (parent === directory) break
  }
  throw new Error(`cannot locate installed package root for ${specifier}`)
}

async function packageDocumentation(selection: PluginDocumentationSelection, specifier: string, projectRoot: string): Promise<PluginDocumentation> {
  const resolved = await resolvePackageReference(specifier, projectRoot)
  const manifestPath = await realpath(resolved.manifestPath)
  const manifestInfo = await stat(manifestPath)
  if (!manifestInfo.isFile()) throw new Error(`package manifest for ${specifier} must be a regular file`)
  const manifestBytes = await readFile(manifestPath)
  const manifestSource = strictText(manifestBytes, `package manifest for ${specifier}`)
  let manifestValue: unknown
  try { manifestValue = JSON.parse(manifestSource) } catch (error) {
    throw new Error(`invalid package manifest for ${specifier}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const manifest = record(manifestValue)
  if (manifest === undefined || typeof manifest.name !== 'string' || manifest.name.trim() === ''
    || typeof manifest.version !== 'string' || manifest.version.trim() === '') {
    throw new Error(`package manifest for ${specifier} must declare non-empty name and version`)
  }

  const focusedSpec = manifest.focusedSpec === undefined ? undefined : record(manifest.focusedSpec)
  if (manifest.focusedSpec !== undefined && focusedSpec === undefined) {
    throw new Error(`package manifest for ${specifier} has invalid focusedSpec metadata`)
  }
  const hasDocumentation = focusedSpec !== undefined && Object.hasOwn(focusedSpec, 'documentation')
  const documentationPath = hasDocumentation ? focusedSpec.documentation : 'README.md'
  if (hasDocumentation && !isDocumentationPath(documentationPath)) {
    throw new Error(`package manifest for ${specifier} has invalid focusedSpec.documentation`)
  }

  const packageRoot = dirname(manifestPath)
  const installedRoot = await installedPackageRoot(projectRoot, specifier)
  if (packageRoot !== installedRoot) throw new Error(`package manifest for ${specifier} is not at its installed package root`)
  let entryPath: string
  try { entryPath = await realpath(fileURLToPath(resolved.entryUrl)) } catch (error) {
    throw new Error(`cannot resolve package entry for ${specifier}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!isInside(packageRoot, entryPath)) throw new Error(`resolved package entry for ${specifier} is outside its package root`)
  if (!(await stat(entryPath)).isFile()) throw new Error(`resolved package entry for ${specifier} must be a regular file`)
  const document = await readDocument(packageRoot, documentationPath)
  return {
    selection,
    plugin: { package: specifier, name: manifest.name, version: manifest.version, root: packageRoot },
    document,
  }
}

async function moduleDocumentation(selection: PluginDocumentationSelection, config: PluginConfig, projectRoot: string): Promise<PluginDocumentation> {
  if (config.module === undefined) throw new Error('internal error: module documentation requires a module registration')
  if (config.documentation === undefined) throw new Error(`${selection.kind} ${selection.name} module registration does not declare documentation`)
  const canonicalRoot = await canonicalDirectory(projectRoot, 'project root')
  await pluginReference(canonicalRoot, config)
  const document = await readDocument(canonicalRoot, config.documentation)
  return { selection, plugin: { module: config.module, root: canonicalRoot }, document }
}

export async function readPluginDocumentation(
  selection: PluginDocumentationSelection,
  projectRoot: string,
  configPath?: string,
): Promise<PluginDocumentation> {
  const canonicalRoot = await canonicalDirectory(resolve(projectRoot), 'project root')
  if (selection.kind === 'package') return packageDocumentation(selection, selection.name, canonicalRoot)

  const loaded = await loadConfig(canonicalRoot, configPath)
  if (loaded.config === undefined) throw new Error(loaded.violations.map(displayViolation).join('\n'))
  const config = selection.kind === 'format'
    ? loaded.config.specifications.formats[selection.name]
    : loaded.config.runners[selection.name]
  if (config === undefined) throw new Error(`unknown ${selection.kind} registration ${selection.name}`)
  return config.package === undefined
    ? moduleDocumentation(selection, config, canonicalRoot)
    : packageDocumentation(selection, config.package, canonicalRoot)
}

export function displayPluginDocumentation(result: PluginDocumentation): string {
  const provenance = [
    `Selection: ${result.selection.kind} ${result.selection.name}`,
    ...('package' in result.plugin
      ? [`Package: ${result.plugin.package}`, `Name: ${result.plugin.name}`, `Version: ${result.plugin.version}`]
      : [`Module: ${result.plugin.module}`]),
    `Root: ${result.plugin.root}`,
    `Document: ${result.document.path}`,
  ]
  return `${provenance.join('\n')}\n\n${result.document.content}`
}
