import { spawn } from 'node:child_process'
import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const groups = new Set<number>()
const runtime = fileURLToPath(new URL('../packages/core/dist/', import.meta.url))
function kill(pid: number): void {
  try { process.kill(-pid, 'SIGKILL') }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error }
}
afterEach(async () => {
  for (const pid of groups) kill(pid)
  groups.clear()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-spec-audit-runtime-'))
  roots.push(root)
  await writeFile(join(root, 'package.json'), '{"type":"module"}\n')
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
  await writeFile(join(root, 'healthy.mjs'), `export default {
apiVersion: 1,
async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },
async run({ targets }) { return { results: targets.map(({ targetId }) => ({ targetId, status: 'pass' })) } }
}\n`)
  return root
}

async function invoke(root: string, entry: string, args: readonly string[] = [], deadline = 8_000): Promise<{ code: number | null; stdout: string; stderr: string; expired: boolean }> {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: root, detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const pid = child.pid
  if (pid === undefined) throw new Error('runtime probe failed to spawn')
  groups.add(pid)
  let stdout = ''
  let stderr = ''
  let expired = false
  child.stdout.on('data', chunk => { stdout += String(chunk) })
  child.stderr.on('data', chunk => { stderr += String(chunk) })
  const timer = setTimeout(() => { expired = true; kill(pid) }, deadline)
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', resolve)
    })
    return { code, stdout, stderr, expired }
  } finally {
    clearTimeout(timer)
    kill(pid)
    groups.delete(pid)
  }
}

async function probe(root: string): Promise<string> {
  const entry = join(root, 'probe.mjs')
  await writeFile(entry, `
import { resolveRunnerTargets, runRunnerTargets } from ${JSON.stringify(pathToFileURL(join(runtime, 'runner-client.js')).href)}
import { readFile } from 'node:fs/promises'
const target = { selector: 'selected', targetId: 'selected', displayName: 'selected' }
try {
  await runRunnerTargets(process.cwd(), 'broken', { module: './broken.mjs', timeoutMs: 500 }, [target])
  console.log(JSON.stringify({ status: 'PASS' }))
} catch (error) {
  console.log(JSON.stringify({ status: 'ERROR', diagnostic: error.message }))
}
const result = await resolveRunnerTargets(process.cwd(), 'healthy', { module: './healthy.mjs', timeoutMs: 2000 }, ['selected'])
console.log(JSON.stringify({ alive: true, targets: result.targets }))
try {
  const { descendant, host } = JSON.parse(await readFile('./descendant.json', 'utf8'))
  try { process.kill(host, 0); throw new Error('timed-out host is still alive') }
  catch (error) { if (error.code !== 'ESRCH') throw error }
  process.kill(descendant, 'SIGKILL')
} catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error }
`)
  return entry
}

async function configure(root: string): Promise<void> {
  await mkdir(join(root, '.focused-spec'))
  await writeFile(join(root, '.focused-spec/config.yaml'), `version: 5
specifications:
  formats:
    fixture:
      package: "@focused-spec/format-registry"
      options:
        parser: { module: ./format.mjs }
  documents:
    - match: spec.md
      format: fixture
      scope: selected
runners:
  fixture: { module: ./healthy.mjs }
`)
  await writeFile(join(root, '.focused-spec/evidence.yaml'), 'scopes:\n  selected:\n    audit.selected:\n      evidence: ["fixture::selected"]\n')
  await writeFile(join(root, 'spec.md'), 'Selected native item\n')
  await writeFile(join(root, 'format.mjs'), `import { writeFile } from 'node:fs/promises'
await writeFile(new URL('./format-loaded', import.meta.url), 'loaded')
export default { apiVersion: 2, parse() { return { items: [{ line: 1, name: 'Selected', nativeIds: [], markerId: 'audit.selected' }], diagnostics: [] } } }
`)
  await writeFile(join(root, 'healthy.mjs'), `import { appendFile } from 'node:fs/promises'
const mark = operation => appendFile(new URL('./runner-loaded', import.meta.url), operation + '\\n')
export default { apiVersion: 1,
async resolve({ selectors }) { await mark('resolve'); return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },
async run({ targets }) { await mark('run'); return { results: targets.map(({ targetId }) => ({ targetId, status: 'pass' })) } }
}
`)
}

