import { spawnSync } from 'node:child_process'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const repository = fileURLToPath(new URL('..', import.meta.url))
const roots = []
const version = '0.10.2'
const commit = 'a'.repeat(40)
const nativeNames = ['@focused-spec/format-scenarios-python', '@focused-spec/runner-scenarios-python', '@focused-spec/format-scenarios-dotnet', '@focused-spec/runner-scenarios-dotnet']
const names = ['focused-spec', '@focused-spec/format-inline', ...nativeNames]

// These clients model immutable registries locally. They never spawn a network
// client or a real native tool; all external state lives inside this fixture.
const clientSource = String.raw`
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { createHash } from 'node:crypto'
const statePath = process.env.RELEASE_FAKE_STATE
const state = JSON.parse(readFileSync(statePath, 'utf8'))
const tool = basename(process.argv[1])
const args = process.argv.slice(2)
state.calls.push([tool, ...args])
const save = () => writeFileSync(statePath, JSON.stringify(state))
const out = value => { save(); process.stdout.write(typeof value === 'string' ? value : JSON.stringify(value)) }
const fail = message => { save(); process.stderr.write(message); process.exit(1) }
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex')
const option = name => args[args.indexOf(name) + 1]
if (tool === 'git') {
  if (args[0] === 'status') out('')
  else if (args[0] === 'rev-parse') {
    if (args.includes('--verify')) state.localGo ? out(state.commit) : fail('unknown tag')
    else out(state.commit)
  } else if (args[0] === 'ls-remote') {
    if (args.includes('refs/heads/main')) out(state.commit + '\trefs/heads/main\n' + state.commit + '\trefs/tags/v' + state.version + '\n')
    else out(state.remoteGo ? state.commit + '\trefs/tags/packages/sdk/go/v' + state.version + '\n' : '')
  } else if (args[0] === 'tag') { state.localGo = true; out('') }
  else if (args[0] === 'push') { state.remoteGo = true; out('') }
  else fail('unexpected git ' + args.join(' '))
} else if (tool === 'npm') {
  if (args[0] === 'run') out('')
  else if (args[0] === 'whoami') out(JSON.stringify('publisher'))
  else if (args[0] === 'access') out(Object.fromEntries(state.nativeNames.filter(name => !state.firstPublication || state.npm[name]).map(name => [name, 'read-write'])))
  else if (args[0] === 'org' && args[1] === 'ls') out({ publisher: 'owner' })
  else if (args[0] === 'view') {
    const name = args[1].slice(0, args[1].lastIndexOf('@'))
    const published = state.npm[name]
    if (published && state.pendingMetadata?.[name] > 0) { state.pendingMetadata[name]--; fail('npm ERR! code E404') }
    if (args[2] === 'version' && args[3] === '--json' && (published || (!state.firstPublication && state.nativeNames.includes(name)))) out(JSON.stringify(state.version))
    else if (published) out({ version: state.version, 'dist.shasum': published })
    else fail('npm ERR! code E404')
  } else if (args[0] === 'pack') {
    const name = args.find(arg => arg.startsWith('--workspace=')).slice('--workspace='.length)
    const filename = name.replace(/[^a-z0-9-]/gi, '-') + '-' + state.version + '.tgz'
    const bytes = Buffer.from(name + '@' + state.version)
    const path = join(option('--pack-destination'), filename)
    writeFileSync(path, bytes)
    state.packs[path] = { name, sha1: hash(bytes, 'sha1') }
    out([{ name, version: state.version, filename, shasum: hash(bytes, 'sha1') }])
  } else if (args[0] === 'publish') {
    const item = state.packs[args[1]]
    if (!item) fail('unprepared npm artifact')
    if (state.failAt === 'npm:' + item.name) fail('fake registry refused publication')
    state.npm[item.name] = item.sha1
    if (state.delayVisibility && item.name === 'focused-spec') { state.pendingMetadata ??= {}; state.pendingMetadata[item.name] = 1 }
    out('')
  } else fail('unexpected npm ' + args.join(' '))
} else if (tool === 'uv') {
  if (args[0] === 'build') {
    const directory = option('--out-dir')
    writeFileSync(join(directory, '.gitignore'), '*')
    for (const filename of ['focused_spec_scenarios-' + state.version + '-py3-none-any.whl', 'focused_spec_scenarios-' + state.version + '.tar.gz']) {
      const bytes = Buffer.from(filename)
      writeFileSync(join(directory, filename), bytes)
      state.pythonPrepared[filename] = hash(bytes)
    }
    out('')
  } else if (args[0] === 'publish') {
    if (state.failAt === 'pypi') fail('fake PyPI refused publication')
    for (const path of args.filter(arg => /\.(?:whl|gz)$/.test(arg))) state.python[basename(path)] = hash(readFileSync(path))
    out('')
  } else fail('unexpected uv')
} else if (tool === 'dotnet') {
  if (args[0] === 'pack') {
    const directory = args.find(arg => arg.startsWith('-p:PackageOutputPath=')).slice('-p:PackageOutputPath='.length)
    writeFileSync(join(directory, 'FocusedSpec.Scenarios.' + state.version + '.nupkg'), 'fake-net8-net10-package')
    out('')
  } else if (args[0] === 'restore') out('')
  else if (args[0] === 'run') out('FocusedSpec.Scenarios')
  else fail('unexpected dotnet')
} else if (tool === 'python3') {
  out(state.failAt === 'inspect' ? 'invalid' : 'verified')
} else if (tool === 'gh') {
  if (args[0] === 'auth') out('')
  else if (args[0] === 'release' && args[1] === 'view') {
    if (option('--json') === 'assets') out({ assets: Object.keys(state.assets).map(name => ({ name })) })
    else out({ tagName: 'v' + state.version, isDraft: false, isPrerelease: false })
  } else if (args[0] === 'release' && args[1] === 'upload') {
    if (state.failAt === 'github') fail('fake GitHub refused upload')
    for (const path of args.slice(3)) state.assets[basename(path)] = readFileSync(path).toString('base64')
    out('')
  } else if (args[0] === 'release' && args[1] === 'download') {
    const directory = option('--dir')
    mkdirSync(directory, { recursive: true })
    for (let index = 0; index < args.length; index += 1) {
      if (args[index] !== '--pattern') continue
      const name = args[++index]
      if (!state.assets[name]) fail('asset missing')
      writeFileSync(join(directory, name), Buffer.from(state.assets[name], 'base64'))
    }
    out('')
  } else fail('unexpected gh')
} else fail('unexpected client ' + tool)
`

