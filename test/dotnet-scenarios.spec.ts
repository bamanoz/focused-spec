import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repository = fileURLToPath(new URL('..', import.meta.url))
const sdkProject = join(repository, 'packages/sdk/dotnet/FocusedSpec.Scenarios/FocusedSpec.Scenarios.csproj')
const sdkTests = join(repository, 'packages/sdk/dotnet/FocusedSpec.Scenarios.Tests/FocusedSpec.Scenarios.Tests.csproj')
const bankTests = join(repository, 'examples/scenarios/dotnet/ScenarioBank.Tests/ScenarioBank.Tests.csproj')
let temporary: string

function run(cwd: string, executable: string, args: string[], timeout = 300_000) {
  return spawnSync(executable, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 8_000_000 })
}

function passed(result: ReturnType<typeof run>) {
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
}

function sdkTest(filter: string) {
  const result = run(repository, 'dotnet', ['test', sdkTests, '--filter', `FullyQualifiedName~${filter}`, '--nologo'])
  passed(result)
  expect(result.stdout).toMatch(/Passed:\s+1/)
}

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'focused-spec-dotnet-'))
}, 60_000)

afterAll(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true })
})

describe('dotnet executable scenarios', () => {
  it('runs the packed SDK without focused-spec', async () => {
    const feed = join(temporary, 'feed')
    await mkdir(feed, { recursive: true })
    const packed = run(repository, 'dotnet', ['pack', sdkProject, '--configuration', 'Release', '--output', feed, '--nologo'])
    passed(packed)

    const consumer = join(temporary, 'consumer')
    await mkdir(consumer, { recursive: true })
    await writeFile(join(consumer, 'NuGet.config'), `<?xml version="1.0" encoding="utf-8"?>
<configuration><packageSources><clear /><add key="local" value="${feed}" /><add key="nuget.org" value="https://api.nuget.org/v3/index.json" /></packageSources></configuration>`)
    await writeFile(join(consumer, 'consumer.csproj'), `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net9.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>enable</ImplicitUsings></PropertyGroup>
  <ItemGroup><PackageReference Include="FocusedSpec.Scenarios" Version="0.1.0" /></ItemGroup>
</Project>`)
    await writeFile(join(consumer, 'Program.cs'), `using FocusedSpec.Scenarios;
var scenario = new Scenario<int, int, int>("account.deposit", "Deposit", 100, 25, 125);
var driver = new ScenarioDriver<int, int, int, int>
{
    Given = (value, _) => ValueTask.FromResult(value),
    When = (subject, command, _) => ValueTask.FromResult(subject + command),
};
var actual = await ScenarioExecutor.VerifyAsync(driver, scenario);
if (actual != 125) throw new InvalidOperationException("unexpected actual");
Console.WriteLine("packed-sdk-ok");`)
    const result = run(consumer, 'dotnet', ['run', '--nologo'])
    passed(result)
    const libraries = run(consumer, 'dotnet', ['list', 'package', '--format', 'json'])
    passed(libraries)
    const packageReport = JSON.parse(libraries.stdout) as { projects: { frameworks: { topLevelPackages?: { id: string }[] }[] }[] }
    const packages = packageReport.projects.flatMap(project => project.frameworks.flatMap(framework => framework.topLevelPackages ?? [])).map(item => item.id)
    expect(packages).toEqual(['FocusedSpec.Scenarios'])
  }, 300_000)

  it('rejects invalid declarations before driver execution', () => {
    sdkTest('InvalidSuiteDoesNotInvokeDriver')
  }, 300_000)

  it('compares typed results exactly and isolates declarations', () => {
    sdkTest('MismatchRetainsIdentityAndExpectedActualSnapshots')
    sdkTest('TypeAndNullEmptyDifferencesAreNotEqual')
    sdkTest('NestedMutableValuesRemainIsolatedFromDriverAndCleanup')
  }, 300_000)

  it('preserves execution and cleanup failures', () => {
    sdkTest('CleanupRunsOnceAndPreservesPrimaryAndReleaseFailures')
  }, 300_000)

  it('retains cleanup after cancellation', () => {
    sdkTest('CancellationStillRunsCleanupAndCannotPassMatchingResult')
  }, 300_000)

  it('reports ordered execution events', () => {
    sdkTest('EventsAreOptionalOrderedAndIndependentSnapshots')
  }, 300_000)

  it('runs the maintained xUnit bank consumer', async () => {
    const bank = join(temporary, 'bank')
    const filter = (path: string) => !['bin', 'obj'].includes(basename(path))
    await cp(join(repository, 'examples/scenarios/dotnet'), join(bank, 'examples/scenarios/dotnet'), { recursive: true, filter })
    await cp(join(repository, 'packages/sdk/dotnet/FocusedSpec.Scenarios'), join(bank, 'packages/sdk/dotnet/FocusedSpec.Scenarios'), { recursive: true, filter })
    const args = ['test', 'examples/scenarios/dotnet/ScenarioBank.Tests/ScenarioBank.Tests.csproj', '--nologo']
    passed(run(bank, 'dotnet', args))
    passed(run(bank, 'dotnet', ['run', '--project', 'examples/scenarios/dotnet/ScenarioBank.Demo/ScenarioBank.Demo.csproj', '--nologo']))
    const path = join(bank, 'examples/scenarios/dotnet/Bank/Account.cs')
    const source = await readFile(path, 'utf8')
    const regression = source.replace('command.Cents > _balance', 'command.Cents >= _balance')
    expect(regression).not.toBe(source)
    await writeFile(path, regression)
    const broken = run(bank, 'dotnet', args)
    expect(broken.status, broken.stdout + broken.stderr).toBe(1)
    expect(broken.stdout + broken.stderr).toMatch(/ScenarioMismatchException.*account\.withdraw\.entire-balance/s)
    await writeFile(path, source)
    passed(run(bank, 'dotnet', args))
  }, 300_000)
})
