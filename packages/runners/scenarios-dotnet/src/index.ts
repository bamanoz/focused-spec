import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeSelector, readCatalog, readDriver } from '@focused-spec/format-scenarios-dotnet/catalog'
import type { Catalog, CatalogScenario } from '@focused-spec/format-scenarios-dotnet/catalog'
import { retainExecutionEvents } from 'focused-spec/runner'
import type { ExecutionEvent, ResolvedTarget, RunnerPlugin, TargetResult } from 'focused-spec/runner'
import { execute, OUTPUT_LIMIT } from './process.js'

const BRIDGE = fileURLToPath(new URL('./dotnet/Bridge.cs.txt', import.meta.url))

interface Options {
  readonly project: string
  readonly framework: string
  readonly command: string
}

function options(value: unknown): Options {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('.NET scenario runner requires { project, framework, command? }')
  const fields = Object.keys(value)
  if (fields.some(field => field !== 'project' && field !== 'framework' && field !== 'command')
    || !('project' in value) || typeof value.project !== 'string' || !('framework' in value) || typeof value.framework !== 'string'
    || ('command' in value && typeof value.command !== 'string')) throw new Error('.NET scenario runner requires { project, framework, command? }')
  if (!value.project || isAbsolute(value.project) || /^[a-z]:/iu.test(value.project) || /[\\\u0000-\u001f\u007f-\u009f]/u.test(value.project)
    || value.project.split('/').some(part => part === '' || part === '.' || part === '..') || !value.project.toLowerCase().endsWith('.csproj')) {
    throw new Error('.NET project must be one contained project-relative .csproj path')
  }
  if (!/^net(?:9|[1-9][0-9]+)\.0$/u.test(value.framework)) throw new Error('.NET framework must be an explicit net9.0 or newer target framework')
  const command = 'command' in value ? value.command as string : 'dotnet'
  if (!command || command !== command.trim() || /[\u0000-\u001f\u007f-\u009f]/u.test(command) || (!isAbsolute(command) && /[\\/\s]/u.test(command))) throw new Error('.NET command must be one executable name or absolute path')
  return { project: value.project, framework: value.framework, command }
}

async function contained(root: string, path: string, label: string): Promise<string> {
  const canonical = await realpath(path)
  const part = relative(root, canonical)
  if (part === '..' || part.startsWith(`..${sep}`) || isAbsolute(part)) throw new Error(`${label} escapes the project: ${path}`)
  const information = await stat(canonical)
  if (!information.isFile()) throw new Error(`${label} must be a file: ${path}`)
  return canonical
}

async function source(root: string, path: string, label: string): Promise<string> {
  const canonical = await contained(root, path, label)
  const information = await stat(canonical)
  if (information.size > OUTPUT_LIMIT) throw new Error(`${label} exceeds 4000000 bytes: ${path}`)
  return readFile(canonical, 'utf8')
}

interface Selected {
  readonly root: string
  readonly path: string
  readonly projectPath: string
  readonly catalog: Catalog
  readonly entry: CatalogScenario
}

async function selected(projectRoot: string, selector: string, configured: Options, signal: AbortSignal): Promise<Selected> {
  signal.throwIfAborted()
  const root = await realpath(projectRoot)
  const [path, id] = decodeSelector(selector)
  const suitePath = await contained(root, resolve(root, path), '.NET suite source')
  const catalog = await readCatalog(path, await source(root, suitePath, '.NET suite source'), signal, configured.command)
  const entry = catalog.scenarios.find(scenario => scenario.id === id)
  if (entry === undefined) throw new Error(`scenario not found: ${id} in ${path}`)
  const driverPath = await contained(root, resolve(dirname(suitePath), catalog.suite.driver.path), '.NET driver source')
  await readDriver(catalog.suite.driver.path, await source(root, driverPath, '.NET driver source'), catalog.suite.driver.exportName, signal, configured.command)
  const projectPath = await contained(root, resolve(root, configured.project), '.NET consumer project')
  signal.throwIfAborted()
  return { root, path, projectPath, catalog, entry }
}

