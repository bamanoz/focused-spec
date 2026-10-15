import { spawnSync } from 'node:child_process'
import { access, mkdir, mkdtemp, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const cli = fileURLToPath(new URL('../packages/core/dist/cli.js', import.meta.url))
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

interface Invocation {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
  readonly error?: Error
}

async function workspace(label: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `focused-spec-plugin-docs-${label}-`))
  roots.push(root)
  await put(root, 'package.json', JSON.stringify({ private: true, type: 'module' }))
  return root
}

async function put(root: string, path: string, content: string | Uint8Array): Promise<void> {
  const target = join(root, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content)
}

function invoke(root: string, argumentsList: readonly string[], cwd = root): Invocation {
  const child = spawnSync(process.execPath, [cli, ...argumentsList], {
    cwd,
    encoding: 'utf8',
    timeout: 20_000,
  })
  return {
    status: child.status,
    stdout: child.stdout,
    stderr: child.stderr,
    ...(child.error === undefined ? {} : { error: child.error }),
  }
}

function successfulJson(result: Invocation): unknown {
  expect(result.error, result.stderr).toBeUndefined()
  expect(result.status, result.stderr).toBe(0)
  expect(result.stderr).toBe('')
  return JSON.parse(result.stdout) as unknown
}

function failed(result: Invocation): void {
  expect(result.error, result.stderr).toBeUndefined()
  expect(result.status).toBe(1)
  expect(result.stdout).toBe('')
  expect(result.stderr.trim()).not.toBe('')
}

async function tree(root: string): Promise<readonly string[]> {
  return (await readdir(root, { recursive: true })).sort()
}

async function resolvablePackage(
  root: string,
  directory: string,
  manifest: Readonly<Record<string, unknown>>,
  readme?: string,
): Promise<string> {
  const packageRoot = join(root, 'node_modules', directory)
  await put(root, `node_modules/${directory}/package.json`, JSON.stringify({
    type: 'module',
    exports: { '.': { import: './entry.mjs', require: './entry.cjs' } },
    ...manifest,
  }))
  await put(root, `node_modules/${directory}/entry.mjs`, "import { writeFileSync } from 'node:fs'; writeFileSync(new URL('./entry-imported', import.meta.url), 'yes'); throw new Error('documentation lookup imported the package')")
  await put(root, `node_modules/${directory}/entry.cjs`, "require('node:fs').writeFileSync(__dirname + '/entry-required', 'yes'); throw new Error('documentation lookup required the package')")
  if (readme !== undefined) await put(root, `node_modules/${directory}/README.md`, readme)
  return packageRoot
}

function configuration(
  formats: Readonly<Record<string, unknown>>,
  runners: Readonly<Record<string, unknown>>,
): string {
  const format = Object.keys(formats)[0]
  if (format === undefined) throw new Error('fixture configuration requires a format')
  return JSON.stringify({
    version: 5,
    specifications: {
      formats,
      documents: [{ match: 'specs/**/*.md', scope: 'current', format }],
    },
    runners,
  })
}

function expectTextDocument(
  output: string,
  provenance: readonly string[],
  documentPath: string,
  content: string,
): void {
  const contentOffset = output.indexOf(content)
  expect(contentOffset).toBeGreaterThan(0)
  const prefix = output.slice(0, contentOffset)
  for (const field of provenance) expect(prefix).toContain(field)
  expect(prefix).toContain(documentPath)
  expect(output.slice(contentOffset)).toBe(content)
}

