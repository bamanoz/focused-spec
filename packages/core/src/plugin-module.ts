import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { access, realpath } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { PluginConfig } from './model.js'

const MODULE_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.mts'])
const PACKAGE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/[A-Za-z0-9_.-]+)*$/u
const DRIVE_PATH = /^[A-Za-z]:/u

export function isPackageSpecifier(value: string): boolean {
  return PACKAGE.test(value) && !value.split('/').some(part => part === '.' || part === '..')
}

export function isDocumentationPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
    && !isAbsolute(value) && !DRIVE_PATH.test(value) && !value.includes('\\') && !value.includes('\0')
    && !value.split('/').includes('..') && ['.md', '.markdown'].includes(extname(value))
}

export function isInside(root: string, path: string): boolean {
  const value = relative(resolve(root), resolve(path))
  return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value))
}

export interface ResolvedPackageReference {
  readonly entryUrl: string
  readonly manifestPath: string
}

export async function resolvePackageReference(reference: string, projectRoot: string): Promise<ResolvedPackageReference> {
  if (!isPackageSpecifier(reference)) throw new Error('plugin package must be an installed package name or public subpath')
  const compiledResolver = fileURLToPath(new URL('./plugin-resolver.js', import.meta.url))
  const sourceResolver = fileURLToPath(new URL('./plugin-resolver.ts', import.meta.url))
  const resolver = existsSync(compiledResolver) ? compiledResolver : sourceResolver
  const stdout = await new Promise<string>((resolvePromise, rejectPromise) => {
    execFile(process.execPath, [...pluginExecArgv(resolver, true), resolver, reference, projectRoot], {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 65_536,
    }, (error, output, diagnostic) => {
      if (error !== null) {
        rejectPromise(new Error(diagnostic.trim() || error.message))
        return
      }
      resolvePromise(output)
    })
  })
  let value: unknown
  try { value = JSON.parse(stdout) } catch { throw new Error(`package resolver returned an invalid response for ${reference}`) }
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || !('entryUrl' in value) || typeof value.entryUrl !== 'string'
    || !('manifestPath' in value) || typeof value.manifestPath !== 'string') {
    throw new Error(`package resolver returned an invalid response for ${reference}`)
  }
  return { entryUrl: value.entryUrl, manifestPath: value.manifestPath }
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

export function pluginExecArgv(reference: string, mayLoadTypeScript = false): string[] {
  const args = ['--experimental-import-meta-resolve']
  if ((mayLoadTypeScript || extname(reference) === '.ts' || extname(reference) === '.mts') && !process.features.typescript) args.push('--experimental-strip-types')
  return args
}
