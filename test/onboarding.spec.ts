import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'

import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repository = fileURLToPath(new URL('..', import.meta.url))

describe('README consumer quick start', () => {
  it('resolves and runs the exact documented inline Vitest selector', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-spec-readme-consumer-'))
    try {
      await writeFile(join(root, 'package.json'), '{"name":"readme-consumer","private":true,"type":"module"}\n')
      await symlink(resolve(repository, 'node_modules'), join(root, 'node_modules'), 'dir')
      await cp(join(repository, 'test/fixtures/onboarding/.focused-spec'), join(root, '.focused-spec'), { recursive: true })
      await cp(join(repository, 'test/fixtures/onboarding/src'), join(root, 'src'), { recursive: true })
      await cp(join(repository, 'test/fixtures/onboarding/test'), join(root, 'test'), { recursive: true })
      await cp(join(repository, 'test/fixtures/onboarding/specs'), join(root, 'specs'), { recursive: true })

      const cli = join(root, 'node_modules/focused-spec/dist/cli.js')
      const validate = spawnSync(process.execPath, [cli, 'validate', '--root', root, '--strict'], { cwd: root, encoding: 'utf8', timeout: 60_000 })
      expect(validate.status, validate.stdout + validate.stderr).toBe(0)
      const run = spawnSync(process.execPath, [cli, 'run', '--root', root, '--scenario', 'account.deposit', '--json'], { cwd: root, encoding: 'utf8', timeout: 60_000 })
      expect(run.status, run.stdout + run.stderr).toBe(0)
      expect(JSON.parse(run.stdout)).toMatchObject({ success: true, scenarios: [{ id: 'account.deposit', status: 'PASS', evidence: [{ reference: 'vitest::test/account.spec.mjs::account > deposits funds', status: 'PASS' }] }] })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 120_000)
})

