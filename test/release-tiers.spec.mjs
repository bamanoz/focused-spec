import { spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it } from 'vitest'

const repository = fileURLToPath(new URL('..', import.meta.url))
const roots = []

// The npm lifecycle, root/workspace scripts, preflight, and release-specs gate
// are real. Compiler/test/application leaves record calls instead of running
// another repository suite. This proves orchestration, not native correctness.
const toolSource = String.raw`
import { appendFileSync, chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
const args = process.argv.slice(2)
const tool = basename(process.argv[1])
appendFileSync(process.env.RELEASE_TRACE, JSON.stringify({ tool, args }) + '\n')
const fail = message => { console.error(message); process.exit(91) }
if (process.env.RELEASE_FORBID_NATIVE === '1' && ['go', 'uv', 'python', 'python3', 'pytest', 'dotnet'].includes(tool)) fail('native tool invoked by Node-only tier: ' + tool)
if (tool === 'go' && args[0] === 'version') console.log('go version go1.23.0 fixture')
else if (tool === 'uv' && args[0] === '--version') console.log('uv 0.9.0')
else if (tool === 'python3' && args[0] === '--version') console.log('Python 3.11.0')
else if (tool === 'dotnet' && args[0] === '--version') console.log('10.0.100')
else if (tool === 'dotnet' && args[0] === '--list-runtimes') console.log('Microsoft.NETCore.App 8.0.0\nMicrosoft.NETCore.App 9.0.0\nMicrosoft.NETCore.App 10.0.0')
else if (tool === 'uv' && args[0] === 'venv') {
  const python = join(args.at(-1), 'bin', 'python3')
  mkdirSync(dirname(python), { recursive: true })
  writeFileSync(python, '#!' + process.execPath + '\n' + readFileSync(process.env.RELEASE_PYTHON_SOURCE, 'utf8'))
  chmodSync(python, 0o755)
} else if (tool === 'uv' && args[0] === 'pip' && args[1] === 'install') {
  const index = args.indexOf('--python')
  if (index < 0) fail('install must target the disposable interpreter')
  writeFileSync(join(dirname(args[index + 1]), 'installed.json'), JSON.stringify(args.slice(index + 2)))
} else if (['python', 'python3', 'pytest', 'uv'].includes(tool)) fail('unexpected Python command: ' + args.join(' '))
else if (!['go', 'dotnet', 'tsc', 'vitest'].includes(tool)) fail('unexpected tool: ' + tool)
`

const pythonSource = String.raw`
import { appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
const installed = JSON.parse(readFileSync(join(dirname(process.argv[1]), 'installed.json'), 'utf8'))
appendFileSync(process.env.RELEASE_TRACE, JSON.stringify({ tool: 'venv-python', executable: process.argv[1], args: process.argv.slice(2), installed }) + '\n')
`

const leafSource = String.raw`
import { appendFileSync } from 'node:fs'
appendFileSync(process.env.RELEASE_TRACE, JSON.stringify({ tool: 'leaf', lifecycle: process.env.npm_lifecycle_event, args: process.argv.slice(2) }) + '\n')
`

async function put(path, content, executable = false) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
  if (executable) await chmod(path, 0o755)
}

function npmExecutable() {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) return realpathSync(process.env.npm_execpath)
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(directory, 'npm')
    if (directory && existsSync(candidate)) return realpathSync(candidate)
  }
  throw new Error('These orchestration tests require the real npm executable on PATH.')
}

