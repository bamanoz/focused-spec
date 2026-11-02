import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cli, put, inlineScenario, configureInline, writeRegistry, emptyFixture, json } from './fixtures/cli-suite.js'


describe('focused-spec CLI', () => {
  it('writes escaped JUnit cases for PASS FAIL ERROR and SKIP scenarios', async () => {
    const root = await emptyFixture()
    await configureInline(root, undefined, ['runners:', '  fixture: { module: ./runner.ts }', '  errrunner: { module: ./error-runner.ts }'])
    await put(root, 'specs/report.md', [
      inlineScenario('report.pass', ['fixture::pass'], 'Pass <&>'),
      inlineScenario('report.fail', ['fixture::fail'], 'Failure'),
      inlineScenario('report.error', ['errrunner::error'], 'Error'),
      inlineScenario('report.skip', ['fixture::skip'], 'Skipped'),
    ].join('\n\n'))
    await writeRegistry(root, [
      { scope: 'current', id: 'report.pass', evidence: ['fixture::pass'] },
      { scope: 'current', id: 'report.fail', evidence: ['fixture::fail'] },
      { scope: 'current', id: 'report.error', evidence: ['errrunner::error'] },
      { scope: 'current', id: 'report.skip', evidence: ['fixture::skip'] },
    ])
    await put(root, 'runner.ts', [
      'import { appendFileSync } from "node:fs"; export default { apiVersion: 1, async resolve({ selectors }) { return { targets: selectors.map(selector => ({ selector, targetId: selector, displayName: selector })), errors: [] } },',
      'async run({ projectRoot, targets }) { appendFileSync(projectRoot + "/runs", targets.map(target => target.targetId).join("\\n") + "\\n"); return { results: targets.filter(target => !target.targetId.endsWith("error")).map(target => ({ targetId: target.targetId, status: target.targetId.endsWith("fail") ? "fail" : target.targetId.endsWith("skip") ? "skip" : "pass", ...(target.targetId.endsWith("fail") ? { diagnostic: "broken <&>" } : {}) })) } } }',
    ].join('\n'))
    await put(root, 'error-runner.ts', 'export default { apiVersion: 1, async resolve() { return { targets: [{ selector: "error", targetId: "error", displayName: "error" }], errors: [] } }, async run() { throw new Error("runner exploded") } }')

    const result = spawnSync(process.execPath, [cli, 'run', '--root', root, '--junit', 'reports/results.xml', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(json(result.stdout)).toMatchObject({ success: false, scenarios: expect.arrayContaining([
      expect.objectContaining({ id: 'report.pass', status: 'PASS' }),
      expect.objectContaining({ id: 'report.fail', status: 'FAIL' }),
      expect.objectContaining({ id: 'report.error', status: 'ERROR' }),
      expect.objectContaining({ id: 'report.skip', status: 'SKIP' }),
    ]) })
    const report = await readFile(join(root, 'reports/results.xml'), 'utf8')
    expect(report).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<testsuite name="focused-spec" tests="4" failures="1" errors="1" skipped="1">[\s\S]*<\/testsuite>\n$/u)
    expect(report.match(/<testcase\b/gu)).toHaveLength(4)
    expect(report).toContain('name="Pass &lt;&amp;&gt;"')
    expect(report).toContain('focused-spec.id')
    expect(report).toContain('<failure')
    expect(report).toContain('<error')
    expect(report).toContain('<skipped')
    expect(report).toContain('broken &lt;&amp;&gt;')
    const parsed = spawnSync('python3', ['-c', "import sys, xml.etree.ElementTree as ET; root=ET.parse(sys.argv[1]).getroot(); assert root.attrib['tests']=='4'; assert len(root.findall('testcase'))==4", join(root, 'reports/results.xml')], { encoding: 'utf8' })
    expect(parsed.status, parsed.stderr).toBe(0)
    expect((await readFile(join(root, 'runs'), 'utf8')).trim().split('\n')).toHaveLength(3)
  })
})
