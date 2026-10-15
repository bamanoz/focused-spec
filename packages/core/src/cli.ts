#!/usr/bin/env node
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { isAbsolute, resolve } from 'node:path'
import { instructions, INSTRUCTIONS_HELP } from './instructions.js'
import { initialize, INIT_HELP } from './init.js'
import { loadConfig } from './config.js'
import { displayPluginDocumentation, readPluginDocumentation } from './plugin-docs.js'
import type { PluginDocumentationSelection } from './plugin-docs.js'
import { executePlan } from './executor.js'
import type { ExecutionPlan, ExecutionResult, SpecDocument, Violation } from './model.js'
import { parseEvidenceReference } from './parser.js'
import { planEvidence, projectExecutionPlan } from './planner.js'
import { validateFocusedSpecs } from './validate.js'
import { OperationTimings } from './timings.js'
import { argumentError, jsonRequested, printCliError } from './cli-error.js'
import { readVersion, displayVersion } from './cli-version.js'
import { inspectEnrollments, displayInspection } from './inspection.js'

type InspectionCommand = 'list' | 'show'

interface CliOptions {
  readonly command: 'validate' | 'run'
  readonly root: string
  readonly configPath?: string
  readonly scopeName?: string
  readonly strict: boolean
  readonly syntaxOnly: boolean
  readonly json: boolean
  readonly allowSkip: boolean
  readonly scenarioId?: string
  readonly timings: boolean
}

interface PluginDocsOptions {
  readonly command: 'plugin-docs'
  readonly root: string
  readonly configPath?: string
  readonly json: boolean
  readonly selection: PluginDocumentationSelection
}

interface InspectionOptions {
  readonly root: string
  readonly configPath?: string
  readonly scopeName?: string
  readonly scenarioId?: string
  readonly json: boolean
}

const ROOT_HELP = `focused-spec — Connect native checkable items to real executable evidence.

Usage:
  focused-spec <command> [options]
  focused-spec help [command]

Commands:
  validate  Check native bindings and resolve format-provided evidence without running tests
  run       Strictly validate, then execute selected evidence
  plugin-docs  Read one installed plugin's public Markdown documentation
  instructions  Read version-compatible workflow, format or runner guidance from this package
  init      Install selected agent integrations without evidence setup
  version   Identify this executable and its supported contract versions offline
  list      Inspect enrolled items and evidence provenance without resolving targets
  show      Inspect exact matching scope/ID occurrences without running tests

Options:
  -h, --help  Show this help
  -V, --version  Show this package version offline

Examples:
  focused-spec validate --scope add-search
  focused-spec run --scope add-search
  focused-spec validate --help

Run 'focused-spec <command> --help' for command options.
`

const VALIDATE_HELP = `Validate native item bindings and resolve concrete format-provided evidence without running tests.

Usage:
  focused-spec validate [options]

Options:
  --root <path>    Project root (default: current directory)
  --config <path>  Configuration file relative to the project root (default: .focused-spec/config.yaml)
  --scope <name>   Validate only this scope (default: all discovered scopes)
  --scenario <id>  Narrow validation to matching enrolled items in selected scopes
  --strict         Reject all planned: evidence; use once exact tests exist
  --syntax-only    Check enrollment syntax and scoped native identity without loading runners or resolving evidence
  --json           Print the validation result as JSON
  --timings        Include elapsed validation and resolution phase timings
  -h, --help       Show this help

Without --strict, planned: evidence is allowed in every scope and is not resolved.
Full validation resolves concrete evidence but never executes tests.
With --scenario, only matching scope/ID occurrences are validated; this does not certify the rest.
Configuration version 5 selects explicitly registered Format API 2 adapters.
Each selected format supplies exact evidence, either inline or through explicitly configured adapter options.
This command does not certify host format validity or unregistered native outcomes.

Examples:
  focused-spec validate --scope add-search
  focused-spec validate --scope add-search --strict
  focused-spec validate --syntax-only --json
`

