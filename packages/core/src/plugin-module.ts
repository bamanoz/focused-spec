import { access, realpath } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { PluginConfig } from './model.js'

const MODULE_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.mts'])
const PACKAGE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/[A-Za-z0-9_.-]+)*$/u

export function isPackageSpecifier(value: string): boolean {
  return PACKAGE.test(value) && !value.split('/').some(part => part === '.' || part === '..')
}

export function isInside(root: string, path: string): boolean {
  const value = relative(resolve(root), resolve(path))
  return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value))
}

export async function pluginReference(projectRoot: string, config: PluginConfig): Promise<string> {
  if ((config.package === undefined) === (config.module === undefined)) throw new Error('plugin must declare exactly one package or module')
  if (config.package !== undefined) {
    if (!isPackageSpecifier(config.package)) throw new Error('plugin package must be an installed package name or public subpath')
    return config.package
  }
  const module = config.module!
  const path = resolve(projectRoot, module)
  if (isAbsolute(module) || !isInside(projectRoot, path)) throw new Error('plugin module must stay inside project root')
  if (!MODULE_EXTENSIONS.has(extname(path))) throw new Error('plugin module must be .ts, .mts, .js, or .mjs')
  await access(path)
  if (!isInside(await realpath(projectRoot), await realpath(path))) throw new Error('plugin module must stay inside project root after resolving symlinks')
  return path
}

// Hosts enable Node's parent-aware ESM resolver. Packages are resolved from the
// consumer, never from this loader's own dependency tree or require conditions.
export function pluginUrl(reference: string, projectRoot: string): string {
  return isAbsolute(reference)
    ? pathToFileURL(reference).href
    : import.meta.resolve(reference, pathToFileURL(resolve(projectRoot, 'package.json')).href)
}

export function pluginExecArgv(reference: string): string[] {
  const args = ['--experimental-import-meta-resolve']
  if ((extname(reference) === '.ts' || extname(reference) === '.mts') && !process.features.typescript) args.push('--experimental-strip-types')
  return args
}