async function boundaryWorkspace(reference = 'fixture::selected'): Promise<string> {
  const root = await workspace()
  await mkdir(join(root, '.focused-spec'))
  await writeFile(join(root, '.focused-spec/config.yaml'), JSON.stringify({
    version: 5,
    specifications: { formats: { native: { module: './format.mjs' } }, documents: [{ match: 'spec.json', scope: 'current', format: 'native' }] },
    runners: { fixture: { module: './healthy.mjs' }, planned: { module: './healthy.mjs' } },
    execution: { maxConcurrentGroups: 2 },
  }))
  await writeFile(join(root, 'spec.json'), JSON.stringify({ items: [{ line: 1, name: 'Native outcome', nativeIds: [], markerId: 'boundary.outcome', evidence: [reference] }], diagnostics: [] }))
  await writeFile(join(root, 'format.mjs'), 'export default { apiVersion: 2, parse({ source }) { return JSON.parse(source) } }')
  return root
}

const lossyValues = [
  'NaN', 'Infinity', 'undefined', '{ missing: undefined }', '() => 42', 'Symbol("value")',
  'new Date(0)', 'new Map([["key", 1]])', '[, 1]', '{ toJSON() { return null } }',
  'Object.defineProperty({}, "value", { enumerable: true, get() { return null } })',
  'Object.defineProperty({}, "hidden", { value: 1 })', '{ [Symbol("key")]: 1 }',
  'Object.assign([1], { extra: 2 })',
  '(() => { const value = {}; value.self = value; return value })()',
]

async function boundaryCli(root: string, ...args: string[]) {
  return invoke(root, join(runtime, 'cli.js'), [...args, '--root', root])
}

const duplicates = [
  { label: 'run repeated scope', command: 'run', args: ['--scope', 'ignored', '--scope', 'selected'], option: '--scope' },
  { label: 'validate repeated scope', command: 'validate', args: ['--scope', 'ignored', '--scope', 'selected'], option: '--scope' },
  { label: 'run repeated json', command: 'run', args: ['--json', '--json'], option: '--json' },
  { label: 'validate repeated json', command: 'validate', args: ['--json', '--json'], option: '--json' },
  { label: 'instructions repeated json', command: 'instructions', args: ['--json', '--json'], option: '--json' },
  { label: 'instructions protocol 2 then 1', command: 'instructions', args: ['--protocol', '2', '--protocol', '1'], option: '--protocol' },
] as const

