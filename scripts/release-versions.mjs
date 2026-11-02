import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'glob'

const root = process.env.FOCUSED_SPEC_RELEASE_ROOT === undefined
  ? fileURLToPath(new URL('../', import.meta.url))
  : resolve(process.env.FOCUSED_SPEC_RELEASE_ROOT)
const findings = []
const distributions = []
const references = []
const dependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']
const semver = String.raw`\d+\.\d+\.\d+(?:-[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?`
const canonicalGoModule = 'github.com/bamanoz/focused-spec/packages/sdk/go'
const goMarker = 'v0.0.0-COORDINATED'

async function readText(path) {
  try {
    return await readFile(join(root, path), 'utf8')
  } catch (error) {
    findings.push(`${path}: cannot read (${error.code ?? error.message})`)
    return ''
  }
}

async function readJson(path) {
  const text = await readText(path)
  if (text === '') return {}
  try {
    return JSON.parse(text)
  } catch {
    findings.push(`${path}: invalid JSON`)
    return {}
  }
}

const rootManifest = await readJson('package.json')
const version = rootManifest.version
if (typeof version !== 'string' || !new RegExp(`^${semver}$`, 'u').test(version)) {
  findings.push(`package.json: version ${version} is not a release semver`)
}

const workspacePatterns = Array.isArray(rootManifest.workspaces)
  ? rootManifest.workspaces
  : rootManifest.workspaces?.packages