const RUN_HELP = `Strictly validate evidence before executing selected tests.

Usage:
  focused-spec run [options]

Options:
  --root <path>     Project root (default: current directory)
  --config <path>   Configuration file relative to the project root (default: .focused-spec/config.yaml)
  --scope <name>    Validate and execute only this scope (default: all discovered scopes)
  --scenario <id>   Narrow validation and execution to matching enrolled items
                    within the selected scope(s)
  --allow-skip      Allow an overall successful exit with SKIP; never relabel SKIP as PASS
  --json            Print the execution result as JSON
  --timings         Include elapsed validation, resolution and execution phase timings
  -h, --help        Show this help

Run always validates strictly before starting tests; planned: evidence blocks execution.
Evidence is supplied by each explicitly selected format; inline formats do not require a registry.
Each scope/ID must uniquely enroll one native item through that format.
Only enrolled items and executed evidence are reported; native validation belongs to the host.

Examples:
  focused-spec run
  focused-spec run --scope add-search --scenario search.results.empty
`

const PLUGIN_DOCS_HELP = `Read one installed plugin's public Markdown documentation without loading plugin code.

Usage:
  focused-spec plugin-docs (--format <id> | --runner <id> | --package <specifier>) [options]

Options:
  --format <id>          Read documentation for one configured format
  --runner <id>          Read documentation for one configured runner
  --package <specifier>  Read documentation for an installed package or public subpath
  --root <path>          Consumer project root (default: current directory)
  --config <path>        Configuration relative to the project root (registrations only)
  --json                 Print documentation and exact provenance as JSON
  -h, --help             Show this help

Exactly one selector is required. Package lookup does not read project configuration.
Package documentation is README.md unless the package manifest declares focusedSpec.documentation.
Local-module registrations must declare a contained project-relative documentation file.
Documentation is returned in full as dependency or project text with visible provenance.

Examples:
  focused-spec plugin-docs --format prose
  focused-spec plugin-docs --runner test --json
  focused-spec plugin-docs --package @example/format/subpath
`

const VERSION_HELP = `Identify the invoked focused-spec installation offline.

Usage:
  focused-spec version [--json]
  focused-spec --version
  focused-spec -V

Options:
  --json      Print package, canonical executable, runtime and contract versions as JSON
  -h, --help  Show this help

No project configuration, plugins, network access or writes are needed.

Example:
  focused-spec version --json
`

const LIST_HELP = `Inspect enrolled items and exact evidence provenance without resolving targets.

Usage:
  focused-spec list [options]

Options:
  --root <path>    Project root (default: current directory)
  --config <path>  Configuration relative to project root (default: .focused-spec/config.yaml)
  --scope <name>   Select only this scope (default: all discovered scopes)
  --scenario <id>  Select only exact matching enrolled IDs
  --json          Print selection, native sources and ordered evidence origins as JSON
  -h, --help      Show this help

Loads configured format parsers/binders and checks structure, permitting planned evidence.
Never loads runners, resolves targets or executes tests. This is not PASS or native coverage.

Example:
  focused-spec list --scope add-search --json
`

const SHOW_HELP = `Inspect every exact matching scope/ID occurrence and its evidence provenance.

Usage:
  focused-spec show <id> [options]
  focused-spec show [options] -- <id>

Options:
  --root <path>    Project root (default: current directory)
  --config <path>  Configuration relative to project root (default: .focused-spec/config.yaml)
  --scope <name>   Select only this scope (default: every matching scope)
  --json          Print selection, native sources and ordered evidence origins as JSON
  -h, --help      Show this help

IDs are exact opaque values. Use -- before a flag-looking ID, with options before --.
Loads format parsers/binders, never runners; no target resolution, test execution or PASS claim.

Examples:
  focused-spec show search.results.empty --scope add-search --json
  focused-spec show --json -- --json
`

const COMMAND_HELP: Readonly<Record<string, string>> = {
  validate: VALIDATE_HELP,
  run: RUN_HELP,
  'plugin-docs': PLUGIN_DOCS_HELP,
  instructions: INSTRUCTIONS_HELP,
  init: INIT_HELP,
  version: VERSION_HELP,
  list: LIST_HELP,
  show: SHOW_HELP,
}

function requestedHelp(argumentsList: readonly string[]): string | undefined {
  const command = argumentsList[0]
  if (command === '--help' || command === '-h' || command === 'help') {
    if (argumentsList.length === 1) return ROOT_HELP
    if (command === 'help' && argumentsList.length === 2) {
      const target = argumentsList[1]!
      const help = Object.hasOwn(COMMAND_HELP, target) ? COMMAND_HELP[target] : undefined
      if (help !== undefined) return help
      throw argumentError(`unknown help command ${String(argumentsList[1])}`)
    }
    throw argumentError('unexpected arguments for help')
  }
  const help = command === '--version' || command === '-V' ? VERSION_HELP : command !== undefined && Object.hasOwn(COMMAND_HELP, command) ? COMMAND_HELP[command] : undefined
  if (help === undefined) return undefined
  for (let index = 1; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (command === 'show' && argument === '--') break
    if ((command === 'run' || command === 'validate' || command === 'list') && argument === '--scenario') {
      index += 1
      continue
    }
    if (argument === '--help' || argument === '-h') return help
  }
  return undefined
}

