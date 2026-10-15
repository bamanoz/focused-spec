import process from 'node:process'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readFile, realpath, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { targets } from './init-targets.js'
import type { Tool } from './init-targets.js'
import { argumentError } from './cli-error.js'
import { InitTerminal } from './init-terminal.js'

export const INIT_HELP = `Install selected agent integration from this package, without evidence setup.

Usage:
  focused-spec init [path] [--tools <IDs>] [--dry-run] [--json] [--replace] [--no-animation]

Options:
  --tools <IDs>     Comma-separated target IDs below; bypasses interactive selection
  --dry-run         Preview all actions and conflicts without creating or modifying files
  --json            Print one action/error report; requires explicit --tools
  --replace         Replace divergent selected regular integration files; preserve neighboring files
  --no-animation    Show the final welcome logo immediately before choosing agents
  -h, --help        Show this help

The path defaults to cwd and must be an existing directory; no ancestor discovery.
OpenSpec 1.14.1 targets (50 canonical IDs):
${Object.entries(targets).map(([id, target]) => `  ${id}  ${target.home ? '~/' : ''}${target.skill}${target.command === undefined ? ' (skills only)' : ` and ${target.command}`}\n    ${target.hint}`).join('\n')}

Alias: windsurf -> devin, deduplicated before reporting; no .windsurf writes.
Amp, Antigravity, Codex, GSD, Zed and agents share one .agents/skills loader.
MiniMax Code is global-only: explicit minimax-code selection authorizes its home skill file.
Project-only selection does not inspect home integration. Global JSON file/error paths are
canonical absolute paths; project paths remain project-relative. No all/none selectors.
Without --tools, an eligible TTY shows a small welcome beside the logo in normal scrollback.
Enter opens the separate searchable picker. There, type to filter, arrows move,
Space to toggle, Enter to review and Y to install. Esc/Ctrl-C cancels; Backspace
edits the search.
Preview, conflicts and cancellation never write integration files.
Custom files conflict by default; all selected assets/destinations across both roots are
checked before any writes. Symlinked destinations are rejected even with --replace.
No config, registry, runner, dependency, global settings or AGENTS.md is generated.
Success means installation only, not evidence readiness, activation or execution.

Examples:
  focused-spec init --tools oh-my-pi,claude
  focused-spec init --no-animation
  focused-spec init ../project --tools codex --dry-run --json
  focused-spec init --tools minimax-code --dry-run --json
`

type Action = 'install' | 'unchanged' | 'replace' | 'conflict'
interface FileResult { path: string; action: Action; applied: boolean }
interface InitReport {
  root: string | null
  tools: Tool[]
  dryRun: boolean
  files: FileResult[]
  errors: { path?: string; message: string }[]
}
interface Options { path: string; tools?: Tool[]; dryRun: boolean; json: boolean; replace: boolean; noAnimation: boolean }
interface ExistingFile { content: Buffer; dev: number; ino: number }
interface Destination { root: string; path: string; reportPath: string; asset: URL }
interface PlannedFile { root: string; path: string; result: FileResult; content: Buffer; existing: ExistingFile | undefined }

function toolIds(value: string): Tool[] {
  const tools: Tool[] = []
  for (const part of value.split(',')) {
    const id = part.trim() === 'windsurf' ? 'devin' : part.trim()
    if (!Object.hasOwn(targets, id)) throw argumentError(`unknown or empty init target ${JSON.stringify(id)}; choose an ID listed in init --help`, 'init')
    if (!tools.includes(id as Tool)) tools.push(id as Tool)
  }
  return tools
}

