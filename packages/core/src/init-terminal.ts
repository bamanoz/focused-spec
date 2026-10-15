import process from 'node:process'
import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { StringDecoder } from 'node:string_decoder'
import { targets } from './init-targets.js'
import type { Tool } from './init-targets.js'

type Key = 'up' | 'down' | 'enter' | 'toggle' | 'escape' | 'cancel' | 'backspace' | { text: string }
type Review = {
  root: string | null
  tools: readonly Tool[]
  dryRun: boolean
  files: readonly { path: string; action: string }[]
  errors: readonly { path?: string; message: string }[]
}

const SHARP = ['   ███', '   █', '   █', '  ███', '   █', '   █', '   █', '   █']
const WIDTH = 19
const HEIGHT = 18
const DURATION = 2200
const GOLD = [249, 197, 108]
const BROWN = [23, 19, 15]
let stages: Float32Array[] | undefined

function focusStages(): Float32Array[] {
  if (stages !== undefined) return stages
  const cells = new Float32Array(WIDTH * HEIGHT)
  for (let y = 5; y <= 12; y++) {
    for (let x = 0; x < SHARP[y - 5]!.length; x++) {
      if (SHARP[y - 5]![x] === '█') cells[y * WIDTH + x + 5] = 1
    }
  }
  stages = [3.2, 2.1, 1.15, 0.55, 0].map(sigma => {
    if (sigma === 0) return cells
    const radius = Math.ceil(sigma * 3)
    const blurred = new Float32Array(cells.length)
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      let sum = 0
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const yy = y + dy
        const xx = x + dx
        if (yy >= 0 && yy < HEIGHT && xx >= 0 && xx < WIDTH && cells[yy * WIDTH + xx]) {
          sum += Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
        }
      }
      blurred[y * WIDTH + x] = Math.min(1, sum / (2 * Math.PI * sigma * sigma))
    }
    return blurred
  })
  return stages
}

function animatedFrame(progress: number, color: boolean): string[] {
  const sequence = focusStages()
  const position = Math.min(3.999999, progress * 4)
  const stage = Math.floor(position)
  const mix = position - stage
  const lines: string[] = []
  for (let y = 5; y <= 12; y++) {
    let line = ''
    for (let x = 3; x <= 12; x++) {
      const at = y * WIDTH + x
      const intensity = progress >= 1 ? sequence[4]![at]! : sequence[stage]![at]! * (1 - mix) + sequence[stage + 1]![at]! * mix
      const brightness = Math.min(1, intensity * 1.55)
      if (brightness < 0.065) { line += '  '; continue }
      const symbol = [' ', '░', '▒', '▓', '█'][Math.min(4, Math.max(1, Math.ceil(brightness * 4)))]!
      if (color) {
        const rgb = BROWN.map((background, channel) => Math.round(background + (GOLD[channel]! - background) * brightness))
        line += `\x1b[38;2;${rgb.join(';')}m${symbol}${symbol}`
      } else line += symbol + symbol
    }
    lines.push(color ? `${line}\x1b[0m` : line)
  }
  return lines
}

function wrap(line: string, columns: number): string[] {
  const characters = Array.from(line)
  if (characters.length <= columns) return [line]
  const lines: string[] = []
  while (characters.length > columns) {
    const separator = characters.lastIndexOf('/', columns - 1)
    const width = separator > columns / 3 ? separator + 1 : columns
    lines.push(characters.splice(0, width).join(''))
  }
  lines.push(characters.join(''))
  return lines
}

function tint(text: string, rgb: string, enabled: boolean, bold = false): string {
  return enabled ? `\x1b[${bold ? '1;' : ''}38;2;${rgb}m${text}\x1b[0m` : text
}

export class InitTerminal {
  private readonly originalRaw = process.stdin.isRaw ?? false
  private readonly controls = process.env.TERM !== 'dumb'
  private readonly color = this.controls && process.env.NO_COLOR === undefined && process.env.FORCE_COLOR !== '0'
  private readonly decoder = new StringDecoder('utf8')
  private readonly pending: Key[] = []
  private input = ''
  private flushEscape: ReturnType<typeof setTimeout> | undefined
  private waiter: ((key: Key) => void) | undefined
  private closed = false
  private renderedLines = 0

  constructor() {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', this.onData)
    process.once('SIGINT', this.onSignal)
    process.once('SIGTERM', this.onSignal)
    if (this.controls) process.stdout.write('\x1b[?25l')
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    if (this.flushEscape !== undefined) clearTimeout(this.flushEscape)
    process.stdin.off('data', this.onData)
    process.off('SIGINT', this.onSignal)
    process.off('SIGTERM', this.onSignal)
    process.stdin.setRawMode(this.originalRaw)
    process.stdin.pause()
    if (this.controls) process.stdout.write('\x1b[0m\x1b[?25h')
  }