function parsePluginDocsArguments(argumentsList: readonly string[]): PluginDocsOptions {
  let root = process.cwd()
  let configPath: string | undefined
  let json = false
  let selection: PluginDocumentationSelection | undefined
  const seen = new Set<string>()

  for (let index = 1; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument !== undefined && argument.startsWith('-')) {
      if (seen.has(argument)) throw argumentError(`duplicate option ${argument}`, 'plugin-docs')
      seen.add(argument)
    }
    if (argument === '--json') json = true
    else if (argument === '--root' || argument === '--config' || argument === '--format' || argument === '--runner' || argument === '--package') {
      const value = argumentsList[index + 1]
      if (value === undefined || value.startsWith('-')) throw argumentError(`missing value for ${argument}`, 'plugin-docs')
      index += 1
      if (argument === '--root') root = resolve(value)
      else if (argument === '--config') configPath = value
      else {
        if (selection !== undefined) throw argumentError('plugin-docs requires exactly one --format, --runner, or --package selector', 'plugin-docs')
        selection = { kind: argument.slice(2) as PluginDocumentationSelection['kind'], name: value }
      }
    } else {
      throw argumentError(`unknown argument ${String(argument)}`, 'plugin-docs')
    }
  }

  if (selection === undefined) throw argumentError('plugin-docs requires exactly one --format, --runner, or --package selector', 'plugin-docs')
  if (selection.kind === 'package' && configPath !== undefined) throw argumentError('--config is valid only with --format or --runner', 'plugin-docs')
  return {
    command: 'plugin-docs',
    root,
    ...(configPath === undefined ? {} : { configPath }),
    json,
    selection,
  }
}

function parseVersionArguments(argumentsList: readonly string[]): boolean {
  if (argumentsList[0] !== 'version' && argumentsList.length !== 1) throw argumentError('version options require the version command', 'version')
  let json = false
  for (let index = 1; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]!
    if (argument !== '--json') throw argumentError(`unknown argument ${argument}`, 'version')
    if (json) throw argumentError('duplicate option --json', 'version')
    json = true
  }
  return json
}

function parseInspectionArguments(argumentsList: readonly string[], command: InspectionCommand): InspectionOptions {
  let root = process.cwd()
  let configPath: string | undefined
  let scopeName: string | undefined
  let scenarioId: string | undefined
  let json = false
  const seen = new Set<string>()
  for (let index = 1; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]!
    if (command === 'show' && argument === '--') {
      if (scenarioId !== undefined || index + 2 !== argumentsList.length) throw argumentError('show requires exactly one ID', command)
      scenarioId = argumentsList[index + 1]!
      break
    }
    if (argument.startsWith('-')) {
      if (seen.has(argument)) throw argumentError(`duplicate option ${argument}`, command)
      seen.add(argument)
    }
    if (argument === '--json') json = true
    else if (argument === '--root' || argument === '--config' || argument === '--scope' || (command === 'list' && argument === '--scenario')) {
      const value = argumentsList[index + 1]
      if (value === undefined || (argument !== '--scenario' && value.startsWith('-'))) throw argumentError(`missing value for ${argument}`, command)
      index += 1
      if (argument === '--root') root = resolve(value)
      else if (argument === '--config') configPath = value
      else if (argument === '--scope') scopeName = value
      else scenarioId = value
    } else if (command === 'show' && !argument.startsWith('-') && scenarioId === undefined) scenarioId = argument
    else throw argumentError(`unknown argument ${argument}`, command)
  }
  if (command === 'show' && scenarioId === undefined) throw argumentError('show requires exactly one ID', command)
  return { root, json, ...(configPath === undefined ? {} : { configPath }), ...(scopeName === undefined ? {} : { scopeName }), ...(scenarioId === undefined ? {} : { scenarioId }) }
}