describe('plugin documentation CLI', () => {
  it('reads configured plugins using consumer import conditions', async () => {
    const root = await workspace('conditions')
    const formatContent = '# Consumer format\n\nNested options remain plugin-owned. 🧭'
    const runnerContent = '# Consumer runner\n\nRun the selected consumer contract.'
    const formatRoot = await resolvablePackage(root, 'unrelated-format-kit', {
      name: 'unrelated-format-kit', version: '2.4.1',
      exports: { '.': { import: './entry.mjs', require: './require-owner/entry.cjs' } },
    }, formatContent)
    const runnerRoot = await resolvablePackage(root, '@arbitrary/contract-runner', {
      name: '@arbitrary/contract-runner', version: '7.3.0',
      exports: { '.': { import: './entry.mjs', require: './require-owner/entry.cjs' } },
    }, runnerContent)
    for (const directory of ['unrelated-format-kit', '@arbitrary/contract-runner']) {
      await put(root, `node_modules/${directory}/require-owner/package.json`, JSON.stringify({ name: 'wrong-require-owner', version: '99.0.0' }))
      await put(root, `node_modules/${directory}/require-owner/README.md`, '# Wrong CommonJS owner')
      await put(root, `node_modules/${directory}/require-owner/entry.cjs`, "require('node:fs').writeFileSync(__dirname + '/required', 'yes'); throw new Error('wrong condition executed')")
    }
    const config = configuration({
      consumer: {
        package: 'unrelated-format-kit',
        options: { parser: { package: 'not-installed-and-must-stay-opaque' } },
      },
    }, { audit: { package: '@arbitrary/contract-runner' } })
    await put(root, '.focused-spec/config.yaml', config)
    await put(root, '.focused-spec/alternate.yaml', config)
    const before = await tree(root)

    const format = invoke(root, ['plugin-docs', '--format', 'consumer', '--root', root, '--json'])
    const canonicalFormatRoot = await realpath(formatRoot)
    expect(successfulJson(format)).toEqual({
      selection: { kind: 'format', name: 'consumer' },
      plugin: { package: 'unrelated-format-kit', name: 'unrelated-format-kit', version: '2.4.1', root: canonicalFormatRoot },
      document: { path: await realpath(join(formatRoot, 'README.md')), content: formatContent },
    })

    const runner = invoke(root, ['plugin-docs', '--runner', 'audit', '--root', root, '--config', '.focused-spec/alternate.yaml', '--json'])
    const canonicalRunnerRoot = await realpath(runnerRoot)
    expect(successfulJson(runner)).toEqual({
      selection: { kind: 'runner', name: 'audit' },
      plugin: { package: '@arbitrary/contract-runner', name: '@arbitrary/contract-runner', version: '7.3.0', root: canonicalRunnerRoot },
      document: { path: await realpath(join(runnerRoot, 'README.md')), content: runnerContent },
    })
    expect(await tree(root)).toEqual(before)
    for (const marker of [
      join(formatRoot, 'entry-imported'), join(formatRoot, 'require-owner/required'),
      join(runnerRoot, 'entry-imported'), join(runnerRoot, 'require-owner/required'),
    ]) await expect(access(marker)).rejects.toMatchObject({ code: 'ENOENT' })
  }, 30_000)

  it('reads explicit packages without project configuration', async () => {
    const root = await workspace('explicit')
    const content = '# Aliased public contract\n\nFirst line.\n\nFinal UTF-8 line: café 🚀'
    const packageRoot = join(root, 'node_modules/alias-slot')
    await put(root, 'node_modules/alias-slot/package.json', JSON.stringify({
      name: '@publisher/actual-plugin',
      version: '4.5.6',
      type: 'module',
      exports: { './public': { import: './public.mjs', require: './public.cjs' } },
    }))
    await put(root, 'node_modules/alias-slot/public.mjs', "import { writeFileSync } from 'node:fs'; writeFileSync(new URL('./public-imported', import.meta.url), 'yes'); throw new Error('must not import')")
    await put(root, 'node_modules/alias-slot/public.cjs', "require('node:fs').writeFileSync(__dirname + '/public-required', 'yes'); throw new Error('must not require')")
    await put(root, 'node_modules/alias-slot/README.md', content)
    await put(root, '.focused-spec/config.yaml', 'this: [is not valid YAML')
    const before = await tree(root)
    const canonicalRoot = await realpath(packageRoot)
    const documentPath = await realpath(join(packageRoot, 'README.md'))

    const json = invoke(root, ['plugin-docs', '--package', 'alias-slot/public', '--root', root, '--json'])
    expect(successfulJson(json)).toEqual({
      selection: { kind: 'package', name: 'alias-slot/public' },
      plugin: { package: 'alias-slot/public', name: '@publisher/actual-plugin', version: '4.5.6', root: canonicalRoot },
      document: { path: documentPath, content },
    })

    const text = invoke(root, ['plugin-docs', '--package', 'alias-slot/public', '--root', root])
    expect(text.error, text.stderr).toBeUndefined()
    expect(text.status, text.stderr).toBe(0)
    expect(text.stderr).toBe('')
    expectTextDocument(text.stdout, [
      'package',
      'alias-slot/public',
      '@publisher/actual-plugin',
      '4.5.6',
      canonicalRoot,
    ], documentPath, content)
    expect(await tree(root)).toEqual(before)
    await expect(access(join(packageRoot, 'public-imported'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(join(packageRoot, 'public-required'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reads the declared document from a symlinked package', async () => {
    const root = await workspace('symlink-install')
    const packageRoot = await workspace('symlink-target')
    const content = '# Workspace plugin\n\nThe selected Markdown survives intact: 🧩'
    await put(packageRoot, 'package.json', JSON.stringify({
      name: 'workspace-plugin',
      version: '1.8.0',
      type: 'module',
      exports: { '.': './entry.mjs' },
      focusedSpec: { documentation: 'docs/contract.markdown' },
    }))
    await put(packageRoot, 'entry.mjs', "import { writeFileSync } from 'node:fs'; writeFileSync(new URL('./executed', import.meta.url), 'yes'); throw new Error('must not import')")
    await put(packageRoot, 'README.md', '# Default README must not be returned')
    await put(packageRoot, 'docs/public/contract.markdown', content)
    await symlink(join(packageRoot, 'docs/public/contract.markdown'), join(packageRoot, 'docs/contract.markdown'), 'file')
    await mkdir(join(root, 'node_modules'), { recursive: true })
    await symlink(packageRoot, join(root, 'node_modules/workspace-plugin'), 'dir')

    const result = invoke(root, ['plugin-docs', '--package', 'workspace-plugin', '--root', root, '--json'])
    expect(successfulJson(result)).toEqual({
      selection: { kind: 'package', name: 'workspace-plugin' },
      plugin: { package: 'workspace-plugin', name: 'workspace-plugin', version: '1.8.0', root: await realpath(packageRoot) },
      document: { path: await realpath(join(packageRoot, 'docs/contract.markdown')), content },
    })
    await expect(access(join(packageRoot, 'executed'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reads explicit local module documentation without executing it', async () => {
    const root = await workspace('local-module')
    const content = '# Local format\n\nProject-owned documentation. 🔒'
    await put(root, 'plugins/local-format.mjs', "import { writeFileSync } from 'node:fs'; writeFileSync(new URL('../local-format-executed', import.meta.url), 'yes'); throw new Error('must not import')")
    await put(root, 'plugins/undocumented-runner.mjs', "import { writeFileSync } from 'node:fs'; writeFileSync(new URL('../runner-executed', import.meta.url), 'yes'); throw new Error('must not import')")
    await put(root, 'docs/source/local-format.md', content)
    await mkdir(join(root, 'docs'), { recursive: true })
    await symlink(join(root, 'docs/source/local-format.md'), join(root, 'docs/local-format.md'), 'file')
    await put(root, '.focused-spec/config.yaml', configuration({
      local: { module: './plugins/local-format.mjs', documentation: 'docs/local-format.md' },
    }, {
      undocumented: { module: './plugins/undocumented-runner.mjs' },
    }))
    const before = await tree(root)
    const canonicalRoot = await realpath(root)
    const documentPath = await realpath(join(root, 'docs/local-format.md'))

    const result = invoke(root, ['plugin-docs', '--format', 'local', '--root', root, '--json'])
    expect(successfulJson(result)).toEqual({
      selection: { kind: 'format', name: 'local' },
      plugin: { module: './plugins/local-format.mjs', root: canonicalRoot },
      document: { path: documentPath, content },
    })
    failed(invoke(root, ['plugin-docs', '--runner', 'undocumented', '--root', root, '--json']))
    expect(await tree(root)).toEqual(before)
    await expect(access(join(root, 'local-format-executed'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(join(root, 'runner-executed'))).rejects.toMatchObject({ code: 'ENOENT' })

    // Runtime discovery may load formats; documentation is optional for that path.
    await put(root, 'plugins/local-format.mjs', 'export default { apiVersion: 2, parse() { return { items: [], diagnostics: [] } } }')
    await put(root, '.focused-spec/config.yaml', configuration({
      local: { module: './plugins/local-format.mjs' },
    }, { undocumented: { module: './plugins/undocumented-runner.mjs' } }))

    const syntaxOnly = invoke(root, ['validate', '--root', root, '--syntax-only', '--json'])
    expect(successfulJson(syntaxOnly)).toEqual({
      valid: true,
      mode: 'syntax-only',
      validationScope: { scopes: { mode: 'all' } },
    })
  }, 30_000)

  it('rejects unavailable or malformed documentation without fallback', async () => {
    const root = await workspace('invalid-documents')
    await put(root, 'README.md', '# Project fallback must not be used')
    await resolvablePackage(root, 'missing-readme', { name: 'missing-readme', version: '1.0.0' })
    await resolvablePackage(root, 'missing-explicit', {
      name: 'missing-explicit', version: '1.0.0', focusedSpec: { documentation: 'docs/missing.md' },
    }, '# Package fallback must not be used')
    await resolvablePackage(root, 'malformed-declaration', {
      name: 'malformed-declaration', version: '1.0.0', focusedSpec: { documentation: 42 },
    }, '# Malformed declaration fallback must not be used')
    await resolvablePackage(root, 'empty-document', { name: 'empty-document', version: '1.0.0' }, ' \n\t')
    await resolvablePackage(root, 'invalid-utf8', { name: 'invalid-utf8', version: '1.0.0' })
    await put(root, 'node_modules/invalid-utf8/README.md', Uint8Array.from([0xff, 0xfe, 0x41]))
    await resolvablePackage(root, 'directory-document', {
      name: 'directory-document', version: '1.0.0', focusedSpec: { documentation: 'docs/contract.md' },
    })
    await mkdir(join(root, 'node_modules/directory-document/docs/contract.md'), { recursive: true })
    await resolvablePackage(root, 'missing-identity', { name: 'missing-identity' }, '# Identity is incomplete')
    await resolvablePackage(root, 'config-owned-doc', { name: 'config-owned-doc', version: '1.0.0' }, '# Package contract')
    await put(root, 'plugins/undocumented.mjs', "import { writeFileSync } from 'node:fs'; writeFileSync(new URL('../undocumented-imported', import.meta.url), 'yes'); throw new Error('must not import')")
    await put(root, '.focused-spec/config.yaml', configuration({
      undocumented: { module: './plugins/undocumented.mjs' },
      unavailable: { package: 'not-installed-registered' },
    }, {}))

    for (const specifier of [
      'not-installed-anywhere',
      'missing-readme',
      'missing-explicit',
      'malformed-declaration',
      'empty-document',
      'invalid-utf8',
      'directory-document',
      'missing-identity',
    ]) {
      const result = invoke(root, ['plugin-docs', '--package', specifier, '--root', root, '--json'])
      failed(result)
      expect(result.stderr).not.toContain('fallback must not be used')
    }
    failed(invoke(root, ['plugin-docs', '--format', 'not-registered', '--root', root, '--json']))
    failed(invoke(root, ['plugin-docs', '--format', 'undocumented', '--root', root, '--json']))
    failed(invoke(root, ['plugin-docs', '--format', 'unavailable', '--root', root, '--json']))
    await put(root, '.focused-spec/config.yaml', configuration({
      packaged: { package: 'config-owned-doc', documentation: 'README.md' },
    }, {}))
    failed(invoke(root, ['plugin-docs', '--format', 'packaged', '--root', root, '--json']))
    await expect(access(join(root, 'undocumented-imported'))).rejects.toMatchObject({ code: 'ENOENT' })
  }, 30_000)

  it('rejects documentation paths escaping their owner', async () => {
    const root = await workspace('containment')
    const outside = await workspace('outside')
    await put(outside, 'secret.md', '# Outside content must stay private')
    const unsafeDeclarations: ReadonlyArray<readonly [string, string]> = [
      ['traversal-doc', '../outside.md'],
      ['absolute-doc', join(outside, 'secret.md')],
      ['drive-doc', 'C:/secret.md'],
      ['backslash-doc', 'docs\\secret.md'],
      ['non-markdown-doc', 'docs/secret.txt'],
      ['nul-doc', 'docs/\0secret.md'],
    ]
    for (const [name, documentation] of unsafeDeclarations) {
      await resolvablePackage(root, name, {
        name,
        version: '1.0.0',
        focusedSpec: { documentation },
      }, '# README fallback must not be used')
      const result = invoke(root, ['plugin-docs', '--package', name, '--root', root, '--json'])
      failed(result)
      expect(result.stderr).not.toContain('Outside content')
    }

    await resolvablePackage(root, 'symlink-escape-doc', {
      name: 'symlink-escape-doc',
      version: '1.0.0',
      focusedSpec: { documentation: 'docs/secret.md' },
    }, '# README fallback must not be used')
    await mkdir(join(root, 'node_modules/symlink-escape-doc/docs'), { recursive: true })
    await symlink(join(outside, 'secret.md'), join(root, 'node_modules/symlink-escape-doc/docs/secret.md'), 'file')
    failed(invoke(root, ['plugin-docs', '--package', 'symlink-escape-doc', '--root', root, '--json']))

    await put(root, 'plugins/local.mjs', "import { writeFileSync } from 'node:fs'; writeFileSync(new URL('../local-imported', import.meta.url), 'yes'); throw new Error('must not import')")
    await mkdir(join(root, 'docs'), { recursive: true })
    await symlink(join(outside, 'secret.md'), join(root, 'docs/secret.md'), 'file')
    await put(root, '.focused-spec/config.yaml', configuration({
      local: { module: './plugins/local.mjs', documentation: 'docs/secret.md' },
    }, {}))
    failed(invoke(root, ['plugin-docs', '--format', 'local', '--root', root, '--json']))
    await put(root, '.focused-spec/config.yaml', configuration({
      local: { module: './plugins/local.mjs', documentation: '../outside/secret.md' },
    }, {}))
    failed(invoke(root, ['plugin-docs', '--format', 'local', '--root', root, '--json']))
    await expect(access(join(root, 'local-imported'))).rejects.toMatchObject({ code: 'ENOENT' })
  }, 30_000)

  it('rejects invalid requests and serves help without setup', async () => {
    const root = await workspace('arguments')
    await put(root, '.focused-spec/config.yaml', 'invalid: [')
    const before = await tree(root)

    const rootHelp = invoke(root, ['--help'])
    expect(rootHelp.status, rootHelp.stderr).toBe(0)
    expect(rootHelp.stderr).toBe('')
    expect(rootHelp.stdout).toMatch(/^\s+plugin-docs\s/mu)

    for (const argumentsList of [
      ['plugin-docs', '--help'],
      ['plugin-docs', '-h'],
      ['help', 'plugin-docs'],
      ['plugin-docs', '--format', 'duplicate', '--format', 'other', '--help'],
    ]) {
      const result = invoke(root, argumentsList)
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('focused-spec plugin-docs')
      for (const option of ['--format', '--runner', '--package', '--root', '--config', '--json']) expect(result.stdout).toContain(option)
    }

    for (const argumentsList of [
      ['plugin-docs'],
      ['plugin-docs', '--format', 'one', '--runner', 'two'],
      ['plugin-docs', '--package', 'one', '--config', 'custom.yaml'],
      ['plugin-docs', '--format', 'one', '--format', 'two'],
      ['plugin-docs', '--package', 'one', '--json', '--json'],
      ['plugin-docs', '--unknown'],
      ['plugin-docs', '--package'],
      ['plugin-docs', '--format', 'one', 'extra'],
    ]) {
      const result = invoke(root, argumentsList)
      failed(result)
      expect(result.stderr).toContain('focused-spec plugin-docs --help')
    }
    expect(await tree(root)).toEqual(before)
  }, 30_000)
})