  private readonly onSignal = (): void => { this.push('cancel') }

  private readonly onData = (chunk: Buffer): void => {
    this.input += this.decoder.write(chunk)
    if (this.flushEscape !== undefined) clearTimeout(this.flushEscape)
    while (this.input.length > 0) {
      if (this.input.startsWith('\x1b[') && this.input.length < 3) break
      if (this.input.startsWith('\x1b[A') || this.input.startsWith('\x1b[B')) {
        const key: Key = this.input[2] === 'A' ? 'up' : 'down'
        this.input = this.input.slice(3)
        this.push(key)
        continue
      }
      if (this.input.startsWith('\x1b[') && this.input.length >= 3 && /[0-9]/u.test(this.input[2]!)) {
        const end = this.input.indexOf('~')
        if (end === -1) break
        this.input = this.input.slice(end + 1)
        continue
      }
      const char = Array.from(this.input)[0]!
      this.input = this.input.slice(char.length)
      if (char === '\x1b') this.push('escape')
      else if (char === '\x03' || char === '\x04') this.push('cancel')
      else if (char === '\r' || char === '\n') this.push('enter')
      else if (char === '\x7f' || char === '\b') this.push('backspace')
      else if (char === ' ') this.push('toggle')
      else if (char >= ' ' && char !== '\x7f') this.push({ text: char })
    }
    if (this.input.startsWith('\x1b')) {
      this.flushEscape = setTimeout(() => {
        this.input = this.input.slice(this.input.startsWith('\x1b[') ? 2 : 1)
        this.push('escape')
      }, 45)
    }
  }

  private push(key: Key): void {
    const waiter = this.waiter
    if (waiter !== undefined) {
      this.waiter = undefined
      waiter(key)
    } else this.pending.push(key)
  }

  private nextKey(timeout?: number): Promise<Key | undefined> {
    const queued = this.pending.shift()
    if (queued !== undefined) return Promise.resolve(queued)
    return new Promise(resolve => {
      let timer: ReturnType<typeof setTimeout> | undefined
      this.waiter = key => { if (timer !== undefined) clearTimeout(timer); resolve(key) }
      if (timeout !== undefined) timer = setTimeout(() => { this.waiter = undefined; resolve(undefined) }, timeout)
    })
  }

  private show(lines: readonly string[]): void {
    if (!this.controls) { process.stdout.write(`\n${lines.join('\n')}\n`); return }
    const height = Math.max(this.renderedLines, lines.length)
    let frame = this.renderedLines ? `\x1b[${this.renderedLines}A` : '\n'
    for (let index = 0; index < height; index++) frame += `\x1b[2K${lines[index] ?? ''}\n`
    process.stdout.write(frame)
    this.renderedLines = height
  }
  private collapse(line: string): void {
    if (this.controls) process.stdout.write(`\x1b[${this.renderedLines}A\x1b[J${line}\n`)
    else process.stdout.write(`${line}\n`)
    this.renderedLines = 0
  }
  summary(report: { tools: readonly Tool[]; dryRun: boolean; files: readonly { action: string; applied: boolean }[] }): void {
    const written = report.files.filter(file => file.applied).length
    const unchanged = report.files.filter(file => file.action === 'unchanged').length
    const title = report.dryRun ? 'Setup Preview Complete' : written > 0 ? 'Setup Complete' : 'Already Up to Date'
    process.stdout.write(`\n${tint('focused-spec', '249;197;108', this.color, true)} ${tint(title, '246;242;235', this.color, true)}\n\n`)
    process.stdout.write(`Agents: ${report.tools.join(', ')}\n`)
    process.stdout.write(report.dryRun
      ? `Planned: ${report.files.filter(file => file.action !== 'unchanged').length} files · ${unchanged} unchanged. No files written.\n`
      : `Files: ${written} written · ${unchanged} unchanged.\n`)
    if (!report.dryRun) {
      process.stdout.write(`\n${tint('Agent entrypoints:', '246;242;235', this.color, true)}\n`)
      for (const id of report.tools) process.stdout.write(`  ${id}: ${targets[id].hint}\n`)
    }
    process.stdout.write('\n')
  }

  private get columns(): number { return Math.max(20, process.stdout.columns || 80) }
  private get rows(): number { return Math.max(8, process.stdout.rows || 24) }

  private static cancel(): never { throw new Error('initialization cancelled; no files written') }

