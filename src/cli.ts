#!/usr/bin/env node
import process from 'node:process'
import { isAbsolute, resolve } from 'node:path'
import { loadConfig } from './config.js'
import { executePlan } from './executor.js'
import type { ExecutionPlan, ExecutionResult, SpecDocument, Violation } from './model.js'
import { parseEvidenceReference } from './parser.js'
import { planEvidence } from './planner.js'
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
}

const USAGE = `Usage:
  focused-spec validate [--root <path>] [--config <path>] [--scope <name>] [--strict] [--syntax-only] [--json]
  focused-spec run [--root <path>] [--config <path>] [--scope <name>] [--scenario <id>] [--allow-skip] [--json]
`

function parseArguments(argumentsList: readonly string[]): CliOptions {
  const command = argumentsList[0]
  if (command !== 'validate' && command !== 'run') throw new Error(USAGE)
  let root = process.cwd()
  let configPath: string | undefined
  let scopeName: string | undefined
  let strict = false
  let syntaxOnly = false
  let json = false
  let allowSkip = false
  let scenarioId: string | undefined

  for (let index = 1; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === '--strict') strict = true
    else if (argument === '--syntax-only') syntaxOnly = true
    else if (argument === '--json') json = true
    else if (argument === '--allow-skip') allowSkip = true
    else if (argument === '--root' || argument === '--config' || argument === '--scope' || argument === '--scenario') {
      const value = argumentsList[index + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${argument}\n${USAGE}`)
      index += 1
      if (argument === '--root') root = resolve(value)
      else if (argument === '--config') configPath = value
      else if (argument === '--scope') scopeName = value
      else scenarioId = value
    } else {
      throw new Error(`unknown argument ${String(argument)}\n${USAGE}`)
    }
  }

  if (command === 'validate' && (allowSkip || scenarioId !== undefined)) {
    throw new Error(`--allow-skip and --scenario are valid only for run\n${USAGE}`)
  }
  if (command === 'run' && (strict || syntaxOnly)) throw new Error(`run is always strict and cannot be syntax-only\n${USAGE}`)
  return {
    command,
    root,
    ...(configPath === undefined ? {} : { configPath }),
    ...(scopeName === undefined ? {} : { scopeName }),
    strict,
    syntaxOnly,
    json,
    allowSkip,
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

function printViolations(violations: readonly Violation[], json: boolean, context: ValidationContext | RunContext): void {
  if (json) {
    const output = 'executionSelection' in context
      ? { valid: false, executionStarted: false, ...context, violations }
      : { valid: false, ...context, violations }
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
    return
  }
  if ('executionSelection' in context) process.stderr.write(`${displayRunContext(context)}execution did not start\n`)
  else process.stderr.write(displayValidationContext(context))
  for (const violation of violations) process.stderr.write(`${displayViolation(violation)}\n`)
}

function printExecution(result: ExecutionResult, json: boolean, context: RunContext): void {
  if (json) {
    process.stdout.write(`${JSON.stringify({ ...result, executionStarted: result.targetCount > 0, ...context }, null, 2)}\n`)
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
  const options = parseArguments(argumentsList)
  const context = options.command === 'run' ? runContext(options) : validationContext(options)
  const projectRoot = isAbsolute(options.root) ? options.root : resolve(options.root)
  const loaded = await loadConfig(projectRoot, options.configPath)
  if (loaded.config === undefined) {
    printViolations(loaded.violations, options.json, context)
    return 1
  }

  const validation = await validateFocusedSpecs(projectRoot, loaded.config, {
    ...(options.scopeName === undefined ? {} : { scopeName: options.scopeName }),
    strict: options.command === 'run' || options.strict,
  })
  if (validation.violations.length > 0) {
    printViolations(validation.violations, options.json, context)
    return 1
  }

  if (options.syntaxOnly) {
    if (options.json) process.stdout.write(`${JSON.stringify({ valid: true, mode: 'syntax-only', ...context }, null, 2)}\n`)
    else process.stdout.write(`${displayValidationContext(context)}focused specifications are structurally valid\n`)
    return 0
  }

  const resolution = await planEvidence(projectRoot, loaded.config, validation.resolutionDocuments)
  if (resolution.violations.length > 0) {
    printViolations(resolution.violations, options.json, context)
    return 1
  }

  if (options.command === 'validate') {
    if (resolution.plan === undefined) throw new Error('evidence validation did not produce a resolution plan')
    const counts = validationCounts(validation.resolutionDocuments, resolution.plan)
    if (options.json) process.stdout.write(`${JSON.stringify({ valid: true, ...counts, ...context }, null, 2)}\n`)
    else process.stdout.write(`${displayValidationContext(context)}focused specifications are valid: ${counts.scenarios} scenarios, ${counts.plannedEvidence} planned evidence, ${counts.targets} unique targets\n`)
    return 0
  }

  const planned = await planEvidence(projectRoot, loaded.config, validation.targetDocuments, {
    ...(options.scenarioId === undefined ? {} : { scenarioId: options.scenarioId }),
  })
  if (planned.violations.length > 0 || planned.plan === undefined) {
    printViolations(planned.violations, options.json, context)
    return 1
  }
  const result = await executePlan(planned.plan, { allowSkip: options.allowSkip })
  printExecution(result, options.json, context as RunContext)
  return result.success ? 0 : 1
}

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
