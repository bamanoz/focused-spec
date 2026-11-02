import { spawn } from 'node:child_process'
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect } from 'vitest'

export const roots: string[] = []

export const cli = fileURLToPath(new URL('../../packages/core/dist/cli.js', import.meta.url))

export const initTargets: { id: string; skill: string; command: string | null; home: boolean }[] = JSON.parse(await readFile(new URL('./agent-targets.json', import.meta.url), 'utf8'))

interface Layout {
  readonly match: string
  readonly scope?: string
  readonly exclude?: readonly string[]
}

export interface RegistryEntry {
  readonly scope: string
  readonly id: string
  readonly evidence: readonly string[]
  readonly source?: { readonly path: string; readonly nativeId: string }
}

export const openSpecLayouts: readonly Layout[] = [
  { match: 'openspec/specs/**/spec.md', scope: 'current' },
  { match: 'openspec/changes/{scope}/specs/**/spec.md' },
]

export const baselineEntries: readonly RegistryEntry[] = [
  { scope: 'current', id: 'fixture.current.passes', evidence: ['fixture::current'] },
  { scope: 'add', id: 'fixture.future.planned', evidence: ['planned:fixture::future'] },
]

export async function put(root: string, path: string, content: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, content)
}

export function configYaml(
  layouts: readonly Layout[],
  runners: readonly string[] = [
    'runners:',
    '  fixture:',
    '    module: ./runner.ts',
  ],
): string {
  const documents = layouts.flatMap(layout => [
    `    - match: ${JSON.stringify(layout.match)}`,
    `      format: ${layout.match.endsWith('.feature') ? 'gherkin' : 'markdown'}`,
    ...(layout.scope === undefined ? [] : [`      scope: ${layout.scope}`]),
    ...(layout.exclude === undefined ? [] : [
      '      exclude:',
      ...layout.exclude.map(pattern => `        - ${JSON.stringify(pattern)}`),
    ]),
  ])
  return [
    'version: 5',
    'specifications:',
    '  formats:',
    '    markdown:',
    '      package: "@focused-spec/format-registry"',
    '      options:',
    '        parser: { package: "@focused-spec/format-markdown" }',
    '    gherkin:',
    '      package: "@focused-spec/format-registry"',
    '      options:',
    '        parser: { package: "@focused-spec/format-gherkin" }',
    '  documents:',
    ...documents,
    ...runners,
  ].join('\n')
}

export function nativeScenario(id: string, name = id): string {
  return [
    `<!-- focused-spec:id=${id} -->`,
    `#### Scenario: ${name}`,
    '',
    'The configured behavior has its observable result.',
  ].join('\n')
}

export function inlineScenario(id: string, evidence: readonly string[], name = id): string {
  return [
    `#### Scenario: ${name}`,
    `- **ID**: \`${id}\``,
    ...evidence.map(reference => `- **EVIDENCE**: \`${reference}\``),
    '- **WHEN** the configured input is supplied',
    '- **THEN** the configured result is observed',
  ].join('\n')
}

function registryYaml(entries: readonly RegistryEntry[]): string {
  const scopes = new Map<string, RegistryEntry[]>()
  for (const entry of entries) scopes.set(entry.scope, [...(scopes.get(entry.scope) ?? []), entry])
  return [
    'scopes:',
    ...[...scopes].flatMap(([scope, scoped]) => [
      `  ${scope}:`,
      ...scoped.flatMap(entry => [
        `    ${entry.id}:`,
        `      evidence: ${JSON.stringify(entry.evidence)}`,
        ...(entry.source === undefined ? [] : [
          '      source:',
          `        path: ${JSON.stringify(entry.source.path)}`,
          `        nativeId: ${JSON.stringify(entry.source.nativeId)}`,
        ]),
      ]),
    ]),
  ].join('\n')
}