function parseArguments(argumentsList: readonly string[]): CliOptions {
  const command = argumentsList[0]
  if (command !== 'validate' && command !== 'run') {
    throw argumentError(command === undefined ? 'missing command' : `unknown command ${command}`)
  }
  let root = process.cwd()
  let configPath: string | undefined
  let scopeName: string | undefined
  let strict = false
  let syntaxOnly = false
  let json = false
  let allowSkip = false
  let scenarioId: string | undefined
  let timings = false
  const seen = new Set<string>()

  for (let index = 1; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument !== undefined && argument.startsWith('-')) {
      if (seen.has(argument)) throw argumentError(`duplicate option ${argument}`, command)
      seen.add(argument)
    }
    if (argument === '--strict') strict = true
    else if (argument === '--syntax-only') syntaxOnly = true
    else if (argument === '--json') json = true
    else if (argument === '--timings') timings = true
    else if (argument === '--allow-skip') allowSkip = true
    else if (argument === '--root' || argument === '--config' || argument === '--scope' || argument === '--scenario') {
      const value = argumentsList[index + 1]
      if (value === undefined || (argument !== '--scenario' && value.startsWith('--'))) throw argumentError(`missing value for ${argument}`, command)
      index += 1
      if (argument === '--root') root = resolve(value)
      else if (argument === '--config') configPath = value
      else if (argument === '--scope') scopeName = value
      else scenarioId = value
    } else {
      throw argumentError(`unknown argument ${String(argument)}`, command)
    }
  }

  if (command === 'validate' && allowSkip) {
    throw argumentError('--allow-skip is valid only for run', command)
  }
  if (command === 'run' && (strict || syntaxOnly)) {
    throw argumentError('run is always strict and cannot be syntax-only', command)
  }
  return {
    command,
    root,
    ...(configPath === undefined ? {} : { configPath }),
    ...(scopeName === undefined ? {} : { scopeName }),
    strict,
    syntaxOnly,
    json,
    allowSkip,
    timings,
    ...(scenarioId === undefined ? {} : { scenarioId }),
  }
}
type ScopeSelection = { readonly mode: 'all' } | { readonly mode: 'selected'; readonly name: string }

interface ValidationScope {
  readonly scopes: ScopeSelection
  readonly scenario?: string
}

interface ExecutionSelection {
  readonly scopes: ScopeSelection
  readonly scenario?: string
}
interface ValidationContext {
  readonly validationScope: ValidationScope
}

interface RunContext {
  readonly validationScope: ValidationScope
  readonly executionSelection: ExecutionSelection
}

interface PhaseTimings extends ReturnType<OperationTimings['snapshot']> {
  readonly validationMs?: number
  readonly resolutionMs?: number
  readonly executionMs?: number
  readonly totalMs: number
}

function validationContext(options: CliOptions): ValidationContext {
  return {
    validationScope: {
      scopes: options.scopeName === undefined
        ? { mode: 'all' }
        : { mode: 'selected', name: options.scopeName },
      ...(options.scenarioId === undefined ? {} : { scenario: options.scenarioId }),
    },
  }
}

function runContext(options: CliOptions): RunContext {
  return {
    ...validationContext(options),
    executionSelection: {
      scopes: options.scopeName === undefined
        ? { mode: 'all' }
        : { mode: 'selected', name: options.scopeName },
      ...(options.scenarioId === undefined ? {} : { scenario: options.scenarioId }),
    },
  }
}

function displayScopeSelection(selection: ScopeSelection): string {
  return selection.mode === 'all' ? 'all discovered scopes' : `selected scope ${String(selection.name)}`
}

function displayValidationContext(context: ValidationContext): string {
  const selection = context.validationScope
  const scenario = selection.scenario === undefined ? '' : `, scenario ${selection.scenario}`
  return `validation scope: ${displayScopeSelection(selection.scopes)}${scenario}\n`
}

function displayRunContext(context: RunContext): string {
  const selection = context.executionSelection
  const scenario = selection.scenario === undefined ? '' : `, scenario ${selection.scenario}`
  return `${displayValidationContext(context)}execution selection: ${displayScopeSelection(selection.scopes)}${scenario}\n`
}

function displayViolation(violation: Violation): string {
  const location = violation.line === undefined ? violation.path : `${violation.path}:${violation.line}`
  return `${location}: ${violation.message}`
}

function elapsed(started: number): number {
  return Math.max(performance.now() - started, Number.EPSILON)
}

