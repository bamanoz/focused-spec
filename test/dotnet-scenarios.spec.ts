import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repository = fileURLToPath(new URL('..', import.meta.url))
let sdkProject: string
let sdkTests: string
const bankTests = join(repository, 'examples/scenarios/dotnet/ScenarioBank.Tests/ScenarioBank.Tests.csproj')
let temporary: string

function run(cwd: string, executable: string, args: string[], timeout = 300_000) {
  return spawnSync(executable, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 8_000_000 })
}

function passed(result: ReturnType<typeof run>) {
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
}

function sdkTest(filter: string) {
  const result = run(temporary, 'dotnet', ['test', sdkTests, '--filter', `FullyQualifiedName~${filter}`, '--nologo'])
  passed(result)
  expect(result.stdout).toMatch(/Passed:\s+1/)
}

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'focused-spec-dotnet-'))
  const sdk = join(temporary, 'sdk')
  await cp(join(repository, 'packages/sdk/dotnet'), sdk, {
    recursive: true,
    filter: path => !['bin', 'obj'].includes(basename(path)),
  })
  sdkProject = join(sdk, 'FocusedSpec.Scenarios/FocusedSpec.Scenarios.csproj')
  sdkTests = join(sdk, 'FocusedSpec.Scenarios.Tests/FocusedSpec.Scenarios.Tests.csproj')
}, 60_000)

afterAll(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true })
})