function parse(argumentsList: readonly string[]): Options {
  let path: string | undefined
  let tools: Tool[] | undefined
  let dryRun = false
  let json = false
  let replace = false
  let noAnimation = false
  const seen = new Set<string>()
  for (let index = 0; index < argumentsList.length; index++) {
    const argument = argumentsList[index]!
    if (argument.startsWith('-')) {
      if (seen.has(argument)) throw argumentError(`duplicate option ${argument}`, 'init')
      seen.add(argument)
      if (argument === '--tools') {
        const value = argumentsList[++index]
        if (value === undefined || value.startsWith('-')) throw argumentError('missing value for --tools', 'init')
        tools = toolIds(value)
      } else if (argument === '--dry-run') dryRun = true
      else if (argument === '--json') json = true
      else if (argument === '--replace') replace = true
      else if (argument === '--no-animation') noAnimation = true
      else throw argumentError(`unknown argument ${argument}`, 'init')
    } else {
      if (path !== undefined || argument.trim() === '') throw argumentError('expected one existing project directory', 'init')
      path = argument
    }
  }
  return { path: path ?? process.cwd(), ...(tools === undefined ? {} : { tools }), dryRun, json, replace, noAnimation }
}


async function inspect(root: string, path: string): Promise<ExistingFile | undefined> {
  const parts = path.split('/')
  let absolute = root
  for (let index = 0; index < parts.length; index++) {
    absolute = join(absolute, parts[index]!)
    let info
    try { info = await lstat(absolute) } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
      throw error
    }
    if (info.isSymbolicLink()) throw new Error('symlinked integration destinations or ancestors are not allowed')
    if (index < parts.length - 1) {
      if (!info.isDirectory()) throw new Error('integration ancestor is not a directory')
    } else {
      if (!info.isFile()) throw new Error('integration destination is not a regular file')
      return { content: await readFile(absolute), dev: info.dev, ino: info.ino }
    }
  }
  return undefined
}

async function createParents(root: string, path: string): Promise<void> {
  let absolute = root
  for (const part of path.split('/').slice(0, -1)) {
    absolute = join(absolute, part)
    try { await mkdir(absolute) } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
    }
    const info = await lstat(absolute)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('integration ancestor changed or is unsafe')
  }
}

async function applyFile(file: PlannedFile): Promise<void> {
  const current = await inspect(file.root, file.path)
  if (current === undefined ? file.existing !== undefined
    : file.existing === undefined || current.dev !== file.existing.dev || current.ino !== file.existing.ino || !current.content.equals(file.existing.content)) {
    throw new Error('integration destination changed after preflight; no replacement authorized for its new state')
  }
  if (file.result.action === 'unchanged') return
  await createParents(file.root, file.path)
  const handle = await open(join(file.root, file.path), file.existing === undefined ? 'wx'
    : constants.O_RDWR | (constants.O_NOFOLLOW ?? 0))
  try {
    if (file.existing !== undefined) {
      const info = await handle.stat()
      if (!info.isFile() || info.dev !== file.existing.dev || info.ino !== file.existing.ino
        || !(await handle.readFile()).equals(file.existing.content)) throw new Error('integration destination changed before replacement')
    }
    let written = 0
    while (written < file.content.length) {
      const result = await handle.write(file.content, written, file.content.length - written, written)
      if (result.bytesWritten === 0) throw new Error('integration file write made no progress')
      written += result.bytesWritten
    }
    await handle.truncate(file.content.length)
    file.result.applied = true
  } finally { await handle.close() }
}

