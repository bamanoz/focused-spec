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
    passed(run(repository, 'uv', ['build', '--out-dir', dist, 'packages/sdk/python']))
    const artifacts = await readdir(dist)
    const wheel = artifacts.find(name => name.endsWith('.whl'))!
    const sdist = artifacts.find(name => name.endsWith('.tar.gz'))!
    expect(wheel).toBeDefined()
    expect(sdist).toBeDefined()
    const venv = join(temporary, 'venv')
    passed(run(temporary, 'uv', ['venv', venv]))
    const python = process.platform === 'win32' ? join(venv, 'Scripts', 'python.exe') : join(venv, 'bin', 'python')
    passed(run(temporary, 'uv', ['pip', 'install', '--python', python, '--no-deps', join(dist, wheel)]))
    const consumer = join(temporary, 'consumer.py')
    await writeFile(consumer, `from importlib.metadata import metadata, requires
from importlib.resources import files
from importlib.util import find_spec
from focused_spec_scenarios import Driver, Scenario, ScenarioMismatch, verify_specification
package_metadata = metadata('focused-spec-scenarios')
assert package_metadata['License-Expression'] == 'MIT'
assert package_metadata['Requires-Python'] == '>=3.11'
assert 'Typing :: Typed' in package_metadata.get_all('Classifier')
assert 'Programming Language :: Python :: 3.11' in package_metadata.get_all('Classifier')
assert 'Repository, https://github.com/bamanoz/focused-spec' in package_metadata.get_all('Project-URL')
assert 'Issues, https://github.com/bamanoz/focused-spec/issues' in package_metadata.get_all('Project-URL')
assert files('focused_spec_scenarios').joinpath('py.typed').is_file()
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
    const inspectArtifacts = `import email, sys, tarfile, zipfile
from pathlib import Path
wheel, sdist = map(Path, sys.argv[1:])
with zipfile.ZipFile(wheel) as archive:
    assert 'focused_spec_scenarios/py.typed' in archive.namelist()
    wheel_metadata = email.message_from_bytes(archive.read(next(name for name in archive.namelist() if name.endswith('.dist-info/METADATA'))))
    assert any(name.endswith('/licenses/LICENSE') for name in archive.namelist())
with tarfile.open(sdist) as archive:
    assert any(name.endswith('/src/focused_spec_scenarios/py.typed') for name in archive.getnames())
    assert any(name.endswith('/LICENSE') for name in archive.getnames())
    member = archive.extractfile(next(name for name in archive.getnames() if name.endswith('/PKG-INFO')))
    assert member is not None
    sdist_metadata = email.message_from_bytes(member.read())
for package_metadata in (wheel_metadata, sdist_metadata):
    assert package_metadata['License-Expression'] == 'MIT'
    assert package_metadata['Requires-Python'] == '>=3.11'
    assert 'Typing :: Typed' in package_metadata.get_all('Classifier')
    assert 'Repository, https://github.com/bamanoz/focused-spec' in package_metadata.get_all('Project-URL')
`
    passed(run(temporary, python, ['-I', '-c', inspectArtifacts, join(dist, wheel), join(dist, sdist)]))
    const sourceVenv = join(temporary, 'sdist-venv')
    passed(run(temporary, 'uv', ['venv', sourceVenv]))
    const sourcePython = process.platform === 'win32' ? join(sourceVenv, 'Scripts', 'python.exe') : join(sourceVenv, 'bin', 'python')
    passed(run(temporary, 'uv', ['pip', 'install', '--python', sourcePython, '--no-deps', join(dist, sdist)]))
    passed(run(temporary, sourcePython, ['-I', consumer]))
  }, 120_000)

  it('preserves pre-cleanup actual and mismatch snapshots', () => {
    pytest([`${sdkTests}::test_actual_snapshot_precedes_cleanup`, `${sdkTests}::test_async_actual_snapshot_precedes_cleanup`])
  }, 120_000)

  it('executes synchronous drivers inside an active loop and rejects awaitables cleanly', () => {
    pytest([`${sdkTests}::test_sync_verification_inside_running_loop`, `${sdkTests}::test_sync_verification_rejects_awaitables_without_warning`])
  }, 120_000)

  it('distinguishes cooperative cancellation from native task cancellation', () => {
    pytest([`${sdkTests}::test_cooperative_cancellation_is_task_group_failure`, `${sdkTests}::test_native_task_cancellation_runs_cleanup`])
  }, 120_000)

  it('validates explanations independently of observation', () => {
    pytest([`${sdkTests}::test_explain_validates_without_observer`])
  }, 120_000)

  it('types the explanation data argument as optional', async () => {
    const typing = join(temporary, 'explain_typing.py')
    await writeFile(typing, `from focused_spec_scenarios import DriverContext
def explain_without_data(context: DriverContext) -> None:
    context.explain("a decision")
    context.explain("a decision with data", {"count": 1})
`)
    const result = run(repository, 'uv', ['run', '--no-project', '--with', 'mypy', '--with-editable', './packages/sdk/python', 'mypy', '--strict', typing])
    passed(result)
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
