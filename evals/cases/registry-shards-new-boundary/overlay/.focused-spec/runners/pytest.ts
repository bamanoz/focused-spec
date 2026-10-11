import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import type { RunnerPlugin } from 'focused-spec/runner'

const execute = promisify(execFile)
const reporter = fileURLToPath(new URL('./pytest-report.py', import.meta.url))

async function report(mode: string, selector: string, cwd: string, signal: AbortSignal) {
  const { stdout, stderr } = await execute('uv', ['run', '--with', 'pytest', 'python', reporter, mode, selector], { cwd, signal, timeout: 120_000, maxBuffer: 1024 * 1024 })
  const line = stdout.split('\n').findLast(line => line.startsWith('FOCUSED_REPORT='))
  if (line === undefined) throw new Error('pytest result report missing')
  const result = JSON.parse(line.slice('FOCUSED_REPORT='.length)) as { code: number; collected: string[]; reports: { id: string; when: string; outcome: string }[] }
  return { ...result, diagnostic: `${stdout}\n${stderr}`.slice(-16_000) }
}

export default {
  apiVersion: 1,
  async resolve(request) {
    const targets = []
    const errors = []
    for (const selector of request.selectors) {
      const result = await report('collect', selector, request.cwd, request.signal)
      if (result.code === 0 && result.collected.length === 1 && result.collected[0] === selector) targets.push({ selector, targetId: selector, displayName: selector })
      else errors.push({ selector, message: 'Expected exactly one collected pytest node: ' + result.diagnostic })
    }
    return { targets, errors }
  },
  async run(request) {
    const results = []
    for (const target of request.targets) {
      const result = await report('run', target.selector, request.cwd, request.signal)
      const selected = result.reports.filter(item => item.id === target.selector)
      const status = selected.some(item => item.outcome === 'skipped') ? 'skip' as const
        : result.code === 0 && result.collected.length === 1 && result.collected[0] === target.selector && selected.some(item => item.when === 'call' && item.outcome === 'passed') && selected.every(item => item.outcome === 'passed') ? 'pass' as const : 'fail' as const
      results.push({ targetId: target.targetId, status, diagnostic: result.diagnostic })
    }
    return { results }
  },
} satisfies RunnerPlugin
