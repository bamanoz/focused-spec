import { dirname } from 'node:path'
import type { ResolvedTarget, RunnerPlugin, TargetResult } from 'focused-spec/runner'
import { runProcess, type ProcessResult } from './process.js'

const DIAGNOSTIC_LIMIT = 8_000

interface CommandOptions {
  readonly command: string
  readonly commandArgs: readonly string[]
}
interface GoTarget {
  readonly packagePath: string
  readonly testName: string
}
interface GoEvent {
  readonly Action?: string
  readonly Package?: string
  readonly Test?: string
  readonly Output?: string
}

function commandOptions(value: unknown): CommandOptions {
  if (value === null) return { command: 'go', commandArgs: [] }
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Go runner options must be an object or null')
  const options = value as Record<string, unknown>
  if (Object.keys(options).some(key => key !== 'command' && key !== 'commandArgs')) throw new Error('Go runner options contain unsupported fields')
  const command = options.command === undefined ? 'go' : options.command
  const commandArgs = options.commandArgs === undefined ? [] : options.commandArgs
  if (typeof command !== 'string' || command.length === 0 || command.includes('\0')) {
    throw new Error('Go runner option command must be a nonempty string')
  }
  if (!Array.isArray(commandArgs) || !commandArgs.every(item => typeof item === 'string' && !item.includes('\0'))) {
    throw new Error('Go runner option commandArgs must be an array of strings')
  }
  return { command, commandArgs }
}

function parseSelector(selector: string): GoTarget | undefined {
  const separator = selector.lastIndexOf('::')
  if (separator <= 0 || separator === selector.length - 2) return undefined
  const authoredPath = selector.slice(0, separator)
  const packagePath = authoredPath.endsWith('.go') ? `./${dirname(authoredPath)}` : authoredPath
  const testName = selector.slice(separator + 2)
  if (packagePath.startsWith('-') || packagePath.includes('\0') || !/^Test[A-Za-z0-9_]+$/u.test(testName)) return undefined
  return { packagePath, testName }
}

function exactPattern(value: string): string {
  return `^${value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`
}

function processDiagnostic(process: ProcessResult): string {
  return (process.stderr || process.stdout).trim().slice(-DIAGNOSTIC_LIMIT)
}

function parseEvents(output: string): readonly GoEvent[] {
  const events: GoEvent[] = []
  for (const line of output.split(/\r?\n/u)) {
    if (line.trim() === '') continue
    let event: unknown
    try {
      event = JSON.parse(line)
    } catch {
      throw new Error('go test produced malformed JSON output')
    }
    if (typeof event !== 'object' || event === null || Array.isArray(event)) throw new Error('go test produced malformed JSON output')
    events.push(event as GoEvent)
  }
  return events
}

function eventDiagnostic(events: readonly GoEvent[], process: ProcessResult): string {
  const output = events.map(event => event.Output ?? '').join('').trim()
  return (output || processDiagnostic(process)).slice(-DIAGNOSTIC_LIMIT)
}

