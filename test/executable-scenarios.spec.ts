import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defineSuite, verifySpecification } from '@focused-spec/scenarios-typescript'
import type { Driver, ExecutionEvent, Scenario } from '@focused-spec/scenarios-typescript'
import type { ExecutionEvent as RunnerExecutionEvent } from 'focused-spec/runner'
import { decodeSelector, encodeSelector, readCatalog } from '@focused-spec/format-scenarios-typescript/catalog'
import runner from '@focused-spec/runner-scenarios-typescript'

const repository = fileURLToPath(new URL('..', import.meta.url))
let temporary: string
const tarballs = new Map<string, string>()
const sdkName = '@focused-spec/scenarios-typescript'
const scenario = { id: 'account', name: 'actual event', given: { balance: 5 }, when: { cents: 5 }, expect: { balance: 0 } }
const driver: Driver<{ balance: number }, { balance: number }, { cents: number }, { balance: number }> = {
  given: given => given,
  when: (subject, command) => ({ balance: subject.balance - command.cents }),
}

async function put(root: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}

function command(root: string, executable: string, args: string[], timeout = 120_000) {
  return spawnSync(executable, args, { cwd: root, encoding: 'utf8', timeout, maxBuffer: 8_000_000 })
}

function cli(root: string, ...args: string[]) {
  return command(root, process.execPath, [join(root, 'node_modules/focused-spec/dist/cli.js'), ...args, '--json'])
}

function packed(directory: string): string {
  const result = command(join(repository, 'packages', directory), 'npm', ['pack', '--ignore-scripts', '--pack-destination', temporary, '--json'])
  if (result.status !== 0) throw new Error(result.stderr || String(result.error))
  return join(temporary, (JSON.parse(result.stdout) as { filename: string }[])[0]!.filename)
}

function install(root: string, ...names: string[]): void {
  const result = command(root, 'npm', ['install', '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund', ...names.map(name => tarballs.get(name)!)])
  if (result.status !== 0) throw new Error(result.stderr || String(result.error))
}

const configuration = {
  version: 5,
  specifications: {
    formats: { scenarios: { package: '@focused-spec/format-scenarios-typescript', options: { runner: 'scenarios' } } },
    documents: [{ match: 'specifications/*.scenarios.*', scope: 'current', format: 'scenarios' }],
  },
  runners: { scenarios: { package: '@focused-spec/runner-scenarios-typescript' } },
}

function source(scenarios: readonly unknown[] = [scenario], driverPath = './driver.mjs'): string {
  return `import { defineSuite } from '${sdkName}'\nexport default defineSuite({\n driver: ${JSON.stringify(driverPath)},\n scenarios: [\n${scenarios.map(item => JSON.stringify(item)).join(',\n')}\n ]\n})\n`
}

async function project(): Promise<string> {
  const root = await mkdtemp(join(temporary, 'project-'))
  await put(root, 'package.json', '{"name":"scenario-consumer","private":true,"type":"module"}')
  await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir')
  await put(root, '.focused-spec/config.yaml', JSON.stringify(configuration))
  await put(root, 'specifications/account.scenarios.mjs', source())
  await put(root, 'specifications/driver.mjs', 'export default { given: value => value, when: (subject, command) => ({ balance: subject.balance - command.cents }) }')
  return root
}

async function bankProject(): Promise<string> {
  const root = await mkdtemp(join(temporary, 'bank-'))
  await cp(join(repository, 'examples/scenarios/typescript'), root, { recursive: true, filter: path => !path.includes('node_modules') && !path.endsWith('package-lock.json') })
  await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir')
  return root
}


function context(root: string) {
  return { projectRoot: root, cwd: root, runnerId: 'scenarios', options: null, signal: new AbortController().signal }
}

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'focused-executable-scenarios-'))
  for (const directory of ['core', 'sdk/typescript', 'formats/scenarios-typescript', 'runners/scenarios-typescript']) {
    const manifest = JSON.parse(await readFile(join(repository, 'packages', directory, 'package.json'), 'utf8')) as { name: string }
    tarballs.set(manifest.name, packed(directory))
  }
}, 120_000)

afterAll(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }) })

