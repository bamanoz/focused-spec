import { spawnSync } from 'node:child_process'
import { chmod, lstat, mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { agentTargets, root, put, createPackedConsumer, initializeConsumer, initializeConsumerInHome, integrationTree, expectedTree, initWorkspace, expectInstalledGuide } from './fixtures/package-suite.js'


describe('package distribution', () => {
  it('installs selected agent integrations offline from the packed package', async () => {
    const project = await createPackedConsumer('init-selected-')
    const result = initializeConsumer(project, 'oh-my-pi,claude')
    expect(result.status, result.stderr).toBe(0)
    const bundled = join(project, 'node_modules/focused-spec')
    const loader = await readFile(join(bundled, 'skills/focused-spec/SKILL.md'), 'utf8')
    for (const [directory, tool] of [['.omp', 'oh-my-pi'], ['.claude', 'claude']] as const) {
      const path = join(project, directory, 'skills/focused-spec/SKILL.md')
      expect(await readFile(path, 'utf8')).toBe(loader)
      expect((await lstat(path)).isSymbolicLink()).toBe(false)
      expect(await readFile(join(project, directory, 'commands/focused-spec.md'), 'utf8'))
        .toBe(await readFile(join(bundled, 'skills/commands', tool, 'focused-spec.md'), 'utf8'))
    }
    expect((await readdir(project)).sort()).toEqual(['.claude', '.omp', 'node_modules', 'package.json'])
  })

  it('deduplicates Codex and shared agent destinations', async () => {
    const project = await createPackedConsumer('init-shared-')
    const result = initializeConsumer(project, 'amp,antigravity,codex,gsd,zed,agents,codex')
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ tools: ['amp', 'antigravity', 'codex', 'gsd', 'zed', 'agents'], files: [
      { path: '.agents/skills/focused-spec/SKILL.md', action: 'install', applied: true },
      { path: '.agents/workflows/focused-spec.md', action: 'install', applied: true },
    ], errors: [] })
    const bundled = join(project, 'node_modules/focused-spec')
    expect(await integrationTree(project)).toEqual(expectedTree({
      '.agents/skills/focused-spec/SKILL.md': await readFile(join(bundled, 'skills/focused-spec/SKILL.md'), 'utf8'),
      '.agents/workflows/focused-spec.md': await readFile(join(bundled, 'skills/commands/antigravity/focused-spec.md'), 'utf8'),
    }))
  })

  it('installs agent integration without manufacturing evidence setup', async () => {
    const project = await createPackedConsumer('init-only-')
    await put(join(project, '.focused-spec/config.yaml'), 'invalid: [')
    await put(join(project, 'AGENTS.md'), 'custom project instructions')
    const before = await readFile(join(project, '.focused-spec/config.yaml'), 'utf8')
    const result = spawnSync(process.execPath, [join(project, 'node_modules/focused-spec/dist/cli.js'), 'init', '--tools', 'claude'], { cwd: project, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    expect(await readFile(join(project, '.focused-spec/config.yaml'), 'utf8')).toBe(before)
    expect(await readFile(join(project, 'AGENTS.md'), 'utf8')).toBe('custom project instructions')
    expect(await readdir(join(project, '.focused-spec'))).toEqual(['config.yaml'])
    expect((await readdir(project)).sort()).toEqual(['.claude', '.focused-spec', 'AGENTS.md', 'node_modules', 'package.json'])
  })

  it('leaves identical agent integrations unchanged on reinitialization', async () => {
    const project = await createPackedConsumer('init-repeat-')
    expect(initializeConsumer(project, 'claude').status).toBe(0)
    const skill = join(project, '.claude/skills/focused-spec/SKILL.md')
    const before = await stat(skill)
    const tree = await integrationTree(project)
    const result = initializeConsumer(project, 'claude')
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).files).toEqual([
      { path: '.claude/skills/focused-spec/SKILL.md', action: 'unchanged', applied: false },
      { path: '.claude/commands/focused-spec.md', action: 'unchanged', applied: false },
    ])
    expect(await integrationTree(project)).toEqual(tree)
    expect((await stat(skill)).mtimeMs).toBe(before.mtimeMs)
    expect((await stat(skill)).ino).toBe(before.ino)
  })

  it('preserves custom integrations and aborts all writes on conflict', async () => {
    const project = await createPackedConsumer('init-conflict-')
    await put(join(project, '.claude/skills/focused-spec/SKILL.md'), 'custom skill')
    const before = await integrationTree(project)
    const result = initializeConsumer(project, 'oh-my-pi,claude')
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout).files.every((file: { applied: boolean }) => !file.applied)).toBe(true)
    expect(await integrationTree(project)).toEqual(before)
    expect(JSON.parse(result.stdout)).toMatchObject({
      files: expect.arrayContaining([expect.objectContaining({ path: '.claude/skills/focused-spec/SKILL.md', action: 'conflict', applied: false })]),
      errors: expect.arrayContaining([expect.objectContaining({ path: '.claude/skills/focused-spec/SKILL.md', message: expect.stringMatching(/\S/u) })]),
    })
  })

  it('replaces only explicitly selected integration files', async () => {
    const project = await createPackedConsumer('init-replace-')
    await put(join(project, '.claude/skills/focused-spec/SKILL.md'), 'custom skill')
    await put(join(project, '.claude/commands/focused-spec.md'), 'custom command')
    await put(join(project, '.claude/skills/focused-spec/custom.txt'), 'keep adjacent file')
    await put(join(project, '.omp/skills/focused-spec/SKILL.md'), 'keep other target')
    const result = initializeConsumer(project, 'claude', '--replace')
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).files).toEqual([
      { path: '.claude/skills/focused-spec/SKILL.md', action: 'replace', applied: true },
      { path: '.claude/commands/focused-spec.md', action: 'replace', applied: true },
    ])
    expect(await readFile(join(project, '.claude/skills/focused-spec/SKILL.md'), 'utf8')).toBe(await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8'))
    expect(await readFile(join(project, '.claude/skills/focused-spec/custom.txt'), 'utf8')).toBe('keep adjacent file')
    expect(await readFile(join(project, '.omp/skills/focused-spec/SKILL.md'), 'utf8')).toBe('keep other target')
  })

  it('previews installation and replacement without filesystem writes', async () => {
    const project = await createPackedConsumer('init-preview-')
    const fresh = initializeConsumer(project, 'oh-my-pi,claude', '--dry-run')
    expect(fresh.status, fresh.stderr).toBe(0)
    expect(await integrationTree(project)).toEqual({})
    await put(join(project, '.claude/skills/focused-spec/SKILL.md'), 'custom skill')
    const tree = await integrationTree(project)
    const conflict = initializeConsumer(project, 'oh-my-pi,claude', '--dry-run')
    expect(conflict.status).toBe(1)
    expect(await integrationTree(project)).toEqual(tree)
    const replace = initializeConsumer(project, 'oh-my-pi,claude', '--replace', '--dry-run')
    expect(replace.status, replace.stderr).toBe(0)
    expect(JSON.parse(replace.stdout).files).toContainEqual({ path: '.claude/skills/focused-spec/SKILL.md', action: 'replace', applied: false })
    expect(await integrationTree(project)).toEqual(tree)
  })

  it('rejects unsafe integration destinations without modifying either tree', async () => {
    const project = await createPackedConsumer('init-boundary-')
    const outside = await mkdtemp(join(root, 'outside-agent-'))
    await put(join(outside, 'sentinel'), 'outside content')
    await symlink(outside, join(project, '.claude'), 'dir')
    const symlinked = initializeConsumer(project, 'oh-my-pi,claude', '--replace')
    expect(symlinked.status).toBe(1)
    expect((await lstat(join(project, '.claude'))).isSymbolicLink()).toBe(true)
    expect(await readdir(outside)).toEqual(['sentinel'])
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('outside content')
    expect(await lstat(join(project, '.omp')).then(() => true, () => false)).toBe(false)
    await rm(join(project, '.claude'))
    await put(join(project, '.claude'), 'not a directory')
    expect(initializeConsumer(project, 'claude', '--replace').status).toBe(1)
    expect(await readFile(join(project, '.claude'), 'utf8')).toBe('not a directory')
    await rm(join(project, '.claude'))
    await mkdir(join(project, '.claude/skills/focused-spec/SKILL.md'), { recursive: true })
    expect(initializeConsumer(project, 'claude', '--replace').status).toBe(1)
    expect((await stat(join(project, '.claude/skills/focused-spec/SKILL.md'))).isDirectory()).toBe(true)
    await rm(join(project, '.claude'), { recursive: true })
    const alias = join(root, 'root-alias')
    await symlink(project, alias, 'dir')
    const canonical = initializeConsumer(project, 'codex', alias)
    expect(canonical.status, canonical.stderr).toBe(0)
    expect(JSON.parse(canonical.stdout).root).toBe(await realpath(project))
  })

  it('rejects incomplete bundled init assets before writing integrations', async () => {
    const project = await createPackedConsumer('init-assets-')
    const asset = join(project, 'node_modules/focused-spec/skills/commands/claude/focused-spec.md')
    const content = await readFile(asset, 'utf8')
    try {
      for (const action of ['empty', 'missing']) {
        if (action === 'empty') await writeFile(asset, '')
        else await rm(asset)
        const result = initializeConsumer(project, 'oh-my-pi,claude')
        expect(result.status).toBe(1)
        expect(JSON.parse(result.stdout)).toMatchObject({
          errors: expect.arrayContaining([expect.objectContaining({ path: '.claude/commands/focused-spec.md', message: expect.stringMatching(/\S/u) })]),
        })
        expect(await integrationTree(project)).toEqual({})
      }
    } finally { await writeFile(asset, content) }
  })

  it('installs every OpenSpec 1.14.1 agent target from the packed package', async () => {
    const installation = await createPackedConsumer('init-catalog-')
    const loader = await readFile(join(installation, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8')
    for (const target of agentTargets) {
      const project = await mkdtemp(join(root, `target-${target.id}-`))
      const home = await mkdtemp(join(root, 'catalog-home-'))
      const result = initializeConsumerInHome(installation, home, target.id, project)
      expect(result.status, `${target.id}: ${result.stderr}`).toBe(0)
      const projectFiles: Record<string, string> = {}
      const homeFiles: Record<string, string> = {}
      ;(target.home ? homeFiles : projectFiles)[target.skill] = loader
      if (target.command !== null) {
        const filename = target.command.slice(target.command.lastIndexOf('/') + 1)
        projectFiles[target.command] = await readFile(join(installation, 'node_modules/focused-spec/skills/commands', target.id, filename), 'utf8')
      }
      expect(await integrationTree(project), target.id).toEqual(expectedTree(projectFiles))
      expect(await integrationTree(home), target.id).toEqual(expectedTree(homeFiles))
      expect(JSON.parse(result.stdout)).toMatchObject({ root: await realpath(project), tools: [target.id], errors: [] })
    }
  }, 120_000)


  it('normalizes Windsurf selection to Devin without legacy writes', async () => {
    const { project, invoke } = await initWorkspace('init-alias-')
    await put(join(project, '.windsurf/custom.md'), 'keep legacy content')
    const result = invoke(' windsurf,devin,windsurf ')
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ tools: ['devin'], files: [
      { path: '.devin/skills/focused-spec/SKILL.md', action: 'install', applied: true },
      { path: '.devin/workflows/focused-spec.md', action: 'install', applied: true },
    ], errors: [] })
    const bundled = join(project, 'node_modules/focused-spec')
    expect(await integrationTree(project)).toEqual(expectedTree({
      '.windsurf/custom.md': 'keep legacy content',
      '.devin/skills/focused-spec/SKILL.md': await readFile(join(bundled, 'skills/focused-spec/SKILL.md'), 'utf8'),
      '.devin/workflows/focused-spec.md': await readFile(join(bundled, 'skills/commands/devin/focused-spec.md'), 'utf8'),
    }))
  })

  it('installs MiniMax integration only into the explicitly selected home root', async () => {
    const { project, home, invoke } = await initWorkspace('init-minimax-')
    await put(join(home, '.minimax/config.json'), 'keep host settings')
    const homeBefore = await integrationTree(home)
    const projectOnly = initializeConsumerInHome(project, join(home, 'unavailable'), 'codex')
    expect(projectOnly.status, projectOnly.stderr).toBe(0)
    expect(await integrationTree(home)).toEqual(homeBefore)
    const projectBefore = await integrationTree(project)
    const result = invoke('minimax-code')
    expect(result.status, result.stderr).toBe(0)
    const loader = await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8')
    expect(await integrationTree(project)).toEqual(projectBefore)
    expect(await integrationTree(home)).toEqual(expectedTree({ '.minimax/config.json': 'keep host settings', '.minimax/skills/focused-spec/SKILL.md': loader }))
    await expectInstalledGuide(project, 'workflow')
  })

  it('previews mixed project and home integration without writes', async () => {
    const { project, home, invoke } = await initWorkspace('init-global-preview-')
    const globalPath = join(await realpath(home), '.minimax/skills/focused-spec/SKILL.md')
    const fresh = invoke('claude,minimax-code', '--dry-run')
    expect(fresh.status, fresh.stderr).toBe(0)
    expect(JSON.parse(fresh.stdout).files).toContainEqual({ path: globalPath, action: 'install', applied: false })
    expect(await integrationTree(project)).toEqual({})
    expect(await integrationTree(home)).toEqual({})
    await put(globalPath, 'custom home loader')
    const homeBefore = await integrationTree(home)
    expect(invoke('claude,minimax-code', '--dry-run').status).toBe(1)
    const replacement = invoke('claude,minimax-code', '--replace', '--dry-run')
    expect(replacement.status, replacement.stderr).toBe(0)
    expect(JSON.parse(replacement.stdout).files).toContainEqual({ path: globalPath, action: 'replace', applied: false })
    expect(await integrationTree(project)).toEqual({})
    expect(await integrationTree(home)).toEqual(homeBefore)
  })

  it('aborts project and home writes together on any integration conflict', async () => {
    for (const conflictingRoot of ['project', 'home']) {
      const { project, home, invoke } = await initWorkspace('init-global-conflict-')
      const path = conflictingRoot === 'home' ? join(home, '.minimax/skills/focused-spec/SKILL.md') : join(project, '.claude/skills/focused-spec/SKILL.md')
      await put(path, 'custom integration')
      const projectBefore = await integrationTree(project)
      const homeBefore = await integrationTree(home)
      const result = invoke('claude,minimax-code')
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).files.every((file: { applied: boolean }) => !file.applied)).toBe(true)
      expect(await integrationTree(project)).toEqual(projectBefore)
      expect(await integrationTree(home)).toEqual(homeBefore)
    }
  })

  it('replaces only selected MiniMax integration and preserves neighboring files', async () => {
    const { project, home, invoke } = await initWorkspace('init-global-replace-')
    const path = join(await realpath(home), '.minimax/skills/focused-spec/SKILL.md')
    await put(path, 'custom home loader')
    await put(join(home, '.minimax/skills/focused-spec/custom.txt'), 'keep neighbor')
    await put(join(home, '.minimax/config.json'), 'keep settings')
    await put(join(project, '.claude/skills/focused-spec/SKILL.md'), 'keep project integration')
    const projectBefore = await integrationTree(project)
    const result = invoke('minimax-code', '--replace')
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).files).toEqual([{ path, action: 'replace', applied: true }])
    expect(await integrationTree(project)).toEqual(projectBefore)
    expect(await integrationTree(home)).toEqual(expectedTree({
      '.minimax/skills/focused-spec/SKILL.md': await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8'),
      '.minimax/skills/focused-spec/custom.txt': 'keep neighbor', '.minimax/config.json': 'keep settings',
    }))
  })

  it('rejects unsafe home destinations without modifying either tree', async () => {
    const { project, home, invoke } = await initWorkspace('init-global-unsafe-')
    const outside = await mkdtemp(join(root, 'global-outside-'))
    await put(join(outside, 'sentinel'), 'outside content')
    const outsideBefore = await integrationTree(outside)
    for (const unsafe of ['symlink', 'file-ancestor', 'directory-destination', 'file-symlink']) {
      if (unsafe === 'symlink') await symlink(outside, join(home, '.minimax'), 'dir')
      else if (unsafe === 'file-ancestor') await put(join(home, '.minimax'), 'not a directory')
      else if (unsafe === 'directory-destination') await mkdir(join(home, '.minimax/skills/focused-spec/SKILL.md'), { recursive: true })
      else {
        await mkdir(join(home, '.minimax/skills/focused-spec'), { recursive: true })
        await symlink(join(outside, 'sentinel'), join(home, '.minimax/skills/focused-spec/SKILL.md'), 'file')
      }
      const homeBefore = await integrationTree(home)
      for (const options of [[], ['--replace']]) {
        const result = invoke('claude,minimax-code', ...options)
        expect(result.status, unsafe).toBe(1)
        expect(await integrationTree(project), unsafe).toEqual({})
        expect(await integrationTree(home), unsafe).toEqual(homeBefore)
        expect(await integrationTree(outside), unsafe).toEqual(outsideBefore)
      }
      await rm(join(home, '.minimax'), { recursive: true })
    }
    await put(join(home, 'file'), 'not a home directory')
    for (const invalid of [join(home, 'missing'), join(home, 'file')]) {
      const result = initializeConsumerInHome(project, invalid, 'claude,minimax-code')
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).errors).toContainEqual(expect.objectContaining({ path: join(invalid, '.minimax/skills/focused-spec/SKILL.md') }))
      expect(await integrationTree(project)).toEqual({})
    }
    expect(await integrationTree(home)).toEqual({ file: 'not a home directory' })
  })

  it('reports canonical home destinations and completed global writes', async () => {
    const { project, home } = await initWorkspace('init-global-json-')
    const alias = join(root, `home-alias-${Date.now()}`)
    await symlink(home, alias, 'dir')
    const invoke = (...options: string[]) => initializeConsumerInHome(project, alias, 'minimax-code', ...options)
    const path = join(await realpath(home), '.minimax/skills/focused-spec/SKILL.md')
    for (const [options, action, applied] of [[['--dry-run'], 'install', false], [[], 'install', true], [[], 'unchanged', false]] as const) {
      const result = invoke(...options)
      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({ root: await realpath(project), tools: ['minimax-code'], dryRun: options.some(option => option === '--dry-run'), files: [{ path, action, applied }], errors: [] })
    }
    await put(path, 'custom loader')
    const conflict = invoke()
    expect(conflict.status).toBe(1)
    expect(JSON.parse(conflict.stdout)).toMatchObject({ files: [{ path, action: 'conflict', applied: false }], errors: [expect.objectContaining({ path })] })
    if (process.platform !== 'win32' && process.getuid?.() !== 0) {
      await rm(path)
      const directory = dirname(path)
      await chmod(directory, 0o555)
      try {
        const partial = initializeConsumerInHome(project, home, 'claude,minimax-code')
        expect(partial.status).toBe(1)
        const report = JSON.parse(partial.stdout)
        expect(report.files).toContainEqual({ path: '.claude/skills/focused-spec/SKILL.md', action: 'install', applied: true })
        expect(report.files).toContainEqual({ path, action: 'install', applied: false })
        expect(report.errors).toContainEqual(expect.objectContaining({ path }))
        expect(await readFile(join(project, '.claude/skills/focused-spec/SKILL.md'), 'utf8')).toBe(await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8'))
      } finally { await chmod(directory, 0o755) }
    }
  })
})