const workspacePaths = new Set()
if (!Array.isArray(workspacePatterns) || workspacePatterns.some(pattern => typeof pattern !== 'string')) {
  findings.push('package.json: workspaces must declare workspace paths')
} else {
  const ignore = ['**/node_modules/**', ...workspacePatterns.filter(pattern => pattern.startsWith('!')).map(pattern => `${pattern.slice(1).replace(/\/$/u, '')}/package.json`)]
  for (const pattern of workspacePatterns.filter(pattern => !pattern.startsWith('!'))) {
    for (const path of await glob(`${pattern.replace(/\/$/u, '')}/package.json`, { cwd: root, nodir: true, ignore, posix: true })) {
      workspacePaths.add(path.replace(/^\.\//u, ''))
    }
  }
  if (workspacePaths.size === 0) findings.push('package.json: workspaces did not discover any package.json files')
}

const workspaces = []
const publishable = new Map()
for (const path of [...workspacePaths].sort()) {
  const manifest = await readJson(path)
  const workspace = { path, manifest }
  workspaces.push(workspace)
  if (manifest.private === true) continue
  if (typeof manifest.name !== 'string' || manifest.name === '') {
    findings.push(`${path}: name ${manifest.name} is not a publishable package name`)
    continue
  }
  if (publishable.has(manifest.name)) {
    findings.push(`${path}: name ${manifest.name} duplicates ${publishable.get(manifest.name).path}`)
    continue
  }
  publishable.set(manifest.name, workspace)
  if (manifest.version !== version) findings.push(`${path}: version ${manifest.version} does not match ${version}`)
}

function checkDependencies(path, manifest) {
  for (const field of dependencyFields) {
    for (const [name, value] of Object.entries(manifest[field] ?? {})) {
      const target = publishable.get(name)
      if (target === undefined) continue
      let matches = false
      if (typeof value === 'string') {
        if (/^(?:file|link):/u.test(value)) {
          matches = resolve(root, dirname(path), value.slice(value.indexOf(':') + 1)) === resolve(root, dirname(target.path))
        } else {
          const range = value.replace(/^workspace:/u, '')
          matches = (value.startsWith('workspace:') && ['*', '^', '~'].includes(range))
            || [version, `^${version}`, `~${version}`, `=${version}`].includes(range)
        }
      }
      if (!matches) findings.push(`${path}: ${field}.${name} ${value} does not match coordinated version ${version} (${target.path})`)
    }
  }
}
checkDependencies('package.json', rootManifest)
for (const { path, manifest } of workspaces) checkDependencies(path, manifest)

const ordered = []
const states = new Map()
const stack = []
let cyclic = false
function visit(workspace) {
  const { path, manifest } = workspace
  if (states.get(manifest.name) === 'done') return
  if (states.get(manifest.name) === 'visiting') {
    const cycle = [...stack.slice(stack.indexOf(workspace)), workspace]
    findings.push(`npm dependency cycle: ${cycle.map(item => `${item.path} (${item.manifest.name})`).join(' -> ')}`)
    cyclic = true
    return
  }
  states.set(manifest.name, 'visiting')
  stack.push(workspace)
  const dependencies = new Set(dependencyFields.slice(0, 3).flatMap(field => Object.keys(manifest[field] ?? {})))
  for (const name of [...dependencies].sort()) {
    const dependency = publishable.get(name)
    if (dependency !== undefined) visit(dependency)
  }
  stack.pop()
  states.set(manifest.name, 'done')
  ordered.push({ kind: 'npm', path, name: manifest.name, version: manifest.version })
}
for (const workspace of publishable.values()) visit(workspace)
// Never expose a partial publication order for a graph that cannot be published.
if (!cyclic) distributions.push(...ordered)

const pythonPath = 'packages/sdk/python/pyproject.toml'
const pythonText = await readText(pythonPath)
const projectTable = pythonText.match(/^\s*\[\s*project\s*\][^\S\r\n]*(?:#[^\r\n]*)?\r?\n([\s\S]*?)(?=^\s*\[|$(?![\s\S]))/mu)?.[1] ?? ''
function projectString(key) {
  return projectTable.match(new RegExp(`^\\s*${key}\\s*=\\s*(["'])([^"'\\r\\n]*)\\1\\s*(?:#[^\\r\\n]*)?$`, 'mu'))?.[2]
}
const pythonVersion = projectString('version')
distributions.push({ kind: 'python', path: pythonPath, name: projectString('name'), version: pythonVersion })
if (pythonVersion !== version) findings.push(`${pythonPath}: project.version ${pythonVersion} does not match ${version}`)

const dotnetPath = 'packages/sdk/dotnet/FocusedSpec.Scenarios/FocusedSpec.Scenarios.csproj'
const dotnetText = (await readText(dotnetPath)).replace(/<!--[\s\S]*?-->/gu, '')
const propertyGroups = [...dotnetText.matchAll(/<PropertyGroup\b[^>]*>([\s\S]*?)<\/PropertyGroup>/gu)].map(match => match[1]).join('\n')
function property(name) {
  return [...propertyGroups.matchAll(new RegExp(`<${name}\\b[^>]*>\\s*([^<]*?)\\s*</${name}>`, 'gu'))].at(-1)?.[1]
}
const projectVersion = property('Version')
const packageVersionOverride = property('PackageVersion')
const packageVersion = packageVersionOverride ?? projectVersion
const packageId = property('PackageId')
const frameworks = property('TargetFrameworks') ?? property('TargetFramework')
const targetFrameworks = frameworks?.split(';').map(value => value.trim()).sort() ?? []
if (projectVersion !== version) findings.push(`${dotnetPath}: Version ${projectVersion} does not match ${version}`)
if (packageVersionOverride !== undefined && packageVersionOverride !== version) findings.push(`${dotnetPath}: PackageVersion ${packageVersionOverride} does not match ${version}`)
if (packageId !== 'FocusedSpec.Scenarios') findings.push(`${dotnetPath}: PackageId ${packageId} does not match FocusedSpec.Scenarios`)
if (targetFrameworks.join(';') !== ['net8.0', 'net10.0'].sort().join(';')) {
  findings.push(`${dotnetPath}: TargetFrameworks ${frameworks} does not match net8.0;net10.0`)
}
distributions.push({
  kind: 'dotnet', path: dotnetPath, name: packageId, version: packageVersion,
  projectVersion, packageVersion, targetFrameworks,
  asset: `${packageId}.${packageVersion}.nupkg`, delivery: 'github-release',
})

const goPath = 'packages/sdk/go/go.mod'
const goText = (await readText(goPath)).replace(/\/\/[^\r\n]*/gu, '')
const modulePath = goText.match(/^\s*module\s+"?([^"\s]+)"?\s*$/mu)?.[1]
if (modulePath !== canonicalGoModule) findings.push(`${goPath}: module ${modulePath} does not match ${canonicalGoModule}`)
const goExamplePath = 'examples/scenarios/go/go.mod'
const goExample = (await readText(goExamplePath)).replace(/\/\/[^\r\n]*/gu, '')
function goDirectives(text, directive) {
  const entries = []
  let inBlock = false
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (trimmed === `${directive} (`) { inBlock = true; continue }
    if (trimmed === ')') { inBlock = false; continue }
    if (inBlock) entries.push(trimmed)
    else if (trimmed.startsWith(`${directive} `)) entries.push(trimmed.slice(directive.length).trim())
  }
  return entries
}
const goRequirement = goDirectives(goExample, 'require').find(value => value.split(/\s+/u)[0] === canonicalGoModule)?.split(/\s+/u)[1]
const goReplacement = goDirectives(goExample, 'replace').find(value => value.split(/\s+/u)[0] === canonicalGoModule)?.split(/\s*=>\s*/u)[1]
if (goRequirement !== goMarker) findings.push(`${goExamplePath}: require ${canonicalGoModule} ${goRequirement} does not match ${goMarker}`)
if (goReplacement !== '../../../packages/sdk/go') findings.push(`${goExamplePath}: replace ${canonicalGoModule} ${goReplacement} does not match ../../../packages/sdk/go`)
const goPlan = {
  module: modulePath, expectedTag: `packages/sdk/go/v${version}`, versionField: false,
  template: { path: goExamplePath, version: goRequirement, replacement: goReplacement },
  stamp: { from: goMarker, to: `v${version}` },
}

// These are authored distribution inputs, not a sweep of arbitrary protocol/tool versions.
const referencePaths = new Set(['docs/guides/install.md', 'guidance/integration.md', 'scripts/stage-assets.mjs'])
for (const path of await glob([
  'README.md', 'docs/development/releasing.md', 'packages/sdk/{go,python,dotnet/FocusedSpec.Scenarios}/README.md',
  'test/{package*,*-native-plugins,go-executable-scenarios,dotnet-scenarios,python-scenarios}.spec.{ts,js,mjs}',
  'packages/sdk/dotnet/**/*.csproj', 'examples/scenarios/dotnet/**/*.csproj',
], { cwd: root, nodir: true, ignore: ['**/{node_modules,bin,obj}/**'], posix: true })) referencePaths.add(path)

for (const path of [...referencePaths].sort()) {
  const text = await readText(path)
  const seen = new Set()
  function capture(pattern) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1]
      const offset = match.index + match[0].lastIndexOf(value)
      if (seen.has(offset)) continue
      seen.add(offset)
      const line = text.slice(0, offset).split('\n').length
      references.push({ path, line, value })
      if (value !== version) findings.push(`${path}:${line}: release reference ${value} does not match ${version}`)
    }
  }
  capture(new RegExp(String.raw`https://(?:github\.com/bamanoz/focused-spec/(?:blob|tree|releases/download)|raw\.githubusercontent\.com/bamanoz/focused-spec)/v(${semver})(?=/)`, 'gu'))
  capture(new RegExp(String.raw`FocusedSpec\.Scenarios\.(${semver})\.nupkg`, 'gu'))
  capture(new RegExp(String.raw`(?:focused-spec|@focused-spec/[\w-]+)@(${semver})(?![\w.+-])`, 'gu'))
  capture(new RegExp(String.raw`focused-spec-scenarios\s*==\s*(${semver})(?![\w.+-])`, 'gu'))
  capture(new RegExp(String.raw`github\.com/bamanoz/focused-spec/packages/sdk/go@v(${semver})(?![\w.+-])`, 'gu'))
  capture(new RegExp('FocusedSpec\\.Scenarios[`\'\"]?(?:\\s+version)?\\s+[`\'\"]?(' + semver + ')(?![\\w.+-])', 'gu'))
  capture(new RegExp('(?:coordinated(?: release)?(?: version)?|release version|currently)\\s+[`\'\"]?(' + semver + ')(?![\\w.+-])', 'gu'))
  capture(new RegExp(String.raw`dotnet\s+(?:add\s+(?:[^\r\n]*?\s+)?package|package\s+add)\s+FocusedSpec\.Scenarios\b[^\r\n]*?--version(?:\s+|=)["']?(${semver})(?![\w.+-])`, 'gu'))
  capture(new RegExp(String.raw`<PackageReference\b(?=[^>]*(?:Include|Update)\s*=\s*["']FocusedSpec\.Scenarios["'])[^>]*\bVersion(?:Override)?\s*=\s*["'](${semver})["']`, 'gu'))
  capture(new RegExp(String.raw`<PackageReference\b(?=[^>]*(?:Include|Update)\s*=\s*["']FocusedSpec\.Scenarios["'])[^>]*>(?:(?!</PackageReference>)[\s\S])*?<Version(?:Override)?>\s*(${semver})\s*</Version(?:Override)?>`, 'gu'))
  if (path === 'test/go-executable-scenarios.spec.ts') {
    capture(new RegExp(String.raw`\bconst\s+version\s*=\s*["'\x60]v(${semver})["'\x60]`, 'gu'))
  }
}

const report = { version, distributions, go: goPlan, references, findings, valid: findings.length === 0 }
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`Release version check: ${version}`)
  for (const distribution of distributions) console.log(`${distribution.kind}: ${distribution.path} = ${distribution.version}`)
  console.log(`go: ${goPlan.module} -> ${goPlan.expectedTag}`)
  for (const finding of findings) console.log(`error: ${finding}`)
  console.log(report.valid ? 'version check passed' : 'version check failed')
}
if (!report.valid) process.exitCode = 1