async function fixture(script = 'release:check', forbidNative = false) {
  const root = await mkdtemp(join(tmpdir(), 'focused-release-tiers-'))
  roots.push(root)
  const bin = join(root, 'bin')
  await mkdir(bin)
  await copyFile(join(repository, 'package.json'), join(root, 'package.json'))
  for (const script of ['release-preflight.mjs', 'release-specs.mjs']) {
    await mkdir(join(root, 'scripts'), { recursive: true })
    await copyFile(join(repository, 'scripts', script), join(root, 'scripts', script))
  }
  const workspacePaths = ['packages/core']
  for (const directory of ['packages/sdk', 'packages/formats', 'packages/runners']) {
    for (const child of await readdir(join(repository, directory))) {
      if (existsSync(join(repository, directory, child, 'package.json'))) workspacePaths.push(join(directory, child))
    }
  }
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await symlink(join(root, 'packages/core'), join(root, 'node_modules/focused-spec'))
  for (const directory of workspacePaths) {
    await mkdir(join(root, directory), { recursive: true })
    await copyFile(join(repository, directory, 'package.json'), join(root, directory, 'package.json'))
    if (existsSync(join(repository, directory, 'build.mjs'))) await put(join(root, directory, 'build.mjs'), leafSource)
  }
  for (const script of ['build-package.mjs', 'stage-assets.mjs', 'release-versions.mjs', 'openspec-guard.mjs', 'release-registry.mjs']) await put(join(root, 'scripts', script), leafSource)
  await put(join(root, 'packages/core/dist/cli.js'), String.raw`
import { appendFileSync } from 'node:fs'
import { delimiter } from 'node:path'
appendFileSync(process.env.RELEASE_TRACE, JSON.stringify({ tool: 'cli', args: process.argv.slice(2), pythonBin: process.env.PATH.split(delimiter)[0] }) + '\n')
`)
  await put(join(root, 'examples/scenarios/typescript/test/account.node.mjs'), String.raw`
import { appendFileSync } from 'node:fs'
import { test } from 'node:test'
test('fixture bank leaf', () => appendFileSync(process.env.RELEASE_TRACE, JSON.stringify({ tool: 'typescript-bank' }) + '\n'))
`)
  const python = join(root, 'python-leaf.mjs')
  await put(python, pythonSource)
  for (const tool of ['go', 'uv', 'python', 'python3', 'dotnet', 'pytest', 'tsc', 'vitest']) await put(join(bin, tool), `#!${process.execPath}\n${toolSource}`, true)
  await symlink(process.execPath, join(bin, 'node'))
  const npm = npmExecutable()
  // Do not fake npm run/exec: nested scripts must execute the copied manifest.
  await put(join(bin, 'npm'), `#!${process.execPath}\nimport { spawnSync } from 'node:child_process'\nconst result = spawnSync(process.execPath, [${JSON.stringify(npm)}, ...process.argv.slice(2)], { stdio: 'inherit' })\nprocess.exitCode = result.status ?? 1\n`, true)
  const trace = join(root, 'trace.jsonl')
  await writeFile(trace, '')
  const env = {
    PATH: bin,
    HOME: root,
    RELEASE_TRACE: trace,
    RELEASE_PYTHON_SOURCE: python,
    RELEASE_FORBID_NATIVE: forbidNative ? '1' : '0',
    npm_config_cache: join(root, 'npm-cache'),
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
    npm_config_offline: 'true',
    npm_config_script_shell: '/bin/sh',
  }
  return {
    invoke: () => spawnSync(process.execPath, [npm, 'run', script], { cwd: root, env, encoding: 'utf8', timeout: 60000 }),
    trace: async () => (await readFile(trace, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)),
  }
}

afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

it('executes the Node-only tier without invoking native-toolchain jobs', async () => {
  const test = await fixture('test:node', true)
  const result = test.invoke()
  expect(result.status, result.stdout + result.stderr).toBe(0)
  expect(result.stdout).toContain('Release preflight: node')
  const trace = await test.trace()
  expect(trace.filter(call => ['go', 'uv', 'python', 'python3', 'pytest', 'dotnet'].includes(call.tool))).toEqual([])
  expect(trace.filter(call => call.tool === 'vitest').map(call => call.args[0])).toEqual(['run'])
  expect(trace.some(call => call.tool === 'cli' || call.tool === 'typescript-bank')).toBe(false)
}, 60000)

it('release-check pins pytest and executes full repository Vitest evidence exactly once', async () => {
  const test = await fixture()
  const result = test.invoke()
  expect(result.status, result.stdout + result.stderr).toBe(0)
  const trace = await test.trace()
  expect(trace.filter(call => call.tool === 'vitest').map(call => call.args)).toEqual([['run']])
  expect(trace.filter(call => call.tool === 'cli').map(call => call.args)).toEqual([
    ['run', '--root', 'examples/openspec'],
    ['run', '--root', 'examples/scenarios/typescript'],
    ['run', '--root', 'examples/scenarios/go'],
    ['run', '--root', 'examples/scenarios/python'],
    ['run', '--root', 'examples/scenarios/dotnet'],
  ])
  const venvs = trace.filter(call => call.tool === 'uv' && call.args[0] === 'venv')
  expect(venvs).toHaveLength(1)
  expect(venvs[0].args.slice(0, -1)).toEqual(['venv', '--python', '>=3.11', '--no-python-downloads'])
  const environment = venvs[0].args.at(-1)
  const python = join(environment, 'bin', 'python3')
  expect(trace.filter(call => call.tool === 'uv' && call.args[0] === 'pip').map(call => call.args)).toEqual([
    ['pip', 'install', '--python', python, 'pytest==8.4.2', './packages/sdk/python'],
  ])
  expect(trace.filter(call => call.tool === 'venv-python')).toEqual([
    { tool: 'venv-python', executable: python, args: ['-m', 'pytest', 'examples/scenarios/python/tests', '-q'], installed: ['pytest==8.4.2', './packages/sdk/python'] },
  ])
  expect(trace.filter(call => call.tool === 'go' && call.args[0] !== 'version').map(call => call.args)).toEqual([
    ['-C', 'examples/scenarios/go', 'test', '-count=1', './...'],
  ])
  expect(trace.filter(call => call.tool === 'dotnet' && call.args[0] === 'test').map(call => call.args)).toEqual([
    ['test', 'examples/scenarios/dotnet/ScenarioBank.Tests/ScenarioBank.Tests.csproj'],
  ])
  expect(trace.filter(call => call.tool === 'typescript-bank')).toHaveLength(1)
  expect(trace.filter(call => call.tool === 'cli' && call.args[2] === 'examples/scenarios/python')[0].pythonBin).toBe(dirname(python))
  expect(existsSync(environment)).toBe(false)
}, 60000)
