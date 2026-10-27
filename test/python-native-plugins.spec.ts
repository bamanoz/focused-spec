import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { decodeSelector, encodeSelector, readCatalog } from '@focused-spec/format-scenarios-python/catalog'
import runner from '@focused-spec/runner-scenarios-python'

const repository = fileURLToPath(new URL('..', import.meta.url))
const suitePath = 'specifications/example_scenarios.py'
let temporary: string
let python: string
const tarballs = new Map<string, string>()

async function put(root: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}

function environment(): NodeJS.ProcessEnv {
  const bin = python ? dirname(python) : ''
  return {
    ...process.env,
    PYTHONDONTWRITEBYTECODE: '1',
    ...(bin ? { PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` } : {}),
  }
}

function command(root: string, executable: string, args: string[], timeout = 120_000) {
  return spawnSync(executable, args, { cwd: root, encoding: 'utf8', timeout, maxBuffer: 8_000_000, env: environment() })
}

function passed(result: SpawnSyncReturns<string>): void {
  expect(result.status, `${result.stdout}\n${result.stderr}\n${String(result.error ?? '')}`).toBe(0)
}

function cli(root: string, ...args: string[]) {
  return command(root, process.execPath, [join(root, 'node_modules/focused-spec/dist/cli.js'), ...args, '--json'])
}

interface ScenarioInput {
  readonly id: string
  readonly name?: string
  readonly given?: number
  readonly when?: number
  readonly expect?: number
}

function suiteSource(scenarios: readonly ScenarioInput[] = [{ id: 'account', when: 5 }], binding = true): string {
  return `from focused_spec_scenarios import DriverBinding, Scenario, define_suite

EXAMPLE_SCENARIOS = define_suite(
${scenarios.map(value => `    Scenario(
        id=${JSON.stringify(value.id)},
        name=${JSON.stringify(value.name ?? 'bank observation')},
        given=${value.given ?? 5},
        when=${value.when ?? 5},
        expect=${value.expect ?? 0},
    ),`).join('\n')}
${binding ? '    driver=DriverBinding("example_driver.py", "DRIVER"),\n' : ''})
`
}

function driverSource(action = 'return subject - command'): string {
  return `from pathlib import Path
from focused_spec_scenarios import Driver

def prepare(value, context):
    return value

def act(subject, command, context):
    with Path("actions").open("a", encoding="utf-8") as stream:
        stream.write(f"{command}\\n")
    ${action}

DRIVER = Driver(prepare, act)
`
}

function configuration(commandName = python) {
  return {
    version: 5,
    specifications: {
      formats: {
        'scenarios-python': {
          package: '@focused-spec/format-scenarios-python',
          options: { runner: 'scenarios-python', command: commandName },
        },
      },
      documents: [{ match: 'specifications/*_scenarios.py', scope: 'current', format: 'scenarios-python' }],
    },
    runners: {
      'scenarios-python': {
        package: '@focused-spec/runner-scenarios-python',
        timeoutMs: 120_000,
        options: { command: commandName },
      },
    },
  }
}

async function project(): Promise<string> {
  const root = await mkdtemp(join(temporary, 'python-project-'))
  await put(root, 'package.json', '{"name":"python-native-consumer","private":true,"type":"module"}')
  await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir')
  await put(root, '.focused-spec/config.yaml', JSON.stringify(configuration()))
  await put(root, suitePath, suiteSource())
  await put(root, 'specifications/example_driver.py', driverSource())
  return root
}

function context(root: string, signal = new AbortController().signal) {
  return { projectRoot: root, cwd: root, runnerId: 'scenarios-python', options: { command: python }, signal }
}

async function waitFor(path: string): Promise<void> {
  const deadline = Date.now() + 30_000
  for (;;) {
    try {
      await stat(path)
      return
    } catch (error) {
      if (Date.now() >= deadline) throw error
      await delay(20)
    }
  }
}

async function expectProcessGone(pid: number): Promise<void> {
  const deadline = Date.now() + 2_000
  for (;;) {
    try {
      process.kill(pid, 0)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return
      throw error
    }
    if (Date.now() >= deadline) throw new Error(`owned Python process remained alive: ${pid}`)
    await delay(20)
  }
}

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'focused-spec-python-native-'))
  const environmentRoot = join(temporary, 'sdk-environment')
  passed(command(temporary, 'uv', ['venv', environmentRoot]))
  python = process.platform === 'win32' ? join(environmentRoot, 'Scripts', 'python.exe') : join(environmentRoot, 'bin', 'python')
  passed(command(temporary, 'uv', ['pip', 'install', '--python', python, '--no-deps', join(repository, 'packages/sdk/python')]))
  passed(command(temporary, 'uv', ['pip', 'install', '--python', python, 'pytest']))
  for (const directory of ['core', 'formats/scenarios-python', 'runners/scenarios-python']) {
    const root = join(repository, 'packages', directory)
    const result = command(root, 'npm', ['pack', '--ignore-scripts', '--pack-destination', temporary, '--json'])
    passed(result)
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { readonly name: string }
    const packed = JSON.parse(result.stdout) as { readonly filename: string }[]
    tarballs.set(manifest.name, join(temporary, packed[0]!.filename))
  }
}, 180_000)

afterAll(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true })
})

describe('python native plugins', () => {
  it('preserves standalone suites and optional driver bindings', async () => {
    const root = await mkdtemp(join(temporary, 'sdk-only-'))
    const script = join(root, 'probe.py')
    await writeFile(script, `import asyncio
from focused_spec_scenarios import Driver, DriverBinding, Scenario, define_suite, verify_specification, verify_specification_async
scenario = Scenario("subtract", "Subtract", 5, 2, 3)
driver = Driver(lambda value, _: value, lambda subject, value, _: subject - value)
unbound = define_suite(scenario)
bound = define_suite(scenario, driver=DriverBinding("driver.py", "DRIVER"))
assert unbound.driver is None
assert bound.driver == DriverBinding("driver.py", "DRIVER")
assert verify_specification(driver, unbound.scenarios[0]) == 3
assert asyncio.run(verify_specification_async(driver, bound.scenarios[0])) == 3
print("standalone")
`)
    const result = command(root, python, ['-I', script])
    passed(result)
    expect(result.stdout).toBe('standalone\n')
    await expect(stat(join(root, 'node_modules'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects unsupported or unbound declarations', async () => {
    await expect(readCatalog(suitePath, suiteSource(undefined, false), undefined, python)).rejects.toThrow(/driver|binding/u)
    await expect(readCatalog(suitePath, suiteSource().replace('id="account"', 'id=make_id()'), undefined, python)).rejects.toThrow(/literal|dynamic/u)
    await expect(readCatalog(suitePath, suiteSource().replace('        expect=0,\n', ''), undefined, python)).rejects.toThrow(/expect/u)
    await expect(readCatalog(suitePath, suiteSource([{ id: 'same' }, { id: 'same' }]), undefined, python)).rejects.toThrow(/duplicate/u)
    const root = await project()
    await put(root, suitePath, suiteSource(undefined, false))
    const result = cli(root, 'list')
    expect(result.status).toBe(1)
    expect(result.stdout + result.stderr).toMatch(/driver|binding/u)
    await expect(stat(join(root, 'actions'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('inspects suites without executing consumer code', async () => {
    const root = await project()
    const inertSource = `import initializer\n${suiteSource()}`
    const line = inertSource.split('\n').findIndex(value => value.trimStart().startsWith('Scenario(')) + 1
    const catalog = await readCatalog(suitePath, inertSource, undefined, python)
    expect(catalog).toEqual({
      suite: { exportName: 'EXAMPLE_SCENARIOS', driver: { path: 'example_driver.py', exportName: 'DRIVER' } },
      scenarios: [{ id: 'account', name: 'bank observation', line }],
    })
    await put(root, suitePath, inertSource)
    await put(root, 'initializer.py', 'from pathlib import Path\nPath("suite-imported").write_text("bad")\n')
    await put(root, 'specifications/example_driver.py', `${driverSource()}\nPath("driver-imported").write_text("bad")\n`)
    const listed = cli(root, 'list')
    passed(listed)
    const scenario = JSON.parse(listed.stdout).scenarios[0]
    expect(scenario).toMatchObject({
      id: 'account',
      name: 'bank observation',
      source: { path: suitePath, line },
      evidence: [{ reference: `scenarios-python::${encodeSelector(suitePath, 'account')}` }],
    })
    passed(cli(root, 'show', 'account'))
    passed(cli(root, 'validate', '--syntax-only'))
    passed(cli(root, 'validate', '--strict'))
    await expect(stat(join(root, 'suite-imported'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(join(root, 'driver-imported'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(join(root, 'actions'))).rejects.toMatchObject({ code: 'ENOENT' })
  }, 120_000)

  it('runs distributed plugins without checkout access', async () => {
    const root = await mkdtemp(join(temporary, 'packed-consumer-'))
    const dist = join(root, 'dist')
    await mkdir(dist)
    const built = command(repository, 'uv', ['build', '--wheel', '--out-dir', dist, 'packages/sdk/python'])
    passed(built)
    const wheel = (await readdir(dist)).find(name => name.endsWith('.whl'))
    expect(wheel).toBeDefined()
    const environmentRoot = join(root, 'venv')
    passed(command(root, 'uv', ['venv', environmentRoot]))
    const packedPython = process.platform === 'win32' ? join(environmentRoot, 'Scripts', 'python.exe') : join(environmentRoot, 'bin', 'python')
    passed(command(root, 'uv', ['pip', 'install', '--python', packedPython, '--no-deps', join(dist, wheel!)]))
    await put(root, 'package.json', '{"name":"packed-python-native","private":true,"type":"module"}')
    passed(command(root, 'npm', ['install', '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund', ...tarballs.values()]))
    await put(root, '.focused-spec/config.yaml', JSON.stringify(configuration(packedPython)))
    await put(root, suitePath, suiteSource())
    await put(root, 'specifications/example_driver.py', driverSource())
    const executable = join(root, 'node_modules/focused-spec/dist/cli.js')
    for (const args of [
      ['list'], ['show', 'account'], ['validate', '--syntax-only'], ['validate', '--strict'], ['run', '--scenario', 'account'],
    ]) passed(command(root, process.execPath, [executable, ...args, '--json']))
    for (const name of ['@focused-spec/format-scenarios-python', '@focused-spec/runner-scenarios-python']) {
      const docs = command(root, process.execPath, [executable, 'plugin-docs', '--package', name, '--json'])
      passed(docs)
      expect(JSON.parse(docs.stdout).selection).toEqual({ kind: 'package', name })
      expect(await realpath(join(root, 'node_modules', name))).not.toContain(repository)
    }
    expect(await readFile(join(root, 'package-lock.json'), 'utf8')).not.toContain(repository)
  }, 180_000)

  it('executes only the exact selected native scenario', async () => {
    const root = await project()
    const id = 'Opaque Δ / :: " ID'
    await put(root, suitePath, suiteSource([{ id, when: 5 }, { id: 'must-not-run', when: 99 }]))
    await put(root, 'specifications/example_driver.py', `import asyncio
from pathlib import Path
from focused_spec_scenarios import Driver

async def prepare(value, context):
    await asyncio.sleep(0)
    return value

async def act(subject, command, context):
    with Path("actions").open("a", encoding="utf-8") as stream:
        stream.write(f"{command}\\n")
    await asyncio.sleep(0)
    if command == 99:
        raise AssertionError("unselected action ran")
    return subject - command

DRIVER = Driver(prepare, act)
`)
    const selector = encodeSelector(suitePath, id)
    expect(decodeSelector(selector)).toEqual([suitePath, id])
    const first = await runner.resolve({ ...context(root), selectors: [selector] })
    const second = await runner.resolve({ ...context(root), selectors: [selector] })
    expect(first.errors).toEqual([])
    expect(second.targets[0]?.targetId).toBe(first.targets[0]?.targetId)
    const result = await runner.run({ ...context(root), targets: first.targets })
    expect(result.results).toMatchObject([{ status: 'pass' }])
    expect(await readFile(join(root, 'actions'), 'utf8')).toBe('5\n')
  }, 120_000)

  it('preserves native comparison across transport', async () => {
    const root = await project()
    await put(root, suitePath, `from focused_spec_scenarios import DriverBinding, Scenario, define_suite

EXAMPLE_SCENARIOS = define_suite(
    Scenario("tuple", "Tuple differs from list", None, "tuple", (1, 2)),
    Scenario("boolean", "Boolean differs from integer", None, "boolean", True),
    driver=DriverBinding("example_driver.py", "DRIVER"),
)
`)
    await put(root, 'specifications/example_driver.py', `from focused_spec_scenarios import Driver
DRIVER = Driver(lambda value, context: value, lambda subject, command, context: [1, 2] if command == "tuple" else 1)
`)
    const resolved = await runner.resolve({ ...context(root), selectors: ['tuple', 'boolean'].map(id => encodeSelector(suitePath, id)) })
    expect(resolved.errors).toEqual([])
    const outcome = await runner.run({ ...context(root), targets: resolved.targets })
    expect(outcome.results).toHaveLength(2)
    expect(outcome.results.every(result => result.status === 'fail')).toBe(true)
    expect(outcome.results[0]).toMatchObject({
      diagnostic: expect.stringMatching(/tuple|\(1, 2\)|\[1, 2\]/u),
      events: expect.arrayContaining([
        { kind: 'observation', message: 'Expect', data: { value: { type: 'python:tuple', items: [1, 2] } } },
        { kind: 'observation', message: 'Actual', data: { value: [1, 2] } },
      ]),
    })
    expect(outcome.results[1]).toMatchObject({
      diagnostic: expect.stringMatching(/True|1/u),
      events: expect.arrayContaining([
        { kind: 'observation', message: 'Expect', data: { value: true } },
        { kind: 'observation', message: 'Actual', data: { value: 1 } },
      ]),
    })
  }, 120_000)

  it('rejects a selected identity changed after resolution', async () => {
    const root = await project()
    const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector(suitePath, 'account')] })
    expect(resolved.errors).toEqual([])
    await put(root, suitePath, suiteSource([{ id: 'replacement', when: 5 }]))
    const outcome = await runner.run({ ...context(root), targets: resolved.targets })
    expect(outcome.results).toMatchObject([{ status: 'fail', diagnostic: expect.stringContaining('not found') }])
    await expect(stat(join(root, 'actions'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects source and binding escapes', async () => {
    const bindingRoot = await project()
    const outsideDriver = join(temporary, 'outside_driver.py')
    await writeFile(outsideDriver, driverSource('raise AssertionError("escaped driver ran")'))
    await rm(join(bindingRoot, 'specifications/example_driver.py'))
    await symlink(outsideDriver, join(bindingRoot, 'specifications/example_driver.py'))
    const binding = await runner.resolve({ ...context(bindingRoot), selectors: [encodeSelector(suitePath, 'account')] })
    expect(binding.targets).toEqual([])
    expect(binding.errors[0]?.message).toContain('escapes the project')
    const bindingStrict = cli(bindingRoot, 'validate', '--strict')
    expect(bindingStrict.status).toBe(1)
    expect(bindingStrict.stdout + bindingStrict.stderr).toMatch(/escap.*project|outside.*project/iu)
    const sourceRoot = await project()
    const outsideSuite = join(temporary, 'outside_scenarios.py')
    await writeFile(outsideSuite, suiteSource())
    await rm(join(sourceRoot, suitePath))
    await symlink(outsideSuite, join(sourceRoot, suitePath))
    const source = await runner.resolve({ ...context(sourceRoot), selectors: [encodeSelector(suitePath, 'account')] })
    expect(source.targets).toEqual([])
    expect(source.errors[0]?.message).toContain('escapes the project')
    await expect(stat(join(bindingRoot, 'actions'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(join(sourceRoot, 'actions'))).rejects.toMatchObject({ code: 'ENOENT' })
    const sourceStrict = cli(sourceRoot, 'validate', '--strict')
    expect(sourceStrict.status).toBe(1)
    expect(sourceStrict.stdout + sourceStrict.stderr).toMatch(/escap.*project|outside.*project/iu)
  })

  it('rejects missing malformed and forged reports', async () => {
    const cases = [
      { action: 'os._exit(0)', diagnostic: /missing.*report/iu },
      { action: 'open(sys.argv[1], "w", encoding="utf-8").write("not json"); os._exit(0)', diagnostic: /malformed|invalid/iu },
      { action: 'open(sys.argv[1], "w", encoding="utf-8").write(\'{"protocol":1,"nonce":"forged","results":[]}\'); os._exit(0)', diagnostic: /invalid|report/iu },
      { action: 'print(\'{"protocol":1,"results":[{"status":"pass"}]}\', flush=True); os._exit(0)', diagnostic: /missing.*report/iu },
    ]
    for (const item of cases) {
      const root = await project()
      await put(root, 'specifications/example_driver.py', `import os
import sys
from focused_spec_scenarios import Driver

def act(subject, command, context):
    ${item.action}

DRIVER = Driver(lambda value, context: value, act)
`)
      const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector(suitePath, 'account')] })
      expect(resolved.errors).toEqual([])
      const outcome = await runner.run({ ...context(root), targets: resolved.targets })
      expect(outcome.results[0]).toMatchObject({ status: 'fail', diagnostic: expect.stringMatching(item.diagnostic) })
    }
  }, 120_000)

  it('bounds cancellation and terminates owned workers', async () => {
    const cooperative = await project()
    await put(cooperative, 'specifications/example_driver.py', `import asyncio
from pathlib import Path
from focused_spec_scenarios import Driver

async def act(subject, command, context):
    Path("started").write_text("started")
    await asyncio.Event().wait()

async def cleanup(subject, context):
    Path("cleaned").write_text("released")

DRIVER = Driver(lambda value, context: value, act, cleanup)
`)
    const selected = await runner.resolve({ ...context(cooperative), selectors: [encodeSelector(suitePath, 'account')] })
    const cooperativeController = new AbortController()
    const cooperativeRun = runner.run({ ...context(cooperative, cooperativeController.signal), targets: selected.targets })
    await waitFor(join(cooperative, 'started'))
    cooperativeController.abort()
    await expect(cooperativeRun).rejects.toMatchObject({ name: 'AbortError' })
    expect(await readFile(join(cooperative, 'cleaned'), 'utf8')).toBe('released')

    const forced = await project()
    await put(forced, 'specifications/example_driver.py', `import os
import subprocess
import sys
import time
from pathlib import Path
from focused_spec_scenarios import Driver

def act(subject, command, context):
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    Path("worker-pids").write_text(f"{os.getpid()} {child.pid}")
    while True:
        time.sleep(0.05)

DRIVER = Driver(lambda value, context: value, act)
`)
    const forcedTargets = await runner.resolve({ ...context(forced), selectors: [encodeSelector(suitePath, 'account')] })
    const forcedController = new AbortController()
    const started = Date.now()
    const forcedRun = runner.run({ ...context(forced, forcedController.signal), targets: forcedTargets.targets })
    await waitFor(join(forced, 'worker-pids'))
    forcedController.abort()
    await expect(forcedRun).rejects.toMatchObject({ name: 'AbortError' })
    expect(Date.now() - started).toBeLessThan(5_000)
    const pids = (await readFile(join(forced, 'worker-pids'), 'utf8')).split(' ').map(Number)
    for (const pid of pids) await expectProcessGone(pid)
  }, 120_000)

  it('retains application explanations and mismatch observations', async () => {
    const root = await project()
    await put(root, suitePath, `from focused_spec_scenarios import DriverBinding, Scenario, define_suite

EXAMPLE_SCENARIOS = define_suite(
    Scenario("mismatch", "Mismatched observation", {"balance": 5}, 2, {"balance": 9}),
    Scenario("error", "Application failure", {"balance": 5}, 3, {"balance": 2}),
    Scenario("bounded", "Bounded events", 0, 4, 4),
    driver=DriverBinding("example_driver.py", "DRIVER"),
)
`)
    await put(root, 'specifications/example_driver.py', `from focused_spec_scenarios import Driver

def act(subject, command, context):
    if command == 4:
        for index in range(300):
            context.explain("event", {"index": index})
        return command
    context.explain("withdrawal decision", {"requested": command, "available": subject["balance"], "large": 9007199254740993})
    if command == 3:
        raise RuntimeError("application exploded")
    return {"balance": subject["balance"] - command}

DRIVER = Driver(lambda value, context: value, act)
`)
    const resolved = await runner.resolve({ ...context(root), selectors: ['mismatch', 'error', 'bounded'].map(id => encodeSelector(suitePath, id)) })
    expect(resolved.errors).toEqual([])
    const outcome = await runner.run({ ...context(root), targets: resolved.targets })
    expect(outcome.results[0]).toMatchObject({
      status: 'fail',
      diagnostic: expect.stringContaining("{'balance': 3}"),
      events: expect.arrayContaining([
        { kind: 'explanation', message: 'withdrawal decision', data: { requested: 2, available: 5, large: { type: 'python:int', text: '9007199254740993' } } },
        { kind: 'observation', message: 'Expect', data: { value: { balance: 9 } } },
        { kind: 'observation', message: 'Actual', data: { value: { balance: 3 } } },
      ]),
    })
    expect(outcome.results[1]).toMatchObject({
      status: 'fail',
      diagnostic: expect.stringContaining('application exploded'),
      events: expect.arrayContaining([
        { kind: 'explanation', message: 'withdrawal decision', data: { requested: 3, available: 5, large: { type: 'python:int', text: '9007199254740993' } } },
      ]),
    })
    expect(outcome.results[2]).toMatchObject({ status: 'pass' })
    expect(outcome.results[2]?.events).toHaveLength(256)
    expect(outcome.results[2]?.events?.at(-1)).toEqual({ kind: 'truncated', message: 'Additional execution events omitted' })
  }, 120_000)

  it('runs canonical bank through CLI and detects restored regression', async () => {
    const root = await mkdtemp(join(temporary, 'python-bank-'))
    await cp(join(repository, 'examples/scenarios/python'), root, {
      recursive: true,
      filter: path => !['__pycache__', '.pytest_cache', '.venv'].includes(path.split(/[\\/]/u).at(-1) ?? ''),
    })
    await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir')
    const applicationPath = join(root, 'src/account.py')
    const suite = join(root, 'specifications/account_scenarios.py')
    const baseline = await readFile(applicationPath)
    const declarations = await readFile(suite)
    const pytest = () => command(root, python, ['-m', 'pytest', 'tests', '-q'])
    const demo = () => command(root, python, ['demo.py'])
    const selected = () => cli(root, 'run', '--scenario', 'account.withdraw.entire-balance')
    const all = () => cli(root, 'run')

    passed(pytest())
    passed(demo())
    for (const args of [
      ['list'], ['show', 'account.withdraw.entire-balance'], ['validate', '--syntax-only'], ['validate', '--strict'],
    ]) passed(cli(root, ...args))
    const initialSelected = selected()
    passed(initialSelected)
    expect(JSON.parse(initialSelected.stdout)).toMatchObject({ scenarios: [{ id: 'account.withdraw.entire-balance', status: 'PASS' }] })
    const initialAll = all()
    passed(initialAll)
    expect(JSON.parse(initialAll.stdout).scenarios).toHaveLength(6)
    const detailed = command(root, process.execPath, [join(root, 'node_modules/focused-spec/dist/cli.js'), 'run', '--scenario', 'account.withdraw.insufficient-funds', '--details'])
    passed(detailed)
    expect(detailed.stdout).toContain('Withdrawal declined')

    try {
      const changed = baseline.toString('utf8').replace('elif cents > self._balance:', 'elif cents >= self._balance:')
      expect(changed).not.toBe(baseline.toString('utf8'))
      await writeFile(applicationPath, changed)
      const nativeFailure = pytest()
      expect(nativeFailure.status).toBe(1)
      expect(nativeFailure.stdout + nativeFailure.stderr).toContain('account.withdraw.entire-balance')
      const focusedFailure = selected()
      expect(focusedFailure.status).toBe(1)
      expect(JSON.parse(focusedFailure.stdout)).toMatchObject({ scenarios: [{ id: 'account.withdraw.entire-balance', status: 'FAIL' }] })
    } finally {
      await writeFile(applicationPath, baseline)
    }

    expect(await readFile(applicationPath)).toEqual(baseline)
    expect(await readFile(suite)).toEqual(declarations)
    passed(pytest())
    const restored = all()
    passed(restored)
    expect(JSON.parse(restored.stdout).scenarios).toHaveLength(6)
    expect(JSON.parse(restored.stdout).scenarios.every((scenario: { readonly status: string }) => scenario.status === 'PASS')).toBe(true)
  }, 180_000)
})
