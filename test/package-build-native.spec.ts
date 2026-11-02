import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, mkdir, readFile, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repository, root, put } from './fixtures/package-suite.js'


describe('package distribution', () => {
  it('omits retired runtime modules from every independently rebuilt package', async () => {
    const checkout = await mkdtemp(join(root, 'rebuild-'))
    await cp(join(repository, 'tsconfig.json'), join(checkout, 'tsconfig.json'))
    await cp(join(repository, 'package.json'), join(checkout, 'package.json'))
    await cp(join(repository, 'scripts'), join(checkout, 'scripts'), { recursive: true })
    await symlink(join(repository, 'node_modules'), join(checkout, 'node_modules'), 'dir')
    for (const name of ['core', 'sdk/typescript', 'formats/markdown', 'formats/gherkin', 'formats/inline', 'formats/registry', 'formats/scenarios-typescript', 'formats/scenarios-go', 'formats/scenarios-python', 'formats/scenarios-dotnet', 'runners/vitest', 'runners/pytest', 'runners/go', 'runners/scenarios-typescript', 'runners/scenarios-go', 'runners/scenarios-python', 'runners/scenarios-dotnet']) {
      const packageRoot = join(checkout, 'packages', name)
      await mkdir(packageRoot, { recursive: true })
      for (const asset of ['src', 'package.json', 'tsconfig.json']) await cp(join(repository, 'packages', name, asset), join(packageRoot, asset), { recursive: true })
      if (name === 'formats/scenarios-go') {
        for (const asset of ['go', 'build.mjs']) await cp(join(repository, 'packages', name, asset), join(packageRoot, asset), { recursive: true })
      }
      if (name.endsWith('scenarios-python') || name.endsWith('scenarios-dotnet')) {
        const language = name.endsWith('scenarios-python') ? 'python' : 'dotnet'
        for (const asset of [language, 'build.mjs']) await cp(join(repository, 'packages', name, asset), join(packageRoot, asset), { recursive: true })
      }
      const retiredSource = join(packageRoot, 'src/audit-retired-runtime.ts')
      await put(retiredSource, 'export const retired = true\n')
      const build = () => spawnSync('npm', ['run', 'build'], { cwd: packageRoot, encoding: 'utf8', timeout: 60000 })
      const first = build()
      expect(first.status, name + first.stdout + first.stderr).toBe(0)
      expect(await readFile(join(packageRoot, 'dist/audit-retired-runtime.js'), 'utf8')).toContain('retired')
      await rm(retiredSource)
      const second = build()
      expect(second.status, name + second.stdout + second.stderr).toBe(0)
      const packed = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { cwd: packageRoot, encoding: 'utf8', timeout: 60000 })
      expect(packed.status, packed.stderr).toBe(0)
      const files = (JSON.parse(packed.stdout) as { files: { path: string }[] }[])[0]!.files.map(file => file.path)
      expect(files, name).toContain('dist/index.js')
      expect(files.filter(path => path.startsWith('dist/audit-retired-runtime')), name).toEqual([])
    }
  }, 180000)
})
