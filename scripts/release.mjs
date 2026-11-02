import { spawnSync } from 'node:child_process'
import { readFile, readdir, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runDistributionPlan } from './release-publisher.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const authorized = process.argv.includes('--authorize-release')
const report = {
  authorized,
  dryRun: !authorized,
  complete: false,
  prepared: [],
  published: [],
  pending: [],
  failed: null,
  provenance: 'unavailable: local token publishing does not verify OIDC provenance',
}
const env = { ...process.env }
const temporaryRoot = join(tmpdir(), 'focused-spec-release-')

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, env, encoding: 'utf8', ...options })
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(`${executable} ${args[0] ?? ''} failed${result.error ? `: ${result.error.message}` : result.signal ? ` (${result.signal})` : ` (exit ${result.status})`}`)
  }
  return result.stdout.trim()
}
function json(executable, args) { return JSON.parse(run(executable, args)) }
function digest(bytes, algorithm = 'sha256') { return createHash(algorithm).update(bytes).digest('hex') }
function requireConfiguration() {
  const missing = []
  if (!env.NODE_AUTH_TOKEN && !env.NPM_CONFIG_TOKEN) missing.push('npm publisher token (NODE_AUTH_TOKEN or NPM_CONFIG_TOKEN)')
  if (!env.UV_PUBLISH_TOKEN && !(env.TWINE_USERNAME && env.TWINE_PASSWORD)) missing.push('PyPI publisher configuration (UV_PUBLISH_TOKEN or TWINE_USERNAME/TWINE_PASSWORD)')
  if (!env.UV_PUBLISH_TOKEN && env.TWINE_PASSWORD) {
    env.UV_PUBLISH_USERNAME = env.TWINE_USERNAME
    env.UV_PUBLISH_PASSWORD = env.TWINE_PASSWORD
  }
  if (env.FOCUSED_SPEC_NATIVE_NAMES_APPROVED !== '1') missing.push('maintainer native-package name/access decision (FOCUSED_SPEC_NATIVE_NAMES_APPROVED=1)')
  if (missing.length) throw new Error(`Missing publisher configuration: ${missing.join('; ')}`)
}
function verifySource(version) {
  if (run('git', ['status', '--porcelain'])) throw new Error('Release preparation requires a clean working tree')
  const commit = run('git', ['rev-parse', 'HEAD'])
  if (run('git', ['rev-parse', `v${version}^{commit}`]) !== commit) throw new Error(`v${version} must identify HEAD`)
  const remote = run('git', ['ls-remote', 'origin', 'refs/heads/main', `refs/tags/v${version}`, `refs/tags/v${version}^{}`])
  const refs = Object.fromEntries(remote.split(/\r?\n/u).filter(Boolean).map(line => {
    const [sha, ref] = line.split(/\s+/u)
    return [ref, sha]
  }))
  if (refs['refs/heads/main'] !== commit || (refs[`refs/tags/v${version}^{}`] ?? refs[`refs/tags/v${version}`]) !== commit) {
    throw new Error('origin/main and the immutable remote release tag must identify HEAD')
  }
  return commit
}
async function readJson(path) { return JSON.parse(await readFile(join(root, path), 'utf8')) }
async function prepare(version, packages, temporary) {
  const npmDir = join(temporary, 'npm')
  await mkdir(npmDir)
  const npmArtifacts = []
  for (const item of packages) {
    const result = json('npm', ['pack', '--ignore-scripts', `--workspace=${item.name}`, '--pack-destination', npmDir, '--json'])
    if (result.length !== 1 || result[0].name !== item.name || result[0].version !== version) throw new Error(`Unexpected npm pack identity for ${item.name}`)
    const path = join(npmDir, result[0].filename)
    const bytes = await readFile(path)
    if (digest(bytes, 'sha1') !== result[0].shasum) throw new Error(`Packed npm checksum differs for ${item.name}`)
    npmArtifacts.push({ ...item, path, filename: result[0].filename, sha1: result[0].shasum, sha256: digest(bytes) })
  }

  const pythonDir = join(temporary, 'python')
  await mkdir(pythonDir)
  run('uv', ['build', '--out-dir', pythonDir, 'packages/sdk/python'])
  const pythonFiles = (await readdir(pythonDir)).sort()
  const expectedPython = [`focused_spec_scenarios-${version}-py3-none-any.whl`, `focused_spec_scenarios-${version}.tar.gz`]
  if (pythonFiles.length !== 2 || expectedPython.some(name => !pythonFiles.includes(name))) throw new Error('Python build did not produce the exact coordinated wheel and sdist')
  const pythonArtifacts = await Promise.all(pythonFiles.map(async filename => {
    const path = join(pythonDir, filename)
    return { filename, path, sha256: digest(await readFile(path)) }
  }))

  const dotnetDir = join(temporary, 'dotnet')
  await mkdir(dotnetDir)
  run('dotnet', ['pack', 'packages/sdk/dotnet/FocusedSpec.Scenarios/FocusedSpec.Scenarios.csproj', '--configuration', 'Release', '--output', dotnetDir, '--nologo'])
  const dotnetName = `FocusedSpec.Scenarios.${version}.nupkg`
  const dotnetPath = join(dotnetDir, dotnetName)
  const bytes = await readFile(dotnetPath)
  const sha256 = digest(bytes)
  const checksum = `${sha256}  ${dotnetName}\n`
  const checksumPath = `${dotnetPath}.sha256`
  await writeFile(checksumPath, checksum)
  const inspect = run('python3', ['-c', 'import sys,zipfile,xml.etree.ElementTree as E; z=zipfile.ZipFile(sys.argv[1]); n=[n for n in z.namelist() if n.endswith(".nuspec")]; assert len(n)==1; r=E.fromstring(z.read(n[0])); v={e.tag.split("}")[-1]:e.text for e in r.iter()}; assert v["id"]=="FocusedSpec.Scenarios" and v["version"]==sys.argv[2]; assert all("lib/"+t+"/FocusedSpec.Scenarios.dll" in z.namelist() for t in ("net8.0","net10.0")); print("verified")', dotnetPath, version])
  if (inspect !== 'verified') throw new Error('.NET package identity/framework verification failed')
  const consumer = join(temporary, 'dotnet-consumer')
  await mkdir(consumer)
  await writeFile(join(consumer, 'NuGet.Config'), `<configuration><packageSources><clear/><add key="verified-local" value="${dotnetDir.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"/></packageSources></configuration>`)
  await writeFile(join(consumer, 'Consumer.csproj'), `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFrameworks>net8.0;net10.0</TargetFrameworks></PropertyGroup><ItemGroup><PackageReference Include="FocusedSpec.Scenarios" Version="${version}"/></ItemGroup></Project>`)
  await writeFile(join(consumer, 'Program.cs'), 'System.Console.WriteLine(System.Reflection.Assembly.Load("FocusedSpec.Scenarios").GetName().Name);')
  const consumerEnv = { ...env, NUGET_PACKAGES: join(temporary, 'nuget-cache') }
  run('dotnet', ['restore', join(consumer, 'Consumer.csproj'), '--configfile', join(consumer, 'NuGet.Config'), '--force', '--no-cache'], { env: consumerEnv })
  for (const framework of ['net8.0', 'net10.0']) {
    const output = run('dotnet', ['run', '--project', join(consumer, 'Consumer.csproj'), '--framework', framework, '--no-restore'], { env: consumerEnv })
    if (!output.includes('FocusedSpec.Scenarios')) throw new Error(`Verified local-feed consumer failed for ${framework}`)
  }

  return {
    npm: npmArtifacts,
    python: pythonArtifacts,
    dotnet: { filename: dotnetName, path: dotnetPath, sha256, checksum, checksumPath },
  }
}
async function npmExists(item, version) {
  const result = spawnSync('npm', ['view', `${item.name}@${version}`, 'version', 'dist.shasum', '--json'], { cwd: root, env, encoding: 'utf8' })
  if (result.status !== 0) {
    if (/E404/u.test(`${result.stdout}${result.stderr}`)) return false
    throw new Error(`npm registry lookup blocked for ${item.name}`)
  }
  const remote = JSON.parse(result.stdout)
  if (remote.version !== version || remote['dist.shasum'] !== item.sha1) throw new Error(`Immutable npm artifact differs: ${item.name}@${version}`)
  return true
}
async function pypiFiles(version, artifacts) {
  const response = await fetch(`https://pypi.org/pypi/focused-spec-scenarios/${version}/json`)
  if (response.status === 404) return []
  if (!response.ok) throw new Error(`PyPI verification failed (${response.status})`)
  const metadata = await response.json()
  for (const artifact of artifacts) {
    const match = metadata.urls.find(item => item.filename === artifact.filename)
    if (match && match.digests.sha256 !== artifact.sha256) throw new Error(`Immutable PyPI artifact differs: ${artifact.filename}`)
  }
  return metadata.urls
}
async function githubAssets(version) {
  return json('gh', ['release', 'view', `v${version}`, '--json', 'assets']).assets
}
async function verifyGithubAsset(version, artifact, destination) {
  await mkdir(destination, { recursive: true })
  run('gh', ['release', 'download', `v${version}`, '--pattern', artifact.filename, '--pattern', `${artifact.filename}.sha256`, '--dir', destination])
  const bytes = await readFile(join(destination, artifact.filename))
  const checksum = await readFile(join(destination, `${artifact.filename}.sha256`), 'utf8')
  if (digest(bytes) !== artifact.sha256 || checksum !== artifact.checksum) throw new Error('GitHub Release artifact or checksum manifest differs from verified local files')
}
function remoteGoTag(tag, expectedCommit) {
  const result = spawnSync('git', ['ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`], { cwd: root, env, encoding: 'utf8' })
  if (result.error || result.status !== 0) throw new Error(`Remote Go tag lookup failed: ${result.stderr ?? result.error?.message ?? ''}`)
  if (!result.stdout.trim()) return false
  const rows = result.stdout.trim().split(/\r?\n/u).map(line => line.split(/\s+/u))
  const commit = rows.find(row => row[1]?.endsWith('^{}'))?.[0] ?? rows[0]?.[0]
  if (commit !== expectedCommit) throw new Error('Immutable remote Go module tag points at a different source commit')
  return true
}
async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node scripts/release.mjs [--version X.Y.Z] [--authorize-release]')
    console.log('Without --authorize-release, verifies source, prerequisites, and prepared artifacts without publication, upload, tag, or push operations.')
    return
  }
  for (let index = 2; index < process.argv.length; index += 1) {
    if (process.argv[index] === '--version') index += 1
    else if (process.argv[index] !== '--authorize-release') throw new Error(`Unknown option: ${process.argv[index]}`)
  }
  const manifest = await readJson('package.json')
  const versionIndex = process.argv.indexOf('--version')
  const version = versionIndex < 0 ? manifest.version : process.argv[versionIndex + 1]
  if (!version || version !== manifest.version) throw new Error('Requested version must match source version')
  if (authorized) requireConfiguration()
  const sourceCommit = verifySource(version)
  if (authorized) run('gh', ['auth', 'status'])
  const release = json('gh', ['release', 'view', `v${version}`, '--json', 'tagName,isDraft,isPrerelease'])
  if (release.tagName !== `v${version}` || release.isDraft || release.isPrerelease) throw new Error('A published stable GitHub Release for the verified tag is required')
  run('npm', ['run', 'release:prepare-check'], { stdio: ['ignore', 'pipe', 'pipe'] })
  const versionReport = json(process.execPath, ['scripts/release-versions.mjs', '--json'])
  const packages = versionReport.distributions.filter(item => item.kind === 'npm')
  const nativeNames = json(process.execPath, ['scripts/release-registry.mjs', '--publisher', '--json'])
  if (!nativeNames.ready) throw new Error(`Native package names or versions remain unresolved: ${nativeNames.unavailable.join(', ')}`)
  if (authorized && !env.NODE_AUTH_TOKEN && !env.NPM_CONFIG_TOKEN) throw new Error('Missing npm publisher token')
  report.pending = [...packages.map(item => item.name), 'pypi:focused-spec-scenarios', 'github:FocusedSpec.Scenarios', `go:packages/sdk/go/v${version}`]
  const temporary = await mkdtemp(temporaryRoot)
  try {
    const artifacts = await prepare(version, packages, temporary)
    report.prepared = [
      ...artifacts.npm.map(item => ({ distribution: item.name, file: item.filename, sha256: item.sha256 })),
      ...artifacts.python.map(item => ({ distribution: 'pypi:focused-spec-scenarios', file: item.filename, sha256: item.sha256 })),
      { distribution: 'github:FocusedSpec.Scenarios', file: artifacts.dotnet.filename, sha256: artifacts.dotnet.sha256, checksumManifest: `${artifacts.dotnet.filename}.sha256` },
    ]
    if (verifySource(version) !== sourceCommit) throw new Error('Source revision changed during release preparation')
    if (!authorized) {
      report.dryRun = true
      console.log(JSON.stringify(report, null, 2))
      return
    }

    const plan = [
      ...artifacts.npm.map(item => ({ name: item.name, exists: () => npmExists(item, version), publish: () => run('npm', ['publish', item.path, '--ignore-scripts', '--access', 'public']), verify: () => npmExists(item, version) })),
      {
        name: 'pypi:focused-spec-scenarios',
        exists: async () => {
          const remote = await pypiFiles(version, artifacts.python)
          return artifacts.python.every(item => remote.some(file => file.filename === item.filename))
        },
        publish: async () => {
          const remote = await pypiFiles(version, artifacts.python)
          const missing = artifacts.python.filter(item => !remote.some(file => file.filename === item.filename))
          run('uv', ['publish', '--publish-url', 'https://upload.pypi.org/legacy/', ...missing.map(item => item.path)])
        },
        verify: async () => {
          const remote = await pypiFiles(version, artifacts.python)
          return artifacts.python.every(item => remote.some(file => file.filename === item.filename && file.digests.sha256 === item.sha256))
        },
      },
      {
        name: 'github:FocusedSpec.Scenarios',
        exists: async () => {
          const assets = await githubAssets(version)
          const names = new Set(assets.map(item => item.name))
          const hasPackage = names.has(artifacts.dotnet.filename)
          const hasChecksum = names.has(`${artifacts.dotnet.filename}.sha256`)
          if (hasPackage !== hasChecksum) throw new Error('GitHub Release contains only one immutable .NET package/checksum asset')
          if (hasPackage) await verifyGithubAsset(version, artifacts.dotnet, join(temporary, 'existing-assets'))
          return hasPackage
        },
        publish: async () => {
          run('gh', ['release', 'upload', `v${version}`, artifacts.dotnet.path, artifacts.dotnet.checksumPath])
        },
        verify: async () => {
          await verifyGithubAsset(version, artifacts.dotnet, join(temporary, 'verified-assets'))
          return true
        },
      },
      {
        name: `go:packages/sdk/go/v${version}`,
        exists: () => remoteGoTag(`packages/sdk/go/v${version}`, sourceCommit),
        publish: () => {
          const local = spawnSync('git', ['rev-parse', '--verify', `refs/tags/packages/sdk/go/v${version}^{commit}`], { cwd: root, env, encoding: 'utf8' })
          if (local.status === 0 && local.stdout.trim() !== sourceCommit) throw new Error('Existing local Go tag must not be moved')
          if (local.status !== 0) run('git', ['tag', `packages/sdk/go/v${version}`, sourceCommit])
          run('git', ['push', 'origin', `refs/tags/packages/sdk/go/v${version}`])
        },
        verify: () => remoteGoTag(`packages/sdk/go/v${version}`, sourceCommit),
      },
    ]
    const result = await runDistributionPlan(plan.map(item => item.name), {
      dryRun: false,
      exists: name => plan.find(item => item.name === name).exists(),
      publish: name => plan.find(item => item.name === name).publish(),
      verify: name => plan.find(item => item.name === name).verify(),
    })
    report.published = result.published
    report.pending = result.pending
    report.failed = result.failed
    report.complete = result.complete
    if (!report.complete) process.exitCode = 1
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}
main().catch(error => {
  report.failed = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify(report, null, 2))
  process.exitCode = 1
})