describe('audit runtime correctness', () => {
  it('rejects lossy runner responses before transport', async () => {
    const root = await boundaryWorkspace()
    for (const operation of ['resolve', 'partition', 'run']) {
      for (const expression of lossyValues) {
        await writeFile(join(root, 'healthy.mjs'), `import { appendFile } from 'node:fs/promises'
const invalid = () => (${expression})
export default { apiVersion: 1,
async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector, data: ${operation === 'resolve' ? 'invalid()' : '{ exact: [null, false, 42, "Δ"] }'} })), errors: [] } },
async partition({ targets }) { return { groups: [{ targetIds: targets.map(t => t.targetId), resources: [], ${operation === 'partition' ? 'invalid: invalid(),' : ''} }] } },
async run({ projectRoot, targets }) { await appendFile(projectRoot + '/executed', 'run\\n'); return { results: targets.map(t => ({ targetId: t.targetId, status: 'pass', events: [{ kind: 'custom', message: 'data', data: ${operation === 'run' ? 'invalid()' : 't.data'} }] })) } }
}`)
        await rm(join(root, 'executed'), { force: true })
        const result = await boundaryCli(root, 'run', '--json')
        expect(result.code, `${operation}: ${expression}: ${result.stdout || result.stderr}`).toBe(1)
        const output = JSON.parse(result.stdout)
        if (operation === 'resolve') {
          expect(output).toMatchObject({ valid: false, executionStarted: false })
        } else {
          expect(output).toMatchObject({ success: false, scenarios: [{ status: 'ERROR' }] })
        }
        if (operation !== 'run') await expect(access(join(root, 'executed'))).rejects.toMatchObject({ code: 'ENOENT' })
      }
    }
    await writeFile(join(root, 'healthy.mjs'), `export default { apiVersion: 1,
async resolve({ selectors }) { const shared = { exact: [null, false, 42, 'Δ'] }; return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector, data: { one: shared, two: shared } })), errors: [] } },
async run({ targets }) { return { results: targets.map(t => ({ targetId: t.targetId, status: 'pass', events: [{ kind: 'custom', message: 'data', data: t.data }] })) } }
}`)
    const valid = await boundaryCli(root, 'run', '--json')
    expect(valid.code, valid.stderr).toBe(0)
    expect(JSON.parse(valid.stdout).scenarios[0].evidence[0].events[0].data).toEqual({ one: { exact: [null, false, 42, 'Δ'] }, two: { exact: [null, false, 42, 'Δ'] } })
  }, 60_000)

  it('rejects lossy format responses before transport', async () => {
    const root = await boundaryWorkspace()
    await writeFile(join(root, 'healthy.mjs'), `import { writeFileSync } from 'node:fs'; writeFileSync(new URL('./runner-loaded', import.meta.url), 'loaded'); throw new Error('unexpected runner load')`)
    for (const operation of ['parse', 'bind']) {
      for (const expression of lossyValues) {
        await writeFile(join(root, 'format.mjs'), `export default { apiVersion: 2,
parse({ source }) { return { ...JSON.parse(source), ${operation === 'parse' ? `invalid: (${expression}),` : ''} } },
bind() { return { enrollments: [], diagnostics: [], sourceClaims: [], ${operation === 'bind' ? `invalid: (${expression}),` : ''} } }
}`)
        const result = await boundaryCli(root, 'run', '--json')
        expect(result.code, `${operation}: ${expression}`).toBe(1)
        expect(JSON.parse(result.stdout)).toMatchObject({ valid: false, executionStarted: false })
        await expect(access(join(root, 'runner-loaded'))).rejects.toMatchObject({ code: 'ENOENT' })
      }
    }
    await writeFile(join(root, 'format.mjs'), `export default { apiVersion: 2, parse({ source }) { return JSON.parse(source) }, bind() { return { enrollments: [], diagnostics: [], sourceClaims: [] } } }`)
    const valid = await boundaryCli(root, 'list', '--json')
    expect(valid.code, valid.stderr).toBe(0)
    expect(JSON.parse(valid.stdout)).toMatchObject({ valid: true, scenarios: [{ id: 'boundary.outcome', evidence: [{ reference: 'fixture::selected' }] }] })
  }, 60_000)

  it('executes the planned runner without deferring concrete evidence', async () => {
    const selector = 'selected::planned:opaque'
    const root = await boundaryWorkspace(`planned::${selector}`)
    await writeFile(join(root, 'healthy.mjs'), `import { writeFile } from 'node:fs/promises'
export default { apiVersion: 1,
async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },
async run({ projectRoot, targets }) { await writeFile(projectRoot + '/executed', JSON.stringify(targets.map(t => t.selector))); return { results: targets.map(t => ({ targetId: t.targetId, status: 'pass' })) } }
}`)
    const concrete = await boundaryCli(root, 'run', '--json')
    expect(concrete.code, concrete.stdout || concrete.stderr).toBe(0)
    expect(JSON.parse(concrete.stdout)).toMatchObject({ success: true, targetCount: 1, scenarios: [{ evidence: [{ reference: `planned::${selector}`, status: 'PASS' }] }] })
    expect(JSON.parse(await readFile(join(root, 'executed'), 'utf8'))).toEqual([selector])
    await rm(join(root, 'executed'))
    const native = JSON.parse(await readFile(join(root, 'spec.json'), 'utf8'))
    native.items[0].evidence = [`planned:planned::${selector}`]
    await writeFile(join(root, 'spec.json'), JSON.stringify(native))
    const deferred = await boundaryCli(root, 'validate', '--json')
    expect(deferred.code, deferred.stderr).toBe(0)
    expect(JSON.parse(deferred.stdout)).toMatchObject({ valid: true, plannedEvidence: 1, targets: 0 })
    const strict = await boundaryCli(root, 'run', '--json')
    expect(strict.code).toBe(1)
    expect(JSON.parse(strict.stdout)).toMatchObject({ valid: false, executionStarted: false })
    await expect(access(join(root, 'executed'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('escapes opaque human output without changing execution or JSON', async () => {
    const control = '\u001b[2J\r\u009b\u202e\u2028'
    const id = 'boundary.\u202eoutcome'
    const reference = `fixture::selected${control}`
    const root = await boundaryWorkspace(reference)
    const native = JSON.parse(await readFile(join(root, 'spec.json'), 'utf8'))
    native.items[0].markerId = id
    native.items[0].name = `Native${control}`
    const nativePath = 'spec\u202e\u2028.json'
    native.items[0].evidenceLocations = [{ path: `origin${control}.yaml`, line: 3 }]
    await rm(join(root, 'spec.json'))
    await writeFile(join(root, nativePath), JSON.stringify(native))
    const config = JSON.parse(await readFile(join(root, '.focused-spec/config.yaml'), 'utf8'))
    config.specifications.documents[0].match = nativePath
    await writeFile(join(root, '.focused-spec/config.yaml'), JSON.stringify(config))
    const diagnostic = `failure${control}\nsecond line`
    await writeFile(join(root, 'healthy.mjs'), `import { writeFile } from 'node:fs/promises'
export default { apiVersion: 1,
async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },
async run({ projectRoot, targets }) { await writeFile(projectRoot + '/executed', JSON.stringify(targets.map(t => t.selector))); return { results: targets.map(t => ({ targetId: t.targetId, status: 'fail', diagnostic: ${JSON.stringify(diagnostic)} })) } }
}`)
    const machine = await boundaryCli(root, 'run', '--scenario', id, '--json')
    expect(machine.code).toBe(1)
    expect(JSON.parse(machine.stdout)).toMatchObject({ success: false, scenarios: [{ id, name: `Native${control}`, source: { path: nativePath, line: 1 }, evidence: [{ reference, status: 'FAIL', diagnostic }] }] })
    expect(JSON.parse(await readFile(join(root, 'executed'), 'utf8'))).toEqual([`selected${control}`])
    const assertSafe = (value: string): void => {
      expect(value).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\p{Cf}\p{Zl}\p{Zp}]/u)
      expect(value).toContain('\\u001b[2J\\u000d\\u009b\\u202e\\u2028')
    }
    for (const args of [['run', '--scenario', id, '--timings'], ['list'], ['show', id]]) {
      const text = await boundaryCli(root, ...args)
      expect(text.code, text.stderr).toBe(args[0] === 'run' ? 1 : 0)
      assertSafe(text.stdout)
      if (args[0] === 'run') expect(text.stdout).toContain('\n    second line\n')
    }
    await writeFile(join(root, 'healthy.mjs'), `export default { apiVersion: 1, async resolve({ selectors }) { return { targets: [], errors: selectors.map(selector => ({ selector, message: ${JSON.stringify(diagnostic)} })) } }, async run() { throw new Error('must not run') } }`)
    for (const command of ['validate', 'run']) {
      const rejected = await boundaryCli(root, command, '--scenario', id)
      expect(rejected.code).toBe(1)
      assertSafe(rejected.stderr)
    }
    const commandError = await boundaryCli(root, `unknown${control}`)
    expect(commandError.code).toBe(1)
    assertSafe(commandError.stderr)
  })

  it('settles a runner timeout with inherited output pipes and permits subsequent work', async () => {
    const root = await workspace()
    const entry = await probe(root)
    await writeFile(join(root, 'broken.mjs'), `
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
export default { apiVersion: 1, async resolve() { return { targets: [], errors: [] } }, async run() {
  const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: ['ignore', 'inherit', 'inherit'] })
  writeFileSync(new URL('./descendant.json', import.meta.url), JSON.stringify({ descendant: descendant.pid, host: process.pid }))
  await new Promise(() => {})
} }
`)
    const result = await invoke(root, entry)
    const pids: { descendant: number; host: number } = JSON.parse(await readFile(join(root, 'descendant.json'), 'utf8'))
    // The watchdog kills the entire owned group even on RED; it never releases
    // the pipes early to make the broken timeout appear to settle.
    expect(pids.descendant).toBeGreaterThan(0)
    expect(result.expired, result.stderr).toBe(false)
    expect(result.code, result.stderr).toBe(0)
    const lines = result.stdout.trim().split('\n').map(line => JSON.parse(line))
    expect(lines[0]).toEqual({ status: 'ERROR', diagnostic: expect.stringMatching(/broken.*timed out/u) })
    expect(lines[1]).toEqual({ alive: true, targets: [{ selector: 'selected', targetId: 'selected', displayName: 'selected' }] })
    expect(() => process.kill(pids.host, 0)).toThrow()
  }, 15_000)

  for (const envelope of [
    { label: 'null', expression: 'null' },
    { label: 'string ok', expression: '{ ok: "yes", value: { results: [{ targetId: "selected", status: "pass" }] } }' },
  ]) {
    it(`rejects ${envelope.label} host IPC normally and keeps the caller alive`, async () => {
      const root = await workspace()
      const entry = await probe(root)
      await writeFile(join(root, 'broken.mjs'), `export default { apiVersion: 1,
async resolve() { return { targets: [], errors: [] } },
async run() { process.send(${envelope.expression}); await new Promise(() => {}) }
}\n`)
      const result = await invoke(root, entry)
      expect(result.expired, result.stderr).toBe(false)
      expect(result.code, result.stderr).toBe(0)
      const lines = result.stdout.trim().split('\n').map(line => JSON.parse(line))
      expect(lines[0]).toEqual({ status: 'ERROR', diagnostic: expect.stringMatching(/runner.*broken/iu) })
      expect(lines[1]).toEqual({ alive: true, targets: [{ selector: 'selected', targetId: 'selected', displayName: 'selected' }] })
    }, 15_000)
  }

  for (const row of duplicates) {
    it(`rejects ${row.label} before project execution with no stdout and a help pointer`, async () => {
      const root = await workspace()
      await configure(root)
      const result = await invoke(root, join(runtime, 'cli.js'), [row.command, ...row.args])
      expect(result.expired, result.stderr).toBe(false)
      expect(result.code).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(result.stderr).toMatch(/duplicate|repeated|more than once/iu)
      expect(result.stderr).toContain(row.option)
      expect(result.stderr).toContain(`focused-spec ${row.command} --help`)
      await expect(access(join(root, 'format-loaded'))).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(access(join(root, 'runner-loaded'))).rejects.toMatchObject({ code: 'ENOENT' })
    }, 15_000)
  }

  it('gives explicit help precedence over repeated options', async () => {
    const root = await workspace()
    await configure(root)
    const result = await invoke(root, join(runtime, 'cli.js'), ['instructions', '--protocol', '2', '--protocol', '1', '--json', '--json', '--help'])
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('focused-spec instructions [options]')
    await expect(access(join(root, 'format-loaded'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(join(root, 'runner-loaded'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