  private async welcome(noAnimation: boolean): Promise<void> {
    const animate = !noAnimation && this.controls && this.color && process.env.REDUCED_MOTION !== '1'
      && this.columns >= 72 && this.rows >= 13
    const render = (progress: number): void => {
      const art = animatedFrame(progress, this.color)
      const detail = [
        `${tint('Welcome to ', '246;242;235', this.color, true)}${tint('focused-spec', '249;197;108', this.color, true)}`,
        tint(this.columns < 50 ? 'Behavior, backed by tests.' : 'Behavioral promises, backed by test results.', '162;173;181', this.color),
        '',
        tint('This setup installs:', '162;173;181', this.color),
        tint(this.columns < 50 ? '  • Skill for selected agents' : '  • A skill for the agents you choose', '162;173;181', this.color),
        tint(this.columns < 50 ? '  • Commands where supported' : '  • Native commands where supported', '162;173;181', this.color),
        '',
        tint('Your agent handles the workflow.', '162;173;181', this.color),
      ]
      const sideBySide = this.columns >= 72 && this.rows >= 12
      const lines = sideBySide
        ? [`${' '.repeat(25)}${detail[0]}`, ...art.map((line, index) => `  ${line}   ${detail[index + 1] ?? ''}`)]
        : this.columns < 35
          ? [tint('  focused-spec', '249;197;108', this.color, true), ...SHARP.slice(0, this.rows < 12 ? 3 : 8).map(line => `  ${line.trimStart()}`), '  Agent skill', '  Optional commands']
          : this.rows < 18
            ? [detail[0]!, detail[1]!, ...art.slice(0, 3).map(line => `  ${line}`), detail[3]!, detail[4]!, detail[5]!]
            : [detail[0]!, detail[1]!, ...art.map(line => `  ${line}`), detail[3]!, detail[4]!, detail[5]!, detail[7]!]
      if (!sideBySide && this.columns >= 35 && this.rows >= 12) lines.push('')
      lines.push(this.columns < 35 ? '  Enter · Esc cancel' : `${sideBySide ? ' '.repeat(25) : '  '}${tint('Press Enter', '249;197;108', this.color)}${tint(' to continue...', '162;173;181', this.color)}`)
      this.show(lines)
    }
    if (animate) {
      const started = performance.now()
      while (true) {
        const progress = Math.min(1, (performance.now() - started) / DURATION)
        render(1 - (1 - progress) ** 3)
        if (progress === 1) break
        const key = await this.nextKey(Math.min(33, Math.max(0, DURATION - (performance.now() - started))))
        if (key === 'cancel' || key === 'escape') InitTerminal.cancel()
        if (key === 'enter') return
        if (key !== undefined) break
      }
    }
    render(1)
    while (true) {
      const key = await this.nextKey()
      if (key === 'cancel' || key === 'escape') InitTerminal.cancel()
      if (key === 'enter') return
    }
  }

  async pick(root: string, noAnimation: boolean): Promise<Tool[]> {
    await this.welcome(noAnimation)
    const ids = Object.keys(targets) as Tool[]
    const detected = new Set<Tool>()
    for (const id of ids) {
      const target = targets[id]
      if (!target.home && await Promise.all(target.detection.map(path => lstat(join(root, path)).then(info => info.isDirectory(), () => false))).then(results => results.includes(true))) detected.add(id)
    }
    const selected = new Set<Tool>()
    let query = ''
    let cursor = 0
    while (true) {
      const filtered = ids.filter(id => id.includes(query.toLowerCase()))
      cursor = Math.min(cursor, Math.max(0, filtered.length - 1))
      const compact = this.rows < 15 || this.columns < 42
      const capacity = Math.max(2, Math.min(10, this.rows - 8))
      const start = Math.max(0, Math.min(cursor - Math.floor(capacity / 2), filtered.length - capacity))
      const visible = filtered.slice(start, start + capacity)
      const lines = [
        `  ${tint('Choose agent integrations', '249;197;108', this.color)}`,
        `  Search: ${query || '(type to filter)'}   Selected: ${selected.size}`,
        '',
        ...visible.map((id, index) => {
          const target = targets[id]
          const label = target.home ? ' [GLOBAL home]' : detected.has(id) ? ' [detected]' : ''
          const active = index + start === cursor
          const marker = selected.has(id) ? '[x]' : '[ ]'
          const row = `${marker} ${id}${label}`
          return active && this.color
            ? `  \x1b[48;2;59;43;31m\x1b[38;2;249;197;108m› ${row}  \x1b[0m`
            : `  ${active ? '›' : ' '} ${tint(row, selected.has(id) || target.home ? '249;197;108' : '219;224;228', this.color)}`
        }),
        filtered.length === 0 ? '  No matching agents.' : `  ${start + 1}-${start + visible.length} of ${filtered.length} agents`,
        compact ? '  ↑↓ Move  Space Select  Enter Review' : '  ↑↓ Move    Space Select    Enter Review',
        compact ? '  Esc Clear/Cancel' : '  Type to filter    Backspace Edit    Esc Clear/Cancel',
      ]
      this.show(lines)
      const key = await this.nextKey()
      if (key === 'cancel') InitTerminal.cancel()
      if (key === 'escape') {
        if (query) { query = ''; cursor = 0; continue }
        InitTerminal.cancel()
      }
      if (key === 'up') cursor = Math.max(0, cursor - 1)
      else if (key === 'down') cursor = Math.min(filtered.length - 1, cursor + 1)
      else if (key === 'backspace') { query = Array.from(query).slice(0, -1).join(''); cursor = 0 }
      else if (key === 'toggle' && filtered[cursor] !== undefined) {
        const id = filtered[cursor]!
        if (selected.has(id)) selected.delete(id)
        else selected.add(id)
      } else if (key === 'enter' && selected.size > 0) {
        const tools = [...selected]
        this.collapse(this.columns < 35
          ? `  ${tint(`${tools.length} agent${tools.length === 1 ? '' : 's'} selected`, '162;173;181', this.color)}`
          : `  ${tint('✓', '111;217;211', this.color)} ${tint('Selected agents:', '246;242;235', this.color, true)} ${tint(tools.length === 1 ? tools[0]! : `${tools.length} agents`, '162;173;181', this.color)}`)
        return tools
      }
      else if (typeof key === 'object') { query += key.text; cursor = 0 }
    }
  }

