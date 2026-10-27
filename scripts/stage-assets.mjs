import { cp, copyFile, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const core = join(root, 'packages/core')
for (const asset of ['skills', 'guidance']) {
  await rm(join(core, asset), { recursive: true, force: true })
  await cp(join(root, asset), join(core, asset), { recursive: true })
}
const readme = (await readFile(join(root, 'README.md'), 'utf8'))
  .replace('src="./assets/focused-spec.svg"', 'src="https://raw.githubusercontent.com/bamanoz/focused-spec/main/assets/focused-spec.svg"')
await writeFile(join(core, 'README.md'), readme)
for (const name of ['core', 'sdk/typescript', 'sdk/go', 'formats/markdown', 'formats/gherkin', 'formats/inline', 'formats/registry', 'formats/scenarios-typescript', 'formats/scenarios-go', 'formats/scenarios-python', 'formats/scenarios-dotnet', 'runners/vitest', 'runners/pytest', 'runners/go', 'runners/scenarios-typescript', 'runners/scenarios-go', 'runners/scenarios-python', 'runners/scenarios-dotnet']) {
  await copyFile(join(root, 'LICENSE'), join(root, 'packages', name, 'LICENSE'))
}
const runnerGuide = (await readFile(join(root, 'docs/guides/runners.md'), 'utf8'))
  .replaceAll('../reference/runner-api.md', 'https://github.com/bamanoz/focused-spec/blob/main/docs/reference/runner-api.md')
  .replaceAll('../../guidance/runners.md', 'https://github.com/bamanoz/focused-spec/blob/main/guidance/runners.md')
  .replaceAll('../../packages/formats/scenarios-go/README.md', 'https://github.com/bamanoz/focused-spec/blob/main/packages/formats/scenarios-go/README.md')
  .replaceAll('../../packages/sdk/go/README.md', 'https://github.com/bamanoz/focused-spec/blob/main/packages/sdk/go/README.md')
  .replaceAll('../../packages/formats/scenarios-python/README.md', 'https://github.com/bamanoz/focused-spec/blob/main/packages/formats/scenarios-python/README.md')
  .replaceAll('../../packages/formats/scenarios-dotnet/README.md', 'https://github.com/bamanoz/focused-spec/blob/main/packages/formats/scenarios-dotnet/README.md')
  .replaceAll('../../packages/sdk/python/README.md', 'https://github.com/bamanoz/focused-spec/blob/main/packages/sdk/python/README.md')
  .replaceAll('../../packages/sdk/dotnet/FocusedSpec.Scenarios/README.md', 'https://github.com/bamanoz/focused-spec/blob/main/packages/sdk/dotnet/FocusedSpec.Scenarios/README.md')
  .replaceAll('](configuration.md#', '](https://github.com/bamanoz/focused-spec/blob/main/docs/guides/configuration.md#')
for (const name of ['runners/vitest', 'runners/pytest', 'runners/go', 'runners/scenarios-typescript', 'runners/scenarios-go', 'runners/scenarios-python', 'runners/scenarios-dotnet']) {
  await writeFile(join(root, 'packages', name, 'README.md'), runnerGuide)
}
