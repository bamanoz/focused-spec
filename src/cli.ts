#!/usr/bin/env node
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { isAbsolute, resolve } from 'node:path'
import { loadConfig } from './config.js'
import { executePlan } from './executor.js'
import type { ExecutionPlan, ExecutionResult, SpecDocument, Violation } from './model.js'
import { parseEvidenceReference } from './parser.js'
import { planEvidence, projectExecutionPlan } from './planner.js'
import { validateFocusedSpecs } from './validate.js'

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

const ROOT_HELP = `focused-spec — Validate and run focused behavioral specifications against real evidence.

Usage:
  focused-spec <command> [options]
  focused-spec help [command]

Commands:
  validate  Check scenario structure and resolve evidence without running tests
  run       Strictly validate, then execute selected evidence

Options:
  -h, --help  Show this help

Examples:
  focused-spec validate --scope add-search
  focused-spec run --scope add-search
  focused-spec validate --help

Run 'focused-spec <command> --help' for command options.
`

const VALIDATE_HELP = `Validate scenario structure and resolve concrete evidence without running tests.

Usage:
  focused-spec validate [options]

Options:
  --root <path>    Project root (default: current directory)
  --config <path>  Configuration file relative to the project root (default: .focused-spec/config.yaml)
  --scope <name>   Validate baseline and this named scope (default: baseline and all named scopes)
  --strict         Reject all planned: evidence; use once exact tests exist
  --syntax-only    Check document syntax and ownership without loading runners or resolving evidence
  --json           Print the validation result as JSON
  --timings        Include elapsed validation and resolution phase timings
  -h, --help       Show this help

Without --strict, planned: evidence is allowed only in named scopes and is not resolved.
Full validation resolves concrete evidence but never executes tests.

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
  --scope <name>    Validate baseline and this named scope, then execute that scope
                    (default: validate baseline and all named scopes, then execute baseline)
  --scenario <id>   Narrow execution to one scenario; validation remains unchanged
  --allow-skip      Allow an overall successful exit with SKIP; never relabel SKIP as PASS
  --json            Print the execution result as JSON
  --timings         Include elapsed validation, resolution and execution phase timings
  -h, --help        Show this help

Run always validates strictly before starting tests; planned: evidence blocks execution.

Examples:
  focused-spec run
  focused-spec run --scope add-search --scenario search.results.empty
`

function argumentError(message: string, command?: CliOptions['command']): Error {
  return new Error(`${message}\nRun 'focused-spec ${command === undefined ? '--help' : `${command} --help`}' for usage.`)
}

