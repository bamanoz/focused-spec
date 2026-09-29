import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EvalGate } from './types.ts'
import { runProcess } from './process.ts'

const selector = 'tests/functional/test_auth.py::test_blocked_account'
const scenarioId = 'auth.login.blocked-account'

export async function judgeEvidenceRepair(workspace: string, transcripts: readonly string[]): Promise<EvalGate[]> {
  const behavior = await runProcess('uv', ['run', 'python', '-c', [
    'from app.auth import authenticate',
    'for blocked, valid, expected in [(False, True, True), (True, True, False), (False, False, False), (True, False, False)]:',
    '    assert authenticate(blocked=blocked, credentials_valid=valid) is expected, (blocked, valid, expected)',
  ].join('\n')], { cwd: workspace, timeoutMs: 120_000 })
  const gates: EvalGate[] = [{ name: 'authentication-contract', passed: behavior.code === 0, detail: behavior.code === 0 ? 'all four authentication outcomes correct' : behavior.stderr.trim() || behavior.stdout.trim() }]
  const productPath = join(workspace, 'app/auth.py')
  const source = await readFile(productPath, 'utf8')
  let focusedFailure = false
  let testFailure = false
  let restoredPass = false
  try {
    await writeFile(productPath, 'def authenticate(blocked: bool, credentials_valid: bool) -> bool:\n    return credentials_valid\n')
    const test = await runProcess('uv', ['run', '--with', 'pytest', 'python', '-m', 'pytest', '-q', selector], { cwd: workspace, timeoutMs: 120_000 })
    testFailure = test.code === 1 && test.stdout.includes('AssertionError') && test.stdout.includes('FAILED ' + selector)
    const focused = await runProcess(process.execPath, [join(workspace, 'node_modules/focused-spec/dist/cli.js'), 'run', '--scenario', scenarioId, '--json'], { cwd: workspace, timeoutMs: 240_000 })
    const result = JSON.parse(focused.stdout) as { executionStarted?: boolean; scenarios?: { id: string; status: string; evidence: { reference: string; status: string }[] }[] }
    focusedFailure = focused.code === 1 && result.executionStarted === true && result.scenarios?.some(item => item.id === scenarioId && item.status === 'FAIL' && item.evidence.some(evidence => evidence.reference === 'pytest-functional::' + selector && evidence.status === 'FAIL')) === true
  } catch (error) {
    gates.push({ name: 'evidence-repair-probe', passed: false, detail: String(error) })
  } finally {
    await writeFile(productPath, source)
  }
  const restored = await runProcess(process.execPath, [join(workspace, 'node_modules/focused-spec/dist/cli.js'), 'run', '--scenario', scenarioId, '--json'], { cwd: workspace, timeoutMs: 240_000 })
  try {
    const result = JSON.parse(restored.stdout) as { executionStarted?: boolean; scenarios?: { id: string; status: string }[] }
    restoredPass = restored.code === 0 && result.executionStarted === true && result.scenarios?.some(item => item.id === scenarioId && item.status === 'PASS') === true
  } catch {
    restoredPass = false
  }
  gates.push({ name: 'repaired-evidence-sensitivity', passed: testFailure && focusedFailure && restoredPass, detail: `selected pytest assertion fails=${testFailure}; focused FAIL=${focusedFailure}; restored PASS=${restoredPass}` })

  let phase = 0
  for (const transcript of transcripts) {
    for (const line of transcript.split('\n')) {
      let event: { type?: string; message?: { role?: string; toolName?: string; content?: { type: string; text?: string }[]; isError?: boolean } }
      try { event = JSON.parse(line) as typeof event } catch { continue }
      if (event.type !== 'message_end' || event.message?.role !== 'toolResult' || event.message.toolName !== 'bash') continue
      const text = event.message.content?.filter(item => item.type === 'text').map(item => item.text ?? '').join('\n') ?? ''
      const passed = !event.message.isError && /PASS (?:\[current\] )?auth\.login\.blocked-account/.test(text)
      const failed = /FAIL (?:\[current\] )?auth\.login\.blocked-account/.test(text) && text.includes('test_blocked_account') && text.includes('AssertionError')
      if (phase === 0 && passed) phase = 1
      else if (phase === 1 && failed) phase = 2
      else if (phase === 2 && passed) phase = 3
    }
  }
  gates.push({ name: 'agent-sensitivity-probe', passed: phase === 3, detail: phase === 3 ? 'agent trace contains focused PASS, selected assertion FAIL, restored PASS' : `agent did not complete PASS/behavioral FAIL/PASS (phase=${phase})` })
  return gates
}
