import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { decodeSelector, encodeSelector, readCatalog } from '@focused-spec/format-scenarios-dotnet/catalog'
import runner from '@focused-spec/runner-scenarios-dotnet'

const repository = fileURLToPath(new URL('..', import.meta.url))
const sdkProject = join(repository, 'packages/sdk/dotnet/FocusedSpec.Scenarios/FocusedSpec.Scenarios.csproj')
const suitePath = 'Suite.cs'
const runnerOptions = { project: 'Consumer.csproj', framework: 'net9.0' }
const configuration = {
  version: 5,
  specifications: {
    formats: { 'scenarios-dotnet': { package: '@focused-spec/format-scenarios-dotnet', options: { runner: 'scenarios-dotnet' } } },
    documents: [{ match: suitePath, scope: 'current', format: 'scenarios-dotnet' }],
  },
  runners: { 'scenarios-dotnet': { package: '@focused-spec/runner-scenarios-dotnet', timeoutMs: 300000, options: runnerOptions } },
}
let temporary: string
let feed: string
const tarballs = new Map<string, string>()

interface CommandOptions {
  readonly timeout?: number
  readonly environment?: NodeJS.ProcessEnv
}

function command(root: string, executable: string, args: readonly string[], options: CommandOptions = {}) {
  return spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: options.timeout ?? 300000,
    maxBuffer: 8_000_000,
    env: { ...(options.environment ?? process.env), NUGET_PACKAGES: join(temporary, 'nuget-packages') },
  })
}

function passed(result: SpawnSyncReturns<string>): void {
  expect(result.status, `${result.stdout}\n${result.stderr}\n${String(result.error ?? '')}`).toBe(0)
}

async function put(root: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}

function cli(root: string, args: readonly string[], environment?: NodeJS.ProcessEnv) {
  return command(root, process.execPath, [join(root, 'node_modules/focused-spec/dist/cli.js'), ...args, '--json'], environment === undefined ? {} : { environment })
}

interface NativeScenario {
  readonly id: string
  readonly name?: string
  readonly given: string
  readonly when: string
  readonly expect: string
}

function nativeSource(
  scenarios: readonly NativeScenario[] = [
    { id: 'account', given: '5', when: '5', expect: '0' },
    { id: 'unselected', given: '5', when: '99', expect: '0' },
  ],
  action = `await File.AppendAllTextAsync("actions", context.ScenarioId + "\\n");
            if (context.ScenarioId == "unselected") throw new InvalidOperationException("unselected action ran");
            return (int)subject - (int)command;`,
  bindingPath = 'Suite.cs',
  bindingExport = 'Consumer.Specifications.Driver',
): string {
  const declarations = scenarios.map(scenario => `            new(${JSON.stringify(scenario.id)}, ${JSON.stringify(scenario.name ?? `Scenario ${scenario.id}`)}, ${scenario.given}, ${scenario.when}, ${scenario.expect}),`).join('\n')
  return `using FocusedSpec.Scenarios;
namespace Consumer;
public static class Specifications
{
    public static readonly ScenarioSuite<object, object, object> Suite = new([
${declarations}
        ], new ScenarioDriverBinding(${JSON.stringify(bindingPath)}, ${JSON.stringify(bindingExport)}));

    public static ScenarioDriver<object, object, object, object> Driver => new()
    {
        Given = (value, _) => ValueTask.FromResult(value),
        When = async (subject, command, context) =>
        {
            ${action}
        },
    };
}
`
}

