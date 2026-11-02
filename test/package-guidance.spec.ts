import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repository, root, consumer, packedTarball, markdownTarball, registryTarball, put, packageIdentity, packPackage, installPackage, createPackedConsumer, initializeConsumer, integrationTree, writeSnapshotVersion, expectInstalledGuide, expectInstallerReadableSkill } from './fixtures/package-suite.js'


describe('package distribution', () => {
  it('ships a compact loader and complete focused guidance topics', async () => {
    const project = await createPackedConsumer('focused-guidance-')
    try {
      const packageRoot = join(project, 'node_modules/focused-spec')
      const authoredLoader = await readFile(join(repository, 'skills/focused-spec/SKILL.md'), 'utf8')
      const installedLoader = await readFile(join(packageRoot, 'skills/focused-spec/SKILL.md'), 'utf8')
      expect(installedLoader).toBe(authoredLoader)
      expect(Buffer.byteLength(installedLoader, 'utf8')).toBeLessThanOrEqual(4_000)

      const initialized = initializeConsumer(project, 'claude')
      expect(initialized.status, initialized.stderr).toBe(0)
      expect(await readFile(join(project, '.claude/skills/focused-spec/SKILL.md'), 'utf8')).toBe(authoredLoader)

      const topics = ['workflow', 'review', 'author-revise', 'upgrade', 'verify'] as const
      const identity = packageIdentity(await readFile(join(packageRoot, 'package.json'), 'utf8'))
      const workflow = await readFile(join(packageRoot, 'guidance/workflow.md'), 'utf8')
      for (const topic of topics) {
        const authored = await readFile(join(repository, 'guidance', `${topic}.md`), 'utf8')
        const installed = await readFile(join(packageRoot, 'guidance', `${topic}.md`), 'utf8')
        expect(installed).toBe(authored)
        expect(installed.trim()).not.toBe('')
        expect(Buffer.byteLength(installed, 'utf8')).toBeLessThanOrEqual(topic === 'workflow' ? 6_000 : 14_000)
        const acquired = spawnSync(process.execPath, [join(packageRoot, 'dist/cli.js'), 'instructions', '--protocol', '1', '--topic', topic, '--json'], {
          cwd: project,
          encoding: 'utf8',
          env: { ...process.env, npm_config_offline: 'true', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' },
        })
        expect(acquired.status, acquired.stderr).toBe(0)
        expect(acquired.stderr).toBe('')
        const content = topic === 'workflow' ? installed : `## Workflow router\n\n${workflow}\n\n## ${topic} guidance\n\n${installed}`
        expect(JSON.parse(acquired.stdout)).toEqual({ protocolVersion: 1, package: identity, topic, content })
      }
    } finally {
      await rm(project, { recursive: true, force: true })
    }
  }, 300_000)

  it('serves complete runner guidance from the installed package', async () => {
    const guideConsumer = await createPackedConsumer('runner-guidance-')
    try {
      const entriesBefore = (await readdir(guideConsumer)).sort()
      expect(entriesBefore).not.toContain('.focused-spec')
      await expectInstalledGuide(guideConsumer, 'runners')
      expect((await readdir(guideConsumer)).sort()).toEqual(entriesBefore)
    } finally {
      await rm(guideConsumer, { recursive: true, force: true })
    }
  }, 300_000)

  it('serves integration guidance from core alone offline', async () => {
    const project = await createPackedConsumer('integration-guidance-')
    await put(join(project, 'guidance/integration.md'), '# Consumer instructions must not win')
    await put(join(project, '.focused-spec/config.yaml'), 'invalid: [')
    const paths = await readdir(project, { recursive: true })
    const before = await Promise.all(paths.map(async path => [path, (await stat(join(project, path))).isFile() ? await readFile(join(project, path), 'utf8') : null]))
    await expectInstalledGuide(project, 'integration')
    const result = spawnSync(process.execPath, [join(project, 'node_modules/focused-spec/dist/cli.js'), 'instructions', '--protocol', '1', '--topic', 'integration', '--json'], {
      cwd: project, encoding: 'utf8', env: { ...process.env, npm_config_offline: 'true', HTTPS_PROXY: 'http://127.0.0.1:1', HTTP_PROXY: 'http://127.0.0.1:1' },
    })
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).content).toBe(await readFile(join(project, 'node_modules/focused-spec/guidance/integration.md'), 'utf8'))
    await expect(stat(join(project, 'node_modules/@focused-spec'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readdir(project, { recursive: true })).toEqual(paths)
    expect(await Promise.all(paths.map(async path => [path, (await stat(join(project, path))).isFile() ? await readFile(join(project, path), 'utf8') : null]))).toEqual(before)
  }, 300_000)

  it('refreshes guidance after a compatible package replacement', async () => {
    const workspace = await mkdtemp(join(root, 'compatible-replacement-'))
    try {
      const sourcePackage = join(consumer, 'node_modules/focused-spec')
      const firstPackage = join(workspace, 'snapshot-one')
      const secondPackage = join(workspace, 'snapshot-two')
      await Promise.all([
        cp(sourcePackage, firstPackage, { recursive: true }),
        cp(sourcePackage, secondPackage, { recursive: true }),
      ])

      const topics = ['workflow', 'review', 'author-revise', 'upgrade', 'verify'] as const
      const firstGuidance = Object.fromEntries(await Promise.all(topics.map(async topic => {
        const original = await readFile(join(sourcePackage, 'guidance', `${topic}.md`), 'utf8')
        return [topic, `${original.trimEnd()}\n\n<!-- disposable compatible snapshot one -->\n`] as const
      }))) as Record<(typeof topics)[number], string>
      const secondGuidance = Object.fromEntries(await Promise.all(topics.map(async topic => {
        const original = await readFile(join(sourcePackage, 'guidance', `${topic}.md`), 'utf8')
        return [topic, `${original.trimEnd()}\n\n<!-- disposable compatible snapshot two -->\n`] as const
      }))) as Record<(typeof topics)[number], string>
      await Promise.all([
        writeSnapshotVersion(firstPackage, '0.0.0-compatible-snapshot.1'),
        writeSnapshotVersion(secondPackage, '0.0.0-compatible-snapshot.2'),
        ...topics.flatMap(topic => [
          writeFile(join(firstPackage, 'guidance', `${topic}.md`), firstGuidance[topic]),
          writeFile(join(secondPackage, 'guidance', `${topic}.md`), secondGuidance[topic]),
        ]),
      ])

      const tarballs = join(workspace, 'tarballs')
      await mkdir(tarballs)
      const firstTarball = packPackage(firstPackage, tarballs)
      const secondTarball = packPackage(secondPackage, tarballs)
      const replacementConsumer = join(workspace, 'consumer')
      await mkdir(replacementConsumer)
      await writeFile(join(replacementConsumer, 'package.json'), '{"name":"replacement-consumer","private":true,"type":"module"}\n')

      installPackage(replacementConsumer, firstTarball)
      const installedLoader = await readFile(join(replacementConsumer, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8')
      const firstResponses = {} as Record<(typeof topics)[number], string>
      for (const topic of topics) {
        const response = await expectInstalledGuide(replacementConsumer, topic)
        const content = topic === 'workflow' ? firstGuidance[topic] : `## Workflow router\n\n${firstGuidance.workflow}\n\n## ${topic} guidance\n\n${firstGuidance[topic]}`
        expect(response).toEqual({ content, version: '0.0.0-compatible-snapshot.1' })
        firstResponses[topic] = response.content
      }

      installPackage(replacementConsumer, secondTarball)
      for (const topic of topics) {
        const response = await expectInstalledGuide(replacementConsumer, topic)
        const content = topic === 'workflow' ? secondGuidance[topic] : `## Workflow router\n\n${secondGuidance.workflow}\n\n## ${topic} guidance\n\n${secondGuidance[topic]}`
        expect(response).toEqual({ content, version: '0.0.0-compatible-snapshot.2' })
        expect(response.content).not.toBe(firstResponses[topic])
      }
      expect(await readFile(join(replacementConsumer, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8')).toBe(installedLoader)
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  }, 300_000)

  it('rejects missing authoritative guidance without fallback', async () => {
    const incompleteConsumer = await createPackedConsumer('incomplete-guidance-')
    try {
      const fallback = '# stale consumer guidance must not be used\n'
      await Promise.all([
        put(join(incompleteConsumer, 'guidance/workflow.md'), fallback),
        put(join(incompleteConsumer, '.agents/skills/focused-spec/SKILL.md'), fallback),
      ])
      const packageRoot = join(incompleteConsumer, 'node_modules/focused-spec')
      await rm(join(packageRoot, 'guidance/workflow.md'))
      const cli = join(packageRoot, 'dist/cli.js')
      const result = spawnSync(process.execPath, [cli, 'instructions', '--protocol', '1', '--topic', 'workflow', '--json'], {
        cwd: incompleteConsumer,
        encoding: 'utf8',
      })
      expect(result.status).not.toBe(0)
      expect(result.stdout.trim()).toBe('')
      expect(result.stderr).toMatch(/incomplete installed focused-spec package/iu)
      expect(result.stderr).toMatch(/reinstall/iu)
      expect(result.stdout).not.toContain(fallback.trim())
    } finally {
      await rm(incompleteConsumer, { recursive: true, force: true })
    }
  }, 300_000)

  it('serves guidance from a source-independent packed installation', async () => {
    const isolatedConsumer = await createPackedConsumer('source-independent-')
    try {
      const cli = join(isolatedConsumer, 'node_modules/focused-spec/dist/cli.js')
      expect(relative(repository, cli).startsWith('..')).toBe(true)
      const entriesBefore = (await readdir(isolatedConsumer)).sort()
      expect(entriesBefore).not.toContain('.focused-spec')
      await expectInstalledGuide(isolatedConsumer, 'workflow')
      await expectInstalledGuide(isolatedConsumer, 'formats')
      await expectInstalledGuide(isolatedConsumer, 'runners')
      await expectInstallerReadableSkill(isolatedConsumer)
      expect((await readdir(isolatedConsumer)).sort()).toEqual(entriesBefore)
    } finally {
      await rm(isolatedConsumer, { recursive: true, force: true })
    }
  }, 300_000)

  it('reads composed plugin documentation through separate packed-consumer requests', async () => {
    const project = await createPackedConsumer('plugin-documentation-')
    try {
      installPackage(project, packedTarball, registryTarball, markdownTarball)
      await put(join(project, '.focused-spec/config.yaml'), JSON.stringify({ version: 5,
        specifications: { formats: { selected: { package: '@focused-spec/format-registry', options: { parser: { package: '@focused-spec/format-markdown' } } } },
          documents: [{ match: 'specs/**/*.md', scope: 'current', format: 'selected' }] }, runners: {},
      }))
      const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
      expect(relative(repository, cli).startsWith('..')).toBe(true)
      const before = await integrationTree(project)
      const entriesBefore = (await readdir(project)).sort()
      for (const [args, selection, name] of [
        [['--format', 'selected'], { kind: 'format', name: 'selected' }, '@focused-spec/format-registry'],
        [['--package', '@focused-spec/format-markdown'], { kind: 'package', name: '@focused-spec/format-markdown' }, '@focused-spec/format-markdown'],
      ] as const) {
        const packageRoot = await realpath(join(project, 'node_modules', name))
        const identity = packageIdentity(await readFile(join(packageRoot, 'package.json'), 'utf8'))
        const path = await realpath(join(packageRoot, 'README.md'))
        const content = await readFile(path, 'utf8')
        const response = spawnSync(process.execPath, [cli, 'plugin-docs', ...args, '--json'], { cwd: project, encoding: 'utf8',
          env: { ...process.env, npm_config_offline: 'true', HTTPS_PROXY: 'http://127.0.0.1:1' },
        })
        expect(response.status, response.stderr).toBe(0)
        expect(response.stderr).toBe('')
        expect(JSON.parse(response.stdout)).toEqual({ selection,
          plugin: { package: name, ...identity, root: packageRoot }, document: { path, content },
        })
        const text = spawnSync(process.execPath, [cli, 'plugin-docs', ...args], { cwd: project, encoding: 'utf8' })
        expect(text.status, text.stderr).toBe(0)
        expect(text.stdout).toContain(content)
        const provenance = text.stdout.slice(0, text.stdout.indexOf(content))
        expect(provenance).toContain(identity.name)
        expect(provenance).toContain(identity.version)
        expect(provenance).toContain(path)
      }
      expect(await integrationTree(project)).toEqual(before)
      expect((await readdir(project)).sort()).toEqual(entriesBefore)
    } finally {
      await rm(project, { recursive: true, force: true })
    }
  }, 300_000)
})
