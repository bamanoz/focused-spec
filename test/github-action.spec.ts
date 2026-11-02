import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { delimiter, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
const repository = fileURLToPath(new URL('..', import.meta.url))

async function readYaml(path: string): Promise<Record<string, unknown>> {
  const source = await readFile(resolve(repository, path), 'utf8')
  const document = parseDocument(source)
  expect(document.errors).toEqual([])
  return document.toJS() as Record<string, unknown>
}
describe('composite GitHub Action contract', () => {

  it('provides a read-only pull_request example with no credential or privileged publishing flow', async () => {
    const workflow = await readYaml('test/fixtures/github-action-pr.example.yml')
    expect(workflow.on).toEqual({ pull_request: null })
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow).not.toHaveProperty('pull_request_target')
    const jobs = workflow.jobs as Record<string, { steps: Array<Record<string, unknown>> }>
    const steps = jobs['focused-spec']?.steps ?? []
    expect(steps.some((step) => step.uses === './.github/actions/focused-spec-run')).toBe(true)
    const serialized = JSON.stringify(workflow)
    expect(serialized).not.toMatch(/secrets\.|GITHUB_TOKEN|permissions:\s*write|upload-artifact|comment|publish/i)
  })
  it('executes the Action script against an installed CLI and preserves report/output status', async () => {
    const action = await readYaml('.github/actions/focused-spec-run/action.yml')
    const steps = (action.runs as { steps: Array<Record<string, unknown>> }).steps
    const script = steps.find(step => step.id === 'run')?.run
    expect(typeof script).toBe('string')
    const temporary = await mkdtemp(join(tmpdir(), 'focused-spec-action-'))
    const report = join(temporary, 'report.xml')
    const output = join(temporary, 'github-output')
    const workspace = join(repository, 'examples/scenarios/typescript')
    const env = {
      ...process.env,
      PATH: `${join(repository, 'node_modules/.bin')}${delimiter}${process.env.PATH ?? ''}`,
      INPUT_REPORT_PATH: report,
      INPUT_ARGS: JSON.stringify(['--root', workspace]),
      GITHUB_OUTPUT: output,
    }
    try {
      const success = spawnSync(process.execPath, ['-e', script as string], { cwd: repository, env, encoding: 'utf8' })
      expect(success.status, `${success.stdout}\n${success.stderr}`).toBe(0)
      expect(await readFile(report, 'utf8')).toContain('<testsuite name="focused-spec" tests="6"')
      const outputs = await readFile(output, 'utf8')
      expect(outputs).toContain(`report-path<<`)
      expect(outputs).toContain(`${report}\n`)
      expect(outputs).toContain('outcome<<')
      expect(outputs).toContain('\nsuccess\n')

      const failedOutput = join(temporary, 'failed-github-output')
      const failed = spawnSync(process.execPath, ['-e', script as string], {
        cwd: repository,
        env: { ...env, INPUT_ARGS: JSON.stringify(['--root', workspace, '--scenario', 'missing.action.scenario']), GITHUB_OUTPUT: failedOutput },
        encoding: 'utf8',
      })
      expect(failed.status).toBe(1)
      expect(await readFile(failedOutput, 'utf8')).toContain('\nfailure\n')

      for (const args of ['not-json', '{}', '[1]', '["--junit", "override.xml"]', '["--junit=override.xml"]']) {
        const invalid = spawnSync(process.execPath, ['-e', script as string], {
          cwd: temporary, env: { ...env, INPUT_ARGS: args }, encoding: 'utf8',
        })
        expect(invalid.status, invalid.stderr).toBe(2)
      }
      const literalReport = join(temporary, 'literal;touch injected.xml')
      const literal = spawnSync(process.execPath, ['-e', script as string], {
        cwd: temporary, env: { ...env, INPUT_REPORT_PATH: literalReport }, encoding: 'utf8',
      })
      expect(literal.status, literal.stderr).toBe(0)
      expect(await readFile(literalReport, 'utf8')).toContain('<testsuite')
      await expect(readFile(join(temporary, 'injected.xml'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(temporary, { recursive: true, force: true })
    }
  }, 30000)
})
