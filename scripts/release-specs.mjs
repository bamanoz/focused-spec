import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const cli = 'packages/core/dist/cli.js'
const temporary = mkdtempSync(join(tmpdir(), 'focused-spec-release-'))
const environment = join(temporary, 'python')
const bin = join(environment, process.platform === 'win32' ? 'Scripts' : 'bin')
const python = join(bin, process.platform === 'win32' ? 'python.exe' : 'python3')
const env = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` }

function check(command, args) {
  console.log(`\nRelease specification gate: ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' })
  if (result.error) console.error(result.error.message)
  if (result.error || result.signal || result.status !== 0) {
    throw new Error('Release blocked: executable specifications did not pass.')
  }
}

try {
  check('uv', ['venv', '--python', '>=3.11', '--no-python-downloads', environment])
  check('uv', ['pip', 'install', '--python', python, 'pytest', './packages/sdk/python'])
  const checks = [
    [process.execPath, [cli, 'run', '--root', '.']],
    [process.execPath, ['--test', '--test-reporter=spec', 'examples/scenarios/typescript/test/account.node.mjs']],
    [process.execPath, [cli, 'run', '--root', 'examples/scenarios/typescript']],
    ['go', ['-C', 'examples/scenarios/go', 'test', '-count=1', './...']],
    [process.execPath, [cli, 'run', '--root', 'examples/scenarios/go']],
    [python, ['-m', 'pytest', 'examples/scenarios/python/tests', '-q']],
    [process.execPath, [cli, 'run', '--root', 'examples/scenarios/python']],
    ['dotnet', ['test', 'examples/scenarios/dotnet/ScenarioBank.Tests/ScenarioBank.Tests.csproj']],
    [process.execPath, [cli, 'run', '--root', 'examples/scenarios/dotnet']],
  ]
  for (const [command, args] of checks) check(command, args)
  console.log('\nRelease specification gate passed: project evidence and all four native and CLI bank suites executed.')
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
