import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { agentTargets, root, createPackedConsumer, initWorkspace, integrationTree, expectedTree } from './fixtures/package-suite.js'


describe('package distribution', () => {
  it('installs host-readable wrappers with native argument handling', async () => {
    const { project, home, invoke } = await initWorkspace('init-formats-')
    const result = invoke(agentTargets.map(target => target.id).join(','))
    expect(result.status, result.stderr).toBe(0)
    const request = 'Check account access for blocked users: keep the original task.'
    for (const target of agentTargets.filter(target => target.command !== null)) {
      const text = await readFile(join(project, target.command!), 'utf8')
      let prompt: string
      if (target.format === 'toml') {
        const parsed = spawnSync('python3', ['-c', 'import json,sys,tomllib; print(json.dumps(tomllib.loads(sys.stdin.read())))'], { input: text, encoding: 'utf8' })
        expect(parsed.status, `${target.id}: ${parsed.stderr}`).toBe(0)
        const command = JSON.parse(parsed.stdout)
        expect(command.description).toEqual(expect.any(String))
        expect(command.prompt).toEqual(expect.any(String))
        prompt = command.prompt
      } else if (target.format === 'yaml') {
        const header = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
        expect(header, target.id).not.toBeNull()
        const document = parseDocument(header![1]!)
        expect(document.errors, target.id).toEqual([])
        const metadata = document.toJS()
        expect(metadata, target.id).toMatchObject(target.metadata)
        expect(metadata.description, target.id).toEqual(expect.any(String))
        expect(metadata).not.toHaveProperty('allowed-tools')
        if (target.id === 'atomcode') expect(header![1]).toMatch(/^name: focused-spec\n/m)
        prompt = text.slice(header![0].length)
      } else {
        if (target.format === 'heading') expect(text).toMatch(/^# focused-spec\n/)
        else expect(text).not.toMatch(/^---\n/)
        prompt = text
      }
      expect(prompt, target.id).toMatch(/Load [^\n]*focused-spec[^\n]*skill/i)
      expect(text, target.id).not.toMatch(/opsx-|Bash\(openspec/)
      if (target.arguments !== null) {
        const expanded = prompt.replaceAll(target.arguments, request)
        expect(expanded, target.id).toContain(request)
        expect(expanded, target.id).not.toContain(target.arguments)
      } else expect(prompt, target.id).not.toMatch(/\$ARGUMENTS|\$@|\{\{args\}\}/)
    }
    expect(await integrationTree(home)).toEqual(expectedTree({ '.minimax/skills/focused-spec/SKILL.md': await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8') }))
    for (const [id, hint] of [['hermes', /skills\.external_dirs/], ['github-copilot', /IDE/], ['codex', /\$focused-spec/], ['kimi', /\/skill:focused-spec/], ['amazon-q', /@focused-spec/]] as const) {
      const output = spawnSync(process.execPath, [join(project, 'node_modules/focused-spec/dist/cli.js'), 'init', '--tools', id], { cwd: project, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } })
      expect(output.status, output.stderr).toBe(0)
      expect(output.stdout).toMatch(hint)
    }
  }, 120_000)
  it.skipIf(process.platform === 'win32')('installs from a packed consumer through the reviewed terminal picker', async () => {
    const project = await createPackedConsumer('init-packed-tty-')
    const home = await mkdtemp(join(root, 'init-packed-tty-home-'))
    const cli = join(project, 'node_modules/focused-spec/dist/cli.js')
    const script = `import os, pty, select, sys
pid, master = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], [sys.argv[1], *sys.argv[2:]])
started, sent, confirmed = False, False, False
while True:
    ready, _, _ = select.select([master], [], [])
    if not ready: continue
    try: data = os.read(master, 65536)
    except OSError: break
    if not data: break
    os.write(1, data)
    if not started and b'to continue...' in data:
        os.write(master, b'\\r')
        started = True
    if started and not sent and b'Search:' in data:
        os.write(master, b'claude \\r')
        sent = True
    elif sent and not confirmed and b'Install these files? Y / N' in data:
        os.write(master, b'y')
        confirmed = True
_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
`
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, TERM: 'xterm-256color', npm_config_offline: 'true', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' }
    delete env.CI
    const result = spawnSync('python3', ['-c', script, process.execPath, cli, 'init', '--no-animation'], { cwd: project, env, encoding: 'utf8', timeout: 30_000 })
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('.claude/skills/focused-spec/SKILL.md')
    expect(await readFile(join(project, '.claude/skills/focused-spec/SKILL.md'), 'utf8'))
      .toBe(await readFile(join(project, 'node_modules/focused-spec/skills/focused-spec/SKILL.md'), 'utf8'))
    expect(await readdir(home)).toEqual([])
  }, 120_000)
})