describe('dotnet executable scenarios', () => {
  it('runs the packed SDK without focused-spec', async () => {
    const release = join(temporary, 'release')
    await mkdir(release, { recursive: true })
    passed(run(temporary, 'dotnet', ['pack', sdkProject, '--configuration', 'Release', '--output', release, '--nologo']))
    const packageFile = (await readdir(release)).find(name => name.endsWith('.nupkg'))!
    expect(packageFile).toBeDefined()
    const packageBytes = await readFile(join(release, packageFile))
    const checksum = createHash('sha256').update(packageBytes).digest('hex')
    const projectSource = await readFile(sdkProject, 'utf8')
    const version = projectSource.match(/<Version>([^<]+)<\/Version>/u)![1]!

    for (const framework of ['net8.0', 'net10.0']) {
      const consumer = join(temporary, `consumer-${framework}`)
      const feed = join(consumer, '.nuget', 'local-feed')
      await mkdir(feed, { recursive: true })
      const packagePath = join(feed, packageFile)
      await writeFile(packagePath, packageBytes)
      expect(createHash('sha256').update(await readFile(packagePath)).digest('hex')).toBe(checksum)
      await writeFile(join(consumer, 'NuGet.config'), `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="existing" value="https://example.invalid/v3/index.json" />
    <add key="focused-spec-local" value=".nuget/local-feed" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
  <packageSourceMapping>
    <clear />
    <packageSource key="existing"><package pattern="Existing.*" /></packageSource>
    <packageSource key="focused-spec-local"><package pattern="FocusedSpec.Scenarios" /></packageSource>
    <packageSource key="nuget.org"><package pattern="Microsoft.*" /><package pattern="System.*" /></packageSource>
  </packageSourceMapping>
</configuration>`)
      await writeFile(join(consumer, 'consumer.csproj'), `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>${framework}</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>enable</ImplicitUsings><RestorePackagesPath>.nuget/packages</RestorePackagesPath></PropertyGroup>
  <ItemGroup><PackageReference Include="FocusedSpec.Scenarios" Version="${version}" /></ItemGroup>
</Project>`)
      await writeFile(join(consumer, 'Program.cs'), `using System.IO.Compression;
using System.Xml.Linq;
using FocusedSpec.Scenarios;
using var archive = ZipFile.OpenRead(args[0]);
var targets = archive.Entries.Where(entry => entry.FullName.EndsWith("/FocusedSpec.Scenarios.dll", StringComparison.Ordinal)).Select(entry => entry.FullName).OrderBy(value => value).ToArray();
if (!targets.SequenceEqual(new[] { "lib/net10.0/FocusedSpec.Scenarios.dll", "lib/net8.0/FocusedSpec.Scenarios.dll" })) throw new Exception("incorrect packed target assets");
using var nuspecStream = archive.Entries.Single(entry => entry.FullName.EndsWith(".nuspec", StringComparison.Ordinal)).Open();
var nuspec = XDocument.Load(nuspecStream);
var metadata = nuspec.Descendants().Single(element => element.Name.LocalName == "metadata");
string? Metadata(string name) => metadata.Elements().SingleOrDefault(element => element.Name.LocalName == name)?.Value;
if (Metadata("id") != "FocusedSpec.Scenarios" || Metadata("version") != args[1] || Metadata("license") != "MIT" || Metadata("readme") != "README.md") throw new Exception("incorrect NuGet metadata");
var repository = metadata.Elements().Single(element => element.Name.LocalName == "repository");
if ((string?)repository.Attribute("type") != "git" || (string?)repository.Attribute("url") != "https://github.com/bamanoz/focused-spec") throw new Exception("missing repository metadata");
if (metadata.Descendants().Any(element => element.Name.LocalName == "dependency")) throw new Exception("SDK has runtime package dependencies");
if (archive.GetEntry("README.md") is null || archive.GetEntry("LICENSE") is null) throw new Exception("missing package documentation or license");
var scenario = new Scenario<int, int, int>("account.deposit", "Deposit", 100, 25, 125);
var driver = new ScenarioDriver<int, int, int, int>
{
    Given = (value, _) => ValueTask.FromResult(value),
    When = (subject, command, _) => ValueTask.FromResult(subject + command),
};
if (await ScenarioExecutor.VerifyAsync(driver, scenario) != 125) throw new Exception("unexpected actual");
var mismatch = new Scenario<int, int, int>("account.deposit", "Deposit", 100, 25, 124);
try { await ScenarioExecutor.VerifyAsync(driver, mismatch); throw new Exception("incorrect expectation passed"); }
catch (ScenarioMismatchException error) { if (!Equals(error.Expected, 124) || !Equals(error.Actual, 125)) throw; }
Console.WriteLine("packed-sdk-ok");`)
      passed(run(consumer, 'dotnet', ['restore', '--configfile', 'NuGet.config', '--force', '--no-http-cache', '--use-lock-file', '--nologo']))
      const assets = JSON.parse(await readFile(join(consumer, 'obj', 'project.assets.json'), 'utf8')) as {
        libraries: Record<string, unknown>
        targets: Record<string, Record<string, { compile?: Record<string, unknown> }>>
      }
      expect(Object.keys(assets.libraries)).toEqual([`FocusedSpec.Scenarios/${version}`])
      const target = Object.values(assets.targets)[0]![`FocusedSpec.Scenarios/${version}`]!
      expect(Object.keys(target.compile ?? {})).toEqual([`lib/${framework}/FocusedSpec.Scenarios.dll`])
      passed(run(consumer, 'dotnet', ['restore', '--configfile', 'NuGet.config', '--locked-mode', '--nologo']))
      const result = run(consumer, 'dotnet', ['run', '--no-restore', '--', packagePath, version])
      passed(result)
      expect(result.stdout).toContain('packed-sdk-ok')
    }
  }, 300_000)
  it('validates .NET explanations with and without an observer', () => {
    sdkTest('ExplainValidatesDataWithoutObserver')
  }, 300_000)

  it('rejects invalid declarations before driver execution', () => {
    sdkTest('InvalidSuiteDoesNotInvokeDriver')
  }, 300_000)
  it('validates supplied suite bindings without loading drivers', () => {
    sdkTest('ValidateRejectsInvalidDriverBinding')
  }, 300_000)

  it('renders structural mismatch snapshots without user formatting hooks', () => {
    sdkTest('MismatchMessageRendersStructuralValuesWithoutCallingToString')
  }, 300_000)
  it('returns a successful actual snapshot before cleanup mutation', () => {
    sdkTest('SuccessfulActualSnapshotPrecedesCleanup')
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