export default {
  apiVersion: 1,
  async resolve(request) {
    const options = commandOptions(request.options)
    const targetBySelector = new Map<string, ResolvedTarget>()
    const errorBySelector = new Map<string, { selector: string; message: string }>()
    const grouped = new Map<string, { readonly selector: string; readonly testName: string }[]>()
    for (const selector of request.selectors) {
      const selected = parseSelector(selector)
      if (selected === undefined) {
        errorBySelector.set(selector, { selector, message: 'expected <go-package>::<top-level TestName>' })
        continue
      }
      const entries = grouped.get(selected.packagePath)
      if (entries === undefined) grouped.set(selected.packagePath, [{ selector, testName: selected.testName }])
      else entries.push({ selector, testName: selected.testName })
    }
    for (const [packagePath, entries] of grouped) {
      const names = [...new Set(entries.map(entry => entry.testName))]
      const pattern = `^(${names.map(exactPattern).map(value => value.slice(1, -1)).join('|')})$`
      const discovery = await runProcess(
        options.command,
        [...options.commandArgs, 'test', '-list', pattern, packagePath],
        request.cwd,
        request.signal,
      )
      const matches = new Map<string, number>()
      for (const line of discovery.stdout.split(/\r?\n/u)) {
        const name = line.trim()
        if (name !== '') matches.set(name, (matches.get(name) ?? 0) + 1)
      }
      for (const entry of entries) {
        const count = matches.get(entry.testName) ?? 0
        if (discovery.code !== 0) {
          errorBySelector.set(entry.selector, { selector: entry.selector, message: processDiagnostic(discovery) || `go test could not collect ${entry.selector}` })
        } else if (count !== 1) {
          errorBySelector.set(entry.selector, {
            selector: entry.selector,
            message: count === 0
              ? `Go test not found: ${entry.selector}`
              : `Go test is ambiguous (${count} matches): ${entry.selector}`,
          })
        } else {
          targetBySelector.set(entry.selector, { selector: entry.selector, targetId: entry.selector, displayName: entry.testName, data: { packagePath, testName: entry.testName } })
        }
      }
    }
    return {
      targets: request.selectors.flatMap(selector => { const target = targetBySelector.get(selector); return target === undefined ? [] : [target] }),
      errors: request.selectors.flatMap(selector => { const error = errorBySelector.get(selector); return error === undefined ? [] : [error] }),
    }
  },

  async run(request) {
    const options = commandOptions(request.options)
    const packages = new Map<string, Map<string, ResolvedTarget>>()
    for (const target of request.targets) {
      const selected = parseSelector(target.selector)
      if (selected === undefined) throw new Error(`Invalid Go target ${target.selector}`)
      let tests = packages.get(selected.packagePath)
      if (tests === undefined) {
        tests = new Map()
        packages.set(selected.packagePath, tests)
      }
      if (tests.has(selected.testName)) throw new Error(`Duplicate Go target ${target.selector}`)
      tests.set(selected.testName, target)
    }

    const resultByTarget = new Map<string, TargetResult>()
    for (const [packagePath, tests] of packages) {
      const pattern = [...tests.keys()].map(exactPattern).join('|')
      const processResult = await runProcess(
        options.command,
        [...options.commandArgs, 'test', '-json', '-count=1', '-run', pattern, packagePath],
        request.cwd,
        request.signal,
      )
      const events = parseEvents(processResult.stdout)
      const packageDiagnostic = eventDiagnostic(events.filter(event => event.Test === undefined), processResult)
      let selectedFailure = false
      for (const [testName, target] of tests) {
        const testEvents = events.filter(event => event.Test === testName || event.Test?.startsWith(`${testName}/`) === true)
        const names = new Set(testEvents.map(event => event.Test).filter((name): name is string => name !== undefined))
        const direct = testEvents.filter(event => event.Test === testName)
        const directRun = direct.filter(event => event.Action === 'run')
        const directTerminal = direct.filter(event => event.Action === 'pass' || event.Action === 'fail' || event.Action === 'skip')
        const malformed = directRun.length !== 1 || directTerminal.length !== 1 || [...names].some(name => {
          const named = testEvents.filter(event => event.Test === name)
          return named.filter(event => event.Action === 'run').length !== 1
            || named.filter(event => event.Action === 'pass' || event.Action === 'fail' || event.Action === 'skip').length !== 1
        })
        const diagnostic = eventDiagnostic(testEvents, processResult)
        let result: TargetResult
        if (malformed) {
          const detail = diagnostic === '' ? '' : `\n${diagnostic}`
          result = { targetId: target.targetId, status: 'fail', diagnostic: `go test did not report one run and terminal event for ${testName}${detail}` }
        } else {
          const terminals = testEvents.filter(event => event.Action === 'pass' || event.Action === 'fail' || event.Action === 'skip')
          if (terminals.some(event => event.Action === 'fail')) {
            result = { targetId: target.targetId, status: 'fail', ...(diagnostic === '' ? {} : { diagnostic }) }
          } else if (terminals.some(event => event.Action === 'skip')) {
            result = { targetId: target.targetId, status: 'skip', ...(diagnostic === '' ? {} : { diagnostic }) }
          } else {
            result = { targetId: target.targetId, status: 'pass' }
          }
        }
        if (result.status === 'fail') selectedFailure = true
        resultByTarget.set(target.targetId, result)
      }
      if (processResult.code !== 0 && !selectedFailure) {
        for (const target of tests.values()) {
          const result = resultByTarget.get(target.targetId)
          if (result?.status === 'pass') {
            resultByTarget.set(target.targetId, {
              targetId: target.targetId,
              status: 'fail',
              diagnostic: packageDiagnostic || `go test exited ${processResult.code}`,
            })
          }
        }
      }
    }
    return {
      results: request.targets.map(target => {
        const result = resultByTarget.get(target.targetId)
        if (result === undefined) throw new Error(`Go runner lost target ${target.targetId}`)
        return result
      }),
    }
  },
} satisfies RunnerPlugin
