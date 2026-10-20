import { spawn, spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import { cp, lstat, mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))
const initTargets: { id: string; skill: string; command: string | null; home: boolean }[] = JSON.parse(await readFile(new URL('./fixtures/agent-targets.json', import.meta.url), 'utf8'))

interface Layout {
  readonly match: string
  readonly scope?: string
  readonly exclude?: readonly string[]
}

interface RegistryEntry {
  readonly scope: string
  readonly id: string
  readonly evidence: readonly string[]
  readonly source?: { readonly path: string; readonly nativeId: string }
}

const openSpecLayouts: readonly Layout[] = [
  { match: 'openspec/specs/**/spec.md', scope: 'current' },
  { match: 'openspec/changes/{scope}/specs/**/spec.md' },
]

const baselineEntries: readonly RegistryEntry[] = [
  { scope: 'current', id: 'fixture.current.passes', evidence: ['fixture::current'] },
  { scope: 'add', id: 'fixture.future.planned', evidence: ['planned:fixture::future'] },
]

async function put(root: string, path: string, content: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, content)
}

function configYaml(
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

function nativeScenario(id: string, name = id): string {
  return [
    `<!-- focused-spec:id=${id} -->`,
    `#### Scenario: ${name}`,
    '',
    'The configured behavior has its observable result.',
  ].join('\n')
}

function inlineScenario(id: string, evidence: readonly string[], name = id): string {
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

async function configure(root: string, layouts: readonly Layout[] = openSpecLayouts, runners?: readonly string[]): Promise<void> {
  try { await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir') }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
  await put(root, '.focused-spec/config.yaml', configYaml(layouts, runners))
}

async function configureInline(root: string, layouts: readonly Layout[] = [{ match: 'specs/**/*.md', scope: 'current' }], runners: readonly string[] = [
  'runners:',
  '  fixture:',
  '    module: ./runner.ts',
]): Promise<void> {
  try { await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir') }
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

async function writeRegistry(root: string, entries: readonly RegistryEntry[]): Promise<void> {
  await put(root, '.focused-spec/evidence.yaml', entries.length === 0 ? 'scopes: {}\n' : registryYaml(entries))
}

async function fixture(): Promise<string> {
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

async function emptyFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-cli-empty-'))
  roots.push(root)
  await configure(root, [{ match: 'specs/**/*.md', scope: 'current' }], ['runners: {}'])
  await writeRegistry(root, [])
  return root
}

function json(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>
}

interface PtyStep { when: string; send: string }

async function interactiveInit(root: string, home: string, steps: readonly PtyStep[], options: { args?: string[]; rows?: number; columns?: number; env?: Record<string, string>; welcome?: boolean } = {}): Promise<{ code: number | null; output: string }> {
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

function timingArrays(output: Record<string, unknown>): {
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

function runnerFacts(rows: readonly RunnerOperationTiming[]): readonly Record<string, unknown>[] {
  return rows.map(({ startedMs: _startedMs, durationMs: _durationMs, ...facts }) => facts)
}

function formatFacts(rows: readonly FormatOperationTiming[]): readonly Record<string, unknown>[] {
  return rows.map(({ startedMs: _startedMs, durationMs: _durationMs, ...facts }) => facts)
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('focused-spec CLI', () => {
  it.each(['zero-depth', 'nested'] as const)('preserves captured scope before a globstar with leading ./ for %s documents', async depth => {
    const root = await fixture()
    const path = depth === 'zero-depth' ? 'changes/alpha/spec.md' : 'changes/alpha/auth/deep/spec.md'
    await put(root, path, nativeScenario('fixture.capture.passes'))
    await put(root, 'changes/beta/spec.md', nativeScenario('fixture.capture.other'))
    await writeRegistry(root, [
      { scope: 'alpha', id: 'fixture.capture.passes', evidence: ['fixture::captured'] },
      { scope: 'beta', id: 'fixture.capture.other', evidence: ['fixture::other'] },
    ])
    for (const match of ['changes/{scope}/**/spec.md', './changes/{scope}/**/spec.md']) {
      await configure(root, [{ match }])
      const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'alpha', '--strict', '--json'], { encoding: 'utf8', timeout: 20_000 })
      expect(validate.error, validate.stderr).toBeUndefined()
      expect(validate.status, validate.stdout).toBe(0)
      expect(json(validate.stdout)).toMatchObject({ valid: true, scenarios: 1, targets: 1, validationScope: { scopes: { mode: 'selected', name: 'alpha' } } })
      const executed = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'alpha', '--json'], { encoding: 'utf8', timeout: 20_000 })
      expect(executed.error, executed.stderr).toBeUndefined()
      expect(executed.status, executed.stdout).toBe(0)
      expect(json(executed.stdout)).toMatchObject({ success: true, targetCount: 1, scenarios: [{ id: 'fixture.capture.passes', scope: 'alpha', status: 'PASS' }] })
    }
  })

  it('discovers commands and native options without reading project state', async () => {
    const root = await emptyFixture()
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    for (const args of [['--help'], ['-h'], ['help']]) {
      const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toMatch(/^\s+validate\s/mu)
      expect(result.stdout).toMatch(/^\s+run\s/mu)
      expect(result.stdout).toMatch(/^\s+instructions\s/mu)
      expect(result.stdout).toMatch(/^\s+init\s/mu)
    }
    for (const command of ['validate', 'run']) {
      for (const args of [[command, '--help'], [command, '-h'], ['help', command]]) {
        const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
        expect(result.status).toBe(0)
        expect(result.stderr).toBe('')
      }
    }
  })

  it('requires explicit init targets without interactive input', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-explicit-'))
    roots.push(root)
    await mkdir(join(root, '.claude'))
    for (const args of [[], ['--json']]) {
      const result = spawnSync(process.execPath, [cli, 'init', ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('--tools')
      expect(await readdir(root, { recursive: true })).toEqual(['.claude'])
    }
  })

  it('rejects invalid init arguments before writing files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-invalid-'))
    roots.push(root)
    for (const args of [['--tools', 'unknown'], ['--tools', 'all'], ['--tools', 'none'], ['--tools', 'claude,'], ['--tools', ''], ['--tools'], ['--wat'], ['--tools', 'claude', '--tools', 'codex'], [root, root, '--tools', 'claude']]) {
      const result = spawnSync(process.execPath, [cli, 'init', ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('init --help')
      expect(await readdir(root)).toEqual([])
    }
  })

  it('rejects unavailable init roots without creating a project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-root-'))
    roots.push(root)
    await put(root, 'file', 'not a directory')
    for (const path of [join(root, 'missing'), join(root, 'file')]) {
      const result = spawnSync(process.execPath, [cli, 'init', path, '--tools', 'claude', '--json'], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(json(result.stdout)).toMatchObject({ root: null, files: [], errors: expect.arrayContaining([expect.objectContaining({ message: expect.any(String) })]) })
    }
    expect(await readdir(root)).toEqual(['file'])
  })

  it('reports actual init actions and conflicts as one JSON document', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-json-'))
    roots.push(root)
    const invoke = (...args: string[]) => spawnSync(process.execPath, [cli, 'init', root, '--tools', ' agents,codex,agents ', '--json', ...args], { encoding: 'utf8' })
    const preview = invoke('--dry-run')
    expect(preview.status, preview.stderr).toBe(0)
    expect(json(preview.stdout)).toMatchObject({ tools: ['agents', 'codex'], dryRun: true, files: [{ path: '.agents/skills/focused-spec/SKILL.md', action: 'install', applied: false }], errors: [] })
    const installed = invoke()
    expect(installed.status, installed.stderr).toBe(0)
    expect(json(installed.stdout)).toMatchObject({ files: [{ path: '.agents/skills/focused-spec/SKILL.md', action: 'install', applied: true }], errors: [] })
    await put(root, '.agents/skills/focused-spec/SKILL.md', 'custom loader')
    const conflict = invoke()
    expect(conflict.status).toBe(1)
    expect(json(conflict.stdout)).toMatchObject({ files: [{ path: '.agents/skills/focused-spec/SKILL.md', action: 'conflict', applied: false }], errors: expect.arrayContaining([expect.objectContaining({ path: '.agents/skills/focused-spec/SKILL.md' })]) })
    expect(await readFile(join(root, '.agents/skills/focused-spec/SKILL.md'), 'utf8')).toBe('custom loader')
  })

  it('explains initialization without reading or modifying project state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-help-'))
    roots.push(root)
    await cp(new URL('../packages/core/dist/', import.meta.url), join(root, 'dist'), { recursive: true })
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
    await put(root, 'package.json', '{"type":"module"}')
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    const before = await readdir(root, { recursive: true })
    const home = join(root, 'missing-home')
    for (const args of [['init', '--help'], ['init', '-h'], ['help', 'init'], ['init', '--json', '--help']]) {
      const result = spawnSync(process.execPath, [join(root, 'dist/cli.js'), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('--replace')
      expect(result.stdout).toContain('--dry-run')
      expect(result.stdout).toContain('--no-animation')
      expect(result.stdout).toContain('Space to toggle')
      for (const target of initTargets) {
        expect(result.stdout).toContain(target.id)
        expect(result.stdout).toContain(`${target.home ? '~/' : ''}${target.skill}`)
        if (target.command !== null) expect(result.stdout).toContain(target.command)
      }
      expect(result.stdout).toMatch(/windsurf\s*->\s*devin/)
      expect(result.stdout).toMatch(/global-only/i)
      expect(result.stdout).toMatch(/canonical absolute/i)
      expect(await readdir(root, { recursive: true })).toEqual(before)
    }
  })

  it.skipIf(process.platform === 'win32')('keeps scripted and CI init outside the terminal screen', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-scripted-'))
    const home = await mkdtemp(join(tmpdir(), 'focused-init-scripted-home-'))
    roots.push(root, home)
    const ci = await interactiveInit(root, home, [], { env: { CI: 'true' }, welcome: false })
    expect(ci.code, ci.output).toBe(1)
    expect(ci.output).toContain('--tools')
    expect(ci.output).not.toContain('\x1b[?1049h')
    const scripted = await interactiveInit(root, home, [], { args: ['--tools', 'claude', '--no-animation', '--json'], welcome: false })
    expect(scripted.code, scripted.output).toBe(0)
    expect(scripted.output).not.toContain('\x1b[?1049h')
    expect(json(scripted.output)).toMatchObject({ tools: ['claude'], files: expect.arrayContaining([expect.objectContaining({ action: 'install', applied: true })]) })
    expect(await readdir(home)).toEqual([])
  }, 30_000)

  it.skipIf(process.platform === 'win32')('presents a compact welcome beside the glyph before selecting integrations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-welcome-'))
    const home = await mkdtemp(join(tmpdir(), 'focused-init-welcome-home-'))
    roots.push(root, home)
    const welcome = await interactiveInit(root, home, [
      { when: ' to continue...', send: '\r' },
      { when: 'Choose agent integrations', send: '\x03' },
    ], { args: ['--no-animation'], welcome: false })
    expect(welcome.code, welcome.output).toBe(1)
    const plainText = welcome.output.replace(/\x1b\[[0-9;?]*[A-Za-z]/gu, '')
    const pickerAt = plainText.indexOf('Choose agent integrations')
    expect(pickerAt).toBeGreaterThan(plainText.indexOf('Press Enter to continue'))
    const headingAt = plainText.slice(0, pickerAt).split(/\r?\n/u).findIndex(line => line.includes('Welcome to focused-spec'))
    const welcomeLines = plainText.slice(0, pickerAt).split(/\r?\n/u)
    expect(welcomeLines[headingAt]).toMatch(/^ {25}Welcome to focused-spec$/u)
    expect(welcomeLines[headingAt + 1]).toContain('██████')
    const promptAt = welcomeLines.findIndex(line => line.includes('Press Enter to continue...'))
    expect(welcomeLines[promptAt - 1]).toContain('██')
    expect(welcomeLines[promptAt]).toMatch(/^ {25}Press Enter to continue\.\.\.$/u)
    expect(welcome.output).toContain('\x1b[38;2;249;197;108mPress Enter\x1b[0m\x1b[38;2;162;173;181m to continue...')
    expect(plainText.slice(0, pickerAt)).toContain('██████')
    expect(plainText.slice(pickerAt)).not.toContain('██████')
    expect(welcome.output).toContain('\x1b[48;2;59;43;31m')
    expect(welcome.output).toContain('\x1b[1;38;2;246;242;235mWelcome to \x1b[0m\x1b[1;38;2;249;197;108mfocused-spec')
    expect(welcome.output).toContain('\x1b[38;2;162;173;181mBehavioral promises, backed by test results.')
    expect(welcome.output).toContain('\x1b[38;2;162;173;181mThis setup installs:')
    expect(welcome.output).toContain('\x1b[38;2;162;173;181mYour agent handles the workflow.')
    expect(plainText).toContain('This setup installs:')
    expect(plainText).toContain('A skill for the agents you choose')
    expect(plainText).toContain('Native commands where supported')
    expect(plainText).toContain('Your agent handles the workflow.')
    expect(plainText).not.toContain('Quick start after setup:')
    expect(plainText).not.toContain('No specs, tests, or config are created.')
    expect(welcome.output).not.toContain('\x1b[?1049h')
    expect(welcome.output).not.toContain('\x1b[2J')
    expect(welcome.output).not.toContain('focused-spec  /  agent setup')
    expect(await readdir(root)).toEqual([])
    expect(await readdir(home)).toEqual([])
  }, 30_000)

  it.skipIf(process.platform === 'win32')('installs only selected targets after separate review confirmation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-terminal-'))
    const home = await mkdtemp(join(tmpdir(), 'focused-init-terminal-home-'))
    roots.push(root, home)
    await mkdir(join(root, '.omp'))
    const installed = await interactiveInit(root, home, [
      { when: 'Search:', send: 'claude' },
      { when: 'Search: claude', send: ' ' },
      { when: 'Selected: 1', send: '\r' },
      { when: 'Install these files? Y / N', send: 'y' },
    ], { args: ['--no-animation'] })
    expect(installed.code, installed.output).toBe(0)
    expect(installed.output).toContain('Selected agents:')
    expect(installed.output).toContain('New files:')
    expect(installed.output).toContain('\x1b[38;2;162;173;181m  .claude/skills/focused-spec/SKILL.md')
    expect(installed.output.split('.claude/skills/focused-spec/SKILL.md')).toHaveLength(2)
    expect(installed.output).not.toContain('INSTALL  ')
    expect(installed.output).toContain('focused-spec\x1b[0m \x1b[1;38;2;246;242;235mSetup Complete')
    expect(installed.output).toContain('Files: 2 written · 0 unchanged.')
    expect(installed.output).toContain('\x1b[?25h')
    expect(await readFile(join(root, '.claude/skills/focused-spec/SKILL.md'), 'utf8')).toContain('name: focused-spec')
    expect(await readdir(join(root, '.omp'))).toEqual([])
    expect(await readdir(home)).toEqual([])
  }, 30_000)

  it.skipIf(process.platform === 'win32')('keeps project and home unchanged on cancel, preview and mixed-root conflict', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-review-'))
    const home = await mkdtemp(join(tmpdir(), 'focused-init-review-home-'))
    roots.push(root, home)
    await put(root, '.claude/skills/focused-spec/SKILL.md', 'custom loader')
    const snapshot = async (directory: string): Promise<string> => JSON.stringify(await Promise.all(
      (await readdir(directory, { recursive: true })).sort().map(async entry => {
        const absolute = join(directory, entry)
        return [entry, (await lstat(absolute)).isFile() ? (await readFile(absolute)).toString('base64') : 'directory']
      }),
    ))
    const before = [await snapshot(root), await snapshot(home)]
    const chooseClaude = [
      { when: 'Search:', send: 'claude' },
      { when: 'Search: claude', send: ' ' },
      { when: 'Selected: 1', send: '\r' },
    ]
    for (const key of ['\x1b', '\x03', '__SIGINT__']) {
      const cancelled = await interactiveInit(root, home, [{ when: 'Search:', send: key }], { args: ['--no-animation'] })
      expect(cancelled.code, cancelled.output).toBe(1)
      expect(cancelled.output).toContain('\x1b[?25h')
      expect([await snapshot(root), await snapshot(home)]).toEqual(before)
    }
    const declined = await interactiveInit(root, home, [...chooseClaude, { when: 'Install these files? Y / N', send: 'n' }], { args: ['--no-animation', '--replace'] })
    expect(declined.code, declined.output).toBe(1)
    expect([await snapshot(root), await snapshot(home)]).toEqual(before)
    const preview = await interactiveInit(root, home, [...chooseClaude, { when: 'Preview only · Enter to close', send: '\r' }], { args: ['--no-animation', '--replace', '--dry-run'] })
    expect(preview.code, preview.output).toBe(0)
    expect(preview.output).toContain('Files to replace:')
    expect(preview.output).toContain('Setup Preview Complete')
    expect([await snapshot(root), await snapshot(home)]).toEqual(before)
    const mixed = await interactiveInit(root, home, [
      { when: 'Search:', send: 'claude' },
      { when: 'Search: claude', send: ' ' },
      { when: 'Selected: 1', send: '\x1b' },
      { when: 'Search: (type to filter)', send: 'minimax-code' },
      { when: 'Search: minimax-code', send: ' ' },
      { when: 'Selected: 2', send: '\r' },
      { when: 'Setup blocked · Enter to close', send: '\r' },
    ], { args: ['--no-animation'] })
    expect(mixed.code, mixed.output).toBe(1)
    expect(mixed.output).toContain('\x1b[38;2;249;197;108m[x] claude')
    expect(mixed.output).not.toContain('\x1b[38;2;111;217;211m[x] claude')
    const text = mixed.output.replace(/\x1b\[[0-9;?]*[A-Za-z]/gu, '')
    expect(text).toContain('minimax-code [GLOBAL home]')
    const review = text.split('setup review')[1]!.split('Setup blocked · Enter to close')[0]!
    expect(review.replace(/\r?\n  /gu, '')).toContain(join(await realpath(home), '.minimax/skills/focused-spec/SKILL.md'))
    expect(text).toContain('Conflicts:')
    expect(text).toContain('.claude/skills/focused-spec/SKILL.md')
    expect(text).toContain('Setup blocked · Enter to close')
    expect([await snapshot(root), await snapshot(home)]).toEqual(before)
  }, 90_000)

  it.skipIf(process.platform === 'win32')('shows the approved focus glyph and usable static fallback on a real terminal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-focus-'))
    const home = await mkdtemp(join(tmpdir(), 'focused-init-focus-home-'))
    roots.push(root, home)
    const animated = await interactiveInit(root, home, [{ when: '░', send: ' ' }, { when: ' to continue...', send: '\r' }, { when: 'Search:', send: '\x03' }], { welcome: false })
    expect(animated.code, animated.output).toBe(1)
    expect(animated.output.replace(/\x1b\[[0-9;?]*[A-Za-z]/gu, '')).toContain('██████')
    const full = await interactiveInit(root, home, [{ when: ' to continue...', send: '\r' }, { when: 'Search:', send: '\x03' }], { welcome: false, args: ['--no-animation'] })
    expect(full.code, full.output).toBe(1)
    expect(full.output.replace(/\x1b\[[0-9;?]*[A-Za-z]/gu, '')).toContain('██████')
    expect(full.output).toContain('\x1b[?25h')
    const plain = await interactiveInit(root, home, [{ when: 'Esc Clear/Cancel', send: '\x03' }], { columns: 36, rows: 12, env: { NO_COLOR: '1' } })
    expect(plain.output).toContain('This setup installs:')
    expect(plain.output).toContain('Skill for selected agents')
    expect(plain.output).toContain('Commands where supported')
    expect(plain.code, plain.output).toBe(1)
    expect(plain.output).toContain('Space Select')
    expect(plain.output).not.toContain('\x1b[38;2;')
    const tiny = await interactiveInit(root, home, [
      { when: 'Enter · Esc cancel', send: '\r' },
      { when: 'Search: (type to filter)', send: 'claude \r' },
      { when: 'Setup review', send: '\x1b' },
    ], { columns: 20, rows: 8, args: ['--no-animation'], welcome: false, env: { NO_COLOR: '1' } })
    expect(tiny.code, tiny.output).toBe(1)
    expect(tiny.output).toContain('↓ Scroll to end')
    expect(tiny.output).toContain('Setup cancelled')
    const tinyWelcome = tiny.output.split('Choose agent integrations')[0]!.replace(/\x1b\[[0-9;?]*[A-Za-z]/gu, '')
    expect(tinyWelcome).toContain('Agent skill')
    expect(tinyWelcome).toContain('Optional commands')
    expect(tinyWelcome).not.toContain('Quick start')
    expect(tinyWelcome.split(/\r?\n/u).every(line => line.length <= 20)).toBe(true)
    const dumb = await interactiveInit(root, home, [{ when: 'Esc Clear/Cancel', send: '\x03' }], { env: { TERM: 'dumb' } })
    expect(dumb.output).toContain('██████')
    expect(dumb.output).not.toContain('\x1b[')
    expect(await readdir(root)).toEqual([])
    expect(await readdir(home)).toEqual([])
  }, 40_000)

  it('serves workflow guidance without project setup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-guide-offline-'))
    roots.push(root)
    await put(root, 'package.json', '{"name":"unrelated-project","version":"99.0.0"}')
    await put(root, 'guidance/workflow.md', 'UNTRUSTED PROJECT INSTRUCTIONS')
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    await put(root, '.focused-spec/evidence.yaml', 'invalid: [')
    const before = await readdir(root, { recursive: true })
    const result = spawnSync(process.execPath, [cli, 'instructions', '--protocol', '1', '--json'], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, npm_config_offline: 'true', HTTPS_PROXY: 'http://127.0.0.1:1' },
    })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    const response = json(result.stdout)
    const metadata = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'))
    expect(response).toMatchObject({ protocolVersion: 1, package: { name: 'focused-spec', version: metadata.version }, topic: 'workflow' })
    expect(response.content).toBe(await readFile(new URL('../guidance/workflow.md', import.meta.url), 'utf8'))
    expect(await readdir(root, { recursive: true })).toEqual(before)
    const text = spawnSync(process.execPath, [cli, 'instructions'], { cwd: root, encoding: 'utf8' })
    expect(text.status, text.stderr).toBe(0)
    expect(text.stdout).toContain(String(response.content))
    expect(text.stdout).toContain(metadata.version)
  })

  it('serves format guidance without loading project configuration or plugins', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-formats-offline-'))
    roots.push(root)
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    await put(root, '.focused-spec/evidence.yaml', 'invalid: [')
    await put(root, 'guidance/formats.md', 'UNTRUSTED PROJECT FORMAT INSTRUCTIONS')
    await put(root, 'format.mjs', 'throw new Error("project format must not load")')
    const before = await readdir(root, { recursive: true })
    const metadata = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'))
    const result = spawnSync(process.execPath, [cli, 'instructions', '--protocol', '1', '--topic', 'formats', '--json'], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, npm_config_offline: 'true', HTTPS_PROXY: 'http://127.0.0.1:1' },
    })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    const response = json(result.stdout)
    expect(response).toEqual({ protocolVersion: 1, package: { name: 'focused-spec', version: metadata.version }, topic: 'formats',
      content: await readFile(new URL('../guidance/formats.md', import.meta.url), 'utf8') })
    expect(response.content).not.toContain('UNTRUSTED PROJECT FORMAT INSTRUCTIONS')
    const text = spawnSync(process.execPath, [cli, 'instructions', '--topic', 'formats'], { cwd: root, encoding: 'utf8' })
    expect(text.status, text.stderr).toBe(0)
    expect(text.stdout).toContain(String(response.content))
    expect(text.stdout).toContain(metadata.version)
    expect(await readdir(root, { recursive: true })).toEqual(before)
  })

  it('rejects missing format guidance without falling back to other topics', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-formats-incomplete-'))
    roots.push(root)
    const installation = join(root, 'installation')
    await cp(new URL('../packages/core/dist/', import.meta.url), join(installation, 'dist'), { recursive: true })
    await cp(new URL('../packages/core/package.json', import.meta.url), join(installation, 'package.json'))
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(installation, 'node_modules'), 'dir')
    await put(installation, 'guidance/workflow.md', '# Workflow fallback must not be used')
    await put(installation, 'guidance/runners.md', '# Runner fallback must not be used')
    await put(root, 'guidance/formats.md', '# Project fallback must not be used')
    const result = spawnSync(process.execPath, [join(installation, 'dist/cli.js'), 'instructions', '--topic', 'formats', '--json'], {
      cwd: root, encoding: 'utf8',
    })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toMatch(/incomplete installed focused-spec package.*formats/iu)
  })

  it('rejects missing or empty integration guidance without fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-integration-incomplete-'))
    roots.push(root)
    const installation = join(root, 'installation')
    await cp(new URL('../packages/core/dist/', import.meta.url), join(installation, 'dist'), { recursive: true })
    await cp(new URL('../packages/core/package.json', import.meta.url), join(installation, 'package.json'))
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(installation, 'node_modules'), 'dir')
    for (const topic of ['workflow', 'formats', 'runners']) await put(installation, `guidance/${topic}.md`, '# Not integration')
    await put(root, 'guidance/integration.md', '# Untrusted consumer fallback')
    for (const content of [undefined, ' \n']) {
      if (content !== undefined) await put(installation, 'guidance/integration.md', content)
      const result = spawnSync(process.execPath, [join(installation, 'dist/cli.js'), 'instructions', '--topic', 'integration', '--json'], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(JSON.parse(result.stderr)).toMatchObject({ error: { code: 'command_failed', message: expect.stringMatching(/incomplete installed focused-spec package.*integration/iu) } })
    }
  })

  it('rejects unsupported guide protocols without returning instructions', async () => {
    const root = await emptyFixture()
    const result = spawnSync(process.execPath, [cli, 'instructions', '--protocol', '2', '--json'], { cwd: root, encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toMatch(/protocol 2.*supported protocols: 1/u)
  })

  it('rejects invalid guide requests with actionable help', async () => {
    const root = await emptyFixture()
    for (const args of [['--topic', 'unknown'], ['--protocol', '0'], ['--protocol', '1.5'], ['--protocol'], ['--topic'], ['--strict'], ['--root', root]]) {
      const result = spawnSync(process.execPath, [cli, 'instructions', ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('instructions --help')
    }
  })

  it('explains guide compatibility without loading package guidance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-guide-help-'))
    roots.push(root)
    await cp(new URL('../packages/core/dist/', import.meta.url), join(root, 'dist'), { recursive: true })
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
    await put(root, 'package.json', '{"type":"module"}')
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    for (const args of [['instructions', '--help'], ['instructions', '-h'], ['help', 'instructions'], ['instructions', '--protocol', '2', '--json', '--help']]) {
      const result = spawnSync(process.execPath, [join(root, 'dist/cli.js'), ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toMatch(/--protocol.*default: 1/u)
      expect(result.stdout).toMatch(/--topic.*workflow.*formats.*runners/u)
      expect(result.stdout).toContain('--json')
      expect(result.stdout).not.toMatch(/^\{/u)
    }
  })

  it('rejects invalid invocations without treating them as successful help', async () => {
    const root = await emptyFixture()
    for (const args of [[], ['unknown'], ['help', 'unknown'], ['agent-guide'], ['agent-guide', '--help'], ['help', 'agent-guide'], ['transition'], ['transition', '--help'], ['help', 'transition'], ['transition', 'prepare', '--help'], ['transition', 'verify', '--help'], ['transition', 'prepare', 'plan.yaml', '--snapshot', 'snapshot.json'], ['transition', 'verify', 'snapshot.json', '--final'], ['run', '--unknown'], ['run', '--scope']]) {
      const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('--help')
    }
  })

  it('rejects malformed evidence alongside valid evidence before execution', async () => {
    const root = await fixture()
    await writeRegistry(root, [{ ...baselineEntries[0]!, evidence: ['fixture::current', 'invalid-reference'] }])
    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, executionStarted: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.current.passes', message: expect.stringContaining('invalid-reference') })]) })
  })

  it('runs inline ID and EVIDENCE without any registry file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-inline-run-'))
    roots.push(root)
    await configureInline(root)
    await put(root, 'specs/inline.md', inlineScenario('inline.execution', ['fixture::first::suffix', 'fixture::second'], 'Inline evidence executes'))
    await put(root, 'runner.ts', [
      "import { appendFile } from 'node:fs/promises'",
      "import { existsSync } from 'node:fs'",
      "import { join } from 'node:path'",
      'export default { apiVersion: 1,',
      '  async resolve({ projectRoot, selectors }) { await appendFile(join(projectRoot, "observed"), selectors.join("|") + "\\n"); return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run({ projectRoot, targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: target.targetId === "second" && existsSync(join(projectRoot, "fail-second")) ? "fail" : "pass" })) } },',
      '}',
    ].join('\n'))

    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--scenario', 'inline.execution', '--json'], { encoding: 'utf8' })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    expect(json(result.stdout)).toMatchObject({ success: true, targetCount: 2, scenarios: [{
      id: 'inline.execution', scope: 'current', status: 'PASS', evidence: [
        { reference: 'fixture::first::suffix', status: 'PASS' },
        { reference: 'fixture::second', status: 'PASS' },
      ],
    }] })
    expect(await readFile(join(root, 'observed'), 'utf8')).toBe('first::suffix|second\n')
    await expect(readFile(join(root, '.focused-spec/evidence.yaml'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    await put(root, 'fail-second', 'controlled regression')
    const failed = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--scenario', 'inline.execution', '--json'], { encoding: 'utf8' })
    expect(failed.status).toBe(1)
    expect(json(failed.stdout)).toMatchObject({ success: false, targetCount: 2, scenarios: [{
      id: 'inline.execution', status: 'FAIL', evidence: [
        { reference: 'fixture::first::suffix', status: 'PASS' },
        { reference: 'fixture::second', status: 'FAIL' },
      ],
    }] })
  })

  it('preserves opaque IDs through selection and results', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-opaque-ids-'))
    roots.push(root)
    await configureInline(root)
    const ids = ['auth-login', '123', 'INVALID', 'Case', 'case', 'Вход разрешён', 'path/looking id']
    await put(root, 'specs/opaque.md', ids.map((id, index) => inlineScenario(id, [`fixture::opaque-${index}`])).join('\n\n'))
    await put(root, 'runner.ts', [
      'export default { apiVersion: 1,',
      '  async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run({ targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))

    for (const id of ids) {
      const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--scenario', id, '--json'], { encoding: 'utf8' })
      expect(result.status, `${id}: ${result.stderr || result.stdout}`).toBe(0)
      expect(json(result.stdout)).toMatchObject({ scenarios: [{ id, scope: 'current', status: 'PASS' }] })
    }
  })

  it('isolates selected inline errors without inheriting evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-inline-selection-'))
    roots.push(root)
    await configureInline(root, [{ match: 'specs/{scope}.md' }])
    await put(root, 'specs/good.md', inlineScenario('inline.shared', ['fixture::good']))
    await put(root, 'specs/broken.md', [
      '#### Scenario: Invalid unrelated occurrence',
      '- **ID**: `inline.shared`',
      '- **EVIDENCE**: invalid-reference',
      '- **WHEN** broken input arrives',
      '- **THEN** no execution begins',
    ].join('\n'))
    await put(root, 'specs/missing.md', [
      '#### Scenario: Missing local evidence',
      '- **ID**: `inline.shared`',
      '- **WHEN** evidence is absent',
      '- **THEN** evidence is not inherited',
    ].join('\n'))
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run({ targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "pass" })) } } }')

    const selected = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'good', '--scenario', 'inline.shared', '--json'], { encoding: 'utf8' })
    expect(selected.status, selected.stderr || selected.stdout).toBe(0)
    expect(json(selected.stdout)).toMatchObject({ scenarios: [{ id: 'inline.shared', scope: 'good', status: 'PASS' }], targetCount: 1 })
    const missing = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'missing', '--json'], { encoding: 'utf8' })
    expect(missing.status).toBe(1)
    expect(json(missing.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'inline.shared' })]) })
    const full = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(full.status).toBe(1)
    expect(json(full.stdout)).toMatchObject({ valid: false })
  })

  it('rejects competing inline and external enrollments', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-competing-enrollment-'))
    roots.push(root)
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
    await put(root, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats:',
      '    inline: { package: "@focused-spec/format-inline" }',
      '    external:',
      '      package: "@focused-spec/format-registry"',
      '      options:',
      '        parser: { package: "@focused-spec/format-markdown" }',
      '        files: [".focused-spec/evidence.yaml"]',
      '  documents:',
      '    - { match: specs/inline.md, scope: current, format: inline }',
      '    - { match: registry-layout/**/*.md, scope: current, format: external }',
      'runners:',
      '  fixture: { module: ./runner.ts }',
    ].join('\n'))
    await put(root, 'specs/inline.md', inlineScenario('inline.competing', ['fixture::protected']))
    await writeRegistry(root, [{ scope: 'current', id: 'inline.competing', evidence: ['fixture::protected'] }])
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run() { throw new Error("must not execute") } }')

    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, executionStarted: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'inline.competing', message: expect.stringMatching(/enroll|bound|more than once|competing/iu) })]) })
  })

  it('validates inline planned evidence without loading runners', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-inline-planned-'))
    roots.push(root)
    await configureInline(root, undefined, ['runners:', '  unavailable: { module: ./missing-runner.ts }'])
    await put(root, 'specs/planned.md', inlineScenario('inline.planned', ['planned:unavailable::future']))

    const syntax = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'current', '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(syntax.status, syntax.stderr || syntax.stdout).toBe(0)
    expect(json(syntax.stdout)).toMatchObject({ valid: true, mode: 'syntax-only' })
    const ordinary = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'current', '--json'], { encoding: 'utf8' })
    expect(ordinary.status, ordinary.stderr || ordinary.stdout).toBe(0)
    expect(json(ordinary.stdout)).toMatchObject({ valid: true, scenarios: 1, plannedEvidence: 1, targets: 0 })
    for (const args of [['validate', '--strict'], ['run']] as const) {
      const rejected = spawnSync(process.execPath, [cli, ...args, '--root', root, '--scope', 'current', '--json'], { encoding: 'utf8' })
      expect(rejected.status).toBe(1)
      expect(json(rejected.stdout)).toMatchObject({ valid: false,
        violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'inline.planned', message: expect.stringMatching(/planned evidence is not allowed/iu) })]) })
    }
  })

  it('rejects old config and format APIs without fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-api-cutover-'))
    roots.push(root)
    await configureInline(root, undefined, ['runners:', '  missing: { module: ./missing-runner.mjs }'])
    const current = await readFile(join(root, '.focused-spec/config.yaml'), 'utf8')
    await put(root, 'specs/cutover.md', inlineScenario('cutover.evidence', ['planned:missing::future']))
    const supported = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(supported.status, supported.stdout).toBe(0)
    for (const version of [1, 2, 3, 4]) {
      await put(root, '.focused-spec/config.yaml', current.replace('version: 5', `version: ${version}`))
      const obsolete = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
      expect(obsolete.status, obsolete.stdout).toBe(1)
      expect(json(obsolete.stdout)).toMatchObject({ valid: false,
        violations: expect.arrayContaining([expect.objectContaining({ path: join(root, '.focused-spec/config.yaml') })]) })
    }
    await put(root, '.focused-spec/config.yaml', `${current}\nevidence:\n  files: [.focused-spec/evidence.yaml]\n`)
    await put(root, '.focused-spec/evidence.yaml', 'scopes: {}\n')
    const obsoleteEvidence = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(obsoleteEvidence.status).toBe(1)
    expect(json(obsoleteEvidence.stdout)).toMatchObject({ valid: false,
      violations: expect.arrayContaining([expect.objectContaining({
        path: join(root, '.focused-spec/config.yaml'),
        message: expect.stringMatching(/evidence|format.*options/iu),
      })]) })

    await put(root, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats: { legacy: { module: ./legacy-format.mjs } }',
      '  documents: [{ match: specs/legacy.md, scope: current, format: legacy }]',
      'runners: {}',
    ].join('\n'))
    await put(root, 'legacy-format.mjs', 'export default { apiVersion: 1, parse() { throw new Error("API 1 parser must not run") } }')
    await put(root, 'specs/legacy.md', 'legacy input')
    const obsoleteApi = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(obsoleteApi.status).toBe(1)
    expect(json(obsoleteApi.stdout)).toMatchObject({ valid: false,
      violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/Format API 1|apiVersion.*2|instructions --protocol 1/iu) })]) })
    expect(obsoleteApi.stdout).not.toContain('API 1 parser must not run')
    const apiMessages = (json(obsoleteApi.stdout).violations as { message: string }[]).map(item => item.message)
    const guidanceCommand = apiMessages.map(message => message.match(/`\.\/node_modules\/\.bin\/focused-spec (instructions [^`]+)`/u)?.[1]).find(value => value !== undefined)
    expect(guidanceCommand).toBeDefined()
    const guidance = spawnSync(process.execPath, [cli, ...guidanceCommand!.split(' ')], { cwd: root, encoding: 'utf8' })
    expect(guidance.status, guidance.stderr).toBe(0)
    expect(json(guidance.stdout)).toMatchObject({ protocolVersion: 1, topic: 'workflow', package: { name: 'focused-spec' } })
  })

  it('runs registry-backed native formats without core evidence configuration', async () => {
    const root = await fixture()
    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--json'], { encoding: 'utf8' })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    expect(json(result.stdout)).toMatchObject({ scenarios: [{ id: 'fixture.current.passes', scope: 'current', status: 'PASS' }] })
  })

  it('reports inline binding failures at their metadata lines', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-inline-provenance-'))
    roots.push(root)
    await configureInline(root, undefined, ['runners:', '  fixture:', '    module: ./missing-runner.mjs'])
    await put(root, 'specs/provenance.md', [
      '#### Scenario: Malformed second reference',
      '- **ID**: `inline.provenance`',
      '- **EVIDENCE**: `fixture::valid`',
      '- **EVIDENCE**: malformed-reference',
      '- **WHEN** both rows are validated',
      '- **THEN** the malformed row reports its own line',
    ].join('\n'))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([
      expect.objectContaining({ path: 'specs/provenance.md', line: 4, scenarioId: 'inline.provenance' }),
    ]) })
    expect((json(result.stdout).violations as { line?: number; scenarioId?: string }[])
      .some(violation => violation.scenarioId === 'inline.provenance' && violation.line === 3)).toBe(false)
  })

  it('reports reached timings on unresolved evidence without starting execution', async () => {
    const root = await fixture()
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: [], errors: selectors.map(selector => ({ selector, message: "missing selected test" })) } }, async run() { throw new Error("must not execute") } }')
    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--json', '--timings'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    const output = json(result.stdout)
    expect(output).toMatchObject({ valid: false, executionStarted: false,
      timings: { validationMs: expect.any(Number), resolutionMs: expect.any(Number), totalMs: expect.any(Number) } })
    expect(output.timings).not.toHaveProperty('executionMs')
    expect(JSON.stringify(output.violations)).toContain('missing selected test')
    const timings = timingArrays(output)
    expect(runnerFacts(timings.runnerOperations)).toEqual([
      { runnerId: 'fixture', operation: 'resolve', selectorCount: 1, outcome: 'completed' },
    ])
    expect(timings.formatOperations).toHaveLength(1)
    expect(timings.runnerOperations.some(row => row.operation === 'run' || row.operation === 'partition')).toBe(false)
  })

  it('reports all scenarios, planned evidence, and unique resolved targets', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/shared/spec.md', nativeScenario('fixture.current.shared', 'A second scenario shares executable evidence'))
    await writeRegistry(root, [
      ...baselineEntries,
      { scope: 'current', id: 'fixture.current.shared', evidence: ['fixture::current'] },
    ])

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({
      valid: true,
      validationScope: { scopes: { mode: 'all' } },
      scenarios: 3,
      plannedEvidence: 1,
      targets: 1,
    })
  })

  it('accepts the same ID in independent scopes', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/other/specs/new/spec.md', nativeScenario('fixture.future.planned'))
    await writeRegistry(root, [
      ...baselineEntries,
      { scope: 'other', id: 'fixture.future.planned', evidence: ['planned:fixture::other'] },
    ])

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toMatchObject({ scenarios: 3, plannedEvidence: 2 })
  })

  it('does not inherit evidence from another scope with the same ID', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Add scope must supply evidence'))
    await writeRegistry(root, [baselineEntries[0]!])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({
      valid: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.current.passes', message: expect.stringMatching(/registry|evidence/iu) })]),
    })
  })

  it('allows planned evidence only during non-strict validation', async () => {
    const root = await fixture()

    const ordinary = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    const strict = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--strict', '--json'], { encoding: 'utf8' })

    expect(ordinary.status).toBe(0)
    expect(json(ordinary.stdout)).toMatchObject({ valid: true, plannedEvidence: 1 })
    expect(strict.status).toBe(1)
    expect(json(strict.stdout)).toMatchObject({
      valid: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.future.planned', message: expect.stringContaining('planned evidence is not allowed') })]),
    })
  })

  it('preserves successful validation and execution for an empty registry', async () => {
    const root = await emptyFixture()

    const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(validate.status).toBe(0)
    expect(json(validate.stdout)).toEqual({
      valid: true,
      validationScope: { scopes: { mode: 'all' } },
      scenarios: 0,
      plannedEvidence: 0,
      targets: 0,
    })
    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({ success: true, executionStarted: false, scenarios: [], targetCount: 0 })
  })

  it('runs all scopes and disambiguates repeated scenario IDs', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Add scope evidence'))
    await put(root, 'openspec/changes/other/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Other scope evidence'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.current.passes', evidence: ['fixture::add'] },
      { scope: 'other', id: 'fixture.current.passes', evidence: ['fixture::other'] },
    ])

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    const output = json(run.stdout)
    expect(output).toMatchObject({ success: true, targetCount: 3 })
    expect(output.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'fixture.current.passes', scope: 'current', status: 'PASS' }),
      expect.objectContaining({ id: 'fixture.current.passes', scope: 'add', status: 'PASS' }),
      expect.objectContaining({ id: 'fixture.current.passes', scope: 'other', status: 'PASS' }),
    ]))
  })

  it('reports selected scope and scenario execution independently', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.future.executes', 'Future evidence executes'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.future.executes', evidence: ['fixture::future'] },
    ])

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.future.executes', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({
      success: true,
      validationScope: { scopes: { mode: 'selected', name: 'add' }, scenario: 'fixture.future.executes' },
      executionSelection: { scopes: { mode: 'selected', name: 'add' }, scenario: 'fixture.future.executes' },
      scenarios: [{ id: 'fixture.future.executes', scope: 'add', status: 'PASS' }],
      targetCount: 1,
    })
  })

  it('runs a selected scenario despite unrelated entry binding and evidence failures', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
    await put(root, 'openspec/specs/current/spec.md', [
      nativeScenario('fixture.current.selected', 'Selected scenario'),
      nativeScenario('fixture.current.unresolved', 'Unresolved scenario'),
      nativeScenario('fixture.current.planned', 'Planned scenario'),
    ].join('\n\n'))
    await writeRegistry(root, [
      { scope: 'current', id: 'fixture.current.selected', evidence: ['fixture::selected'] },
      { scope: 'current', id: 'fixture.current.unresolved', evidence: ['fixture::broken'] },
      { scope: 'current', id: 'fixture.current.planned', evidence: ['planned:fixture::future'] },
      { scope: 'current', id: 'fixture.current.dangling', evidence: ['fixture::missing'] },
    ])
    await put(root, 'runner.ts', [
      'export default { apiVersion: 1,',
      '  async resolve(request) { return {',
      '    targets: request.selectors.filter(selector => selector !== "broken").map(selector => ({ selector, targetId: selector, displayName: selector })),',
      '    errors: request.selectors.filter(selector => selector === "broken").map(selector => ({ selector, message: "not found" })),',
      '  } },',
      '  async run(request) { return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))

    const selected = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scenario', 'fixture.current.selected', '--json'], { encoding: 'utf8' })
    const full = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(selected.status).toBe(0)
    expect(json(selected.stdout)).toMatchObject({ scenarios: [{ id: 'fixture.current.selected', status: 'PASS' }], targetCount: 1 })
    expect(full.status).toBe(1)
    expect(json(full.stdout)).toMatchObject({ valid: false, executionStarted: false })
  })

  it('validates a selected scope independently of another same-ID scope', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/current/spec.md', nativeScenario('fixture.current.passes', 'Unrelated current binding'))
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Independent add binding'))
    await writeRegistry(root, [
      { scope: 'current', id: 'fixture.current.passes', evidence: ['missing::broken'] },
      { scope: 'add', id: 'fixture.current.passes', evidence: ['planned:fixture::add'] },
    ])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(0)
    expect(json(result.stdout)).toMatchObject({ scenarios: 1, plannedEvidence: 1, targets: 0 })
  })

  it('validates binding without importing runner modules in syntax only mode', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.future.concrete'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.future.concrete', evidence: ['fixture::future'] },
    ])
    await rm(join(root, 'runner.ts'))

    const syntax = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--syntax-only', '--json'], { encoding: 'utf8' })
    const full = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })

    expect(syntax.status).toBe(0)
    expect(json(syntax.stdout)).toEqual({ valid: true, mode: 'syntax-only', validationScope: { scopes: { mode: 'selected', name: 'add' } } })
    expect(full.status).toBe(1)
  })

  it('rejects a missing evidence registry', async () => {
    const root = await fixture()
    await rm(join(root, '.focused-spec/evidence.yaml'))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/evidence\.yaml/iu) })]) })
  })

  it('rejects a dangling registry entry', async () => {
    const root = await fixture()
    await writeRegistry(root, [
      ...baselineEntries,
      { scope: 'current', id: 'fixture.missing.binding', evidence: ['fixture::missing'] },
    ])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({
      valid: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.missing.binding', message: expect.stringMatching(/(?:bind|matching|native)/iu) })]),
    })
  })

  it('rejects one marker ID bound to multiple native items', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
    await put(root, 'openspec/specs/current/spec.md', [
      nativeScenario('fixture.current.passes', 'First binding'),
      nativeScenario('fixture.current.passes', 'Second binding'),
    ].join('\n\n'))
    await writeRegistry(root, [baselineEntries[0]!])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/(?:unique|multiple|duplicate)/iu) })]) })
  })

  it('requires external native IDs to resolve uniquely', async () => {
    const root = await emptyFixture()
    await configure(root, [{ match: 'stories/**/*.md', scope: 'current' }], [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
    ])
    await put(root, 'stories/auth.md', [
      '# Authentication capabilities',
      '- **CAP-1**: First declaration',
      '- **CAP-1**: Duplicate declaration',
    ].join('\n'))
    await writeRegistry(root, [{
      scope: 'current',
      id: 'fixture.external.duplicate',
      evidence: ['fixture::external'],
      source: { path: 'stories/auth.md', nativeId: 'CAP-1' },
    }])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/(?:unique|multiple|duplicate)/iu) })]) })

    await put(root, 'stories/auth.md', [
      '# Authentication capabilities',
      '- **CAP-1**: Unique declaration',
    ].join('\n'))
    const unique = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })
    expect(unique.status).toBe(0)
  })

  it('advertises executable workflow guidance for obsolete configuration and inline metadata', async () => {
    const root = await emptyFixture()
    const config = configYaml([{ match: 'specs/**/*.md', scope: 'current' }], ['runners:', '  unit: { module: ./missing-runner.mjs }'])
    const metadata = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8')) as { version: string }
    const assertAdvertised = (result: SpawnSyncReturns<string>): void => {
      expect(result.status).toBe(1)
      const messages = (json(result.stdout).violations as { message: string }[]).map(item => item.message)
      const command = messages.map(message => message.match(/`\.\/node_modules\/\.bin\/focused-spec (instructions [^`]+)`/u)?.[1]).find(value => value !== undefined)
      expect(command).toBeDefined()
      const guidance = spawnSync(process.execPath, [cli, ...command!.split(' ')], { cwd: root, encoding: 'utf8' })
      expect(guidance.status, guidance.stderr).toBe(0)
      expect(json(guidance.stdout)).toMatchObject({ protocolVersion: 1, package: { name: 'focused-spec', version: metadata.version }, topic: 'workflow', content: expect.any(String) })
    }
    const legacySource = '#### Scenario: Blocked account\n- **ID**: `auth.blocked`\n- **EVIDENCE**: `unit::blocked`\n- **REVISES**: `auth.previous`\n- **WHEN** a blocked account authenticates\n- **THEN** it is rejected\n'
    await put(root, 'specs/auth.md', nativeScenario('auth.blocked'))
    await writeRegistry(root, [{ scope: 'current', id: 'auth.blocked', evidence: ['planned:unit::blocked'] }])
    for (const version of [1, 2, 3, 4]) {
      await put(root, '.focused-spec/config.yaml', config.replace('version: 5', `version: ${version}`))
      assertAdvertised(spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' }))
    }
    await put(root, '.focused-spec/config.yaml', config)
    await put(root, 'specs/auth.md', legacySource)
    assertAdvertised(spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' }))
    await configureInline(root, undefined, ['runners: {}'])
    assertAdvertised(spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' }))
  })

  it('reports missing and malformed configuration', async () => {
    const root = await emptyFixture()
    await rm(join(root, '.focused-spec/config.yaml'))
    const missing = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(missing.status).toBe(1)
    expect(json(missing.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('cannot read configuration') })]) })

    await put(root, '.focused-spec/config.yaml', 'version: [\n')
    const malformed = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(malformed.status).toBe(1)
    expect(json(malformed.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('invalid YAML') })]) })
  })

  it('rejects selections containing only unmarked native content', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/native/specs/example/spec.md', '# Native design\n\nNo marker is declared here.\n')

    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'native', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, executionStarted: false })
    expect(json(result.stdout)).not.toHaveProperty('scenarios')
    await rm(join(root, 'openspec/specs'), { recursive: true })
    await rm(join(root, 'openspec/changes/add'), { recursive: true })
    await writeRegistry(root, [])
    const all = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(all.status).toBe(1)
    expect(json(all.stdout)).toMatchObject({ valid: false, executionStarted: false })
  })

  it('runs marked outcomes beside untouched native content', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
    await put(root, 'openspec/specs/current/spec.md', [
      '#### Scenario: Untouched native outcome',
      '',
      'This content is not enrolled.',
      '',
      nativeScenario('fixture.current.passes', 'Enrolled outcome'),
    ].join('\n'))
    await writeRegistry(root, [baselineEntries[0]!])

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({ scenarios: [{ id: 'fixture.current.passes', status: 'PASS' }], targetCount: 1 })
  })

  it('resolves a shared target once for scoped execution', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', [
      nativeScenario('fixture.future.executes', 'Future evidence executes'),
      nativeScenario('fixture.future.shared', 'Future evidence is shared'),
    ].join('\n\n'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.future.executes', evidence: ['fixture::future'] },
      { scope: 'add', id: 'fixture.future.shared', evidence: ['fixture::future'] },
    ])
    await put(root, 'runner.ts', [
      "import { appendFile } from 'node:fs/promises'",
      "import { join } from 'node:path'",
      'export default { apiVersion: 1,',
      '  async resolve(request) { await appendFile(join(request.projectRoot, "calls"), `resolve:${request.selectors.join(",")}\\n`); return { targets: request.selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run(request) { await appendFile(join(request.projectRoot, "calls"), `run:${request.targets.map(target => target.targetId).join(",")}\\n`); return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({ scenarios: [{ status: 'PASS' }, { status: 'PASS' }], targetCount: 1 })
    expect(await readFile(join(root, 'calls'), 'utf8')).toBe('resolve:future\nrun:future\n')
  })

  it('executes only selected-scope evidence for the same scenario ID', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Add-scope evidence executes'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.current.passes', evidence: ['fixture::add'] },
    ])
    await put(root, 'runner.ts', [
      "import { appendFile } from 'node:fs/promises'",
      "import { join } from 'node:path'",
      'export default { apiVersion: 1,',
      '  async resolve(request) { return { targets: request.selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run(request) { await appendFile(join(request.projectRoot, "runs"), `${request.targets.map(target => target.targetId).join(",")}\\n`); return { results: request.targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n'))

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.current.passes', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    expect(json(run.stdout)).toMatchObject({ scenarios: [{ id: 'fixture.current.passes', scope: 'add', status: 'PASS' }], targetCount: 1 })
    expect(await readFile(join(root, 'runs'), 'utf8')).toBe('add\n')
  })

  it('rejects unsafe document layouts and escaped specification symlinks', async () => {
    const root = await emptyFixture()
    await configure(root, [{ match: '../outside/**/*.md', scope: 'current' }], ['runners: {}'])
    const unsafe = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(unsafe.status).toBe(1)

    await configure(root, [{ match: 'specs/**/*.md', scope: 'current' }], ['runners: {}'])
    const outside = await mkdtemp(join(tmpdir(), 'focused-spec-outside-'))
    roots.push(outside)
    await put(outside, 'escape.md', nativeScenario('fixture.escape'))
    await mkdir(join(root, 'specs'), { recursive: true })
    await symlink(outside, join(root, 'specs/linked'), 'junction')
    const escaped = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(escaped.status).toBe(1)
    expect(JSON.stringify(json(escaped.stdout))).toMatch(/outside|escape|project root/iu)
  })

  it('rejects runner timeouts that overflow the host timer', async () => {
    const root = await fixture()
    await configure(root, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
      '    timeoutMs: 2147482648',
    ])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('timeoutMs') })]) })
    expect(result.stderr).not.toContain('TimeoutOverflowWarning')
  })

  it('rejects invalid runner paths and non-JSON options', async () => {
    const root = await fixture()
    await configure(root, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ../outside.ts',
    ])
    const pathResult = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(pathResult.status).toBe(1)
    expect(json(pathResult.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('project root') })]) })

    await configure(root, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
      '    options: 1e999',
    ])
    const optionsResult = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(optionsResult.status).toBe(1)
    expect(json(optionsResult.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('JSON-compatible') })]) })
  })

  it('rejects invalid or missing selected scenarios before execution', async () => {
    const root = await fixture()
    const invalid = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.future.planned', '--json'], { encoding: 'utf8' })
    expect(invalid.status).toBe(1)
    expect(json(invalid.stdout)).toMatchObject({
      valid: false,
      executionStarted: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.future.planned', message: expect.stringContaining('planned evidence is not allowed') })]),
    })

    const missing = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'add', '--scenario', 'fixture.missing', '--json'], { encoding: 'utf8' })
    expect(missing.status).toBe(1)
    expect(json(missing.stdout)).toMatchObject({ valid: false, executionStarted: false })
  })

  it('validates and runs every matching scope for a selected scenario ID', async () => {
    const root = await fixture()
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Add occurrence'))
    await put(root, 'openspec/changes/other/specs/new/spec.md', nativeScenario('fixture.current.passes', 'Other occurrence'))
    await writeRegistry(root, [
      baselineEntries[0]!,
      { scope: 'add', id: 'fixture.current.passes', evidence: ['fixture::add'] },
      { scope: 'other', id: 'fixture.current.passes', evidence: ['fixture::other'] },
    ])

    const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scenario', 'fixture.current.passes', '--json'], { encoding: 'utf8' })

    expect(run.status).toBe(0)
    const output = json(run.stdout)
    expect(output).toMatchObject({ success: true, validationScope: { scopes: { mode: 'all' }, scenario: 'fixture.current.passes' }, targetCount: 3 })
    expect(output.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'current', status: 'PASS' }),
      expect.objectContaining({ scope: 'add', status: 'PASS' }),
      expect.objectContaining({ scope: 'other', status: 'PASS' }),
    ]))
  })

  it('rejects a selected scope with no documents', async () => {
    const root = await fixture()

    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'missing', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({
      valid: false,
      executionStarted: false,
      validationScope: { scopes: { mode: 'selected', name: 'missing' } },
      executionSelection: { scopes: { mode: 'selected', name: 'missing' } },
    })
  })

  it('rejects a document claimed by multiple layouts', async () => {
    const root = await emptyFixture()
    await configure(root, [
      { match: 'specs/**/spec.md', scope: 'current' },
      { match: 'specs/{scope}/spec.md' },
    ])
    await put(root, 'specs/auth/spec.md', nativeScenario('layout.overlap'))
    await writeRegistry(root, [{ scope: 'current', id: 'layout.overlap', evidence: ['fixture::overlap'] }])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--syntax-only', '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(JSON.stringify(json(result.stdout))).toMatch(/claim|multiple|overlap/iu)
  })

  it('discovers fixed and captured scope documents from declared patterns', async () => {
    const root = await emptyFixture()
    await configure(root, [
      { match: 'openspec/changes/{scope}/spec.md' },
      { match: 'features/{scope}/capabilities/**/spec.md' },
      { match: 'specs/**/*.md', scope: 'current' },
    ], [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
    ])
    await put(root, 'openspec/changes/add/spec.md', nativeScenario('layout.adjacent'))
    await put(root, 'features/account/capabilities/auth/spec.md', nativeScenario('layout.nested'))
    await put(root, 'specs/current.md', nativeScenario('layout.fixed'))
    await writeRegistry(root, [
      { scope: 'add', id: 'layout.adjacent', evidence: ['fixture::adjacent'] },
      { scope: 'account', id: 'layout.nested', evidence: ['fixture::nested'] },
      { scope: 'current', id: 'layout.fixed', evidence: ['fixture::fixed'] },
    ])
    await put(root, 'runner.ts', 'export default { apiVersion: 1, async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } }, async run() { return { results: [] } } }')

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(0)
    expect(json(result.stdout)).toMatchObject({ valid: true, scenarios: 3, targets: 3 })
  })
  it('rejects excessive document and exclusion glob complexity', async () => {
    const root = await emptyFixture()
    const deep = '{'.repeat(40) + 'a,b' + '}'.repeat(40)
    for (const layout of [
      { match: `specs/${deep}.md`, scope: 'current' },
      { match: 'specs/@(@(@(a))).md', scope: 'current' },
      { match: `specs/[${deep}].md`, scope: 'current' },
      { match: `specs/${'a'.repeat(4096)}.md`, scope: 'current' },
      { match: `specs/${'{a}'.repeat(129)}.md`, scope: 'current' },
      { match: 'specs/{1..257}.md', scope: 'current' },
      { match: 'specs/**/*.md', scope: 'current', exclude: [`specs/${deep}.md`] },
      { match: 'specs/**/*.md', scope: 'current', exclude: ['specs/{1..257}.md'] },
    ]) {
      await configure(root, [layout], ['runners: {}'])
      const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8', timeout: 10000 })
      expect(result.status).toBe(1)
      expect(json(result.stdout)).toMatchObject({ valid: false, executionStarted: false,
        violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/glob pattern exceeds/u) })]) })
      expect(result.stderr).not.toContain('Maximum call stack')
    }
  })

  it('preserves padded stepped and hidden document discovery', async () => {
    const root = await emptyFixture()
    await configure(root, [
      { match: 'specs/record-{01..03}.md', scope: 'padded' },
      { match: 'changes/{scope}/case-{1..5..2}.md', exclude: ['changes/*/case-3.md'] },
      { match: 'specs/.hidden/*.md', scope: 'hidden' },
    ])
    const entries: RegistryEntry[] = []
    for (const [path, scope, id] of [
      ['specs/record-01.md', 'padded', 'range.one'], ['specs/record-02.md', 'padded', 'range.two'],
      ['specs/record-03.md', 'padded', 'range.three'], ['changes/alpha.one/case-1.md', 'alpha.one', 'step.one'],
      ['changes/alpha.one/case-5.md', 'alpha.one', 'step.five'], ['specs/.hidden/item.md', 'hidden', 'hidden.item'],
    ] as const) {
      await put(root, path, nativeScenario(id))
      entries.push({ scope, id, evidence: ['planned:fixture::future'] })
    }
    for (const path of ['specs/record-04.md', 'changes/alpha.one/case-2.md', 'changes/alpha.one/case-3.md']) {
      await put(root, path, nativeScenario('unselected.item'))
    }
    await writeRegistry(root, entries)
    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    expect(json(result.stdout)).toMatchObject({ valid: true, scenarios: 6 })
  })

  it('rejects inherited Gherkin tags for the selected ID without blocking unrelated IDs', async () => {
    const root = await fixture()
    await configure(root, [{ match: 'features/**/*.feature', scope: 'current' }])
    await writeRegistry(root, [baselineEntries[0]!])
    const feature = 'Feature: Native login\n\n@focused.fixture.current.passes\nScenario: Selected login\n  When login is attempted\n  Then its outcome is checked\n'
    await put(root, 'features/auth.feature', '@focused.fixture.current.passes\n' + feature)
    const selectedArgs = [cli, 'run', '--root', root, '--scenario', 'fixture.current.passes', '--json']
    const inherited = spawnSync(process.execPath, selectedArgs, { encoding: 'utf8' })
    expect(inherited.status).toBe(1)
    expect(json(inherited.stdout)).toMatchObject({ valid: false, executionStarted: false,
      violations: expect.arrayContaining([expect.objectContaining({ scenarioId: 'fixture.current.passes' })]) })
    await put(root, 'features/auth.feature', '@focused.fixture.other.item\n' + feature)
    const isolated = spawnSync(process.execPath, selectedArgs, { encoding: 'utf8' })
    expect(isolated.status).toBe(0)
    expect(json(isolated.stdout)).toMatchObject({ scenarios: [{ id: 'fixture.current.passes', status: 'PASS' }] })
    const full = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    expect(full.status).toBe(1)
    expect(json(full.stdout)).toMatchObject({ valid: false, executionStarted: false })
  })


  it('attributes timed runner operations to selected unique workloads', async () => {
    const root = await fixture()
    await put(root, 'openspec/specs/current/spec.md', [
      nativeScenario('timing.current.first', 'First selected workload'),
      nativeScenario('timing.current.second', 'Second selected workload'),
    ].join('\n\n'))
    await put(root, 'openspec/changes/add/specs/new/spec.md', nativeScenario('timing.add.dormant', 'Unselected workload'))
    await writeRegistry(root, [
      { scope: 'current', id: 'timing.current.first', evidence: ['alpha::shared', 'alpha::one', 'beta::two'] },
      { scope: 'current', id: 'timing.current.second', evidence: ['alpha::shared'] },
      { scope: 'add', id: 'timing.add.dormant', evidence: ['dormant::hidden'] },
    ])
    await configure(root, openSpecLayouts, [
      'runners:',
      '  alpha: { module: ./alpha-runner.ts }',
      '  beta: { module: ./beta-runner.ts }',
      '  dormant: { module: ./dormant-runner.ts }',
    ])
    const passingRunner = [
      'export default { apiVersion: 1,',
      '  async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async partition() { throw new Error("partition must stay dormant in serial execution") },',
      '  async run({ targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "pass" })) } },',
      '}',
    ].join('\n')
    await put(root, 'alpha-runner.ts', passingRunner)
    await put(root, 'beta-runner.ts', passingRunner)
    await put(root, 'dormant-runner.ts', 'throw new Error("unselected runner must not load")')

    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--json', '--timings'], { encoding: 'utf8' })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    const output = json(result.stdout)
    expect(output).toMatchObject({ success: true, targetCount: 3, scenarios: [
      expect.objectContaining({ id: 'timing.current.first', status: 'PASS' }),
      expect.objectContaining({ id: 'timing.current.second', status: 'PASS' }),
    ] })
    const timings = timingArrays(output)
    expect(runnerFacts(timings.runnerOperations)).toEqual([
      { runnerId: 'alpha', operation: 'resolve', selectorCount: 2, outcome: 'completed' },
      { runnerId: 'beta', operation: 'resolve', selectorCount: 1, outcome: 'completed' },
      { runnerId: 'alpha', operation: 'run', targetCount: 2, outcome: 'completed' },
      { runnerId: 'beta', operation: 'run', targetCount: 1, outcome: 'completed' },
    ])
    expect(timings.runnerOperations.every(row => row.operation === 'resolve'
      ? row.targetCount === undefined
      : row.selectorCount === undefined)).toBe(true)

    const text = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--timings'], { encoding: 'utf8' })
    expect(text.status, text.stderr || text.stdout).toBe(0)
    expect(text.stdout).toMatch(/runner alpha resolve: .* selectors 2, completed/u)
    expect(text.stdout).toMatch(/runner beta resolve: .* selectors 1, completed/u)
    expect(text.stdout).toMatch(/runner alpha run: .* targets 2, completed/u)
    expect(text.stdout).toMatch(/runner beta run: .* targets 1, completed/u)
    expect(text.stdout).not.toContain('runner dormant')
    expect(text.stdout).not.toContain(' partition:')
  })

  it('attributes document parsing to configured formats and reused hosts', async () => {
    const root = await emptyFixture()
    await put(root, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats:',
      '    alpha:',
      '      package: "@focused-spec/format-registry"',
      '      options: { parser: { module: ./alpha-format.ts } }',
      '    beta: { module: ./beta-format.ts }',
      '  documents:',
      '    - match: "docs/*.md"',
      '      format: alpha',
      '      scope: current',
      '      exclude: ["docs/excluded.md"]',
      '    - match: "stories/*.story"',
      '      format: beta',
      '      scope: current',
      '    - match: "changes/{scope}/*.story"',
      '      format: beta',
      'runners: {}',
    ].join('\n'))
    await put(root, 'alpha-format.ts', [
      'export default { apiVersion: 2, parse({ source }) {',
      '  const markerId = source.trim()',
      '  return { items: [{ line: 1, name: markerId, nativeIds: [markerId], markerId }], diagnostics: [] }',
      '} }',
    ].join('\n'))
    await put(root, 'beta-format.ts', 'export default { apiVersion: 2, parse() { return { items: [], diagnostics: [{ message: "fixture native diagnostic" }] } } }')
    await put(root, 'docs/first.md', 'format.current.first')
    await put(root, 'docs/second.md', 'format.current.second')
    await put(root, 'docs/excluded.md', 'format.current.excluded')
    await put(root, 'stories/problem.story', 'diagnostic')
    await put(root, 'changes/add/dormant.story', 'unselected')
    await writeRegistry(root, [
      { scope: 'current', id: 'format.current.first', evidence: ['planned:fixture::first'] },
      { scope: 'current', id: 'format.current.second', evidence: ['planned:fixture::second'] },
    ])

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'current', '--syntax-only', '--json', '--timings'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    const output = json(result.stdout)
    expect(JSON.stringify(output.violations)).toContain('fixture native diagnostic')
    const timings = timingArrays(output)
    expect(timings.runnerOperations).toEqual([])
    expect(formatFacts(timings.formatOperations)).toEqual([
      { formatId: 'alpha', path: 'docs/first.md', scope: 'current', coldStart: true, outcome: 'completed' },
      { formatId: 'alpha', path: 'docs/second.md', scope: 'current', coldStart: false, outcome: 'completed' },
      { formatId: 'beta', path: 'stories/problem.story', scope: 'current', coldStart: true, outcome: 'completed' },
    ])

    const text = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--scope', 'current', '--syntax-only', '--timings'], { encoding: 'utf8' })
    expect(text.status).toBe(1)
    expect(text.stderr).toMatch(/format alpha \[current\] docs\/first\.md: .* cold-start, completed/u)
    expect(text.stderr).toMatch(/format alpha \[current\] docs\/second\.md: .* reused-host, completed/u)
    expect(text.stderr).toMatch(/format beta \[current\] stories\/problem\.story: .* cold-start, completed/u)
    expect(text.stderr).not.toContain('excluded.md')
    expect(text.stderr).not.toContain('dormant.story')
    expect(text.stderr).not.toContain('  runner ')
  })

  it('retains attempted plugin timings across errors and negative results', async () => {
    const parseRoot = await emptyFixture()
    await put(parseRoot, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats:',
      '    broken:',
      '      package: "@focused-spec/format-registry"',
      '      options: { parser: { module: ./broken-format.ts } }',
      '  documents:',
      '    - match: "specs/*.md"',
      '      format: broken',
      '      scope: current',
      'runners: {}',
    ].join('\n'))
    await put(parseRoot, 'broken-format.ts', 'export default { apiVersion: 2, parse() { return { items: "malformed", diagnostics: [] } } }')
    await put(parseRoot, 'specs/broken.md', 'malformed parse response')
    const parseFailure = spawnSync(process.execPath, [cli, 'validate', '--root', parseRoot, '--syntax-only', '--json', '--timings'], { encoding: 'utf8' })
    expect(parseFailure.status).toBe(1)
    const parseOutput = json(parseFailure.stdout)
    expect(JSON.stringify(parseOutput.violations)).toContain('format response')
    const parseTimings = timingArrays(parseOutput)
    expect(formatFacts(parseTimings.formatOperations)).toEqual([
      { formatId: 'broken', path: 'specs/broken.md', scope: 'current', coldStart: true, outcome: 'error' },
    ])
    expect(parseTimings.runnerOperations).toEqual([])

    const resolveRoot = await fixture()
    await rm(join(resolveRoot, 'openspec/changes'), { recursive: true })
    await writeRegistry(resolveRoot, [baselineEntries[0]!])
    await put(resolveRoot, 'runner.ts', [
      'export default { apiVersion: 1,',
      '  async resolve() { process.exit(23) },',
      '  async run() { throw new Error("run must not start") },',
      '}',
    ].join('\n'))
    const resolveFailure = spawnSync(process.execPath, [cli, 'run', '--root', resolveRoot, '--json', '--timings'], { encoding: 'utf8' })
    expect(resolveFailure.status).toBe(1)
    const resolveOutput = json(resolveFailure.stdout)
    expect(resolveOutput).toMatchObject({ valid: false, executionStarted: false })
    expect(JSON.stringify(resolveOutput.violations)).toContain('exited before responding with code 23')
    const resolveTimings = timingArrays(resolveOutput)
    expect(runnerFacts(resolveTimings.runnerOperations)).toEqual([
      { runnerId: 'fixture', operation: 'resolve', selectorCount: 1, outcome: 'error' },
    ])

    const runRoot = await fixture()
    await rm(join(runRoot, 'openspec/changes'), { recursive: true })
    await writeRegistry(runRoot, [baselineEntries[0]!])
    await configure(runRoot, openSpecLayouts, [
      'runners:',
      '  fixture:',
      '    module: ./runner.ts',
      '    timeoutMs: 5',
    ])
    await put(runRoot, 'runner.ts', [
      'export default { apiVersion: 1,',
      '  async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run() { return Promise.withResolvers().promise },',
      '}',
    ].join('\n'))
    const runFailure = spawnSync(process.execPath, [cli, 'run', '--root', runRoot, '--json', '--timings'], { encoding: 'utf8', timeout: 10_000 })
    expect(runFailure.error).toBeUndefined()
    expect(runFailure.status).toBe(1)
    const runOutput = json(runFailure.stdout)
    expect(runOutput).toMatchObject({ success: false, scenarios: [expect.objectContaining({ status: 'ERROR' })] })
    expect(JSON.stringify(runOutput.scenarios)).toContain('timed out')
    const runTimings = timingArrays(runOutput)
    expect(runnerFacts(runTimings.runnerOperations)).toEqual([
      { runnerId: 'fixture', operation: 'resolve', selectorCount: 1, outcome: 'completed' },
      { runnerId: 'fixture', operation: 'run', targetCount: 1, outcome: 'error' },
    ])

    await configure(runRoot, openSpecLayouts)
    await put(runRoot, 'runner.ts', [
      'export default { apiVersion: 1,',
      '  async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      '  async run({ targets }) { return { results: targets.map(target => ({ targetId: target.targetId, status: "fail", diagnostic: "assertion failed" })) } },',
      '}',
    ].join('\n'))
    const negative = spawnSync(process.execPath, [cli, 'run', '--root', runRoot, '--json', '--timings'], { encoding: 'utf8' })
    expect(negative.status).toBe(1)
    const negativeOutput = json(negative.stdout)
    expect(negativeOutput).toMatchObject({ success: false, scenarios: [expect.objectContaining({ status: 'FAIL' })] })
    expect(JSON.stringify(negativeOutput.scenarios)).toContain('assertion failed')
    const negativeTimings = timingArrays(negativeOutput)
    expect(runnerFacts(negativeTimings.runnerOperations)).toEqual([
      { runnerId: 'fixture', operation: 'resolve', selectorCount: 1, outcome: 'completed' },
      { runnerId: 'fixture', operation: 'run', targetCount: 1, outcome: 'completed' },
    ])
  })

  it('reports phase timings only when requested', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
    await writeRegistry(root, [baselineEntries[0]!])

    const ordinary = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    const timed = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json', '--timings'], { encoding: 'utf8' })
    const ordinaryText = spawnSync(process.execPath, [cli, 'run', '--root', root], { encoding: 'utf8' })
    const timedText = spawnSync(process.execPath, [cli, 'run', '--root', root, '--timings'], { encoding: 'utf8' })

    expect(ordinary.status).toBe(0)
    expect(timed.status).toBe(0)
    expect(ordinaryText.status).toBe(0)
    expect(timedText.status).toBe(0)
    const ordinaryOutput = json(ordinary.stdout)
    const timedOutput = json(timed.stdout)
    expect(ordinaryOutput).not.toHaveProperty('timings')
    const { timings: _timings, ...timedResult } = timedOutput
    expect(timedResult).toEqual(ordinaryOutput)
    expect(timedOutput).toMatchObject({
      success: true,
      timings: {
        validationMs: expect.any(Number),
        resolutionMs: expect.any(Number),
        executionMs: expect.any(Number),
        totalMs: expect.any(Number),
      },
    })
    const arrays = timingArrays(timedOutput)
    expect(runnerFacts(arrays.runnerOperations)).toEqual([
      { runnerId: 'fixture', operation: 'resolve', selectorCount: 1, outcome: 'completed' },
      { runnerId: 'fixture', operation: 'run', targetCount: 1, outcome: 'completed' },
    ])
    expect(formatFacts(arrays.formatOperations)).toEqual([
      { formatId: 'markdown', path: 'openspec/specs/current/spec.md', scope: 'current', coldStart: true, outcome: 'completed' },
    ])
    expect(ordinaryText.stdout).not.toContain('timings:')
    expect(ordinaryText.stdout).not.toContain('  runner ')
    expect(ordinaryText.stdout).not.toContain('  format ')
    const timingStart = timedText.stdout.indexOf('timings:')
    expect(timingStart).toBeGreaterThanOrEqual(0)
    expect(timedText.stdout.slice(0, timingStart)).toBe(ordinaryText.stdout)
    expect(timedText.stdout.slice(timingStart)).toMatch(/runner fixture resolve: .* selectors 1, completed/u)
    expect(timedText.stdout.slice(timingStart)).toMatch(/runner fixture run: .* targets 1, completed/u)
    expect(timedText.stdout.slice(timingStart)).toMatch(/format markdown \[current\] openspec\/specs\/current\/spec\.md: .* cold-start, completed/u)
  })
  it('preserves native run context independently of target provenance', async () => {
    const root = await fixture()
    await put(root, 'runner.ts', `export default {apiVersion:1,async resolve({selectors}){return {targets:selectors.map(selector=>({selector,targetId:selector,displayName:'Not the native name',source:{path:'tests/target.ts',line:91}})),errors:[]}},async run({targets}){return {results:targets.map(t=>({targetId:t.targetId,status:'pass'}))}}}`)
    const args = [cli,'run','--root',root,'--scope','current']
    const report = spawnSync(process.execPath,[...args,'--json'],{encoding:'utf8'})
    expect(report.status).toBe(0)
    expect(json(report.stdout)).toMatchObject({scenarios:[{id:'fixture.current.passes',name:'Scenario: Current evidence passes',source:{path:'openspec/specs/current/spec.md',line:2},evidence:[{reference:'fixture::current',status:'PASS'}]}]})
    const text = spawnSync(process.execPath,args,{encoding:'utf8'})
    expect(text.status).toBe(0)
    expect(text.stdout).toContain('Current evidence passes (openspec/specs/current/spec.md:2)')
    expect(text.stdout).not.toContain('tests/target.ts')
  })

  it('renders compact detailed and JSON events from the same execution contract', async () => {
    const root = await fixture()
    await configureInline(root)
    await put(root,'specs/events.md',inlineScenario('events',['fixture::passing','fixture::failing']))
    await put(root,'runner.ts',`import {appendFileSync} from 'node:fs';import {join} from 'node:path';export default {apiVersion:1,async resolve({selectors}){return {targets:selectors.map(selector=>({selector,targetId:selector,displayName:selector})),errors:[]}},async run({projectRoot,targets}){for(const t of targets)appendFileSync(join(projectRoot,'runs'),t.targetId+'\\n');return {results:targets.map(t=>({targetId:t.targetId,status:t.targetId==='passing'?'pass':'fail',events:[{kind:'custom.phase\\u001b',message:t.targetId+' detail\\u001b[31m\\n'},{kind:'custom.payload',message:'Result',data:{choice:t.targetId+'\\u001b'}}]}))}}}`)
    const outputs = [[],['--details'],['--json'],['--details','--json']].map(flags => spawnSync(process.execPath,[cli,'run','--root',root,...flags],{encoding:'utf8'}))
    expect(outputs.map(o=>o.status)).toEqual([1,1,1,1])
    const [compact,detailed,plainJson,detailJson] = outputs as [SpawnSyncReturns<string>,SpawnSyncReturns<string>,SpawnSyncReturns<string>,SpawnSyncReturns<string>]
    expect(compact.stdout).not.toContain('passing detail')
    expect(compact.stdout).toContain('failing detail\\u001b[31m\\u000a')
    expect(detailed.stdout).toContain('passing detail\\u001b[31m\\u000a')
    expect(detailed.stdout).toContain('failing detail\\u001b[31m\\u000a')
    expect(detailed.stdout).not.toContain('\u001b')
    expect(detailed.stdout).toContain('[custom.phase\\u001b] passing detail\\u001b[31m\\u000a')
    expect(detailed.stdout).toContain('[custom.payload] Result {"choice":"passing\\u001b"}')
    expect(json(plainJson.stdout)).toEqual(json(detailJson.stdout))
    expect(json(plainJson.stdout)).toMatchObject({success:false,targetCount:2,scenarios:[{status:'FAIL',evidence:[{status:'PASS',events:[{kind:'custom.phase\u001b',message:'passing detail\u001b[31m\n'},{kind:'custom.payload',message:'Result',data:{choice:'passing\u001b'}}]},{status:'FAIL',events:[{kind:'custom.phase\u001b',message:'failing detail\u001b[31m\n'},{kind:'custom.payload',message:'Result',data:{choice:'failing\u001b'}}]}]}]})
    expect((await readFile(join(root,'runs'),'utf8')).trim().split('\n').sort()).toEqual([...Array(4).fill('passing'),...Array(4).fill('failing')].sort())
  })

  it('does not execute unresolved evidence when details are requested', async () => {
    const root = await fixture()
    await put(root,'runner.ts',`import {writeFileSync} from 'node:fs';import {join} from 'node:path';export default {apiVersion:1,async resolve({selectors}){return {targets:[],errors:selectors.map(selector=>({selector,message:'not found'}))}},async run({projectRoot}){writeFileSync(join(projectRoot,'executed'),'yes');return {results:[]}}}`)
    const result = spawnSync(process.execPath,[cli,'run','--root',root,'--scope','current','--details','--json'],{encoding:'utf8'})
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({valid:false,executionStarted:false})
    expect(json(result.stdout)).not.toHaveProperty('scenarios')
    await expect(readFile(join(root,'executed'),'utf8')).rejects.toMatchObject({code:'ENOENT'})
    const invalid = spawnSync(process.execPath,[cli,'validate','--root',root,'--details','--json'],{encoding:'utf8'})
    expect(invalid.status).toBe(1)
    expect(json(invalid.stderr)).toMatchObject({error:{code:'invalid_arguments'}})
  })
})
