import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cli, put, writeRegistry, fixture, emptyFixture, json } from './fixtures/cli-suite.js'


describe('focused-spec CLI', () => {
  it('keeps default output and JSON result unchanged when no JUnit path is requested', async () => {
    const root = await fixture()
    const ordinary = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current'], { encoding: 'utf8' })
    const jsonResult = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--json'], { encoding: 'utf8' })
    expect(ordinary.status).toBe(0)
    expect(ordinary.stdout).toContain('summary: 1 PASS, 0 FAIL, 0 SKIP, 0 ERROR; 1 unique targets')
    expect(jsonResult.status).toBe(0)
    expect(json(jsonResult.stdout)).toMatchObject({ success: true, targetCount: 1, scenarios: [{ id: 'fixture.current.passes', status: 'PASS' }] })
    await expect(readFile(join(root, 'focused-spec-report.xml'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('writes a suite-level preflight failure without fabricated cases', async () => {
    const root = await fixture()
    await put(root, '.focused-spec/config.yaml', 'version: [\n')
    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--junit', 'preflight.xml', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ valid: false, executionStarted: false })
    const report = await readFile(join(root, 'preflight.xml'), 'utf8')
    expect(report).toContain('<testsuite name="focused-spec" tests="0" failures="0" errors="1" skipped="0">')
    expect(report).toContain('<system-err>')
    expect(report).not.toContain('<testcase')
    const writeRoot = await fixture()
    await writeRegistry(writeRoot, [{ scope: 'current', id: 'fixture.current.passes', evidence: ['fixture::current'] }])
    await put(writeRoot, 'report-parent-blocker', 'file')
    const failedWrite = spawnSync(process.execPath, [cli, 'run', '--root', writeRoot, '--scope', 'current', '--junit', 'report-parent-blocker/results.xml', '--json'], { encoding: 'utf8' })
    expect(failedWrite.status, `${failedWrite.stdout}\n${failedWrite.stderr}`).toBe(1)
    expect(json(failedWrite.stdout)).toMatchObject({ success: true, targetCount: 1 })
    expect(failedWrite.stderr).toContain('cannot write JUnit report')
  })

  it('writes an empty suite for a valid empty execution and fails clearly on report output errors', async () => {
    const empty = await emptyFixture()
    const emptyRun = spawnSync(process.execPath, [cli, 'run', '--root', empty, '--junit', 'empty.xml', '--json'], { encoding: 'utf8' })
    expect(emptyRun.status, emptyRun.stdout).toBe(0)
    expect(json(emptyRun.stdout)).toMatchObject({ success: true, scenarios: [], targetCount: 0 })
    expect(await readFile(join(empty, 'empty.xml'), 'utf8')).toContain('<testsuite name="focused-spec" tests="0" failures="0" errors="0" skipped="0"></testsuite>')

    const root = await fixture()
    await writeRegistry(root, [{ scope: 'current', id: 'fixture.current.passes', evidence: ['fixture::current'] }])
    await put(root, 'report-blocker', 'file')
    const failedReport = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scope', 'current', '--junit', 'report-blocker/results.xml', '--json'], { encoding: 'utf8' })
    expect(failedReport.status).toBe(1)
    expect(json(failedReport.stdout)).toMatchObject({ success: true, targetCount: 1 })
    expect(failedReport.stderr).toContain('cannot write JUnit report')
  })
})
