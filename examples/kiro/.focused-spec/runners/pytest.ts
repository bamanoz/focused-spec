import type { RunnerPlugin, TargetResult } from 'focused-spec/runner'
import { runCommand } from './process.ts'

function commandOptions(value: unknown): { command: string; args: string[] } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { command: 'python', args: [] }
  const options = value as Record<string, unknown>
  const command = typeof options.command === 'string' && options.command.length > 0 ? options.command : 'python'
  const args = Array.isArray(options.commandArgs) && options.commandArgs.every(item => typeof item === 'string')
    ? options.commandArgs as string[]
    : []
  return { command, args }
}

export default {
  apiVersion: 1,

  async resolve(request) {
    const targets = []
    const errors = []
    const command = commandOptions(request.options)
    for (const selector of request.selectors) {
      const result = await runCommand(command.command, [...command.args, '-m', 'pytest', '--collect-only', '-q', selector], request.cwd, request.signal)
      const collected = result.output.split(/\r?\n/u).some(line => line.trim() === selector)
      if (result.code !== 0 || !collected) {
        errors.push({ selector, message: result.output.trim() || 'pytest did not collect the selected test' })
        continue
      }
      targets.push({ selector, targetId: selector, displayName: selector })
    }
    return { targets, errors }
  },

  async run(request) {
    const results: TargetResult[] = []
    const command = commandOptions(request.options)
    for (const target of request.targets) {
      const result = await runCommand(command.command, [...command.args, '-m', 'pytest', '-q', target.selector], request.cwd, request.signal)
      results.push({
        targetId: target.targetId,
        status: result.code === 0 ? 'pass' : 'fail',
        ...(result.code === 0 ? {} : { diagnostic: result.output.trim() }),
      })
    }
    return { results }
  },
} satisfies RunnerPlugin
