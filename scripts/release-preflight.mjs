import { spawnSync } from 'node:child_process'
import { accessSync, constants, statSync } from 'node:fs'
import { delimiter, join, resolve } from 'node:path'

const nodeExclusions = [
  'test/cli-init-native.spec.ts',
  'test/cli-reports-native.spec.ts',
  'test/package-init-native.spec.ts',
  'test/package-build-native.spec.ts',
  'test/package-docs-native.spec.ts',
  'test/evals-lifecycle-native.spec.ts',
  'test/evals-integration.spec.ts',
  'test/dotnet-native-plugins.spec.ts',
  'test/python-native-plugins.spec.ts',
  'test/dotnet-scenarios.spec.ts',
  'test/executable-scenarios.spec.ts',
  'test/go-executable-scenarios.spec.ts',
  'test/python-scenarios.spec.ts',
  'test/native-pilot.spec.ts',
  'test/runner-lifecycle-go.spec.ts',
  'test/runner-lifecycle-python.spec.ts',
  'official-runners: reports exact pytest outcomes / reports exact Go outcomes',
]

const tiers = {
  node: {
    tools: ['node', 'npm'],
    network: ['registry.npmjs.org (consumer fixture dependencies when not cached)'],
    description: 'portable Node-only checks; native suites are excluded, not certified',
  },
  go: {
    tools: ['node', 'npm', 'go'],
    network: ['registry.npmjs.org (consumer fixture dependencies when not cached)'],
    description: 'Node and Go SDK, bank, runner and lifecycle checks; no Python smoke',
  },
  python: {
    tools: ['node', 'npm', 'uv', 'python3'],
    network: ['registry.npmjs.org (npm packages)', 'pypi.org and files.pythonhosted.org (Python packages)'],
    description: 'Node and Python SDK, bank, plugin, PTY and lifecycle checks',
  },
  dotnet: {
    tools: ['node', 'npm', 'dotnet'],
    network: ['registry.npmjs.org (npm packages)', 'api.nuget.org (restore only)'],
    description: '.NET SDK 10+; Microsoft.NETCore.App runtimes 8, 9 and 10 for native consumers',
  },
  full: {
    tools: ['node', 'npm', 'uv', 'python3', 'go', 'dotnet'],
    network: ['registry.npmjs.org', 'pypi.org and files.pythonhosted.org', 'api.nuget.org (restore only)'],
    description: 'all repository checks, CLI smoke and all native/CLI bank scenarios',
  },
}

const requirements = {
  npm: { args: ['--version'], pattern: /^(\d+)\./u, minimum: [0, 0], label: 'an executable npm installation' },
  go: { args: ['version'], pattern: /go(\d+)\.(\d+)/u, minimum: [1, 23], label: 'Go 1.23+' },
  uv: { args: ['--version'], pattern: /^uv (\d+)\./u, minimum: [0, 0], label: 'uv (with venv, pip, run and build support)' },
  python3: { args: ['--version'], pattern: /Python (\d+)\.(\d+)/u, minimum: [3, 11], label: 'Python 3.11+ exposed as python3 on PATH' },
  dotnet: { args: ['--version'], pattern: /^(\d+)\.(\d+)\./u, minimum: [10, 0], label: '.NET SDK 10+' },
}

function parseArgs(args) {
  const options = { tier: 'node', json: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--json') options.json = true
    else if (arg === '--tier') options.tier = args[++index]
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

function locate(name) {
  const extensions = process.platform === 'win32' ? ['', ...(process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')] : ['']
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory) continue
    for (const extension of extensions) {
      const candidate = resolve(join(directory.replace(/^"|"$/gu, ''), `${name}${extension}`))
      try {
        accessSync(candidate, constants.X_OK)
        if (statSync(candidate).isFile()) return candidate
      } catch {}
    }
  }
  return null
}

function invoke(path, args) {
  return spawnSync(path, args, {
    encoding: 'utf8',
    timeout: 10_000,
    shell: process.platform === 'win32' && /\.(?:cmd|bat)$/iu.test(path),
  })
}

function meetsMinimum(actual, minimum) {
  return actual[0] > minimum[0] || (actual[0] === minimum[0] && (actual[1] ?? 0) >= minimum[1])
}

function executable(name) {
  if (name === 'node') {
    const available = meetsMinimum(process.versions.node.split('.').map(Number), [22, 16])
    return { available, path: process.execPath, detail: `${process.execPath} (${process.version}); requires Node.js 22.16.0+` }
  }
  const requirement = requirements[name]
  const path = locate(name)
  if (!path) return { available: false, detail: `missing ${name} on PATH; install ${requirement.label}` }
  const result = invoke(path, requirement.args)
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  if (result.error || result.status !== 0) {
    return { available: false, path, detail: `${path} could not report its version; install ${requirement.label}${result.error ? `: ${result.error.message}` : ''}` }
  }
  const match = output.match(requirement.pattern)
  if (!match || !meetsMinimum(match.slice(1).map(Number), requirement.minimum)) {
    return { available: false, path, detail: `${path}: ${output || 'empty version output'}; requires ${requirement.label}` }
  }
  if (name === 'dotnet') {
    const runtimes = invoke(path, ['--list-runtimes'])
    const installed = new Set([...`${runtimes.stdout ?? ''}`.matchAll(/^Microsoft\.NETCore\.App (\d+)\./gmu)].map(entry => Number(entry[1])))
    const missing = [8, 9, 10].filter(major => !installed.has(major))
    if (runtimes.error || runtimes.status !== 0 || missing.length) {
      return { available: false, path, detail: `${path} (${output}); install Microsoft.NETCore.App runtimes ${missing.length ? missing.join(', ') : '8, 9 and 10'} (SDK tests net8.0, bank/catalog net9.0, distribution consumers net10.0)` }
    }
  }
  return { available: true, path, detail: `${path} (${output.replace(/\s+/gu, ' ')})` }
}

function usage() {
  return 'Usage: node scripts/release-preflight.mjs [--tier node|go|python|dotnet|full] [--json]'
}

try {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    process.exit(0)
  }
  if (!Object.hasOwn(tiers, options.tier)) throw new Error(`Unknown tier ${JSON.stringify(options.tier)}. ${usage()}`)
  const tier = tiers[options.tier]
  const tools = tier.tools.map(name => ({ name, ...executable(name) }))
  const missing = tools.filter(tool => !tool.available).map(tool => tool.name)
  const report = {
    tier: options.tier,
    description: tier.description,
    tools,
    excluded: options.tier === 'node' ? nodeExclusions : [],
    network: tier.network,
    networkChecked: false,
    missing,
    ready: missing.length === 0,
  }
  if (options.json) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(`Release preflight: ${options.tier} (${tier.description})`)
    for (const tool of tools) console.log(`${tool.available ? 'ok' : 'missing'} ${tool.name}: ${tool.detail}`)
    if (report.excluded.length) console.log(`excluded from Node-only certification:\n${report.excluded.map(path => `  ${path}`).join('\n')}`)
    console.log(`network paths (not probed; caches may avoid downloads): ${tier.network.join(', ')}`)
    console.log(report.ready ? 'preflight ready' : `preflight blocked: ${missing.join(', ')}; install or expose the listed prerequisites on PATH`)
  }
  process.exitCode = report.ready ? 0 : 1
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 2
}
