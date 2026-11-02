import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { EvalGate } from './types.ts'
import { runProcess } from './process.ts'
import type { ProcessResult } from './process.ts'

const editorialBefore = '# Account status\n\nThe account is active\n'
const editorialAfter = '# Account status\n\nThe account is active.\n'
const requirementBefore = '# Authentication\n\nAn account with valid credentials SHALL authenticate.\n'
const requirementAfter = '# Authentication\n\nA blocked account SHALL be rejected even with valid credentials.\n'
const application = 'export const authenticate = ({ blocked, credentialsValid }) => credentialsValid && !blocked;\n'
const regression = 'export const authenticate = ({ credentialsValid }) => credentialsValid;\n'
const active = { id: 'auth.active', name: 'Active valid credentials authenticate', given: { blocked: false }, when: { credentialsValid: true }, expect: true }
const blocked = { id: 'auth.blocked', name: 'Blocked valid credentials are rejected', given: { blocked: true }, when: { credentialsValid: true }, expect: false }

async function put(workspace: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(workspace, path)), { recursive: true })
  await writeFile(join(workspace, path), content)
}

export async function prepareGuidanceFixture(workspace: string, trigger = true): Promise<void> {
  await put(workspace, 'guidance-task/editorial.md', editorialBefore)
  await put(workspace, 'guidance-task/requirement.md', requirementBefore)
  if (!trigger) return
  await put(workspace, 'guidance-task/application.mjs', application)
  for (const variant of ['sdk', 'driver']) {
    await put(workspace, `guidance-task/${variant}/scenarios.mjs`, `import { defineSuite } from '@focused-spec/scenarios-typescript';\nexport default defineSuite({ driver: './driver.mjs', scenarios: ${JSON.stringify(variant === 'sdk' ? [active] : [blocked], null, 2)} });\n`)
    await put(workspace, `guidance-task/${variant}/driver.mjs`, variant === 'sdk'
      ? "import { authenticate } from '../application.mjs';\nexport default { given: value => value, when: (subject, command) => authenticate({ ...subject, ...command }) };\n"
      : 'export default { given: value => value, when: () => false };\n')
    await put(workspace, `guidance-task/${variant}/suite.test.mjs`, "import { test } from 'node:test';\nimport { verifySpecification } from '@focused-spec/scenarios-typescript';\nimport suite from './scenarios.mjs';\nimport driver from './driver.mjs';\nfor (const scenario of suite.scenarios) test(scenario.id, () => verifySpecification(driver, scenario));\n")
  }
}

export const guidanceEditablePaths: readonly (readonly string[])[] = [
  ['guidance-task/editorial.md'], ['guidance-task/requirement.md'],
  ['guidance-task/sdk/scenarios.mjs'], ['guidance-task/driver/driver.mjs'],
]

export function guidanceBoundaryGate(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>, allowed: readonly string[] = []): EvalGate {
  const changes = [...new Set([...before.keys(), ...after.keys()])].filter(path => before.get(path) !== after.get(path) && !allowed.includes(path))
  return { name: 'guidance-task-boundary', passed: changes.length === 0, detail: changes.length === 0 ? 'no changes outside the current requested native deliverable' : `unauthorized changes: ${changes.join(', ')}` }
}

export async function guidanceOutcomeGate(workspace: string, turn: number): Promise<EvalGate> {
  const name = ['guidance-editorial-outcome', 'guidance-sdd-outcome', 'guidance-sdk-outcome', 'guidance-driver-outcome'][turn] ?? 'guidance-outcome'
  if (turn === 0 || turn === 1) {
    const path = turn === 0 ? 'guidance-task/editorial.md' : 'guidance-task/requirement.md'
    const actual = await readFile(join(workspace, path), 'utf8').catch(() => '')
    const passed = actual === (turn === 0 ? editorialAfter : requirementAfter)
    return { name, passed, detail: passed ? 'requested native edit completed, adjacent content preserved' : `requested exact edit missing or unrelated content changed in ${path}` }
  }
  const variant = turn === 2 ? 'sdk' : 'driver'
  const collected = await runProcess(process.execPath, ['--input-type=module', '-e', `import suite from './guidance-task/${variant}/scenarios.mjs'; process.stdout.write(JSON.stringify(suite.scenarios));`], { cwd: workspace, timeoutMs: 30_000 })
  let scenarios: unknown
  try { scenarios = JSON.parse(collected.stdout) } catch { scenarios = undefined }
  if (collected.code !== 0 || !isDeepStrictEqual(scenarios, variant === 'sdk' ? [active, blocked] : [blocked])) return { name, passed: false, detail: 'suite did not preserve independent Given/When/Expect values and opaque identities' }
  const args = ['--test', '--test-reporter=tap', `guidance-task/${variant}/suite.test.mjs`]
  const initial = await runProcess(process.execPath, args, { cwd: workspace, timeoutMs: 30_000 })
  if (initial.code !== 0 || !/\bok 1 - auth\./u.test(initial.stdout)) return { name, passed: false, detail: `ordinary SDK test did not execute and pass: ${initial.stderr || initial.stdout}` }
  const path = join(workspace, 'guidance-task/application.mjs')
  const original = await readFile(path, 'utf8')
  let failed: ProcessResult
  try {
    await writeFile(path, regression)
    failed = await runProcess(process.execPath, args, { cwd: workspace, timeoutMs: 30_000 })
  } finally {
    await writeFile(path, original)
  }
  const restored = await runProcess(process.execPath, args, { cwd: workspace, timeoutMs: 30_000 })
  const passed = failed.code !== 0 && /not ok \d+ - auth\.blocked/u.test(failed.stdout)
    && /ERR_ASSERTION|AssertionError/u.test(failed.stdout) && restored.code === 0
  return { name, passed, detail: passed ? 'ordinary SDK PASS → real application assertion FAIL → exact restore PASS' : 'SDK did not detect the real blocked-account regression and restore to PASS' }
}
