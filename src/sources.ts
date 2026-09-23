import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'
import fg from 'fast-glob'
import type { FocusedSpecConfig, SpecDocument, Violation } from './model.js'
import { parseFocusedSpecDocument } from './parser.js'

function portable(path: string): string {
  return path.split('\\').join('/')
}

async function documents(projectRoot: string, patterns: readonly string[]): Promise<SpecDocument[]> {
  const paths = await fg([...patterns], {
    absolute: true,
    cwd: projectRoot,
    onlyFiles: true,
    unique: true,
  })
  paths.sort()
  return Promise.all(paths.map(async path => parseFocusedSpecDocument(
    portable(relative(projectRoot, path)),
    await readFile(path, 'utf8'),
  )))
}

function openSpecRoot(config: FocusedSpecConfig): string {
  if (config.specifications.source !== 'openspec') throw new Error('OpenSpec source required')
  return config.specifications.root ?? 'openspec'
}

export async function loadCurrentDocuments(projectRoot: string, config: FocusedSpecConfig): Promise<SpecDocument[]> {
  if (config.specifications.source === 'files') return documents(projectRoot, config.specifications.paths)
  return documents(projectRoot, [`${openSpecRoot(config)}/specs/**/spec.md`])
}

export async function loadChangeDocuments(projectRoot: string, config: FocusedSpecConfig, changeName: string): Promise<SpecDocument[]> {
  if (config.specifications.source !== 'openspec') return []
  return documents(projectRoot, [`${openSpecRoot(config)}/changes/${changeName}/specs/**/spec.md`])
}

export async function loadActiveChanges(projectRoot: string, config: FocusedSpecConfig): Promise<ReadonlyMap<string, readonly SpecDocument[]>> {
  if (config.specifications.source !== 'openspec') return new Map()
  const root = openSpecRoot(config)
  const paths = await fg([`${root}/changes/*/specs/**/spec.md`, `!${root}/changes/archive/**`], {
    absolute: true,
    cwd: projectRoot,
    onlyFiles: true,
    unique: true,
  })
  const groups = new Map<string, string[]>()
  for (const path of paths.sort()) {
    const rel = portable(relative(projectRoot, path))
    const prefix = `${portable(root)}/changes/`
    const changeName = rel.slice(prefix.length).split('/')[0]
    if (changeName === undefined || changeName === '') continue
    groups.set(changeName, [...(groups.get(changeName) ?? []), path])
  }
  const result = new Map<string, readonly SpecDocument[]>()
  for (const [name, changePaths] of groups) {
    result.set(name, await Promise.all(changePaths.map(async path => parseFocusedSpecDocument(
      portable(relative(projectRoot, path)),
      await readFile(path, 'utf8'),
    ))))
  }
  return result
}

export function validateSourceSelection(config: FocusedSpecConfig, changeName: string | undefined): Violation[] {
  if (changeName !== undefined && config.specifications.source !== 'openspec') {
    return [{ path: '.focused-spec/config.yaml', message: '--change requires specifications.source: openspec' }]
  }
  return []
}
