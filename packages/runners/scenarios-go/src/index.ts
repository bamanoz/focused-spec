import { mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { decodeSelector, readCatalog, readDriver } from '@focused-spec/format-scenarios-go/catalog'
import { retainExecutionEvents } from 'focused-spec/runner'
import type { ExecutionEvent, ResolvedTarget, RunnerPlugin, TargetResult } from 'focused-spec/runner'
import { execute, OUTPUT_LIMIT } from './process.js'

function options(value: unknown): void {
  if (value !== null && value !== undefined && (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 0)) throw new Error('Go scenario runner options must be null or an empty object')
}

async function contained(root: string, path: string): Promise<string> {
  const canonical = await realpath(path)
  const part = relative(root, canonical)
  if (part === '..' || part.startsWith(`..${sep}`) || isAbsolute(part)) throw new Error(`path escapes the project: ${path}`)
  return canonical
}

async function source(root: string, path: string): Promise<string> {
  const canonical = await contained(root, path)
  const info = await stat(canonical)
  if (!info.isFile() || info.size > OUTPUT_LIMIT) throw new Error(`expected a Go source file no larger than ${OUTPUT_LIMIT} bytes: ${path}`)
  return readFile(canonical, 'utf8')
}

async function selected(projectRoot: string, selector: string, signal: AbortSignal) {
  signal.throwIfAborted()
  const root = await realpath(projectRoot)
  const [path, id] = decodeSelector(selector)
  const suitePath = await contained(root, resolve(root, path))
  const catalog = await readCatalog(path, await source(root, suitePath), signal)
  const entry = catalog.scenarios.find(entry => entry.id === id)
  if (!entry) throw new Error(`scenario not found: ${id} in ${path}`)
  const binding = catalog.suite.driver
  if (basename(binding.path) !== binding.path || binding.path.includes('\\') || !binding.path.endsWith('.go') || binding.path.endsWith('_test.go')) throw new Error('driver must name a Go source file in the suite package')
  const driverPath = resolve(dirname(suitePath), binding.path)
  const driver = await readDriver(binding.path, await source(root, driverPath), binding.exportName, signal)
  if (driver.packageName !== catalog.suite.packageName) throw new Error('driver must belong to the suite package')
  return { root, path, suitePath, catalog, entry }
}

type Selected = Awaited<ReturnType<typeof selected>>

function bridge(importPath: string, suite: string, driver: string): string {
  return `package main
import (
 "context"
 "encoding/json"
 "fmt"
 "os"
 "os/signal"
 "syscall"
 scenarios "github.com/bamanoz/focused-spec/packages/sdk/go"
 application ${JSON.stringify(importPath)}
)
type selection struct { ID string; Name string }
type request struct { Selected []selection; DriverPath string; DriverExport string }
type event struct { Kind string \`json:"kind"\`; Message string \`json:"message"\`; Data any \`json:"data,omitempty"\` }
type result struct { ID string \`json:"id"\`; Status string \`json:"status"\`; Diagnostic string \`json:"diagnostic,omitempty"\`; Events []event \`json:"events"\` }
type collector struct { events []event; bytes int; stopped bool }
func (c *collector) emit(value scenarios.ExecutionEvent) {
 var record event
 switch value := value.(type) {
 case scenarios.ObservationEvent: record = event{Kind:value.Kind, Message:value.Name, Data:map[string]any{"value":value.Value}}
 case scenarios.TextObservationEvent: record = event{Kind:value.Kind, Message:value.Name, Data:map[string]any{"text":value.Text}}
 case scenarios.ExplanationEvent: record = event{Kind:value.Kind, Message:value.Message, Data:value.Data}
 case scenarios.TruncatedEvent: record = event{Kind:value.Kind, Message:value.Message}
 default: panic("unsupported SDK execution event")
 }
 c.retain(record)
}
func (c *collector) retain(record event) {
 if c.stopped { return }
 encoded, err := json.Marshal(record); if err != nil { panic(err) }
 marker := event{Kind:"truncated", Message:"Additional execution events omitted"}
 encodedMarker, err := json.Marshal(marker); if err != nil { panic(err) }
 separator := 0; if len(c.events) != 0 { separator = 1 }
 if len(c.events) >= 255 || c.bytes+separator+len(encoded)+1+len(encodedMarker) > 65536 { c.events = append(c.events, marker); c.stopped = true; return }
 c.events = append(c.events, record); c.bytes += separator+len(encoded)
}
func main() {
 ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM); defer stop()
 var input request
 if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil { panic(err) }
 suite := application.${suite}
 if err := scenarios.ValidateSuite(suite); err != nil { panic(err) }
 if suite.Driver.Path != input.DriverPath || suite.Driver.Export != input.DriverExport { panic("runtime driver binding changed") }
 results := make([]result, 0, len(input.Selected))
 for _, selected := range input.Selected {
  collected := collector{events:make([]event,0), bytes:2}
  outcome := result{ID:selected.ID, Status:"fail", Diagnostic:"scenario not found at execution", Events:collected.events}
  for _, scenario := range suite.Scenarios {
   if scenario.ID != selected.ID { continue }
   if scenario.Name != selected.Name { panic("runtime scenario identity changed") }
   executionContext := scenarios.WithEvents(ctx, collected.emit)
   _, err := scenarios.VerifySpecification(executionContext, application.${driver}, scenario)
   outcome.Diagnostic = ""
   outcome.Events = collected.events
   if err != nil { outcome.Diagnostic = fmt.Sprint(err) } else { outcome.Status = "pass" }
   break
  }
  results = append(results, outcome)
 }
 report, err := os.OpenFile(os.Args[1], os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600); if err != nil { panic(err) }
 if err := json.NewEncoder(report).Encode(struct{ Protocol int \`json:"protocol"\`; Results []result \`json:"results"\` }{1,results}); err != nil { panic(err) }
 if err := report.Close(); err != nil { panic(err) }
}
`
}

async function moduleRoot(value: Selected): Promise<string> {
  let directory = dirname(value.suitePath)
  for (;;) {
    try {
      const module = await contained(value.root, join(directory, 'go.mod'))
      if ((await stat(module)).isFile()) return directory
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (directory === value.root) throw new Error('Go scenario suite requires a project-contained go.mod')
    const parent = dirname(directory)
    if (parent === directory) throw new Error('Go module not found')
    directory = parent
  }
}

function reportResults(text: string, targets: readonly ResolvedTarget[]): TargetResult[] {
  const report: unknown = JSON.parse(text)
  if (!report || typeof report !== 'object' || !('protocol' in report) || report.protocol !== 1 || !('results' in report) || !Array.isArray(report.results) || report.results.length !== targets.length) throw new Error('invalid or missing selected Go execution report')
  const entries = new Map<string, { status: 'pass' | 'fail'; diagnostic?: string; events?: readonly ExecutionEvent[] }>()
  for (const entry of report.results as unknown[]) {
    if (!entry || typeof entry !== 'object' || !('id' in entry) || typeof entry.id !== 'string' || !('status' in entry) || (entry.status !== 'pass' && entry.status !== 'fail') || entries.has(entry.id)) throw new Error('invalid or duplicate Go execution result')
    const diagnostic = 'diagnostic' in entry ? entry.diagnostic : undefined
    if (diagnostic !== undefined && typeof diagnostic !== 'string') throw new Error('invalid Go diagnostic')
    const events = Object.hasOwn(entry, 'events') ? retainExecutionEvents((entry as Record<string, unknown>).events) : undefined
    entries.set(entry.id, { status: entry.status, ...(diagnostic === undefined ? {} : { diagnostic: diagnostic.slice(-8000) }), ...(events === undefined ? {} : { events }) })
  }
  return targets.map(target => {
    const [, id] = decodeSelector(target.selector)
    const entry = entries.get(id)
    if (!entry) throw new Error(`selected Go execution report missing: ${id}`)
    return { targetId: target.targetId, ...entry }
  })
}

async function runSuite(value: Selected, targets: readonly ResolvedTarget[], signal: AbortSignal): Promise<TargetResult[]> {
  const module = await moduleRoot(value)
  const packagePath = `./${relative(module, dirname(value.suitePath)).split(sep).join('/')}`
  const discovery = await execute('go', ['list', '-find', '-json', packagePath], module, signal)
  if (discovery.code !== 0) throw new Error(discovery.stderr || discovery.stdout || 'Go package discovery failed')
  const metadata = JSON.parse(discovery.stdout) as { ImportPath?: unknown; Name?: unknown; GoFiles?: unknown }
  const importPath = metadata.ImportPath
  if (typeof importPath !== 'string' || !/^[A-Za-z0-9._~+\-/]+$/u.test(importPath) || metadata.Name === 'main' || !Array.isArray(metadata.GoFiles) || !metadata.GoFiles.includes(basename(value.suitePath)) || !metadata.GoFiles.includes(value.catalog.suite.driver.path)) throw new Error('Go suite and driver must be active files in an importable package')
  const temporary = await mkdtemp(join(module, 'focused-scenario-'))
  try {
    await writeFile(join(temporary, 'main.go'), bridge(importPath, value.catalog.suite.exportName, value.catalog.suite.driver.exportName))
    const executable = join(temporary, process.platform === 'win32' ? 'bridge.exe' : 'bridge')
    const built = await execute('go', ['build', '-o', executable, `./${basename(temporary)}`], module, signal)
    if (built.code !== 0) throw new Error(built.stderr || built.stdout || 'Go scenario bridge compilation failed')
    const selectedEntries = targets.map(target => {
      const [, id] = decodeSelector(target.selector)
      const entry = value.catalog.scenarios.find(entry => entry.id === id)
      if (!entry) throw new Error(`scenario not found: ${id}`)
      return { ID: entry.id, Name: entry.name }
    })
    const reportPath = join(temporary, 'report.json')
    const outcome = await execute(executable, [reportPath], module, signal, JSON.stringify({ Selected: selectedEntries, DriverPath: value.catalog.suite.driver.path, DriverExport: value.catalog.suite.driver.exportName }))
    if (outcome.code !== 0) throw new Error(outcome.stderr || outcome.stdout || `Go scenario bridge exited ${outcome.code}`)
    try {
      if ((await stat(reportPath)).size > OUTPUT_LIMIT) throw new Error('Go report exceeds 4000000 bytes')
      return reportResults(await readFile(reportPath, 'utf8'), targets)
    } catch (error) {
      throw new Error(`invalid or missing selected Go execution report: ${error instanceof Error ? error.message : String(error)}`)
    }
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

export default {
  apiVersion: 1,
  async resolve(request) {
    options(request.options)
    const targets: ResolvedTarget[] = []
    const errors: { selector: string; message: string }[] = []
    for (const selector of request.selectors) {
      try {
        const value = await selected(request.projectRoot, selector, request.signal)
        targets.push({ selector, targetId: selector, displayName: value.entry.name, source: { path: value.path, line: value.entry.line } })
      } catch (error) {
        request.signal.throwIfAborted()
        errors.push({ selector, message: error instanceof Error ? error.message : String(error) })
      }
    }
    return { targets, errors }
  },
  async run(request) {
    options(request.options)
    const results: TargetResult[] = []
    const groups = new Map<string, { value: Selected; targets: ResolvedTarget[] }>()
    for (const target of request.targets) {
      try {
        if (target.targetId !== target.selector) throw new Error('Go target identity does not match selector')
        const value = await selected(request.projectRoot, target.selector, request.signal)
        const group = groups.get(value.path)
        if (group) group.targets.push(target)
        else groups.set(value.path, { value, targets: [target] })
      } catch (error) {
        request.signal.throwIfAborted()
        results.push({ targetId: target.targetId, status: 'fail', diagnostic: String(error).slice(-8000) })
      }
    }
    for (const { value, targets } of groups.values()) {
      try { results.push(...await runSuite(value, targets, request.signal)) }
      catch (error) {
        request.signal.throwIfAborted()
        results.push(...targets.map(target => ({ targetId: target.targetId, status: 'fail' as const, diagnostic: String(error).slice(-8000) })))
      }
    }
    return { results }
  },
} satisfies RunnerPlugin