async function planInstallation(root: string, report: InitReport, replace: boolean): Promise<PlannedFile[]> {
  let home: string | undefined
  if (report.tools.includes('minimax-code')) {
    const requestedHome = resolve(homedir())
    try {
      home = await realpath(requestedHome)
      if (!(await stat(home)).isDirectory()) throw new Error('home root must be an existing directory')
    } catch (error) {
      report.errors.push({ path: join(requestedHome, targets['minimax-code'].skill), message: `invalid MiniMax home root: ${error instanceof Error ? error.message : String(error)}` })
    }
  }
  const assets = new Map<string, Destination>()
  for (const id of report.tools) {
    const target = targets[id]
    const base = target.home ? home : root
    if (base === undefined) continue
    const paths = [target.skill, ...(target.command === undefined ? [] : [target.command])]
    for (const path of paths) {
      const absolute = join(base, path)
      const filename = path.slice(path.lastIndexOf('/') + 1)
      assets.set(absolute, { root: base, path, reportPath: target.home ? absolute : path,
        asset: new URL(path === target.skill ? '../skills/focused-spec/SKILL.md' : `../skills/commands/${id}/${filename}`, import.meta.url) })
    }
  }
  const loaded: { destination: Destination; content: Buffer }[] = []
  const contents = new Map<string, Buffer>()
  for (const destination of assets.values()) {
    try {
      let content = contents.get(destination.asset.href)
      if (content === undefined) {
        content = await readFile(destination.asset)
        if (content.toString('utf8').trim() === '') throw new Error('empty bundled asset')
        contents.set(destination.asset.href, content)
      }
      loaded.push({ destination, content })
    } catch (error) {
      report.errors.push({ path: destination.reportPath, message: `incomplete installed focused-spec package: ${error instanceof Error ? error.message : String(error)}. Reinstall the package.` })
    }
  }
  const plan: PlannedFile[] = []
  if (report.errors.length === 0) for (const { destination, content } of loaded) {
    try {
      const existing = await inspect(destination.root, destination.path)
      const action: Action = existing === undefined ? 'install' : existing.content.equals(content) ? 'unchanged' : replace ? 'replace' : 'conflict'
      const result: FileResult = { path: destination.reportPath, action, applied: false }
      report.files.push(result)
      plan.push({ root: destination.root, path: destination.path, result, content, existing })
      if (action === 'conflict') report.errors.push({ path: destination.reportPath, message: 'custom integration differs; preserve it or explicitly use --replace' })
    } catch (error) { report.errors.push({ path: destination.reportPath, message: error instanceof Error ? error.message : String(error) }) }
  }
  return plan
}

export async function initialize(argumentsList: readonly string[]): Promise<number> {
  const options = parse(argumentsList)
  if (options.tools === undefined && (options.json || process.env.CI !== undefined || !process.stdin.isTTY || !process.stdout.isTTY)) {
    throw argumentError('noninteractive initialization requires explicit --tools', 'init')
  }
  const report: InitReport = { root: null, tools: options.tools ?? [], dryRun: options.dryRun, files: [], errors: [] }
  let terminal: InitTerminal | undefined
  let completedTerminal: InitTerminal | undefined
  try {
    const root = await realpath(resolve(options.path))
    if (!(await stat(root)).isDirectory()) throw new Error('init root must be an existing directory')
    report.root = root
    if (options.tools === undefined) terminal = new InitTerminal()
    report.tools = options.tools ?? await terminal!.pick(root, options.noAnimation)
    const plan = await planInstallation(root, report, options.replace)
    if (terminal !== undefined) {
      const confirmed = await terminal.review(report)
      terminal.close()
      completedTerminal = terminal
      terminal = undefined
      if (!confirmed && report.errors.length === 0) report.errors.push({ message: 'initialization cancelled; no files written' })
    }
    if (report.errors.length === 0 && !options.dryRun) for (const file of plan) {
      try { await applyFile(file) } catch (error) {
        report.errors.push({ path: file.result.path, message: `installation stopped; this file may be partially written: ${error instanceof Error ? error.message : String(error)}` })
        break
      }
    }
  } catch (error) { report.errors.push({ message: error instanceof Error ? error.message : String(error) }) }
  finally { terminal?.close() }
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  else if (completedTerminal !== undefined) {
    if (report.errors.length === 0) completedTerminal.summary(report)
  } else {
    for (const file of report.files) process.stdout.write(`${file.action.toUpperCase()} ${file.path}${file.applied ? ' (written)' : ''}\n`)
    if (report.errors.length === 0) {
      process.stdout.write(`${report.dryRun ? 'Preview complete; no files written.' : 'Agent integration installed.'} Evidence readiness, skill activation and execution are not certified.\n`)
      for (const id of report.tools) process.stdout.write(`${id}: ${targets[id].hint}\n`)
    }
  }
  if (!options.json) for (const error of report.errors) process.stderr.write(`${error.path === undefined ? '' : `${error.path}: `}${error.message}\n`)
  return report.errors.length === 0 ? 0 : 1
}