function requestedHelp(argumentsList: readonly string[]): string | undefined {
  const command = argumentsList[0]
  if (command === '--help' || command === '-h' || command === 'help') {
    if (argumentsList.length === 1) return ROOT_HELP
    if (command === 'help' && argumentsList.length === 2) {
      if (argumentsList[1] === 'validate') return VALIDATE_HELP
      if (argumentsList[1] === 'run') return RUN_HELP
      throw argumentError(`unknown help command ${String(argumentsList[1])}`)
    }
    throw argumentError('unexpected arguments for help')
  }
  if (command === 'validate' || command === 'run') {
    if (argumentsList.includes('--help') || argumentsList.includes('-h')) {
      return command === 'validate' ? VALIDATE_HELP : RUN_HELP
    }
  }
  return undefined
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

  for (let index = 1; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === '--strict') strict = true
    else if (argument === '--syntax-only') syntaxOnly = true
    else if (argument === '--json') json = true
    else if (argument === '--timings') timings = true
    else if (argument === '--allow-skip') allowSkip = true
    else if (argument === '--root' || argument === '--config' || argument === '--scope' || argument === '--scenario') {
      const value = argumentsList[index + 1]
      if (value === undefined || value.startsWith('--')) throw argumentError(`missing value for ${argument}`, command)
      index += 1
      if (argument === '--root') root = resolve(value)
      else if (argument === '--config') configPath = value
      else if (argument === '--scope') scopeName = value
      else scenarioId = value
    } else {
      throw argumentError(`unknown argument ${String(argument)}`, command)
    }
  }

  if (command === 'validate' && (allowSkip || scenarioId !== undefined)) {
    throw argumentError('--allow-skip and --scenario are valid only for run', command)
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
interface ValidationScope {
  readonly baseline: true
  readonly scopes: { readonly mode: 'all' } | { readonly mode: 'selected'; readonly name: string }
}

interface ExecutionSelection {
  readonly source: 'baseline' | 'scope'
  readonly scope?: string
  readonly scenario?: string
}
interface ValidationContext {
  readonly validationScope: ValidationScope
}

interface RunContext {
  readonly validationScope: ValidationScope
  readonly executionSelection: ExecutionSelection
}

interface PhaseTimings {
  readonly validationMs?: number
  readonly resolutionMs?: number
  readonly executionMs?: number
  readonly totalMs: number
}

function validationContext(options: CliOptions): ValidationContext {
  return {
    validationScope: {
      baseline: true,
      scopes: options.scopeName === undefined
        ? { mode: 'all' }
        : { mode: 'selected', name: options.scopeName },
    },
  }
}

function runContext(options: CliOptions): RunContext {
  return {
    ...validationContext(options),
    executionSelection: {
      source: options.scopeName === undefined ? 'baseline' : 'scope',
      ...(options.scopeName === undefined ? {} : { scope: options.scopeName }),
      ...(options.scenarioId === undefined ? {} : { scenario: options.scenarioId }),
    },
  }
}

function displayValidationContext(context: ValidationContext): string {
  const scopes = context.validationScope.scopes
  const validation = scopes.mode === 'all'
    ? 'baseline specifications and all named scopes'
    : `baseline specifications and selected scope ${scopes.name}`
  return `validation scope: ${validation}\n`
}

function displayRunContext(context: RunContext): string {
  const selection = context.executionSelection
  const execution = selection.source === 'baseline'
    ? 'baseline specifications'
    : `scope ${String(selection.scope)}`
  const scenario = selection.scenario === undefined ? '' : `, scenario ${selection.scenario}`
  return `${displayValidationContext(context)}execution selection: ${execution}${scenario}\n`
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
  return `timings: ${phases.join(', ')}\n`
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
    process.stdout.write(`${scenario.status} ${scenario.id}\n`)
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
  const options = parseArguments(argumentsList)
  const context = options.command === 'run' ? runContext(options) : validationContext(options)
  const projectRoot = isAbsolute(options.root) ? options.root : resolve(options.root)
  const phases: { validationMs?: number; resolutionMs?: number; executionMs?: number } = {}
  const reportedTimings = (): PhaseTimings | undefined => options.timings
    ? { ...phases, totalMs: elapsed(totalStarted) }
    : undefined
  const loaded = await loadConfig(projectRoot, options.configPath)
  if (loaded.config === undefined) {
    printViolations(loaded.violations, options.json, context, reportedTimings())
    return 1
  }

  const validationStarted = performance.now()
  const validation = await validateFocusedSpecs(projectRoot, loaded.config, {
    ...(options.scopeName === undefined ? {} : { scopeName: options.scopeName }),
    strict: options.command === 'run' || options.strict,
  })
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
  const resolution = await planEvidence(projectRoot, loaded.config, validation.resolutionDocuments)
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
    else process.stdout.write(`${displayValidationContext(context)}focused specifications are valid: ${counts.scenarios} scenarios, ${counts.plannedEvidence} planned evidence, ${counts.targets} unique targets\n${timings === undefined ? '' : displayTimings(timings)}`)
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
  })
  phases.executionMs = elapsed(executionStarted)
  printExecution(result, options.json, context as RunContext, reportedTimings())
  return result.success ? 0 : 1
}

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
