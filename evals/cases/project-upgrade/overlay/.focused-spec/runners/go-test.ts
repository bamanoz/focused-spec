import type { RunnerPlugin, TargetResult } from 'focused-spec/runner'
import { runCommand } from './process.ts'

interface GoTarget {
  readonly packagePath: string
  readonly testName: string
}

function parseSelector(selector: string): GoTarget | undefined {
  const separator = selector.lastIndexOf('::')
  if (separator <= 0 || separator === selector.length - 2) return undefined
  const packagePath = selector.slice(0, separator)
  const testName = selector.slice(separator + 2)
  if (!/^Test[A-Za-z0-9_]+$/u.test(testName)) return undefined
  return { packagePath, testName }
}

function exactPattern(value: string): string {
  return `^${value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`
}

export default {
  apiVersion: 1,

  async resolve(request) {
    const targets = []
    const errors = []
    for (const selector of request.selectors) {
      const parsed = parseSelector(selector)
      if (parsed === undefined) {
        errors.push({ selector, message: 'expected <go-package>::<TestName>' })
        continue
      }
      const result = await runCommand('go', ['test', parsed.packagePath, '-list', exactPattern(parsed.testName)], request.cwd, request.signal)
      const collected = result.output.split(/\r?\n/u).some(line => line.trim() === parsed.testName)
      if (result.code !== 0 || !collected) {
        errors.push({ selector, message: result.output.trim() || `Go test ${parsed.testName} was not collected` })
        continue
      }
      targets.push({ selector, targetId: selector, displayName: parsed.testName })
    }
    return { targets, errors }
  },

  async run(request) {
    const results: TargetResult[] = []
    for (const target of request.targets) {
      const parsed = parseSelector(target.selector)
      if (parsed === undefined) {
        results.push({ targetId: target.targetId, status: 'fail', diagnostic: 'invalid resolved Go selector' })
        continue
      }
      const result = await runCommand('go', ['test', parsed.packagePath, '-run', exactPattern(parsed.testName), '-count=1'], request.cwd, request.signal)
      results.push({
        targetId: target.targetId,
        status: result.code === 0 ? 'pass' : 'fail',
        ...(result.code === 0 ? {} : { diagnostic: result.output.trim() }),
      })
    }
    return { results }
  },
} satisfies RunnerPlugin