function displayTimings(timings: PhaseTimings): string {
  const phases = [
    ...(timings.validationMs === undefined ? [] : [`validation ${timings.validationMs.toFixed(2)} ms`]),
    ...(timings.resolutionMs === undefined ? [] : [`resolution ${timings.resolutionMs.toFixed(2)} ms`]),
    ...(timings.executionMs === undefined ? [] : [`execution ${timings.executionMs.toFixed(2)} ms`]),
    `total ${timings.totalMs.toFixed(2)} ms`,
  ]
  const runners = timings.runnerOperations.map(row => `  runner ${row.runnerId} ${row.operation}: ${row.durationMs.toFixed(2)} ms, start ${row.startedMs.toFixed(2)} ms, ${row.operation === 'resolve' ? `selectors ${row.selectorCount}` : `targets ${row.targetCount}`}, ${row.outcome}\n`)
  const formats = timings.formatOperations.map(row => `  format ${row.formatId} [${row.scope}] ${row.path}: ${row.durationMs.toFixed(2)} ms, start ${row.startedMs.toFixed(2)} ms, ${row.coldStart ? 'cold-start' : 'reused-host'}, ${row.outcome}\n`)
  return `timings: ${phases.join(', ')}\n${runners.join('')}${formats.join('')}`
}

function printViolations(
  violations: readonly Violation[],
  json: boolean,
  context: ValidationContext | RunContext,
  timings?: PhaseTimings,
): void {
  if (json) {
    const output = 'executionSelection' in context
      ? { valid: false, executionStarted: false, ...context, violations, ...(timings === undefined ? {} : { timings }) }
      : { valid: false, ...context, violations, ...(timings === undefined ? {} : { timings }) }
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
    return
  }
  if ('executionSelection' in context) process.stderr.write(`${displayRunContext(context)}execution did not start\n`)
  else process.stderr.write(displayValidationContext(context))
  for (const violation of violations) process.stderr.write(`${displayViolation(violation)}\n`)
  if (timings !== undefined) process.stderr.write(displayTimings(timings))
}

function printExecution(result: ExecutionResult, json: boolean, context: RunContext, timings?: PhaseTimings): void {
  if (json) {
    process.stdout.write(`${JSON.stringify({ ...result, executionStarted: result.targetCount > 0, ...context, ...(timings === undefined ? {} : { timings }) }, null, 2)}\n`)
    return
  }
  process.stdout.write(displayRunContext(context))
  for (const scenario of result.scenarios) {
    const scope = context.executionSelection.scopes.mode === 'all' ? ` [${scenario.scope}]` : ''
    process.stdout.write(`${scenario.status}${scope} ${scenario.id}\n`)
    for (const evidence of scenario.evidence) {
      process.stdout.write(`  ${evidence.status} ${evidence.reference}\n`)
      if (evidence.diagnostic !== undefined) process.stdout.write(`    ${evidence.diagnostic.split('\n').join('\n    ')}\n`)
    }
  }
  const counts = { PASS: 0, FAIL: 0, SKIP: 0, ERROR: 0 }
  for (const scenario of result.scenarios) counts[scenario.status] += 1
  process.stdout.write(`summary: ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.SKIP} SKIP, ${counts.ERROR} ERROR; ${result.targetCount} unique targets\n`)
  if (timings !== undefined) process.stdout.write(displayTimings(timings))
}

function validationCounts(documents: readonly SpecDocument[], plan: ExecutionPlan): {
  readonly scenarios: number
  readonly plannedEvidence: number
  readonly targets: number
} {
  let scenarios = 0
  let plannedEvidence = 0
  for (const document of documents) {
    scenarios += document.scenarios.length
    for (const scenario of document.scenarios) {
      for (const raw of scenario.evidence) {
        const reference = parseEvidenceReference(raw)
        if (!('error' in reference) && reference.planned) plannedEvidence += 1
      }
    }
  }
  return { scenarios, plannedEvidence, targets: plan.targets.length }
}

