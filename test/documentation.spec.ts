import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

function prose(markdown: string): string {
  const lines: string[] = []
  let fence: string | undefined
  for (const line of markdown.split(/\r?\n/u)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1]
    if (fence !== undefined) {
      if (marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = undefined
    } else if (marker !== undefined) {
      fence = marker
    } else {
      lines.push(line)
    }
  }
  return lines.join('\n')
}

function destinations(markdown: string): string[] {
  const content = prose(markdown)
  return [
    ...[...content.matchAll(/\]\(([^\s)]+)\)/gu)].map(match => match[1]!),
    ...[...content.matchAll(/\b(?:src|href)=["']([^"']+)["']/gu)].map(match => match[1]!),
  ]
}

function anchors(markdown: string): Set<string> {
  const result = new Set<string>()
  for (const match of prose(markdown).matchAll(/^#{1,6}\s+(.+)$/gmu)) {
    const base = match[1]!.trim().toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /gu, '-')
    let anchor = base
    for (let suffix = 1; result.has(anchor); suffix++) anchor = `${base}-${suffix}`
    result.add(anchor)
  }
  return result
}

async function follow(from: string, destination: string): Promise<string> {
  const [reference, fragment] = destination.split('#')
  const path = reference?.split('?')[0] ?? ''
  const source = resolve(root, from)
  const target = path ? resolve(dirname(source), decodeURIComponent(path)) : source
  const info = await stat(target)
  expect(info.isFile() || info.isDirectory(), `${from} → ${destination}`).toBe(true)
  if (fragment) {
    expect(info.isFile(), `${from} → ${destination}`).toBe(true)
    const content = await readFile(target, 'utf8')
    expect(anchors(content).has(decodeURIComponent(fragment)), `${from} → ${destination}`).toBe(true)
  }
  return target
}

describe('public documentation navigation', () => {
  it('follows the CLI reference to the current native SDK installation guide', async () => {
    const from = 'docs/reference/cli.md'
    const links = destinations(await readFile(resolve(root, from), 'utf8')).filter(link => !/^[a-z][a-z\d+.-]*:|^\/\//iu.test(link))
    for (const link of links) await follow(from, link)
  })

  it('keeps local documentation navigation reachable from public entry points', async () => {
    const visited = new Set<string>()
    const pending = ['README.md', 'docs/README.md']
    while (pending.length > 0) {
      const from = pending.pop()!
      if (visited.has(from)) continue
      visited.add(from)
      const markdown = await readFile(resolve(root, from), 'utf8')
      for (const destination of destinations(markdown)) {
        if (/^[a-z][a-z\d+.-]*:|^\/\//iu.test(destination)) continue
        const target = relative(root, await follow(from, destination))
        if (target.startsWith('docs/') && /\.md$/iu.test(target)) pending.push(target)
      }
    }
    const pages = await readdir(resolve(root, 'docs'), { recursive: true })
    for (const page of pages.filter(path => path.endsWith('.md') && path !== 'development/candidate-improvements.md')) {
      expect(visited.has(`docs/${page}`), `docs/${page} is not reachable from the public documentation map`).toBe(true)
    }
    expect(visited.has('docs/development/candidate-improvements.md'), 'internal candidate tracking is reachable from public navigation').toBe(false)
  })
})
