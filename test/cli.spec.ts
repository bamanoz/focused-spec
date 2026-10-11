import { spawn, spawnSync } from 'node:child_process'
import { cp, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
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
    ...(layout.scope === undefined ? [] : [`      scope: ${layout.scope}`]),
    ...(layout.exclude === undefined ? [] : [
      '      exclude:',
      ...layout.exclude.map(pattern => `        - ${JSON.stringify(pattern)}`),
    ]),
  ])
  return [
    'version: 3',
    'specifications:',
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
  await put(root, '.focused-spec/config.yaml', configYaml(layouts, runners))
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

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('focused-spec CLI', () => {
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
        const options = [...result.stdout.matchAll(/^\s+(--[a-z-]+)/gmu)].map(match => match[1])
        expect(options.sort()).toEqual((command === 'validate'
          ? ['--root', '--config', '--scope', '--strict', '--syntax-only', '--json', '--timings']
          : ['--root', '--config', '--scope', '--scenario', '--allow-skip', '--json', '--timings']).sort())
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
    await cp(new URL('../dist/', import.meta.url), join(root, 'dist'), { recursive: true })
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

  it.skipIf(process.platform === 'win32')('installs only confirmed interactive init targets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-terminal-'))
    roots.push(root)
    await mkdir(join(root, '.omp'))
    const home = await mkdtemp(join(tmpdir(), 'focused-init-terminal-home-'))
    roots.push(home)
    const interact = async (answer: string): Promise<{ code: number | null; output: string }> => {
      return await new Promise((resolve, reject) => {
        // Python's standard-library PTY avoids Darwin script's rejection of pipe descriptors.
        const terminal = `import os, pty, select, sys
pid, master = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], sys.argv[1:])
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
        const child = spawn('python3', ['-c', terminal, process.execPath, cli, 'init', root], { cwd: root, env: { ...process.env, HOME: home, USERPROFILE: home } })
        let output = ''
        let sent = false
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`interactive init timed out: ${output}`)) }, 10000)
        child.stdout.on('data', chunk => {
          output += String(chunk)
          if (!sent && output.includes('empty cancels):')) { sent = true; child.stdin.write(answer) }
        })
        child.stderr.on('data', chunk => { output += String(chunk) })
        child.once('error', error => { clearTimeout(timer); reject(error) })
        child.once('close', code => { clearTimeout(timer); resolve({ code, output }) })
      })
    }
    for (const answer of ['\n', '\u0003', '\u0004']) {
      const cancelled = await interact(answer)
      expect(cancelled.code, cancelled.output).toBe(1)
      expect(await readdir(root, { recursive: true })).toEqual(['.omp'])
    }
    const installed = await interact('claude\n')
    expect(installed.output).toContain(`GLOBAL: ${join(home, '.minimax/skills/focused-spec/SKILL.md')}`)
    expect(installed.code, installed.output).toBe(0)
    expect(await readFile(join(root, '.claude/skills/focused-spec/SKILL.md'), 'utf8')).toContain('name: focused-spec')
    expect(await readdir(join(root, '.omp'))).toEqual([])
    expect(await readdir(home)).toEqual([])
  }, 30000)

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
    const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
    expect(response).toMatchObject({ protocolVersion: 1, package: { name: 'focused-spec', version: metadata.version }, topic: 'workflow' })
    expect(response.content).toBe(await readFile(new URL('../guidance/workflow.md', import.meta.url), 'utf8'))
    expect(await readdir(root, { recursive: true })).toEqual(before)
    const text = spawnSync(process.execPath, [cli, 'instructions'], { cwd: root, encoding: 'utf8' })
    expect(text.status, text.stderr).toBe(0)
    expect(text.stdout).toContain(String(response.content))
    expect(text.stdout).toContain(metadata.version)
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
    await cp(new URL('../dist/', import.meta.url), join(root, 'dist'), { recursive: true })
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
    await put(root, 'package.json', '{"type":"module"}')
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    for (const args of [['instructions', '--help'], ['instructions', '-h'], ['help', 'instructions'], ['instructions', '--protocol', '2', '--json', '--help']]) {
      const result = spawnSync(process.execPath, [join(root, 'dist/cli.js'), ...args], { cwd: root, encoding: 'utf8' })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toMatch(/--protocol.*default: 1/u)
      expect(result.stdout).toMatch(/--topic.*workflow.*runners/u)
      expect(result.stdout).toContain('--json')
      expect(result.stdout).not.toMatch(/^\{/u)
    }
  })

  it('rejects invalid invocations without treating them as successful help', async () => {
    const root = await emptyFixture()
    for (const args of [[], ['unknown'], ['help', 'unknown'], ['agent-guide'], ['agent-guide', '--help'], ['help', 'agent-guide'], ['transition'], ['transition', '--help'], ['help', 'transition'], ['transition', 'prepare', '--help'], ['transition', 'verify', '--help'], ['transition', 'prepare', 'plan.yaml', '--snapshot', 'snapshot.json'], ['transition', 'verify', 'snapshot.json', '--final'], ['run', '--unknown'], ['run', '--scope'], ['validate', '--scenario', 'fixture.current.passes']]) {
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

  it('rejects obsolete version 2 configuration with migration guidance', async () => {
    const root = await emptyFixture()
    await put(root, '.focused-spec/config.yaml', configYaml([{ match: 'specs/**/*.md', scope: 'current' }], ['runners: {}']).replace('version: 3', 'version: 2'))

    const result = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, violations: expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/(?:version 3|migrat)/iu) })]) })
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

    await configure(root, [{ match: 'specs/**/*.json', scope: 'current' }], ['runners: {}'])
    const unsupported = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--json'], { encoding: 'utf8' })
    expect(unsupported.status).toBe(1)

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


  it('reports phase timings only when requested', async () => {
    const root = await fixture()
    await rm(join(root, 'openspec/changes'), { recursive: true })
    await writeRegistry(root, [baselineEntries[0]!])

    const ordinary = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json'], { encoding: 'utf8' })
    const timed = spawnSync(process.execPath, [cli, 'run', '--root', root, '--json', '--timings'], { encoding: 'utf8' })

    expect(ordinary.status).toBe(0)
    expect(timed.status).toBe(0)
    expect(json(ordinary.stdout)).not.toHaveProperty('timings')
    expect(json(timed.stdout)).toMatchObject({
      success: true,
      timings: {
        validationMs: expect.any(Number),
        resolutionMs: expect.any(Number),
        executionMs: expect.any(Number),
        totalMs: expect.any(Number),
      },
    })
  })
})
