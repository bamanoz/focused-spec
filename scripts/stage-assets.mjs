import { cp, copyFile, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const core = join(root, 'packages/core')
await cp(join(root, 'skills'), join(core, 'skills'), { recursive: true })
await cp(join(root, 'guidance'), join(core, 'guidance'), { recursive: true })
await copyFile(join(root, 'README.md'), join(core, 'README.md'))
for (const name of ['core', 'format-markdown', 'format-gherkin', 'runner-vitest', 'runner-pytest', 'runner-go']) {
  await copyFile(join(root, 'LICENSE'), join(root, 'packages', name, 'LICENSE'))
}
const runnerGuide = (await readFile(join(root, 'docs/guides/runners.md'), 'utf8'))
  .replaceAll('../reference/runner-api.md', 'https://github.com/bamanoz/focused-spec/blob/main/docs/reference/runner-api.md')
  .replaceAll('../../guidance/runners.md', 'https://github.com/bamanoz/focused-spec/blob/main/guidance/runners.md')
for (const name of ['runner-vitest', 'runner-pytest', 'runner-go']) {
  await writeFile(join(root, 'packages', name, 'README.md'), runnerGuide)
}