async function main(argumentsList: readonly string[]): Promise<number> {
  const totalStarted = performance.now()
  const help = requestedHelp(argumentsList)
  if (help !== undefined) {
    process.stdout.write(help)
    return 0
  }
  if (argumentsList[0] === 'version' || argumentsList[0] === '--version' || argumentsList[0] === '-V') {
    const json = parseVersionArguments(argumentsList)
    displayVersion(await readVersion(), json)
    return 0
  }
  if (argumentsList[0] === 'list' || argumentsList[0] === 'show') {
    const options = parseInspectionArguments(argumentsList, argumentsList[0])
    const result = await inspectEnrollments(options.root, options.configPath, {
      ...(options.scopeName === undefined ? {} : { scopeName: options.scopeName }),
      ...(options.scenarioId === undefined ? {} : { scenarioId: options.scenarioId }),
    })
    displayInspection(result, options.json)
    return result.valid ? 0 : 1
  }
  if (argumentsList[0] === 'instructions') {
    process.stdout.write(await instructions(argumentsList.slice(1)))
    return 0
  }
  if (argumentsList[0] === 'init') return initialize(argumentsList.slice(1))
  if (argumentsList[0] === 'plugin-docs') {
    const options = parsePluginDocsArguments(argumentsList)
    const result = await readPluginDocumentation(options.selection, options.root, options.configPath)
    process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : displayPluginDocumentation(result))
    return 0
  }
  const options = parseArguments(argumentsList)
  const context = options.command === 'run' ? runContext(options) : validationContext(options)
  const projectRoot = isAbsolute(options.root) ? options.root : resolve(options.root)
  const phases: { validationMs?: number; resolutionMs?: number; executionMs?: number } = {}
  const operationTimings = options.timings ? new OperationTimings(totalStarted) : undefined
  const reportedTimings = (): PhaseTimings | undefined => operationTimings === undefined
    ? undefined
    : { ...phases, ...operationTimings.snapshot(), totalMs: elapsed(totalStarted) }
  const loaded = await loadConfig(projectRoot, options.configPath)
  if (loaded.config === undefined) {
    printViolations(loaded.violations, options.json, context, reportedTimings())
    return 1
  }

  const validationStarted = performance.now()
  const validation = await validateFocusedSpecs(projectRoot, loaded.config, {
    ...(options.scopeName === undefined ? {} : { scopeName: options.scopeName }),
    strict: options.command === 'run' || options.strict,
    ...(options.scenarioId === undefined ? {} : { scenarioId: options.scenarioId }),
  }, operationTimings)
  phases.validationMs = elapsed(validationStarted)
  if (validation.violations.length > 0) {
    printViolations(validation.violations, options.json, context, reportedTimings())
    return 1
  }

  if (options.syntaxOnly) {
    const timings = reportedTimings()
    if (options.json) process.stdout.write(`${JSON.stringify({ valid: true, mode: 'syntax-only', ...context, ...(timings === undefined ? {} : { timings }) }, null, 2)}\n`)
    else process.stdout.write(`${displayValidationContext(context)}focused specifications are structurally valid\n${timings === undefined ? '' : displayTimings(timings)}`)
    return 0
  }

  const resolutionStarted = performance.now()
  const resolution = await planEvidence(projectRoot, loaded.config, validation.resolutionDocuments, {}, operationTimings)
  phases.resolutionMs = elapsed(resolutionStarted)
  if (resolution.violations.length > 0) {
    printViolations(resolution.violations, options.json, context, reportedTimings())
    return 1
  }
  if (resolution.plan === undefined) throw new Error('evidence validation did not produce a resolution plan')

  if (options.command === 'validate') {
    const counts = validationCounts(validation.resolutionDocuments, resolution.plan)
    const timings = reportedTimings()
    if (options.json) process.stdout.write(`${JSON.stringify({ valid: true, ...counts, ...context, ...(timings === undefined ? {} : { timings }) }, null, 2)}\n`)
    else process.stdout.write(`${displayValidationContext(context)}focused specifications are valid: ${counts.scenarios} enrolled items, ${counts.plannedEvidence} planned evidence, ${counts.targets} unique targets\n${timings === undefined ? '' : displayTimings(timings)}`)
    return 0
  }

  const planned = projectExecutionPlan(resolution.plan, validation.targetDocuments, {
    ...(options.scenarioId === undefined ? {} : { scenarioId: options.scenarioId }),
  })
  if (planned.violations.length > 0 || planned.plan === undefined) {
    printViolations(planned.violations, options.json, context, reportedTimings())
    return 1
  }
  const executionStarted = performance.now()
  const result = await executePlan(planned.plan, {
    allowSkip: options.allowSkip,
    maxConcurrentGroups: loaded.config.execution?.maxConcurrentGroups ?? 1,
  }, operationTimings)
  phases.executionMs = elapsed(executionStarted)
  printExecution(result, options.json, context as RunContext, reportedTimings())
  return result.success ? 0 : 1
}

const argumentsList = process.argv.slice(2)
try {
  process.exitCode = await main(argumentsList)
} catch (error) {
  printCliError(error, jsonRequested(argumentsList))
  process.exitCode = 1
}