export async function configure(root: string, layouts: readonly Layout[] = openSpecLayouts, runners?: readonly string[]): Promise<void> {
  try { await symlink(fileURLToPath(new URL('../../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir') }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
  await put(root, '.focused-spec/config.yaml', configYaml(layouts, runners))
}

export async function configureInline(root: string, layouts: readonly Layout[] = [{ match: 'specs/**/*.md', scope: 'current' }], runners: readonly string[] = [
  'runners:',
  '  fixture:',
  '    module: ./runner.ts',
]): Promise<void> {
  try { await symlink(fileURLToPath(new URL('../../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir') }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
  const documents = layouts.flatMap(layout => [
    `    - match: ${JSON.stringify(layout.match)}`,
    '      format: inline',
    ...(layout.scope === undefined ? [] : [`      scope: ${layout.scope}`]),
    ...(layout.exclude === undefined ? [] : ['      exclude:', ...layout.exclude.map(pattern => `        - ${JSON.stringify(pattern)}`)]),
  ])
  await put(root, '.focused-spec/config.yaml', [
    'version: 5',
    'specifications:',
    '  formats:',
    '    inline: { package: "@focused-spec/format-inline" }',
    '  documents:',
    ...documents,
    ...runners,
  ].join('\n'))
}

export async function writeRegistry(root: string, entries: readonly RegistryEntry[]): Promise<void> {
  await put(root, '.focused-spec/evidence.yaml', entries.length === 0 ? 'scopes: {}\n' : registryYaml(entries))
}

export async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-cli-'))
  roots.push(root)
  await configure(root)
  await put(root, 'openspec/specs/current/spec.md', nativeScenario('fixture.current.passes', 'Current evidence passes'))
  await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.future.planned', 'Future evidence is planned'))
  await writeRegistry(root, baselineEntries)
  await put(root, 'runner.ts', [
    'export default {',
    '  apiVersion: 1,',
    '  async resolve(request) { return { targets: request.selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
    '  async run(request) { return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
    '}',
  ].join('\n'))
  return root
}

export async function emptyFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-cli-empty-'))
  roots.push(root)
  await configure(root, [{ match: 'specs/**/*.md', scope: 'current' }], ['runners: {}'])
  await writeRegistry(root, [])
  return root
}

export function json(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>
}

export async function snapshotTree(root: string): Promise<string> {
  return JSON.stringify(await Promise.all(
    (await readdir(root, { recursive: true })).sort().map(async path => {
      const absolute = join(root, path)
      return [path, (await lstat(absolute)).isFile() ? (await readFile(absolute)).toString('base64') : 'directory']
    }),
  ))
}

interface PtyStep { when: string; send: string }

export async function interactiveInit(root: string, home: string, steps: readonly PtyStep[], options: { args?: string[]; rows?: number; columns?: number; env?: Record<string, string>; welcome?: boolean } = {}): Promise<{ code: number | null; output: string }> {
  return await new Promise((resolve, reject) => {
    // The child uses a real terminal; control bytes are delivered over Python's PTY.
    const terminal = `import fcntl, os, pty, select, signal, struct, sys, termios
pid, master = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], [sys.argv[1], *sys.argv[2:]])
fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', int(os.environ['PTY_ROWS']), int(os.environ['PTY_COLUMNS']), 0, 0))
inputs = [master, 0]
while True:
    ready, _, _ = select.select(inputs, [], [])
    done = False
    for descriptor in ready:
        try:
            data = os.read(descriptor, 65536)
        except OSError:
            done = True
            break
        if descriptor == master:
            if not data:
                done = True
                break
            os.write(1, data)
        elif data == b'__SIGINT__':
            os.kill(pid, signal.SIGINT)
        elif data:
            os.write(master, data)
        else:
            inputs.remove(0)
            os.write(master, b'\\x04')
    if done:
        break
_, status = os.waitpid(pid, 0)
code = os.waitstatus_to_exitcode(status)
sys.exit(code if code >= 0 else 128 - code)
`
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, TERM: 'xterm-256color', PTY_ROWS: String(options.rows ?? 24), PTY_COLUMNS: String(options.columns ?? 80), ...options.env }
    if (options.env?.CI === undefined) delete env.CI
    if (options.env?.NO_COLOR === undefined) delete env.NO_COLOR
    delete env.FORCE_COLOR
    delete env.REDUCED_MOTION
    const child = spawn('python3', ['-c', terminal, process.execPath, cli, 'init', root, ...(options.args ?? [])], { cwd: root, env })
    let output = ''
    const sequence = options.welcome === false ? steps : [{ when: (options.columns ?? 80) < 35 ? 'Enter · Esc cancel' : ' to continue...', send: '\r' }, ...steps]
    let next = 0
    let consumed = 0
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`interactive init timed out at step ${next}: ${output}`)) }, 15_000)
    child.stdout.on('data', chunk => {
      output += String(chunk)
      while (next < sequence.length && output.slice(consumed).includes(sequence[next]!.when)) {
        consumed = output.length
        child.stdin.write(sequence[next++]!.send)
      }
    })
    child.stderr.on('data', chunk => { output += String(chunk) })
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('close', code => { clearTimeout(timer); if (next !== sequence.length) reject(new Error(`interaction stopped at step ${next}: ${output}`)); else resolve({ code, output }) })
  })
}

interface OperationTiming {
  readonly startedMs: number
  readonly durationMs: number
  readonly outcome: 'completed' | 'error'
}

type RunnerOperationTiming = OperationTiming & {
  readonly runnerId: string
  readonly operation: 'resolve' | 'partition' | 'run'
  readonly selectorCount?: number
  readonly targetCount?: number
}

type FormatOperationTiming = OperationTiming & {
  readonly formatId: string
  readonly path: string
  readonly scope: string
  readonly coldStart: boolean
}

export function timingArrays(output: Record<string, unknown>): {
  readonly runnerOperations: readonly RunnerOperationTiming[]
  readonly formatOperations: readonly FormatOperationTiming[]
} {
  const timings = output.timings as { runnerOperations: RunnerOperationTiming[]; formatOperations: FormatOperationTiming[] }
  for (const row of [...timings.runnerOperations, ...timings.formatOperations]) {
    expect(Number.isFinite(row.startedMs)).toBe(true)
    expect(row.startedMs).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(row.durationMs)).toBe(true)
    expect(row.durationMs).toBeGreaterThanOrEqual(0)
  }
  return timings
}

export function runnerFacts(rows: readonly RunnerOperationTiming[]): readonly Record<string, unknown>[] {
  return rows.map(({ startedMs: _startedMs, durationMs: _durationMs, ...facts }) => facts)
}

export function formatFacts(rows: readonly FormatOperationTiming[]): readonly Record<string, unknown>[] {
  return rows.map(({ startedMs: _startedMs, durationMs: _durationMs, ...facts }) => facts)
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})