async function fixture(options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'focused-release-process-'))
  roots.push(root)
  const scripts = join(root, 'scripts')
  const bin = join(root, 'bin')
  await mkdir(scripts)
  await mkdir(bin)
  await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'module', version }))
  for (const name of ['release.mjs', 'release-publisher.mjs', 'release-registry.mjs']) await copyFile(join(repository, 'scripts', name), join(scripts, name))
  await writeFile(join(scripts, 'release-versions.mjs'), `console.log(${JSON.stringify(JSON.stringify({ version, valid: true, distributions: names.map(name => ({ kind: 'npm', name, version, path: `packages/${name}/package.json` })) }))})\n`)
  const statePath = join(root, 'state.json')
  await writeFile(statePath, JSON.stringify({ version, commit, calls: [], nativeNames, npm: {}, packs: {}, python: {}, pythonPrepared: {}, assets: {}, localGo: false, remoteGo: false, ...options }))
  for (const tool of ['git', 'npm', 'uv', 'dotnet', 'python3', 'gh']) {
    const path = join(bin, tool)
    await writeFile(path, `#!${process.execPath}\n${clientSource}`)
    await chmod(path, 0o755)
  }
  const hook = join(root, 'fetch-hook.mjs')
  await writeFile(hook, `import { readFileSync, writeFileSync } from 'node:fs'; globalThis.fetch = async url => { if (!String(url).startsWith('https://pypi.org/pypi/focused-spec-scenarios/')) throw new Error('unexpected network '+url); const state=JSON.parse(readFileSync(process.env.RELEASE_FAKE_STATE,'utf8')); if(state.delayVisibility && Object.keys(state.python).length && !state.pythonVisibilityProbed) {state.pythonVisibilityProbed=true;writeFileSync(process.env.RELEASE_FAKE_STATE,JSON.stringify(state));return {status:404,ok:false};} const urls=Object.entries(state.python).map(([filename,sha256])=>({filename,digests:{sha256}})); return {status:urls.length?200:404,ok:urls.length>0,json:async()=>({urls})}; };\n`)
  const env = {
    PATH: bin,
    HOME: root,
    RELEASE_FAKE_STATE: statePath,
    NODE_AUTH_TOKEN: 'fake-test-token',
    UV_PUBLISH_TOKEN: 'fake-test-token',
    FOCUSED_SPEC_NATIVE_NAMES_APPROVED: '1',
  }
  return {
    root,
    statePath,
    invoke: (args = [], override = {}) => spawnSync(process.execPath, ['--import', hook, join(scripts, 'release.mjs'), ...args], { cwd: root, env: { ...env, ...override }, encoding: 'utf8', timeout: 30000 }),
    state: async () => JSON.parse(await readFile(statePath, 'utf8')),
  }
}
function mutations(state) {
  return state.calls.filter(([tool, ...args]) => (tool === 'npm' && args[0] === 'publish') || (tool === 'uv' && args[0] === 'publish') || (tool === 'gh' && args[1] === 'upload') || (tool === 'git' && ['tag', 'push'].includes(args[0])))
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

describe('local release process', () => {
  it('prepares exact artifacts in dry run without any publication or tag mutation', async () => {
    const test = await fixture({ firstPublication: true })
    const result = test.invoke([], { UV_PUBLISH_TOKEN: '' })
    expect(result.status, result.stderr).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report).toMatchObject({ authorized: false, dryRun: true, complete: false, published: [] })
    expect(report.prepared.map(item => item.distribution)).toEqual([...names, 'pypi:focused-spec-scenarios', 'pypi:focused-spec-scenarios', 'github:FocusedSpec.Scenarios'])
    expect(report.prepared.at(-1)).toMatchObject({ checksumManifest: `FocusedSpec.Scenarios.${version}.nupkg.sha256`, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) })
    const state = await test.state()
    expect(mutations(state)).toEqual([])
  })

  it('refuses authorized publication without publisher configuration before any client is called', async () => {
    const test = await fixture()
    const result = test.invoke(['--authorize-release'], { NODE_AUTH_TOKEN: '', UV_PUBLISH_TOKEN: '', FOCUSED_SPEC_NATIVE_NAMES_APPROVED: '' })
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stderr)).toMatchObject({ complete: false, failed: expect.stringContaining('Missing publisher configuration') })
    expect((await test.state()).calls).toEqual([])
  })

  it('reports successful npm artifacts and stops dependent registries after a later publication fails', async () => {
    const test = await fixture({ failAt: `npm:${names[1]}` })
    const result = test.invoke(['--authorize-release'])
    expect(result.status, result.stderr).toBe(1)
    const report = JSON.parse(result.stdout)
    expect(report).toMatchObject({ complete: false, published: [names[0]], pending: [...names.slice(1), 'pypi:focused-spec-scenarios', 'github:FocusedSpec.Scenarios', `go:packages/sdk/go/v${version}`], failed: expect.stringContaining(names[1]) })
    const state = await test.state()
    expect(mutations(state).map(([tool, ...args]) => [tool, args[0]])).toEqual([['npm', 'publish'], ['npm', 'publish']])
    expect(state.npm[names[0]]).toMatch(/^[a-f0-9]{40}$/)
    expect(state.remoteGo).toBe(false)
  })

  it('publishes approved first-publication fake distributions once and verifies hashes and the remote Go tag', async () => {
    const test = await fixture({ firstPublication: true, delayVisibility: true })
    const result = test.invoke(['--authorize-release'])
    expect(result.status, result.stderr).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report).toMatchObject({ complete: true, pending: [], failed: null })
    expect(report.published).toEqual([...names, 'pypi:focused-spec-scenarios', 'github:FocusedSpec.Scenarios', `go:packages/sdk/go/v${version}`])
    const state = await test.state()
    expect(Object.keys(state.python)).toHaveLength(2)
    expect(Object.keys(state.assets).sort()).toEqual([`FocusedSpec.Scenarios.${version}.nupkg`, `FocusedSpec.Scenarios.${version}.nupkg.sha256`])
    expect(state.remoteGo).toBe(true)
    expect(state.calls.some(([tool, ...args]) => tool === 'npm' && args[0] === 'org' && args[1] === 'ls')).toBe(true)
    const again = test.invoke(['--authorize-release'])
    expect(again.status, again.stderr).toBe(0)
    expect(mutations(await test.state())).toEqual(mutations(state))
  }, 15000)
})