describe('executable scenarios', () => {
  it('runs a packed SDK scenario without focused-spec', async () => {
    const root = await mkdtemp(join(temporary, 'sdk-only-'))
    await put(root, 'package.json', '{"name":"sdk-only","private":true,"type":"module"}')
    install(root, sdkName)
    await put(root, 'run.mjs', `import { defineSuite, verifySpecification } from '${sdkName}';\nconst suite = defineSuite({ driver:'unused.mjs', scenarios:[${JSON.stringify(scenario)}] });\nconst actual = await verifySpecification(${driverSource()}, suite.scenarios[0]);\nlet failed = false; try { await verifySpecification({ given:value=>value, when:(_subject,_command,context)=>{ context.explain('still silent', {private:true}); return {balance:1} } }, suite.scenarios[0]) } catch { failed = true }\nif (!failed) throw new Error('expected mismatch'); console.log(JSON.stringify(actual));`)
    const result = command(root, process.execPath, ['run.mjs'])
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ balance: 0 })
    for (const path of ['node_modules/focused-spec', 'node_modules/typescript']) await expect(stat(join(root, path))).rejects.toMatchObject({ code: 'ENOENT' })
    await put(root, 'cancel.mjs', `import { verifySpecification } from '${sdkName}';
import { writeFile, rm, stat } from 'node:fs/promises';
import { rejects } from 'node:assert/strict';
const controller = new AbortController(), reason = new Error('cancelled packed consumer');
await rejects(verifySpecification({
 given: async () => { await writeFile('held','resource'); return 'held' },
 when: () => { controller.abort(reason); throw reason },
 cleanup: async (path, context) => { context.signal?.throwIfAborted(); await rm(path) },
}, ${JSON.stringify(scenario)}, { signal:controller.signal }), error => error === reason);
await rejects(stat('held'), {code:'ENOENT'}); console.log('released after cancellation');`)
    const cancelled = command(root, process.execPath, ['cancel.mjs'])
    expect(cancelled.status, cancelled.stderr).toBe(0)
    expect(cancelled.stdout.trim()).toBe('released after cancellation')
    await put(root, 'types.ts', `import { defineSuite, verifySpecification, type Driver, type ExecutionEvent, type Scenario, type Suite, type VerifyOptions } from '${sdkName}';\nconst driver: Driver<number, number, number, number> = { given: x => x, when: (s,x,context) => { context.explain('subtracting', { amount:x }); return s-x } };\nconst events: ExecutionEvent[] = []; const options: VerifyOptions = { onEvent: event => events.push(event) };\nconst suite: Suite<number,number,number> = defineSuite({driver:'driver.mjs',scenarios:[{id:'x',name:'x',given:5,when:5,expect:0}]});\nconst scenario: Scenario<number,number,number> = suite.scenarios[0]!;\nvoid verifySpecification(driver, scenario, options);\n// @ts-expect-error incompatible command input\nvoid verifySpecification(driver, {...scenario, when:'wrong'});`)
    const types = command(root, process.execPath, [join(repository, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'NodeNext', '--target', 'ES2024', '--lib', 'ES2024,DOM', 'types.ts'])
    expect(types.status, types.stdout + types.stderr).toBe(0)
  }, 120_000)

  it('rejects invalid declarations before execution', async () => {
    let invoked = false
    const guarded = { ...driver, given: (value: { balance: number }) => { invoked = true; return value } }
    for (const value of [{ ...scenario, expect: undefined }, { ...scenario, extra: true }, { ...scenario, given: new Date() }]) {
      await expect(verifySpecification(guarded, value as typeof scenario)).rejects.toThrow()
    }
    expect(invoked).toBe(false)
    expect(() => defineSuite({ driver: './driver.mjs', scenarios: [scenario, scenario] })).toThrow(/duplicate/u)
    let getter = false
    const accessor = Object.defineProperty({ ...scenario }, 'expect', { enumerable: true, get: () => { getter = true; return {} } })
    expect(() => defineSuite({ driver: './driver.mjs', scenarios: [accessor] })).toThrow(/data property/u)
    expect(getter).toBe(false)
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic
    expect(() => defineSuite({ driver: './driver.mjs', scenarios: [{ ...scenario, given: cyclic }] })).toThrow(/cycle/u)
  })

  it('fails when real application events differ', async () => {
    await expect(verifySpecification({ ...driver, when: () => ({ balance: 1 }) }, scenario)).rejects.toMatchObject({ actual: { balance: 1 }, expected: { balance: 0 } })
    await expect(verifySpecification({ ...driver, when: () => ({ balance: NaN }) }, scenario)).rejects.toThrow(/JSON-compatible/u)
  })

  it('preserves expectations when a driver mutates inputs', async () => {
    const shared = { balance: 5 }
    const declaration = { ...scenario, given: shared, expect: shared }
    await expect(verifySpecification({ given: (value: { balance: number }) => value, when: subject => { subject.balance = 0; return subject } }, declaration)).rejects.toMatchObject({ actual: { balance: 0 }, expected: { balance: 5 } })
    expect(declaration.given).toEqual({ balance: 5 })
    expect(declaration.expect).toEqual({ balance: 5 })
  })

  it('cleans up failures and preserves both errors', async () => {
    const root = await mkdtemp(join(temporary, 'resource-'))
    const resource = join(root, 'open')
    const primary = new Error('application failed'), cleanup = new Error('cleanup failed')
    let releases = 0
    const failing = {
      given: async () => { await writeFile(resource, 'held'); return resource },
      when: () => { throw primary },
      cleanup: async (path: string) => { releases++; await rm(path); throw cleanup },
    }
    await expect(verifySpecification(failing, scenario)).rejects.toMatchObject({ errors: [primary, cleanup] })
    expect(releases).toBe(1)
    await expect(stat(resource)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('releases prepared resources after cancellation without losing failures or explanations', async () => {
    for (const releaseFails of [false, true]) {
      const root = await mkdtemp(join(temporary, 'cancel-resource-'))
      const resource = join(root, 'held')
      const controller = new AbortController()
      const cancellation = new Error('caller cancelled'), releaseFailure = new Error('release failed')
      const events: ExecutionEvent[] = []
      let releases = 0
      const outcome = verifySpecification({
        given: async () => { await writeFile(resource, 'held'); return resource },
        when: (_path: string, _command: { cents: number }, context) => {
          context.explain('action entered'); controller.abort(cancellation); context.signal?.throwIfAborted()
          return { balance: 0 }
        },
        cleanup: async (path: string, context) => {
          context.signal?.throwIfAborted()
          await rm(path); releases++
          context.explain('released', { id: context.scenarioId })
          if (releaseFails) throw releaseFailure
        },
      }, scenario, { signal: controller.signal, onEvent: event => events.push(event) })
      if (releaseFails) await expect(outcome).rejects.toMatchObject({ errors: [cancellation, releaseFailure] })
      else await expect(outcome).rejects.toBe(cancellation)
      expect(releases).toBe(1)
      await expect(stat(resource)).rejects.toMatchObject({ code: 'ENOENT' })
      expect(events.filter(event => event.kind === 'explanation')).toEqual([
        { kind: 'explanation', message: 'action entered' },
        { kind: 'explanation', message: 'released', data: { id: scenario.id } },
      ])
      expect(events.some(event => event.kind === 'observation' && event.name === 'Actual')).toBe(false)
    }
  })

  it('awaits cancellation independent asynchronous cleanup', async () => {
    for (const releaseFails of [false, true]) {
      const root = await mkdtemp(join(temporary, 'await-release-'))
      const resource = join(root, 'held')
      const controller = new AbortController(), releaseFailure = new Error('release failure')
      const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
      let settled = false
      const outcome = verifySpecification({
        given: async () => { await writeFile(resource, 'held'); return { balance: 5 } },
        when: driver.when,
        cleanup: async (_subject, context) => {
          entered.resolve(); await release.promise; context.signal?.throwIfAborted()
          await rm(resource)
          if (releaseFails) throw releaseFailure
        },
      }, scenario, { signal: controller.signal }).then(value => { settled = true; return value }, error => { settled = true; throw error })
      const checked = releaseFails ? expect(outcome).rejects.toBe(releaseFailure) : expect(outcome).resolves.toEqual({ balance: 0 })
      await entered.promise
      controller.abort(new Error('late cancellation'))
      await Promise.resolve()
      expect(settled).toBe(false)
      expect(await readFile(resource, 'utf8')).toBe('held')
      release.resolve(); await checked
      await expect(stat(resource)).rejects.toMatchObject({ code: 'ENOENT' })
    }
  })

  it('does not clean an unprepared subject after preparation fails', async () => {
    const root = await mkdtemp(join(temporary, 'partial-resource-'))
    const resource = join(root, 'partial'), failure = new Error('preparation failed')
    let acted = false, cleaned = false
    await expect(verifySpecification({
      given: async () => { await writeFile(resource, 'partial'); throw failure },
      when: () => { acted = true; return scenario.expect },
      cleanup: () => { cleaned = true },
    }, scenario)).rejects.toBe(failure)
    expect({ acted, cleaned }).toEqual({ acted: false, cleaned: false })
    expect(await readFile(resource, 'utf8')).toBe('partial')
    await rm(resource)
  })

  it('does not acquire resources for pre aborted execution', async () => {
    const root = await mkdtemp(join(temporary, 'pre-abort-'))
    const resource = join(root, 'held'), reason = new Error('already cancelled')
    let acted = false, cleaned = false
    await expect(verifySpecification({
      given: async () => { await writeFile(resource, 'held'); return resource },
      when: () => { acted = true; return scenario.expect },
      cleanup: async () => { cleaned = true; await rm(resource) },
    }, scenario, { signal: AbortSignal.abort(reason) })).rejects.toBe(reason)
    expect({ acted, cleaned }).toEqual({ acted: false, cleaned: false })
    await expect(stat(resource)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('skips the action and releases resources after preparation cancellation', async () => {
    const root = await mkdtemp(join(temporary, 'prepare-abort-'))
    const resource = join(root, 'held'), controller = new AbortController(), reason = new Error('cancel preparation')
    let acted = false, releases = 0
    await expect(verifySpecification({
      given: async (_given: { balance: number }, context) => {
        context.signal?.throwIfAborted(); await writeFile(resource, 'held'); controller.abort(reason); return resource
      },
      when: () => { acted = true; return scenario.expect },
      cleanup: async (path: string, context) => { context.signal?.throwIfAborted(); await rm(path); releases++ },
    }, scenario, { signal: controller.signal })).rejects.toBe(reason)
    expect({ acted, releases }).toEqual({ acted: false, releases: 1 })
    await expect(stat(resource)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a matching action result after cancellation', async () => {
    const root = await mkdtemp(join(temporary, 'action-abort-'))
    const resource = join(root, 'held'), controller = new AbortController(), reason = new Error('cancel action')
    const events: ExecutionEvent[] = []
    await expect(verifySpecification({
      given: async () => { await writeFile(resource, 'held'); return resource },
      when: (_subject: string, _command: { cents: number }, context) => {
        context.signal?.throwIfAborted(); controller.abort(reason); return { balance: 0 }
      },
      cleanup: async (path: string, context) => { context.signal?.throwIfAborted(); await rm(path) },
    }, scenario, { signal: controller.signal, onEvent: event => events.push(event) })).rejects.toBe(reason)
    await expect(stat(resource)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(events.some(event => event.kind === 'observation' && event.name === 'Actual')).toBe(false)
  })

  it('observes actual verification through one event channel', async () => {
    const events: ExecutionEvent[] = []
    const explaining: Driver<{ balance: number }, { balance: number }, { cents: number }, { balance: number }> = {
      given: value => value,
      when: (subject, command, context) => {
        context.explain('Withdrawal declined', { requestedCents: command.cents })
        return { balance: subject.balance - command.cents + 1 }
      },
    }
    await expect(verifySpecification(explaining, scenario, { onEvent: event => events.push(event) }))
      .rejects.toMatchObject({ actual: { balance: 1 }, expected: { balance: 0 } })
    expect(events).toEqual([
      { kind: 'observation', name: 'Given', value: { balance: 5 } },
      { kind: 'observation', name: 'When', value: { cents: 5 } },
      { kind: 'observation', name: 'Expect', value: { balance: 0 } },
      { kind: 'explanation', message: 'Withdrawal declined', data: { requestedCents: 5 } },
      { kind: 'observation', name: 'Actual', value: { balance: 1 } },
    ])
  })

  it('isolates observation snapshots from driver observer and cleanup mutation', async () => {
    const shared = { state: { balance: 5 } }
    const declaration: Scenario<typeof shared, { cents: number }, typeof shared> = {
      id: 'snapshot', name: 'isolated snapshots', given: shared, when: { cents: 5 }, expect: shared,
    }
    const events: ExecutionEvent[] = []
    let actual = { state: { balance: 5 } }
    const decision = { nested: { cents: 5 } }
    let afterObserver = 0
    await verifySpecification({
      given: (value: typeof shared) => { value.state.balance = 4; return value },
      when: (_subject, _command, context) => {
        context.explain('first decision', decision)
        afterObserver = decision.nested.cents
        decision.nested.cents = 6
        context.explain('second decision', decision)
        actual = { state: { balance: 5 } }
        return actual
      },
      cleanup: () => { actual.state.balance = -1; decision.nested.cents = -1 },
    }, declaration, {
      onEvent: event => {
        events.push(event)
        if (event.kind === 'observation' && 'value' in event && event.name === 'Given') {
          (event.value as typeof shared).state.balance = 99
        }
        if (event.kind === 'observation' && 'value' in event && event.name === 'Expect') {
          (event.value as typeof shared).state.balance = 88
        }
        if (event.kind === 'explanation' && event.message === 'first decision') {
          (event.data as typeof decision).nested.cents = 99
        }
      },
    })
    const observations: Record<string, unknown> = {}
    for (const event of events) {
      if (event.kind === 'observation') observations[event.name] = 'value' in event ? event.value : event.text
    }
    expect(observations).toEqual({
      Given: { state: { balance: 99 } },
      When: { cents: 5 },
      Expect: { state: { balance: 88 } },
      Actual: { state: { balance: 5 } },
    })
    expect(observations.Given).not.toBe(observations.Expect)
    expect(declaration.given).toEqual({ state: { balance: 5 } })
    expect(declaration.expect).toEqual({ state: { balance: 5 } })
    expect(actual).toEqual({ state: { balance: -1 } })
    expect(afterObserver).toBe(5)
    expect(events.filter(event => event.kind === 'explanation')).toEqual([
      { kind: 'explanation', message: 'first decision', data: { nested: { cents: 99 } } },
      { kind: 'explanation', message: 'second decision', data: { nested: { cents: 6 } } },
    ])
  })

  it('isolates explanations across concurrent executions', async () => {
    const first: string[] = [], second: string[] = []
    let arrived = 0
    let release!: () => void
    const barrier = new Promise<void>(done => { release = done })
    const concurrent: Driver<{ balance: number }, { balance: number }, { cents: number }, { balance: number }> = {
      given: value => value,
      when: async (subject, command, context) => {
        context.explain(`${context.scenarioId}:before`)
        arrived += 1
        if (arrived === 2) release()
        await barrier
        context.explain(`${context.scenarioId}:after`)
        return { balance: subject.balance - command.cents }
      },
    }
    const collect = (messages: string[]) => (event: ExecutionEvent): void => {
      if (event.kind === 'explanation') messages.push(event.message)
    }
    await Promise.all([
      verifySpecification(concurrent, { ...scenario, id: 'first' }, { onEvent: collect(first) }),
      verifySpecification(concurrent, { ...scenario, id: 'second' }, { onEvent: collect(second) }),
    ])
    expect(first).toEqual(['first:before', 'first:after'])
    expect(second).toEqual(['second:before', 'second:after'])
  })

  it('retains explanations when exact comparison fails', async () => {
    const events: ExecutionEvent[] = []
    let cleaned = false
    await expect(verifySpecification({
      given: (value: { balance: number }) => value,
      when: (_subject: { balance: number }, _command: { cents: number }, context) => {
        context.explain('Application selected the explained branch')
        return { balance: 1 }
      },
      cleanup: () => { cleaned = true },
    }, scenario, { onEvent: event => events.push(event) })).rejects.toMatchObject({ actual: { balance: 1 }, expected: { balance: 0 } })
    expect(events).toEqual(expect.arrayContaining([
      { kind: 'explanation', message: 'Application selected the explained branch' },
      { kind: 'observation', name: 'Actual', value: { balance: 1 } },
    ]))
    expect(cleaned).toBe(true)

    const observerFailure = new Error('observer failed')
    let observerCleaned = false
    await expect(verifySpecification({
      ...driver,
      cleanup: () => { observerCleaned = true },
    }, scenario, {
      onEvent: event => {
        if (event.kind === 'observation' && event.name === 'Actual') throw observerFailure
      },
    })).rejects.toBe(observerFailure)
    expect(observerCleaned).toBe(true)
  })

  it('releases cooperative worker resources and bounds noncooperative cancellation', async () => {
    for (const cooperative of [true, false]) {
      const root = await project()
      await put(root, 'specifications/driver.mjs', `import { writeFile, rm } from 'node:fs/promises';
export default {
 given: async () => { await writeFile('held','resource'); return 'held' },
 when: async (_subject, _command, context) => {
   const waiting = new Promise((_,reject) => { ${cooperative ? "context.signal.addEventListener('abort', () => reject(context.signal.reason), {once:true})" : 'setInterval(() => {}, 1000)'} });
   await writeFile('ready','ready'); return waiting;
 },
 cleanup: async (path, context) => { context.signal?.throwIfAborted(); await rm(path); await writeFile('released',context.scenarioId); context.explain('released') },
}`)
      const controller = new AbortController(), reason = new Error('cancel runner')
      const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector('specifications/account.scenarios.mjs', scenario.id)] })
      expect(resolved.errors).toEqual([])
      const running = runner.run({ ...context(root), signal: controller.signal, targets: resolved.targets })
      const rejected = expect(running).rejects.toBe(reason)
      const deadline = Date.now() + 5000
      while (!await stat(join(root, 'ready')).then(() => true, () => false)) {
        if (Date.now() > deadline) throw new Error('worker did not enter action')
        await new Promise(done => setTimeout(done, 10))
      }
      controller.abort(reason)
      await rejected
      if (cooperative) {
        expect(await readFile(join(root, 'released'), 'utf8')).toBe(scenario.id)
        await expect(stat(join(root, 'held'))).rejects.toMatchObject({ code: 'ENOENT' })
      } else {
        expect(await readFile(join(root, 'held'), 'utf8')).toBe('resource')
        await expect(stat(join(root, 'released'))).rejects.toMatchObject({ code: 'ENOENT' })
      }
    }
  })

  it('discovers source locations without importing drivers', async () => {
    const root = await project()
    await put(root, 'specifications/driver.mjs', "import { writeFileSync } from 'node:fs'; writeFileSync(new URL('../imported', import.meta.url), 'bad'); throw new Error('must not import')")
    const result = cli(root, 'list')
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ scenarios: [{ id: 'account', source: { path: 'specifications/account.scenarios.mjs', line: 5 } }] })
    const strict = cli(root, 'validate', '--strict')
    expect(strict.status, strict.stdout + strict.stderr).toBe(0)
    await expect(stat(join(root, 'imported'))).rejects.toMatchObject({ code: 'ENOENT' })
    const supported = source().replace('import { defineSuite }', 'import { defineSuite as suite }').replace('export default defineSuite(', 'export default suite(').replace('})\n', '} as const)\n')
    expect(readCatalog('suite.ts', supported).scenarios[0]?.scenario.id).toBe('account')
  })

  it('rejects dynamic declarations without executing them', async () => {
    const root = await project()
    const dynamic = `import { defineSuite } from '${sdkName}'\nexport default defineSuite({ driver:'./driver.mjs', scenarios: (() => { throw new Error('EVALUATED') })() })`
    await put(root, 'specifications/account.scenarios.mjs', dynamic)
    const result = cli(root, 'list')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/dynamic|literal/u)
    expect(result.stdout).not.toContain('EVALUATED')
    for (const data of ['{ ...{} }', '{ x:1, x:2 }', '{ __proto__:null }', '[,]']) {
      expect(() => readCatalog('suite.mjs', source().replace('"given":{"balance":5}', `"given":${data}`))).toThrow()
    }
  })

  it('runs native code scenarios without a registry', async () => {
    const root = await project()
    const id = 'Opaque Δ / :: " ID'
    await put(root, 'specifications/account.scenarios.mjs', source([{ ...scenario, id }]))
    const inventory = cli(root, 'show', id)
    expect(inventory.status, inventory.stderr).toBe(0)
    const selected = JSON.parse(inventory.stdout).scenarios[0] as { evidence: { reference: string }[] }
    expect(decodeSelector(selected.evidence[0]!.reference.slice('scenarios::'.length))).toEqual(['specifications/account.scenarios.mjs', id])
    const run = cli(root, 'run', '--scenario', id)
    expect(run.status, run.stdout + run.stderr).toBe(0)
    expect(JSON.parse(run.stdout)).toMatchObject({ scenarios: [{ id, status: 'PASS' }] })
    await expect(stat(join(root, '.focused-spec/evidence.yaml'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('executes only the selected opaque identity', async () => {
    const root = await project()
    await put(root, 'specifications/account.scenarios.mjs', source([scenario, { ...scenario, id: 'unselected', when: { cents: 99 } }]))
    await put(root, 'specifications/driver.mjs', "import { appendFileSync } from 'node:fs'; export default { given: value => value, when: (subject, command) => { appendFileSync(new URL('../actions', import.meta.url), String(command.cents)); return {balance:subject.balance-command.cents} } }")
    const result = cli(root, 'run', '--scenario', 'account')
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ scenarios: [{ id: 'account', status: 'PASS' }] })
    expect(await readFile(join(root, 'actions'), 'utf8')).toBe('5')
    const selector = encodeSelector('specifications/account.scenarios.mjs', 'account')
    expect((await runner.resolve({ ...context(root), selectors: [selector] })).targets[0]?.targetId)
      .toBe((await runner.resolve({ ...context(root), selectors: [selector] })).targets[0]?.targetId)
  })

  it('rejects a target removed after resolution', async () => {
    const root = await project()
    const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector('specifications/account.scenarios.mjs', 'account')] })
    expect(resolved.errors).toEqual([])
    await put(root, 'specifications/account.scenarios.mjs', source([{ ...scenario, id: 'replacement' }]))
    const result = await runner.run({ ...context(root), targets: resolved.targets })
    expect(result.results).toEqual([{ targetId: resolved.targets[0]!.targetId, status: 'fail', diagnostic: expect.stringContaining('not found') }])
  })

  it('rejects driver escapes without importing them', async () => {
    const root = await project()
    const outside = join(temporary, 'outside.mjs')
    await writeFile(outside, "throw new Error('imported unsafe driver')")
    await symlink(outside, join(root, 'specifications/escaped.mjs'))
    for (const path of ['./escaped.mjs', '../../outside.mjs']) {
      await put(root, 'specifications/account.scenarios.mjs', source([scenario], path))
      const result = cli(root, 'validate', '--strict')
      expect(result.status).toBe(1)
      expect(result.stdout).toContain('escapes the project')
      expect(result.stdout).not.toContain('imported unsafe driver')
    }
  })

  it('executes an erasable TypeScript driver without consumer flags', async () => {
    const root = await project()
    await put(root, 'specifications/account.scenarios.mjs', source([scenario], './driver.ts'))
    await put(root, 'specifications/driver.ts', 'interface Account { balance: number }; export default { given: (value: Account): Account => value, when: (subject: Account, command: {cents:number}): Account => ({balance:subject.balance-command.cents}) }')
    const result = cli(root, 'run')
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ scenarios: [{ id: 'account', status: 'PASS' }] })
  })

  it('runs packed plugins outside the source checkout', async () => {
    const root = await mkdtemp(join(temporary, 'packed-bank-'))
    await cp(join(repository, 'examples/scenarios/typescript'), root, { recursive: true, filter: path => !path.includes('node_modules') })
    await put(root, 'package.json', '{"name":"packed-bank","private":true,"type":"module","scripts":{"test":"node --test test/account.node.mjs","start":"node demo.mjs"}}')
    install(root, ...tarballs.keys())
    for (const script of ['test', 'start']) {
      const result = command(root, 'npm', ['run', script])
      expect(result.status, result.stdout + result.stderr).toBe(0)
    }
    for (const args of [['list'], ['validate', '--strict'], ['run', '--scenario', 'account.withdraw.entire-balance'], ['run']]) {
      const result = cli(root, ...args)
      expect(result.status, result.stdout + result.stderr).toBe(0)
      if (args[0] === 'run') expect(JSON.parse(result.stdout).scenarios.every((item: {status:string}) => item.status === 'PASS')).toBe(true)
    }
    for (const name of ['@focused-spec/format-scenarios-typescript', '@focused-spec/runner-scenarios-typescript']) {
      const docs = cli(root, 'plugin-docs', '--package', name)
      expect(docs.status, docs.stderr).toBe(0)
      expect(JSON.parse(docs.stdout)).toMatchObject({ selection: { kind: 'package', name }, plugin: { name, root: await realpath(join(root, 'node_modules', name)) } })
    }
  }, 180_000)


  it('retains direct runner events when bank verification fails', async () => {
    const root = await bankProject()
    await put(root, 'specifications/account.driver.mjs', `import { Account } from '../src/account.mjs';
export default {
  given: history => Account.from(history),
  when: (account, command, context) => account.handle(command, context.explain).map(event => event.type === 'WithdrawalDeclined' ? {...event, reason:'wrong-reason'} : event),
};`)
    const selector = encodeSelector('specifications/account.scenarios.mjs', 'account.withdraw.insufficient-funds')
    const resolved = await runner.resolve({ ...context(root), selectors: [selector] })
    expect(resolved.errors).toEqual([])
    const result = await runner.run({ ...context(root), targets: resolved.targets })
    expect(result.results).toEqual([expect.objectContaining({
      targetId: resolved.targets[0]!.targetId,
      status: 'fail',
      diagnostic: expect.stringContaining('wrong-reason'),
      events: expect.arrayContaining([
        { kind: 'explanation', message: expect.any(String), data: { requestedCents: 4000, availableCents: 3000 } },
        { kind: 'observation', message: 'Actual', data: { value: [{ type: 'WithdrawalDeclined', cents: 4000, reason: 'wrong-reason' }] } },
      ]),
    })])
  })

  it('retains direct runner explanations on action errors without inventing Actual', async () => {
    const root = await project()
    await put(root, 'specifications/driver.mjs', `export default {
  given: value => value,
  when: (_subject, _command, context) => { context.explain('action attempted', { phase:'when' }); throw new Error('action failed') },
}`)
    const selector = encodeSelector('specifications/account.scenarios.mjs', 'account')
    const resolved = await runner.resolve({ ...context(root), selectors: [selector] })
    const result = await runner.run({ ...context(root), targets: resolved.targets })
    const target = result.results[0]!
    expect(target).toMatchObject({
      status: 'fail',
      diagnostic: expect.stringContaining('action failed'),
      events: expect.arrayContaining([{ kind: 'explanation', message: 'action attempted', data: { phase: 'when' } }]),
    })
    expect(target.events?.some(event => event.kind === 'observation' && event.message === 'Actual')).toBe(false)
  })

  it('bounds TypeScript runner event collection by count and encoded bytes', async () => {
    const root = await project()
    const selector = encodeSelector('specifications/account.scenarios.mjs', 'account')
    const executeDriver = async (driverModule: string) => {
      await put(root, 'specifications/driver.mjs', driverModule)
      const resolved = await runner.resolve({ ...context(root), selectors: [selector] })
      return (await runner.run({ ...context(root), targets: resolved.targets })).results[0]!
    }
    const counted = await executeDriver(`export default {
  given: value => value,
  when: (subject, command, context) => { for (let index=0; index<300; index++) context.explain('record '+index); return {balance:subject.balance-command.cents} },
}`)
    expect(counted.status).toBe('pass')
    expect(counted.events).toHaveLength(256)
    expect(counted.events?.at(-1)).toMatchObject({ kind: 'truncated' })
    expect(Buffer.byteLength(JSON.stringify(counted.events))).toBeLessThanOrEqual(65_536)

    const oversized = await executeDriver(`export default {
  given: value => value,
  when: (subject, command, context) => { context.explain('oversized', {payload:'x'.repeat(70000)}); return {balance:subject.balance-command.cents} },
}`)
    expect(oversized.status).toBe('pass')
    expect(oversized.events?.at(-1)).toMatchObject({ kind: 'truncated' })
    expect(Buffer.byteLength(JSON.stringify(oversized.events))).toBeLessThanOrEqual(65_536)
  })

  it('explains the actual bank withdrawal decision', async () => {
    const root = await bankProject()
    const result = command(root, process.execPath, ['demo.mjs'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('"requestedCents":4000')
    expect(result.stdout).toContain('"availableCents":3000')
  })

  it('exposes the real bank execution across standalone detailed and JSON output', async () => {
    const root = await bankProject()
    const id = 'account.withdraw.insufficient-funds'
    const standalone = command(root, process.execPath, ['demo.mjs'])
    const detailed = command(root, process.execPath, [join(root, 'node_modules/focused-spec/dist/cli.js'), 'run', '--scenario', id, '--details'])
    const json = cli(root, 'run', '--scenario', id)
    for (const result of [standalone, detailed, json]) expect(result.status, result.stdout + result.stderr).toBe(0)
    for (const output of [standalone.stdout, detailed.stdout, json.stdout]) {
      expect(output).toContain('WithdrawalDeclined')
      expect(output).toContain('insufficient-funds')
      expect(output).toContain('requestedCents')
      expect(output).toContain('4000')
      expect(output).toContain('availableCents')
      expect(output).toContain('3000')
    }
    const report = JSON.parse(json.stdout) as { scenarios: { id: string; status: string; evidence: { events?: RunnerExecutionEvent[] }[] }[] }
    expect(report.scenarios).toEqual([expect.objectContaining({ id, status: 'PASS' })])
    expect(report.scenarios[0]!.evidence[0]!.events).toEqual(expect.arrayContaining([
      { kind: 'explanation', message: expect.any(String), data: { requestedCents: 4000, availableCents: 3000 } },
      { kind: 'observation', message: 'Actual', data: { value: [{ type: 'WithdrawalDeclined', cents: 4000, reason: 'insufficient-funds' }] } },
    ]))
  }, 120_000)

  it('roundtrips canonical bank messages through the application codec', async () => {
    const root = await bankProject()
    const result = command(root, process.execPath, ['--test', '--test-name-pattern=canonical bank messages roundtrip', 'test/account.node.mjs'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/pass 1/u)
  })

  it('checks serialization without executing or rewriting bank scenarios', async () => {
    const root = await bankProject()
    const suitePath = join(root, 'specifications/account.scenarios.mjs')
    const before = await readFile(suitePath, 'utf8')
    const accountPath = join(root, 'src/account.mjs')
    const account = await readFile(accountPath, 'utf8')
    const guarded = account.replace('handle(command, explain) {', "handle(command, explain) { throw new Error('business execution must stay disabled');")
    expect(guarded).not.toBe(account)
    await writeFile(accountPath, guarded)
    await put(root, 'package.json', '{"name":"codec-only","private":true,"type":"module"}')
    await rm(join(root, 'node_modules'))
    install(root, sdkName)
    await put(root, 'serialization-only.mjs', "import { deepStrictEqual } from 'node:assert/strict'; import suite from './specifications/account.scenarios.mjs'; import { verifySerialization } from './serialization.mjs'; const before = structuredClone(suite.scenarios); const checked = verifySerialization(suite); deepStrictEqual(suite.scenarios, before); console.log(checked);")
    const result = command(root, process.execPath, ['serialization-only.mjs'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe('25')
    expect(await readFile(suitePath, 'utf8')).toBe(before)
    for (const path of ['node_modules/focused-spec', 'node_modules/@focused-spec/format-scenarios-typescript', 'node_modules/@focused-spec/runner-scenarios-typescript']) {
      await expect(stat(join(root, path))).rejects.toMatchObject({ code: 'ENOENT' })
    }
  }, 120_000)

  it('detects a lost decline reason independently of bank behavior', async () => {
    const root = await bankProject()
    const codecPath = join(root, 'src/messages.mjs')
    const codec = await readFile(codecPath, 'utf8')
    const changed = codec.replace(
      'return JSON.stringify(message);',
      "const value = structuredClone(message); if (value.type === 'WithdrawalDeclined') delete value.reason; return JSON.stringify(value);",
    )
    expect(changed).not.toBe(codec)
    await writeFile(codecPath, changed)
    const serialization = command(root, process.execPath, ['--test', '--test-name-pattern=canonical bank messages roundtrip', 'test/account.node.mjs'])
    expect(serialization.status).toBe(1)
    expect(serialization.stdout + serialization.stderr).toContain('account.withdraw.insufficient-funds Expect[0]')
    const demo = command(root, process.execPath, ['demo.mjs'])
    expect(demo.status).toBe(1)
    expect(demo.stdout + demo.stderr).toContain('Serialization roundtrip: FAIL')
    const business = command(root, process.execPath, ['--test', '--test-name-pattern=A withdrawal exceeding the remaining balance is declined', 'test/account.node.mjs'])
    expect(business.status, business.stdout + business.stderr).toBe(0)
  })
  it('detects the bank withdrawal boundary regression', async () => {
    const root = await project()
    await cp(join(repository, 'examples/scenarios/typescript'), root, { recursive: true, filter: path => !path.includes('node_modules') && !path.endsWith('package-lock.json') })
    const accountPath = join(root, 'src/account.mjs')
    const baseline = await readFile(accountPath, 'utf8')
    const ordinary = () => command(root, process.execPath, ['--test', 'test/account.node.mjs'])
    const demo = () => command(root, process.execPath, ['demo.mjs'])
    const focusedOne = () => cli(root, 'run', '--scenario', 'account.withdraw.entire-balance')
    const focusedAll = () => cli(root, 'run')
    const expectBaseline = () => {
      for (const result of [ordinary(), demo(), focusedOne(), focusedAll()]) {
        expect(result.status, result.stdout + result.stderr).toBe(0)
      }
    }
    expectBaseline()
    try {
      const changed = baseline.replace('command.cents > this.#balance', 'command.cents >= this.#balance')
      expect(changed).not.toBe(baseline)
      await writeFile(accountPath, changed)
      const failedTest = ordinary()
      expect(failedTest.status).toBe(1)
      expect(failedTest.stdout + failedTest.stderr).toContain('AssertionError')
      const failedDemo = demo()
      expect(failedDemo.status).toBe(1)
      expect(failedDemo.stdout + failedDemo.stderr).toContain('MoneyWithdrawn')
      for (const result of [focusedOne(), focusedAll()]) {
        expect(result.status).toBe(1)
        expect(JSON.parse(result.stdout).scenarios).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: 'account.withdraw.entire-balance', status: 'FAIL' }),
        ]))
        expect(result.stdout).toContain('MoneyWithdrawn')
      }
    } finally { await writeFile(accountPath, baseline) }
    expectBaseline()
  }, 120_000)
})

function driverSource(): string {
  return "{ given: value => value, when: (subject, command, context) => { context.explain('subtracting balance', { cents: command.cents }); return { balance:subject.balance-command.cents } } }"
}
