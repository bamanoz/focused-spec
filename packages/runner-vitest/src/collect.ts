import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const [api, output, filtersJson, selectedJson] = process.argv.slice(2)
if (api === undefined || output === undefined || filtersJson === undefined) throw new Error('Missing Vitest collection arguments')
const { createVitest } = await import(pathToFileURL(api).href) as typeof import('vitest/node')
const filters: string[] = JSON.parse(filtersJson)
const context = await createVitest('test', { root: process.cwd(), watch: false, run: true, reporters: [], silent: true })
try {
  if (selectedJson !== undefined) await context.standalone()
  const collected = await context.collect(filters)
  const errors = [...collected.unhandledErrors, ...collected.testModules.flatMap(module => module.errors())]
  if (errors.length > 0) throw new Error(errors.map(error => error instanceof Error ? error.message : JSON.stringify(error)).join('\n'))
  if (selectedJson === undefined) {
    const tests = collected.testModules.flatMap(module => [...module.children.allTests()].map(test => ({ file: module.moduleId, name: test.fullName })))
    await writeFile(output, JSON.stringify(tests))
  } else {
    const selections: { readonly file: string; readonly names: readonly string[] }[] = JSON.parse(selectedJson)
    const allTests = collected.testModules.flatMap(module => [...module.children.allTests()])
    const selected = selections.flatMap(selection => selection.names.map(name => {
      const matches = allTests.filter(test => test.module.moduleId === selection.file && test.fullName === name)
      if (matches.length !== 1) throw new Error(`Vitest collected ${matches.length} matches for ${selection.file}::${name}`)
      return matches[0]!
    }))
    const specifications = collected.testModules.flatMap(module => {
      const tests = selected.filter(test => test.module === module)
      return tests.length === 0 ? [] : [module.toTestSpecification(tests)]
    })
    const executed = await context.runTestSpecifications(specifications)
    const runtimeErrors = [...executed.unhandledErrors, ...executed.testModules.flatMap(module => [
      ...module.errors(), ...[...module.children.allSuites()].flatMap(suite => suite.errors()),
    ])]
    if (runtimeErrors.length > 0) throw new Error(runtimeErrors.map(error => error instanceof Error ? error.message : JSON.stringify(error)).join('\n'))
    const executedTests = executed.testModules.flatMap(module => [...module.children.allTests()])
    const assertionResults = selected.map(test => {
      const matches = executedTests.filter(result => result.id === test.id)
      if (matches.length !== 1) throw new Error(`Vitest reported ${matches.length} results for ${test.fullName}`)
      const result = matches[0]!.result()
      return { file: test.module.moduleId, ancestorTitles: [], title: test.fullName, status: result.state, failureMessages: (result.errors ?? []).map(error => error.stack || error.message) }
    })
    await writeFile(output, JSON.stringify({ testResults: [{ assertionResults }] }))
  }
} finally {
  await context.close()
}
