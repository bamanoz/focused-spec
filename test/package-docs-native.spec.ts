import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createPackedConsumer, packPackage, repository, root, installConsumerFramework, packedTarball, registryTarball, markdownTarball, vitestRunnerTarball, put } from './fixtures/package-suite.js'

describe('package distribution', () => {
  it('executes selectors discovered from packed runner documentation', async () => {
      const project = await createPackedConsumer('runner-documentation-')
      const pytestTarball = packPackage(join(repository, 'packages/runners/pytest'), root)
      const goTarball = packPackage(join(repository, 'packages/runners/go'), root)
      await installConsumerFramework(project, packedTarball, registryTarball, markdownTarball, vitestRunnerTarball, pytestTarball, goTarball)
      const evidence: string[] = []
      for (const framework of ['vitest', 'pytest', 'go']) {
        const documentation = await readFile(join(project, `node_modules/@focused-spec/runner-${framework}/README.md`), 'utf8')
          .then(content => ({ content, error: undefined }), error => ({ content: '', error: error as Error }))
        expect(documentation.error, `public ${framework} contract is unavailable`).toBeUndefined()
        const example = documentation.content.match(new RegExp('^\\| `' + framework + '` \\| `([^`]+)` \\|$', 'mu'))?.[1]
        if (example === undefined) throw new Error(`No documented ${framework} example selector`)
        evidence.push(`${framework}::${example}`)
      }
      await put(join(project, '.focused-spec/config.yaml'), JSON.stringify({ version: 5,
        specifications: { formats: { markdown: { package: '@focused-spec/format-registry', options: { parser: { package: '@focused-spec/format-markdown' } } } }, documents: [{ match: 'specs/contract.md', scope: 'current', format: 'markdown' }] },
        runners: { vitest: { package: '@focused-spec/runner-vitest' }, pytest: { package: '@focused-spec/runner-pytest', options: { command: 'uv', commandArgs: ['run', '--with', 'pytest', 'python'] } }, go: { package: '@focused-spec/runner-go' } },
      }))
      await put(join(project, '.focused-spec/evidence.yaml'), JSON.stringify({ scopes: { current: { 'consumer.documentation.works': { evidence } } } }))
      await put(join(project, 'specs/contract.md'), '<!-- focused-spec:id=consumer.documentation.works -->\n#### Scenario: Documented selectors protect the real outcome\n')
      await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
      await put(join(project, 'test/a.spec.ts'), "import { describe, expect, it } from 'vitest'; import { authenticate } from '../auth.mjs'; describe('outer', () => { describe('inner', () => { it('works', () => expect(authenticate(true)).toBe(false)); }); });")
      await put(join(project, 'tests/test_auth.py'), 'def test_blocked_account():\n    assert not authenticate(True)\n\ndef authenticate(blocked):\n    return not blocked\n')
      await put(join(project, 'go.mod'), 'module example.com/public-contracts\n\ngo 1.22\n')
      await put(join(project, 'auth/auth_test.go'), 'package auth\n\nimport "testing"\n\nfunc TestLogin(t *testing.T) { if authenticate(true) { t.Fatal("blocked account authenticated") } }\nfunc authenticate(blocked bool) bool { return !blocked }\n')
      const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
      const invoke = () => spawnSync(process.execPath, [cli, 'run', '--root', project, '--json'], { cwd: project, encoding: 'utf8', timeout: 120_000 })
      const passed = invoke()
      expect(passed.status, passed.stdout + passed.stderr).toBe(0)
      expect(JSON.parse(passed.stdout)).toMatchObject({ success: true, targetCount: 3, scenarios: [{ status: 'PASS' }] })
      await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => true\n')
      const regressed = invoke()
      expect(regressed.status).toBe(1)
      expect(JSON.parse(regressed.stdout)).toMatchObject({ success: false, scenarios: [{ status: 'FAIL', evidence: expect.arrayContaining([{ reference: evidence[0], status: 'FAIL', diagnostic: expect.stringContaining('expected true to be false') }]) }] })
      await put(join(project, 'auth.mjs'), 'export const authenticate = blocked => !blocked\n')
      const restored = invoke()
      expect(restored.status, restored.stdout + restored.stderr).toBe(0)
      expect(JSON.parse(restored.stdout)).toMatchObject({ success: true, scenarios: [{ status: 'PASS' }] })
    }, 300_000)
})
