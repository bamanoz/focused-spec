import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const cli = 'packages/core/dist/cli.js'
const checks = [
  [process.execPath, [cli, 'run', '--root', '.']],
  [process.execPath, ['--test', '--test-reporter=spec', 'examples/scenarios/typescript/test/account.node.mjs']],
  [process.execPath, [cli, 'run', '--root', 'examples/scenarios/typescript']],
  ['go', ['-C', 'examples/scenarios/go', 'test', '-count=1', './...']],
  [process.execPath, [cli, 'run', '--root', 'examples/scenarios/go']],
  ['uv', ['run', '--no-project', '--with', 'pytest', '--with-editable', './packages/sdk/python', 'python', '-m', 'pytest', 'examples/scenarios/python/tests', '-q']],
  ['dotnet', ['test', 'examples/scenarios/dotnet/ScenarioBank.Tests/ScenarioBank.Tests.csproj']],
]

for (const [command, args] of checks) {
  console.log(`\nRelease specification gate: ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) console.error(result.error.message)
  if (result.error || result.signal || result.status !== 0) {
    console.error('Release blocked: executable specifications did not pass.')
    process.exit(result.status || 1)
  }
}
console.log('\nRelease specification gate passed: project evidence and all four native SDK suites executed.')