function bridgeProject(project: string, framework: string): string {
  const reference = project.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>${framework}</TargetFramework>
    <Nullable>enable</Nullable>
    <AssemblyName>FocusedSpec.Bridge</AssemblyName>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
    <UseAppHost>false</UseAppHost>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="Bridge.cs" />
    <ProjectReference Include="${reference}" />
  </ItemGroup>
</Project>
`
}

function parseReport(text: string, targets: readonly ResolvedTarget[]): TargetResult[] {
  let report: unknown
  try { report = JSON.parse(text) } catch { throw new Error('malformed selected .NET execution report') }
  if (report === null || typeof report !== 'object' || Array.isArray(report) || Object.keys(report).some(key => key !== 'protocol' && key !== 'results')
    || !('protocol' in report) || report.protocol !== 1 || !('results' in report) || !Array.isArray(report.results)
    || report.results.length !== targets.length) {
    throw new Error('invalid or missing selected .NET execution report')
  }
  const expected = new Set(targets.map(target => decodeSelector(target.selector)[1]))
  const entries = new Map<string, { status: 'pass' | 'fail'; diagnostic?: string; events: readonly ExecutionEvent[] }>()
  for (const candidate of report.results as unknown[]) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)
      || Object.keys(candidate).some(key => key !== 'id' && key !== 'status' && key !== 'diagnostic' && key !== 'events')
      || !('id' in candidate) || typeof candidate.id !== 'string' || !expected.has(candidate.id) || entries.has(candidate.id)
      || !('status' in candidate) || (candidate.status !== 'pass' && candidate.status !== 'fail') || !Object.hasOwn(candidate, 'events')) {
      throw new Error('invalid or duplicate selected .NET execution result')
    }
    const diagnostic = 'diagnostic' in candidate ? candidate.diagnostic : undefined
    if (diagnostic !== undefined && diagnostic !== null && typeof diagnostic !== 'string') throw new Error('invalid .NET execution diagnostic')
    const events = retainExecutionEvents((candidate as Record<string, unknown>).events)
    entries.set(candidate.id, {
      status: candidate.status,
      ...(typeof diagnostic === 'string' ? { diagnostic: diagnostic.slice(-8000) } : {}),
      events,
    })
  }
  return targets.map(target => {
    const id = decodeSelector(target.selector)[1]
    const result = entries.get(id)
    if (result === undefined) throw new Error(`selected .NET execution report missing: ${id}`)
    return { targetId: target.targetId, ...result }
  })
}

async function runSuite(value: Selected, targets: readonly ResolvedTarget[], configured: Options, signal: AbortSignal): Promise<TargetResult[]> {
  const bridgeRoot = join(dirname(value.projectPath), 'obj')
  await mkdir(bridgeRoot, { recursive: true })
  const temporary = await mkdtemp(join(bridgeRoot, 'focused-spec-dotnet-bridge-'))
  try {
    const project = join(temporary, 'FocusedSpec.Bridge.csproj')
    const bridge = join(temporary, 'Bridge.cs')
    const output = join(temporary, 'output')
    const requestPath = join(temporary, 'request.json')
    const reportPath = join(temporary, 'report.json')
    const cancellationPath = join(temporary, 'cancel')
    await copyFile(BRIDGE, bridge)
    await writeFile(project, bridgeProject(value.projectPath, configured.framework))
    const request = JSON.stringify({
      protocol: 1,
      suiteType: value.catalog.suite.typeName,
      suiteMember: value.catalog.suite.exportName,
      driverPath: value.catalog.suite.driver.path,
      driverExport: value.catalog.suite.driver.exportName,
      inventory: value.catalog.scenarios.map(scenario => ({ id: scenario.id, name: scenario.name })),
      selected: targets.map(target => {
        const id = decodeSelector(target.selector)[1]
        const scenario = value.catalog.scenarios.find(candidate => candidate.id === id)
        if (scenario === undefined) throw new Error(`scenario not found before .NET execution: ${id}`)
        return { id: scenario.id, name: scenario.name }
      }),
    })
    if (Buffer.byteLength(request) > OUTPUT_LIMIT) throw new Error('.NET bridge request exceeds 4000000 bytes')
    await writeFile(requestPath, request, { flag: 'wx' })
    const environment = {
      ...process.env,
      DOTNET_CLI_HOME: temporary,
      DOTNET_NOLOGO: '1',
      DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
      DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    }
    const built = await execute(configured.command, ['build', project, '--configuration', 'Release', '--framework', configured.framework, '--output', output, '--nologo', '-p:UseAppHost=false'], { cwd: value.root, signal, environment })
    if (built.code !== 0) throw new Error(built.stderr || built.stdout || '.NET scenario bridge build failed')
    const executed = await execute(configured.command, [join(output, 'FocusedSpec.Bridge.dll'), requestPath, reportPath, cancellationPath], {
      cwd: value.root,
      signal,
      environment,
      cancellationPath,
    })
    if (executed.code !== 0) throw new Error(executed.stderr || executed.stdout || `.NET scenario bridge exited ${executed.code}`)
    let report: string
    try {
      const information = await stat(reportPath)
      if (!information.isFile() || information.size > OUTPUT_LIMIT) throw new Error('.NET report is missing or exceeds 4000000 bytes')
      report = await readFile(reportPath, 'utf8')
    } catch (error) {
      throw new Error(`invalid or missing selected .NET execution report: ${error instanceof Error ? error.message : String(error)}`)
    }
    return parseReport(report, targets)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

export default {
  apiVersion: 1,
  async resolve(request) {
    const configured = options(request.options)
    const targets: ResolvedTarget[] = []
    const errors: { selector: string; message: string }[] = []
    for (const selector of request.selectors) {
      try {
        const value = await selected(request.projectRoot, selector, configured, request.signal)
        targets.push({ selector, targetId: selector, displayName: value.entry.name, source: { path: value.path, line: value.entry.line } })
      } catch (error) {
        request.signal.throwIfAborted()
        errors.push({ selector, message: error instanceof Error ? error.message : String(error) })
      }
    }
    return { targets, errors }
  },
  async run(request) {
    const configured = options(request.options)
    const results: TargetResult[] = []
    const groups = new Map<string, { value: Selected; targets: ResolvedTarget[] }>()
    for (const target of request.targets) {
      try {
        if (target.targetId !== target.selector) throw new Error('.NET target identity does not match selector')
        const value = await selected(request.projectRoot, target.selector, configured, request.signal)
        if (value.entry.name !== target.displayName) throw new Error('selected .NET scenario identity changed after resolution')
        const group = groups.get(value.path)
        if (group) group.targets.push(target)
        else groups.set(value.path, { value, targets: [target] })
      } catch (error) {
        request.signal.throwIfAborted()
        results.push({ targetId: target.targetId, status: 'fail', diagnostic: String(error).slice(-8000) })
      }
    }
    for (const group of groups.values()) {
      try { results.push(...await runSuite(group.value, group.targets, configured, request.signal)) }
      catch (error) {
        request.signal.throwIfAborted()
        results.push(...group.targets.map(target => ({ targetId: target.targetId, status: 'fail' as const, diagnostic: String(error).slice(-8000) })))
      }
    }
    return { results }
  },
} satisfies RunnerPlugin