function projectFile(reference = sdkProject): string {
  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><TargetFramework>net9.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup>
  <ItemGroup><Compile Include="${suitePath}" /><ProjectReference Include="${reference}" /></ItemGroup>
</Project>
`
}

async function project(source = nativeSource()): Promise<string> {
  const root = await mkdtemp(join(temporary, 'project-'))
  await put(root, 'package.json', '{"name":"dotnet-consumer","private":true,"type":"module"}\n')
  await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir')
  await put(root, '.focused-spec/config.yaml', JSON.stringify(configuration))
  await put(root, 'Consumer.csproj', projectFile())
  await put(root, suitePath, source)
  return root
}

function context(root: string, signal = new AbortController().signal, options = runnerOptions) {
  return { projectRoot: root, cwd: root, runnerId: 'scenarios-dotnet', options, signal }
}

async function sdkProbe(program: string): Promise<void> {
  const root = await mkdtemp(join(temporary, 'sdk-probe-'))
  await put(root, 'NuGet.config', `<?xml version="1.0" encoding="utf-8"?><configuration><packageSources><clear/><add key="local" value="${feed}"/></packageSources></configuration>`)
  await put(root, 'Probe.csproj', `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net9.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup><ItemGroup><PackageReference Include="FocusedSpec.Scenarios" Version="0.10.2"/></ItemGroup></Project>`)
  await put(root, 'Program.cs', program)
  const result = command(root, 'dotnet', ['run', '--project', 'Probe.csproj', '--nologo'])
  passed(result)
  expect(result.stdout).toContain('verified')
  await expect(stat(join(root, 'node_modules'))).rejects.toMatchObject({ code: 'ENOENT' })
}

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'focused-spec-dotnet-native-'))
  feed = join(temporary, 'feed')
  await mkdir(feed)
  passed(command(repository, 'dotnet', ['pack', sdkProject, '--configuration', 'Release', '--output', feed, '--nologo']))
  for (const directory of ['core', 'formats/scenarios-dotnet', 'runners/scenarios-dotnet']) {
    const root = join(repository, 'packages', directory)
    const packed = command(root, 'npm', ['pack', '--ignore-scripts', '--pack-destination', temporary, '--json'])
    passed(packed)
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { name: string }
    const result = JSON.parse(packed.stdout) as { filename: string }[]
    tarballs.set(manifest.name, join(temporary, result[0]!.filename))
  }
}, 300000)

afterAll(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true })
})

describe('dotnet native plugins', () => {
  it('preserves standalone suites and optional driver bindings', async () => {
    await sdkProbe(`using FocusedSpec.Scenarios;
var scenario = new Scenario<int, int, int>("subtract", "Subtract", 5, 3, 2);
var unbound = new ScenarioSuite<int, int, int>([scenario]);
var bound = new ScenarioSuite<int, int, int>([scenario], new ScenarioDriverBinding("Program.cs", "Probe.Driver"));
var driver = new ScenarioDriver<int, int, int, int> { Given = (value, _) => ValueTask.FromResult(value), When = (subject, value, _) => ValueTask.FromResult(subject - value) };
if (unbound.Driver is not null || bound.Driver != new ScenarioDriverBinding("Program.cs", "Probe.Driver")) throw new Exception("binding changed");
if (await ScenarioExecutor.VerifyAsync(driver, unbound.Scenarios[0]) != 2 || await ScenarioExecutor.VerifyAsync(driver, bound.Scenarios[0]) != 2) throw new Exception("typed verification changed");
Console.WriteLine("verified");`)
  }, 300000)

  it('rejects unsupported or unbound declarations', async () => {
    const valid = nativeSource([{ id: 'one', given: '1', when: '1', expect: '0' }])
    const invalid = [
      valid.replace(', new ScenarioDriverBinding("Suite.cs", "Consumer.Specifications.Driver"))', ')'),
      valid.replace('new("one"', 'new(BuildId()'),
      valid.replace(', 1, 1, 0)', ', 1, 1)'),
      nativeSource([{ id: 'same', given: '1', when: '1', expect: '0' }, { id: 'same', given: '1', when: '1', expect: '0' }]),
      valid.replace('public static readonly', '#if DEBUG\n    public static readonly').replace('\n\n    public static ScenarioDriver', '\n#endif\n\n    public static ScenarioDriver'),
    ]
    for (const source of invalid) await expect(readCatalog(suitePath, source)).rejects.toThrow()
  }, 300000)

  it('inspects suites without executing consumer code', async () => {
    const source = nativeSource().replace(
      'public static readonly ScenarioSuite',
      'private static readonly int Initialized = Initialize();\n    private static int Initialize() { File.WriteAllText("initialized", "bad"); return 1; }\n\n    public static readonly ScenarioSuite',
    ).replace(
      'public static ScenarioDriver<object, object, object, object> Driver => new()',
      'public static ScenarioDriver<object, object, object, object> Driver { get { File.WriteAllText("driver-getter", "bad"); return new()',
    ).replace('\n    };\n}\n', '\n    }; } }\n}\n')
    const root = await project(source)
    await put(root, 'Directory.Build.targets', '<Project><Target Name="DiscoveryMustNotBuild" BeforeTargets="BeforeBuild"><WriteLinesToFile File="msbuild-ran" Lines="bad" Overwrite="true"/></Target></Project>')
    for (const args of [['list'], ['show', 'account'], ['validate', '--syntax-only'], ['validate', '--strict']]) passed(cli(root, args))
    for (const sentinel of ['initialized', 'driver-getter', 'msbuild-ran', 'actions']) await expect(stat(join(root, sentinel))).rejects.toMatchObject({ code: 'ENOENT' })
    const catalog = await readCatalog(suitePath, source)
    expect(catalog.scenarios).toEqual([
      { id: 'account', name: 'Scenario account', line: source.split('\n').findIndex(line => line.includes('new("account"')) + 1 },
      { id: 'unselected', name: 'Scenario unselected', line: source.split('\n').findIndex(line => line.includes('new("unselected"')) + 1 },
    ])
  }, 300000)

  it('runs distributed plugins without checkout access', async () => {
    const root = await mkdtemp(join(temporary, 'distributed-'))
    await put(root, 'package.json', '{"name":"distributed-dotnet","private":true,"type":"module"}\n')
    passed(command(root, 'npm', ['install', '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund', ...tarballs.values()]))
    await put(root, 'NuGet.config', `<?xml version="1.0" encoding="utf-8"?><configuration><packageSources><clear/><add key="local" value="${feed}"/><add key="nuget" value="https://api.nuget.org/v3/index.json"/></packageSources></configuration>`)
    await put(root, 'Consumer.csproj', `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net9.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup><ItemGroup><PackageReference Include="FocusedSpec.Scenarios" Version="0.10.2"/></ItemGroup></Project>`)
    await put(root, suitePath, nativeSource([{ id: 'account', given: '5', when: '5', expect: '0' }]))
    await put(root, '.focused-spec/config.yaml', JSON.stringify(configuration))
    passed(command(root, 'dotnet', ['restore', 'Consumer.csproj', '--nologo']))
    const offline = { ...process.env, HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', NO_PROXY: '' }
    const listed = cli(root, ['list'], offline)
    passed(listed)
    expect(JSON.parse(listed.stdout).scenarios).toEqual([
      expect.objectContaining({ id: 'account', evidence: [{ reference: `scenarios-dotnet::${encodeSelector(suitePath, 'account')}`, source: expect.any(Object) }] }),
    ])
    passed(cli(root, ['show', 'account'], offline))
    passed(cli(root, ['validate', '--syntax-only'], offline))
    passed(cli(root, ['validate', '--strict'], offline))
    passed(cli(root, ['run', '--scenario', 'account']))
    for (const name of ['@focused-spec/format-scenarios-dotnet', '@focused-spec/runner-scenarios-dotnet']) {
      const docs = cli(root, ['plugin-docs', '--package', name])
      passed(docs)
      expect(JSON.parse(docs.stdout).selection).toEqual({ kind: 'package', name })
    }
    const lock = await readFile(join(root, 'package-lock.json'), 'utf8')
    expect(lock).not.toContain(repository)
  }, 300000)

  it('executes only the exact selected native scenario', async () => {
    const id = 'Exact Δ :: / " identity'
    const root = await project(nativeSource([
      { id, given: '5', when: '5', expect: '0' },
      { id: 'unselected', given: '5', when: '99', expect: '0' },
    ]))
    const selector = encodeSelector(suitePath, id)
    expect(decodeSelector(selector)).toEqual([suitePath, id])
    const first = await runner.resolve({ ...context(root), selectors: [selector] })
    const second = await runner.resolve({ ...context(root), selectors: [selector] })
    expect(first.errors).toEqual([])
    expect(second.targets[0]?.targetId).toBe(first.targets[0]?.targetId)
    const result = await runner.run({ ...context(root), targets: first.targets })
    expect(result.results).toMatchObject([{ status: 'pass' }])
    expect(await readFile(join(root, 'actions'), 'utf8')).toBe(`${id}\n`)
  }, 300000)

  it('preserves native comparison across transport', async () => {
    const scenarios = [
      { id: 'int-long', given: '0', when: '0', expect: '1L' },
      { id: 'null-empty', given: '0', when: '0', expect: 'null' },
    ]
    const action = `await File.AppendAllTextAsync("actions", context.ScenarioId + "\\n");
            return context.ScenarioId == "int-long" ? (object)1 : Array.Empty<int>();`
    const root = await project(nativeSource(scenarios, action))
    const resolved = await runner.resolve({ ...context(root), selectors: scenarios.map(item => encodeSelector(suitePath, item.id)) })
    expect(resolved.errors).toEqual([])
    const result = await runner.run({ ...context(root), targets: resolved.targets })
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'fail', diagnostic: expect.stringContaining('expected 1, actual 1') }),
      expect.objectContaining({ status: 'fail', diagnostic: expect.stringContaining('actual System.Int32[]') }),
    ]))
  }, 300000)

  it('rejects a selected identity changed after resolution', async () => {
    const root = await project(nativeSource([{ id: 'account', given: '5', when: '5', expect: '0' }]))
    const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector(suitePath, 'account')] })
    expect(resolved.errors).toEqual([])
    await put(root, suitePath, nativeSource([{ id: 'replacement', given: '5', when: '5', expect: '0' }]))
    const result = await runner.run({ ...context(root), targets: resolved.targets })
    expect(result.results).toMatchObject([{ status: 'fail', diagnostic: expect.stringContaining('not found') }])
    await expect(stat(join(root, 'actions'))).rejects.toMatchObject({ code: 'ENOENT' })
  }, 300000)

  it('rejects source and binding escapes', async () => {
    const outsideSource = join(temporary, 'outside-suite.cs')
    await writeFile(outsideSource, nativeSource())
    const sourceRoot = await project()
    await rm(join(sourceRoot, suitePath))
    await symlink(outsideSource, join(sourceRoot, suitePath))
    const escapedSource = await runner.resolve({ ...context(sourceRoot), selectors: [encodeSelector(suitePath, 'account')] })
    expect(escapedSource.targets).toEqual([])
    expect(escapedSource.errors[0]?.message).toContain('escapes the project')

    const bindingRoot = await project(nativeSource(undefined, undefined, 'Driver.cs'))
    const outsideDriver = join(temporary, 'outside-driver.cs')
    await writeFile(outsideDriver, nativeSource())
    await symlink(outsideDriver, join(bindingRoot, 'Driver.cs'))
    const escapedBinding = await runner.resolve({ ...context(bindingRoot), selectors: [encodeSelector(suitePath, 'account')] })
    expect(escapedBinding.targets).toEqual([])
    expect(escapedBinding.errors[0]?.message).toContain('escapes the project')

    const projectRoot = await project()
    const outsideProject = join(temporary, 'outside.csproj')
    await writeFile(outsideProject, projectFile())
    await rm(join(projectRoot, 'Consumer.csproj'))
    await symlink(outsideProject, join(projectRoot, 'Consumer.csproj'))
    const escapedProject = await runner.resolve({ ...context(projectRoot), selectors: [encodeSelector(suitePath, 'account')] })
    expect(escapedProject.targets).toEqual([])
    expect(escapedProject.errors[0]?.message).toContain('escapes the project')
  }, 300000)

  it('rejects missing malformed and forged reports', async () => {
    const actions = [
      'Environment.Exit(0); return 0;',
      'File.WriteAllText(Environment.GetCommandLineArgs().Single(path => path.EndsWith("report.json", StringComparison.Ordinal)), "not-json"); Environment.Exit(0); return 0;',
      'Console.WriteLine("{\\"protocol\\":1,\\"results\\":[{\\"id\\":\\"account\\",\\"status\\":\\"pass\\"}]}"); Environment.Exit(0); return 0;',
      'File.WriteAllText(Environment.GetCommandLineArgs().Single(path => path.EndsWith("report.json", StringComparison.Ordinal)), "{\\"protocol\\":1,\\"results\\":[{\\"id\\":\\"account\\",\\"status\\":\\"pass\\"},{\\"id\\":\\"account\\",\\"status\\":\\"pass\\"}]}"); Environment.Exit(0); return 0;',
    ]
    for (const action of actions) {
      const root = await project(nativeSource([{ id: 'account', given: '5', when: '5', expect: '0' }], action))
      const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector(suitePath, 'account')] })
      expect(resolved.errors).toEqual([])
      const result = await runner.run({ ...context(root), targets: resolved.targets })
      expect(result.results).toMatchObject([{ status: 'fail', diagnostic: expect.stringMatching(/report|exited/u) }])
    }
  }, 300000)

  it('bounds cancellation and terminates owned workers', async () => {
    const action = `await File.WriteAllTextAsync("starting", Environment.ProcessId.ToString());
            File.Move("starting", "started");
            for (;;) await Task.Delay(50);`
    const root = await project(nativeSource([{ id: 'account', given: '5', when: '5', expect: '0' }], action))
    const controller = new AbortController()
    let completed = false
    const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector(suitePath, 'account')] })
    expect(resolved.errors).toEqual([])
    const operation = runner.run({ ...context(root, controller.signal), targets: resolved.targets }).then(
      () => 'resolved',
      error => error instanceof Error ? error.name : String(error),
    )
    void operation.then(() => { completed = true })
    const deadline = Date.now() + 240000
    while (true) {
      try { await stat(join(root, 'started')); break } catch (error) {
        if (completed) throw new Error(`worker stopped before readiness: ${await operation}`)
        if (Date.now() > deadline) throw error
        await delay(25)
      }
    }
    const pid = Number(await readFile(join(root, 'started'), 'utf8'))
    expect(Number.isSafeInteger(pid) && pid > 0).toBe(true)
    const abortedAt = Date.now()
    controller.abort()
    expect(await operation).toBe('AbortError')
    expect(Date.now() - abortedAt).toBeLessThan(5000)
    if (process.platform !== 'win32') expect(() => process.kill(pid, 0)).toThrow()
    expect((await readdir(join(root, 'obj'))).filter(name => name.startsWith('focused-spec-dotnet-bridge-'))).toEqual([])
  }, 300000)

  it('retains application explanations and mismatch observations', async () => {
    const source = `using FocusedSpec.Scenarios;
namespace Consumer;
public sealed record AccountEvent(string Type, int Cents);
public static class Specifications
{
    public static readonly ScenarioSuite<object, object, object> Suite = new([
        new("mismatch", "Typed mismatch", new AccountEvent("Opened", 0), new AccountEvent("Withdraw", 5000), new AccountEvent("Expected", 5000)),
    ], new ScenarioDriverBinding("Suite.cs", "Consumer.Specifications.Driver"));
    public static ScenarioDriver<object, object, object, object> Driver => new()
    {
        Given = (value, _) => ValueTask.FromResult(value),
        When = (subject, command, context) => { context.Explain("Withdrawal allowed", new { requestedCents = 5000, availableCents = 5000 }); return ValueTask.FromResult<object>(new AccountEvent("Actual", 4999)); },
    };
}
`
    const root = await project(source)
    const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector(suitePath, 'mismatch')] })
    expect(resolved.errors).toEqual([])
    const result = await runner.run({ ...context(root), targets: resolved.targets })
    expect(result.results[0]).toMatchObject({
      status: 'fail',
      diagnostic: expect.stringContaining('Expected'),
      events: expect.arrayContaining([
        { kind: 'explanation', message: 'Withdrawal allowed', data: { requestedCents: 5000, availableCents: 5000 } },
        { kind: 'observation', message: 'Actual', data: { value: { Type: 'Actual', Cents: 4999 } } },
      ]),
    })
  }, 300000)

  it('runs canonical bank through CLI and detects restored regression', async () => {
    const root = await mkdtemp(join(temporary, 'bank-regression-'))
    const filter = (path: string) => !['bin', 'obj'].includes(basename(path))
    await cp(join(repository, 'examples/scenarios/dotnet'), join(root, 'examples/scenarios/dotnet'), { recursive: true, filter })
    await cp(join(repository, 'packages/sdk/dotnet/FocusedSpec.Scenarios'), join(root, 'packages/sdk/dotnet/FocusedSpec.Scenarios'), { recursive: true, filter })
    const consumer = join(root, 'examples/scenarios/dotnet')
    await symlink(join(repository, 'node_modules'), join(consumer, 'node_modules'), 'dir')
    const tests = ['test', 'ScenarioBank.Tests/ScenarioBank.Tests.csproj', '--nologo']
    const selected = () => cli(consumer, ['run', '--scenario', 'account.withdraw.entire-balance'])
    const all = () => cli(consumer, ['run'])
    passed(command(consumer, 'dotnet', tests))
    passed(selected())
    passed(all())
    const account = join(consumer, 'Bank/Account.cs')
    const original = await readFile(account, 'utf8')
    try {
      const regression = original.replace('command.Cents > _balance', 'command.Cents >= _balance')
      expect(regression).not.toBe(original)
      await writeFile(account, regression)
      const native = command(consumer, 'dotnet', tests)
      expect(native.status, native.stdout + native.stderr).toBe(1)
      expect(native.stdout + native.stderr).toContain('account.withdraw.entire-balance')
      const focused = selected()
      expect(focused.status).toBe(1)
      expect(JSON.parse(focused.stdout)).toMatchObject({ scenarios: [{ id: 'account.withdraw.entire-balance', status: 'FAIL' }] })
    } finally {
      await writeFile(account, original)
    }
    expect(await readFile(account, 'utf8')).toBe(original)
    passed(command(consumer, 'dotnet', tests))
    const restored = all()
    passed(restored)
    expect(JSON.parse(restored.stdout).scenarios).toHaveLength(6)
    expect(JSON.parse(restored.stdout).scenarios.every((scenario: { status: string }) => scenario.status === 'PASS')).toBe(true)
  }, 300000)
})
