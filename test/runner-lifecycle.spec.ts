import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { runBoundedProcess } from 'focused-spec/runner'
import { runProcess as runGoProcess } from '../packages/runners/go/src/process.js'
import { runProcess as runPytestProcess } from '../packages/runners/pytest/src/process.js'
import { runProcess as runVitestProcess } from '../packages/runners/vitest/src/process.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('runner process lifecycle', () => {
  for (const [name, runProcess] of [
    ['Vitest', runVitestProcess],
    ['pytest', runPytestProcess],
    ['Go', runGoProcess],
  ] as const) {
    for (const mode of ['abort', 'overflow'] as const) {
      it(`terminates the ${name} child and grandchild on ${mode}`, async () => {
        const root = await mkdtemp(join(tmpdir(), 'focused-spec-runner-lifecycle-'))
        roots.push(root)
        const sentinel = join(root, 'pids.json')
        const trigger = join(root, 'overflow')
        const grandchildSource = 'setInterval(() => {}, 1000)'
        const childSource = [
          "const { spawn } = require('node:child_process')",
          "const fs = require('node:fs')",
          `const grandchild = spawn(process.execPath, ['-e', ${JSON.stringify(grandchildSource)}], { stdio: 'inherit' })`,
          `fs.writeFileSync(${JSON.stringify(sentinel)}, JSON.stringify({ child: process.pid, grandchild: grandchild.pid }))`,
          'setInterval(() => {}, 1000)',
        ].join('\n')
        const script = [
          "const { spawn } = require('node:child_process')",
          "const fs = require('node:fs')",
          `spawn(process.execPath, ['-e', ${JSON.stringify(childSource)}], { stdio: 'inherit' })`,
          `const ready = setInterval(() => { if (fs.existsSync(${JSON.stringify(trigger)})) { clearInterval(ready); process.stdout.write('x'.repeat(4100000)) } }, 10)`,
          'setInterval(() => {}, 1000)',
        ].join('\n')
        const controller = new AbortController()
        const watchdog = setTimeout(() => controller.abort(), 8000)
        const operation = runProcess(process.execPath, ['-e', script], root, controller.signal).then(
          () => ({ name: 'resolved', message: '' }),
          (error: unknown) => ({ name: error instanceof Error ? error.name : '', message: String(error) }),
        )
        let pids: { child: number; grandchild: number } | undefined
        try {
          const deadline = Date.now() + 5000
          while (Date.now() < deadline && pids === undefined) {
            try { pids = JSON.parse(await readFile(sentinel, 'utf8')) as { child: number; grandchild: number } } catch { await delay(20) }
          }
          expect(pids).toBeDefined()
          const started = Date.now()
          if (mode === 'abort') controller.abort()
          else await writeFile(trigger, 'overflow')
          const result = await operation
          expect(result.name).toBe(mode === 'abort' ? 'AbortError' : 'Error')
          if (mode === 'overflow') expect(result.message).toContain('exceeded')
          expect(Date.now() - started).toBeLessThan(5000)
          for (const pid of [pids!.child, pids!.grandchild]) {
            const exitDeadline = Date.now() + 3000
            let alive = true
            while (alive && Date.now() < exitDeadline) {
              try {
                process.kill(pid, 0)
                if (process.platform === 'linux') alive = !(await readFile(`/proc/${pid}/stat`, 'utf8')).includes(') Z ')
                if (alive) await delay(25)
              } catch { alive = false }
            }
            expect(alive).toBe(false)
          }
        } finally {
          clearTimeout(watchdog)
          controller.abort()
          await operation
          if (pids !== undefined) for (const pid of [pids.child, pids.grandchild]) {
            try { process.kill(pid, 'SIGKILL') } catch { /* already terminated */ }
          }
        }
      }, 15000)
    }
  }

  it('preserves split UTF-8 and bounds head and tail diagnostics at code-point boundaries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-runner-utf8-'))
    roots.push(root)
    const script = [
      "const bytes = Buffer.from('A€Z😀Y')",
      'let offset = 0',
      'const timer = setInterval(() => {',
      '  if (offset >= bytes.length) { clearInterval(timer); return }',
      '  const byte = bytes.subarray(offset, ++offset)',
      '  process.stdout.write(byte)',
      '  process.stderr.write(byte)',
      '}, 5)',
    ].join('\n')
    for (const capture of ['head', 'tail'] as const) {
      const result = await runBoundedProcess(process.execPath, ['-e', script], {
        cwd: root, outputLimit: 100, diagnosticLimit: 3, capture,
      })
      expect(result.code).toBe(0)
      expect(result.stdout).toBe('A€Z😀Y')
      expect(result.stderr).toBe(capture === 'head' ? 'A' : 'Y')
      expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(3)
    }
  }, 10000)

  it('counts split multibyte bytes toward overflow before decoding finishes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-runner-byte-limit-'))
    roots.push(root)
    await expect(runBoundedProcess(process.execPath, ['-e', "process.stdout.write(Buffer.from([0xe2, 0x82])); setInterval(() => {}, 1000)"], {
      cwd: root, outputLimit: 1, diagnosticLimit: 100,
    })).rejects.toThrow('stdout exceeded')
  }, 5000)
})
