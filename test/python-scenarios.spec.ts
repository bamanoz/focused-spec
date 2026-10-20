import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repository = fileURLToPath(new URL('..', import.meta.url))
const sdkTests = 'packages/sdk/python/tests/test_scenarios.py'
let temporary: string

function run(cwd: string, executable: string, args: string[]) {
  return spawnSync(executable, args, { cwd, encoding: 'utf8', timeout: 120_000, maxBuffer: 8_000_000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
}

function passed(result: ReturnType<typeof run>) {
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
}

function pytest(selectors: string[]) {
  const result = run(repository, 'uv', ['run', '--no-project', '--with', 'pytest', '--with-editable', './packages/sdk/python', 'python', '-m', 'pytest', '-q', ...selectors])
  passed(result)
  expect(result.stdout).toMatch(new RegExp(`${selectors.length} passed`))
}

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'focused-spec-python-'))
})

afterAll(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true })
})

describe('python executable scenarios', () => {
  it('runs the packed SDK without framework dependencies', async () => {
    const dist = join(temporary, 'dist')
    passed(run(repository, 'uv', ['build', '--wheel', '--out-dir', dist, 'packages/sdk/python']))
    const wheel = (await readdir(dist)).find(name => name.endsWith('.whl'))!
    const venv = join(temporary, 'venv')
    passed(run(temporary, 'uv', ['venv', venv]))
    const python = process.platform === 'win32' ? join(venv, 'Scripts', 'python.exe') : join(venv, 'bin', 'python')
    passed(run(temporary, 'uv', ['pip', 'install', '--python', python, '--no-deps', join(dist, wheel)]))
    const consumer = join(temporary, 'consumer.py')
    await writeFile(consumer, `from importlib.metadata import requires
from importlib.util import find_spec
from focused_spec_scenarios import Driver, Scenario, ScenarioMismatch, verify_specification
assert not requires('focused-spec-scenarios')
assert all(find_spec(name) is None for name in ('pytest', 'focused_spec', 'openspec'))
scenario = Scenario('deposit', 'Deposit', {'balance': 100}, 25, {'balance': 125})
driver = Driver(lambda initial, _: dict(initial), lambda account, amount, _: {'balance': account['balance'] + amount})
assert verify_specification(driver, scenario) == {'balance': 125}
try:
    verify_specification(Driver(lambda initial, _: initial, lambda account, amount, _: {'balance': 124}), scenario)
except ScenarioMismatch as error:
    assert error.expected == {'balance': 125} and error.actual == {'balance': 124}
else:
    raise AssertionError('incorrect application observation passed')
`)
    passed(run(temporary, python, ['-I', consumer]))
  }, 120_000)

  it('rejects invalid declarations before driver execution', () => {
    pytest([`${sdkTests}::test_validation_rejects_bad_identity_duplicate_ids_and_cycles_before_driver`])
  }, 120_000)

  it('compares actual results exactly and isolates declarations', () => {
    pytest([`${sdkTests}::test_real_driver_result_is_compared_exactly`, `${sdkTests}::test_driver_mutation_does_not_rewrite_declaration_or_expectation`])
  }, 120_000)

  it('preserves execution and cleanup failures', () => {
    pytest([`${sdkTests}::test_cleanup_runs_once_and_preserves_both_failures`, `${sdkTests}::test_cancellation_and_cleanup_failure_remain_discoverable`])
  }, 120_000)

  it('retains cleanup after cancellation', () => {
    pytest([`${sdkTests}::test_cancellation_still_releases_prepared_subject`])
  }, 120_000)

  it('reports ordered events with actual mismatch observations', () => {
    pytest([`${sdkTests}::test_optional_events_are_ordered_and_mismatch_keeps_actual`])
  }, 120_000)

  it('runs the maintained pytest bank consumer and demo', async () => {
    const bank = join(temporary, 'bank')
    await cp(join(repository, 'examples/scenarios/python'), bank, { recursive: true, filter: path => !['__pycache__', '.pytest_cache', '.venv'].includes(basename(path)) })
    const args = ['run', '--no-project', '--with', 'pytest', '--with-editable', join(repository, 'packages/sdk/python'), 'python', '-m', 'pytest', 'tests', '-q']
    passed(run(bank, 'uv', args))
    passed(run(bank, 'uv', ['run', '--no-project', '--with-editable', join(repository, 'packages/sdk/python'), 'python', 'demo.py']))
    const path = join(bank, 'src/account.py')
    const source = await readFile(path, 'utf8')
    const regression = source.replace('elif cents > self._balance:', 'elif cents >= self._balance:')
    expect(regression).not.toBe(source)
    await writeFile(path, regression)
    const broken = run(bank, 'uv', args)
    expect(broken.status, broken.stdout + broken.stderr).toBe(1)
    expect(broken.stdout).toMatch(/ScenarioMismatch.*account\.withdraw\.entire-balance/s)
    await writeFile(path, source)
    passed(run(bank, 'uv', args))
  }, 120_000)
})
