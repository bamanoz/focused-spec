import { lstat, mkdtemp, mkdir, readFile, readdir, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { roots, put, json, interactiveInit } from './fixtures/cli-suite.js'


describe('focused-spec CLI', () => {
  it.skipIf(process.platform === 'win32')('keeps scripted and CI init outside the terminal screen', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-scripted-'))
    const home = await mkdtemp(join(tmpdir(), 'focused-init-scripted-home-'))
    roots.push(root, home)
    const ci = await interactiveInit(root, home, [], { env: { CI: 'true' }, welcome: false })
    expect(ci.code, ci.output).toBe(1)
    expect(ci.output).toContain('--tools')
    expect(ci.output).not.toContain('\x1b[?1049h')
    const scripted = await interactiveInit(root, home, [], { args: ['--tools', 'claude', '--no-animation', '--json'], welcome: false })
    expect(scripted.code, scripted.output).toBe(0)
    expect(scripted.output).not.toContain('\x1b[?1049h')
    expect(json(scripted.output)).toMatchObject({ tools: ['claude'], files: expect.arrayContaining([expect.objectContaining({ action: 'install', applied: true })]) })
    expect(await readdir(home)).toEqual([])
  }, 30_000)

  it.skipIf(process.platform === 'win32')('presents a compact welcome beside the glyph before selecting integrations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-welcome-'))
    const home = await mkdtemp(join(tmpdir(), 'focused-init-welcome-home-'))
    roots.push(root, home)
    const welcome = await interactiveInit(root, home, [
      { when: ' to continue...', send: '\r' },
      { when: 'Choose agent integrations', send: '\x03' },
    ], { args: ['--no-animation'], welcome: false })
    expect(welcome.code, welcome.output).toBe(1)
    const plainText = welcome.output.replace(/\x1b\[[0-9;?]*[A-Za-z]/gu, '')
    const pickerAt = plainText.indexOf('Choose agent integrations')
    expect(pickerAt).toBeGreaterThan(plainText.indexOf('██████'))
    expect(plainText.slice(0, pickerAt)).toContain('██████')
    expect(plainText.slice(pickerAt)).not.toContain('██████')
    expect(welcome.output).not.toContain('\x1b[?1049h')
    expect(welcome.output).not.toContain('\x1b[2J')
    expect(await readdir(root)).toEqual([])
    expect(await readdir(home)).toEqual([])
  }, 30_000)

  it.skipIf(process.platform === 'win32')('installs only selected targets after separate review confirmation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-terminal-'))
    const home = await mkdtemp(join(tmpdir(), 'focused-init-terminal-home-'))
    roots.push(root, home)
    await mkdir(join(root, '.omp'))
    const installed = await interactiveInit(root, home, [
      { when: 'Search:', send: 'claude' },
      { when: 'Search: claude', send: ' ' },
      { when: 'Selected: 1', send: '\r' },
      { when: 'Install these files? Y / N', send: 'y' },
    ], { args: ['--no-animation'] })
    expect(installed.code, installed.output).toBe(0)
    expect(installed.output).toContain('.claude/skills/focused-spec/SKILL.md')
    expect(installed.output).toContain('\x1b[?25h')
    expect(await readFile(join(root, '.claude/skills/focused-spec/SKILL.md'), 'utf8')).toContain('name: focused-spec')
    expect(await readdir(join(root, '.omp'))).toEqual([])
    expect(await readdir(home)).toEqual([])
  }, 30_000)

  it.skipIf(process.platform === 'win32')('keeps project and home unchanged on cancel, preview and mixed-root conflict', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-review-'))
    const home = await mkdtemp(join(tmpdir(), 'focused-init-review-home-'))
    roots.push(root, home)
    await put(root, '.claude/skills/focused-spec/SKILL.md', 'custom loader')
    const snapshot = async (directory: string): Promise<string> => JSON.stringify(await Promise.all(
      (await readdir(directory, { recursive: true })).sort().map(async entry => {
        const absolute = join(directory, entry)
        return [entry, (await lstat(absolute)).isFile() ? (await readFile(absolute)).toString('base64') : 'directory']
      }),
    ))
    const before = [await snapshot(root), await snapshot(home)]
    const chooseClaude = [
      { when: 'Search:', send: 'claude' },
      { when: 'Search: claude', send: ' ' },
      { when: 'Selected: 1', send: '\r' },
    ]
    for (const key of ['\x1b', '\x03', '__SIGINT__']) {
      const cancelled = await interactiveInit(root, home, [{ when: 'Search:', send: key }], { args: ['--no-animation'] })
      expect(cancelled.code, cancelled.output).toBe(1)
      expect(cancelled.output).toContain('\x1b[?25h')
      expect([await snapshot(root), await snapshot(home)]).toEqual(before)
    }
    const declined = await interactiveInit(root, home, [...chooseClaude, { when: 'Install these files? Y / N', send: 'n' }], { args: ['--no-animation', '--replace'] })
    expect(declined.code, declined.output).toBe(1)
    expect([await snapshot(root), await snapshot(home)]).toEqual(before)
    const preview = await interactiveInit(root, home, [...chooseClaude, { when: 'Preview only · Enter to close', send: '\r' }], { args: ['--no-animation', '--replace', '--dry-run'] })
    expect(preview.code, preview.output).toBe(0)
    expect([await snapshot(root), await snapshot(home)]).toEqual(before)
    const mixed = await interactiveInit(root, home, [
      { when: 'Search:', send: 'claude' },
      { when: 'Search: claude', send: ' ' },
      { when: 'Selected: 1', send: '\x1b' },
      { when: 'Search: (type to filter)', send: 'minimax-code' },
      { when: 'Search: minimax-code', send: ' ' },
      { when: 'Selected: 2', send: '\r' },
      { when: 'Setup blocked · Enter to close', send: '\r' },
    ], { args: ['--no-animation'] })
    expect(mixed.code, mixed.output).toBe(1)
    expect(mixed.output).toContain('\x1b[38;2;249;197;108m[x] claude')
    expect(mixed.output).not.toContain('\x1b[38;2;111;217;211m[x] claude')
    const text = mixed.output.replace(/\x1b\[[0-9;?]*[A-Za-z]/gu, '')
    expect(text).toContain('minimax-code [GLOBAL home]')
    const review = text.split('setup review')[1]!.split('Setup blocked · Enter to close')[0]!
    expect(review.replace(/\r?\n  /gu, '')).toContain(join(await realpath(home), '.minimax/skills/focused-spec/SKILL.md'))
    expect(text).toContain('Conflicts:')
    expect(text).toContain('.claude/skills/focused-spec/SKILL.md')
    expect([await snapshot(root), await snapshot(home)]).toEqual(before)
  }, 90_000)

  it.skipIf(process.platform === 'win32')('shows the approved focus glyph and usable static fallback on a real terminal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focused-init-focus-'))
    const home = await mkdtemp(join(tmpdir(), 'focused-init-focus-home-'))
    roots.push(root, home)
    const animated = await interactiveInit(root, home, [{ when: '░', send: ' ' }, { when: ' to continue...', send: '\r' }, { when: 'Search:', send: '\x03' }], { welcome: false })
    expect(animated.code, animated.output).toBe(1)
    expect(animated.output.replace(/\x1b\[[0-9;?]*[A-Za-z]/gu, '')).toContain('██████')
    const full = await interactiveInit(root, home, [{ when: ' to continue...', send: '\r' }, { when: 'Search:', send: '\x03' }], { welcome: false, args: ['--no-animation'] })
    expect(full.code, full.output).toBe(1)
    expect(full.output.replace(/\x1b\[[0-9;?]*[A-Za-z]/gu, '')).toContain('██████')
    expect(full.output).toContain('\x1b[?25h')
    const plain = await interactiveInit(root, home, [{ when: 'Esc Clear/Cancel', send: '\x03' }], { columns: 36, rows: 12, env: { NO_COLOR: '1' } })
    expect(plain.code, plain.output).toBe(1)
    expect(plain.output).toContain('Space Select')
    expect(plain.output).not.toContain('\x1b[38;2;')
    const tiny = await interactiveInit(root, home, [
      { when: 'Enter · Esc cancel', send: '\r' },
      { when: 'Search: (type to filter)', send: 'claude \r' },
      { when: 'Setup review', send: '\x1b' },
    ], { columns: 20, rows: 8, args: ['--no-animation'], welcome: false, env: { NO_COLOR: '1' } })
    expect(tiny.code, tiny.output).toBe(1)
    expect(tiny.output).toContain('↓ Scroll to end')
    const tinyWelcome = tiny.output.split('Choose agent integrations')[0]!.replace(/\x1b\[[0-9;?]*[A-Za-z]/gu, '')
    expect(tinyWelcome.split(/\r?\n/u).every(line => line.length <= 20)).toBe(true)
    const dumb = await interactiveInit(root, home, [{ when: 'Esc Clear/Cancel', send: '\x03' }], { env: { TERM: 'dumb' } })
    expect(dumb.output).toContain('██████')
    expect(dumb.output).not.toContain('\x1b[')
    expect(await readdir(root)).toEqual([])
    expect(await readdir(home)).toEqual([])
  }, 40_000)
})
