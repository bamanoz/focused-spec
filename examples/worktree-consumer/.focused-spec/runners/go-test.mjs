import { spawn } from 'node:child_process'

const selector = './eligibility::TestAdultEligible'
const testName = 'TestAdultEligible'
const packagePath = './eligibility'

async function go(args, { cwd, signal }) {
  const child = spawn('go', args, { cwd, signal, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => {
    stdout += chunk
    if (stdout.length > 100_000) child.kill()
  })
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000) })
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', resolve)
  })
  if (stdout.length > 100_000) throw new Error('Go report exceeded limit')
  return { code, stdout, stderr }
}

export default {
  apiVersion: 1,
  async resolve(request) {
    const { code, stdout, stderr } = await go(['test', packagePath, '-list', `^${testName}$`], request)
    if (code !== 0) throw new Error(`Go collection failed: ${stderr}`)
    const found = stdout.split(/\r?\n/u).filter(line => line === testName).length === 1
    return {
      targets: request.selectors.filter(value => value === selector && found).map(value => ({ selector: value, targetId: value, displayName: testName })),
      errors: request.selectors.filter(value => value !== selector || !found).map(value => ({ selector: value, message: `Go test not found: ${value}` })),
    }
  },
  async run(request) {
    const { code, stdout, stderr } = await go(['test', '-json', packagePath, '-run', `^${testName}$`, '-count=1'], request)
    const events = stdout.trim().split(/\r?\n/u).map(line => JSON.parse(line))
      .filter(event => event.Test === testName)
    const ran = events.some(event => event.Action === 'run')
    const terminal = events.filter(event => ['pass', 'fail', 'skip'].includes(event.Action))
    const action = terminal.length === 1 ? terminal[0].Action : undefined
    const status = !ran || !action || (action === 'pass' && code !== 0) ? 'fail'
      : action === 'pass' ? 'pass' : action === 'skip' ? 'skip' : 'fail'
    return { results: request.targets.map(target => ({ targetId: target.targetId, status, ...(status === 'pass' ? {} : { diagnostic: stderr || `Go test reported ${String(action)}` }) })) }
  },
}
