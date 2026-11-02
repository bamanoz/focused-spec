import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const packages = [
  '@focused-spec/format-scenarios-python',
  '@focused-spec/runner-scenarios-python',
  '@focused-spec/format-scenarios-dotnet',
  '@focused-spec/runner-scenarios-dotnet',
]
const args = process.argv.slice(2)
if (args.some(arg => !['--json', '--publisher'].includes(arg))) throw new Error('Usage: node scripts/release-registry.mjs [--json] [--publisher]')
const publisher = args.includes('--publisher')
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
function npm(args) {
  const result = spawnSync('npm', args, { encoding: 'utf8' })
  if (result.error || result.signal) return { ok: false, notFound: false }
  if (result.status !== 0) return { ok: false, notFound: /E404|not found/iu.test(`${result.stdout} ${result.stderr}`) }
  try { return { ok: true, value: JSON.parse(result.stdout) } } catch { return { ok: false, notFound: false } }
}
const approved = process.env.FOCUSED_SPEC_NATIVE_NAMES_APPROVED === '1'
const identity = publisher ? npm(['whoami', '--json']) : null
const access = publisher && identity?.ok ? npm(['access', 'list', 'packages', identity.value, '--json']) : null
const results = packages.map(name => {
  const exact = npm(['view', `${name}@${version}`, 'version', '--json'])
  if (!publisher) return {
    name,
    requestedVersion: version,
    status: exact.ok ? exact.value === version ? 'available' : 'version-mismatch' : exact.notFound ? 'unavailable' : 'blocked',
  }
  if (!approved) return { name, requestedVersion: version, status: 'blocked', detail: 'explicit maintainer name/access decision required' }
  if (!identity?.ok || typeof identity.value !== 'string' || !access?.ok || !access.value || typeof access.value !== 'object') {
    return { name, requestedVersion: version, status: 'blocked', detail: 'authenticated npm identity and package access lookup required' }
  }
  if (exact.ok && exact.value !== version) return { name, requestedVersion: version, status: 'version-mismatch' }
  if (!exact.ok && !exact.notFound) return { name, requestedVersion: version, status: 'blocked', detail: 'exact-version lookup failed' }
  const rights = access.value[name]
  if (rights === 'read-write') return { name, requestedVersion: version, status: 'authorized', versionPublished: exact.ok }
  const existingName = npm(['view', name, 'name', '--json'])
  // npm has no write-access object for an unclaimed name. Both the authenticated
  // scope membership and an explicit maintainer decision are required instead.
  if (!existingName.ok && existingName.notFound && !exact.ok) {
    const members = npm(['org', 'ls', 'focused-spec', '--json'])
    if (members.ok && ['owner', 'admin', 'developer'].includes(members.value?.[identity.value])) {
      return { name, requestedVersion: version, status: 'authorized-first-publication', versionPublished: false }
    }
  }
  return { name, requestedVersion: version, status: 'blocked', detail: 'write access or approved unclaimed name with publishing scope membership required' }
})
const allowed = publisher ? ['authorized', 'authorized-first-publication'] : ['available']
const ready = results.every(result => allowed.includes(result.status))
const report = {
  version,
  mode: publisher ? 'publisher' : 'published-versions',
  approved: publisher ? approved : null,
  packages: results,
  available: results.filter(result => allowed.includes(result.status)).map(result => result.name),
  unavailable: results.filter(result => !allowed.includes(result.status)).map(result => result.name),
  ready,
  certificationComplete: !publisher && ready,
}
if (args.includes('--json')) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`Registry preflight ${report.mode} at ${version}`)
  for (const result of results) console.log(`${result.status}: ${result.name}${result.detail ? ` (${result.detail})` : ''}`)
  console.log(ready ? publisher ? 'publisher preflight ready; published-version certification remains separate' : 'published-version certification ready' : `registry preflight blocked: ${report.unavailable.join(', ')}`)
}
if (!ready) process.exitCode = 1