  async review(report: Review): Promise<boolean> {
    const cancelled = this.pending.some(key => key === 'cancel' || key === 'escape')
    this.pending.length = 0
    if (cancelled) return false
    const groups = [
      ['install', 'New files'],
      ['unchanged', 'Already present'],
      ['replace', 'Files to replace'],
      ['conflict', 'Conflicts'],
    ] as const
    const content = [
      `Project: ${report.root ?? '(invalid)'}`,
      `Agents: ${report.tools.join(', ')}`,
      ...groups.flatMap(([action, heading]) => {
        const files = report.files.filter(file => file.action === action)
        return files.length === 0 ? [] : ['', `${heading}:`, ...files.map(file => `  ${file.path}`)]
      }),
      ...report.errors.map(error => `Problem: ${error.path === undefined ? '' : `${error.path}: `}${error.message}`),
    ].flatMap(line => wrap(line, this.columns - 2))
    let offset = 0
    while (true) {
      const capacity = Math.max(2, Math.min(12, this.rows - 6))
      const finalPage = Math.max(0, content.length - capacity)
      const narrow = this.columns < 35
      const blocked = report.errors.length > 0
      const prompt = blocked ? narrow ? '  Blocked · Enter' : '  Setup blocked · Enter to close'
        : report.dryRun ? narrow ? '  Preview · Enter' : '  Preview only · Enter to close'
          : offset < finalPage ? narrow ? '  ↓ Scroll to end' : '  Scroll to the end to confirm'
            : narrow ? '  Install? Y/N' : '  Install these files? Y / N'
      this.show([
        narrow ? `  ${tint('Setup review', '249;197;108', this.color, true)}`
          : `  ${tint('focused-spec', '249;197;108', this.color, true)} ${tint('setup review', '246;242;235', this.color, true)}`,
        '',
        ...content.slice(offset, offset + capacity).map(line => `  ${tint(line, line.startsWith('Problem:') || line === 'Conflicts:' ? '244;120;120' : groups.some(([, heading]) => line === `${heading}:`) ? '246;242;235' : '162;173;181', this.color)}`),
        ...(content.length > capacity ? [`  ${offset + 1}-${Math.min(content.length, offset + capacity)} of ${content.length}`] : []),
        prompt,
        ...(content.length > capacity ? [narrow ? '  ↑↓ Scroll' : '  ↑↓ Scroll · Esc cancel'] : ['  Esc cancel']),
      ])
      const key = await this.nextKey()
      if (key === 'cancel' || key === 'escape' || (typeof key === 'object' && key.text.toLowerCase() === 'n')) {
        this.collapse(`  ${tint('Setup cancelled', '162;173;181', this.color)}`)
        return false
      }
      if (key === 'up') offset = Math.max(0, offset - 1)
      else if (key === 'down') offset = Math.min(finalPage, offset + 1)
      else if (blocked || report.dryRun) {
        if (key === 'enter') {
          this.collapse(blocked ? `  ${tint('Setup blocked', '162;173;181', this.color)}` : '')
          return true
        }
      } else if (typeof key === 'object' && key.text.toLowerCase() === 'y' && offset === finalPage) {
        this.collapse('')
        return true
      }
    }
  }
}
