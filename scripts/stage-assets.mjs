import { cp, copyFile, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const core = join(root, 'packages/core')
for (const asset of ['skills', 'guidance']) {
  await rm(join(core, asset), { recursive: true, force: true })
  await cp(join(root, asset), join(core, asset), { recursive: true })
}
await copyFile(join(root, 'README.md'), join(core, 'README.md'))
for (const name of ['core', 'sdk/typescript', 'sdk/go', 'formats/markdown', 'formats/gherkin', 'formats/inline', 'formats/registry', 'formats/scenarios-typescript', 'formats/scenarios-go', 'runners/vitest', 'runners/pytest', 'runners/go', 'runners/scenarios-typescript', 'runners/scenarios-go']) {
  await copyFile(join(root, 'LICENSE'), join(root, 'packages', name, 'LICENSE'))
}
const runnerGuide = (await readFile(join(root, 'docs/guides/runners.md'), 'utf8'))
  .replaceAll('../reference/runner-api.md', 'https://github.com/bamanoz/focused-spec/blob/main/docs/reference/runner-api.md')
  .replaceAll('../../guidance/runners.md', 'https://github.com/bamanoz/focused-spec/blob/main/guidance/runners.md')
  .replaceAll('../../packages/formats/scenarios-go/README.md', 'https://github.com/bamanoz/focused-spec/blob/main/packages/formats/scenarios-go/README.md')
  .replaceAll('../../packages/sdk/go/README.md', 'https://github.com/bamanoz/focused-spec/blob/main/packages/sdk/go/README.md')
  .replaceAll('](configuration.md#', '](https://github.com/bamanoz/focused-spec/blob/main/docs/guides/configuration.md#')
for (const name of ['runners/vitest', 'runners/pytest', 'runners/go', 'runners/scenarios-typescript', 'runners/scenarios-go']) {
  await writeFile(join(root, 'packages', name, 'README.md'), runnerGuide)
}
