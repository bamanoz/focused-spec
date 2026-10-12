import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const [api, output, filtersJson] = process.argv.slice(2)
if (api === undefined || output === undefined || filtersJson === undefined) throw new Error('Missing Vitest collection arguments')
const { createVitest } = await import(pathToFileURL(api).href) as typeof import('vitest/node')
const filters: string[] = JSON.parse(filtersJson)
const context = await createVitest('test', { root: process.cwd(), watch: false, run: true, reporters: [], silent: true })
try {
  const collected = await context.collect(filters)
  const errors = [...collected.unhandledErrors, ...collected.testModules.flatMap(module => module.errors())]
  if (errors.length > 0) throw new Error(errors.map(error => error instanceof Error ? error.message : JSON.stringify(error)).join('\n'))
  const tests = collected.testModules.flatMap(module => [...module.children.allTests()].map(test => ({ file: module.moduleId, name: test.fullName })))
  await writeFile(output, JSON.stringify(tests))
} finally {
  await context.close()
}
