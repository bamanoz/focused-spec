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
  await writeFile(join(root, '.focused-spec/config.yaml'), `version: 4
specifications:
  formats:
    fixture: { module: ./format.mjs }
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
export default { apiVersion: 1, parse() { return { items: [{ line: 1, name: 'Selected', nativeIds: [], markerId: 'audit.selected' }], diagnostics: [] } } }
`)
  await writeFile(join(root, 'healthy.mjs'), `import { appendFile } from 'node:fs/promises'
const mark = operation => appendFile(new URL('./runner-loaded', import.meta.url), operation + '\\n')
export default { apiVersion: 1,
async resolve({ selectors }) { await mark('resolve'); return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },
async run({ targets }) { await mark('run'); return { results: targets.map(({ targetId }) => ({ targetId, status: 'pass' })) } }
}
`)
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
