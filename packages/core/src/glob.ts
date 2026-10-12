import { glob } from 'glob'
import { braceExpand } from 'minimatch'

const MAX_PATTERN_LENGTH = 4096
const MAX_PATTERN_DEPTH = 32
const MAX_BRACE_DELIMITERS = 256
const MAX_EXPANSIONS = 256

export function expandGlobPattern(pattern: string): string[] {
  if (pattern.length > MAX_PATTERN_LENGTH) throw new Error(`glob pattern exceeds ${MAX_PATTERN_LENGTH} characters`)
  let braceDepth = 0
  let parenthesisDepth = 0
  let braces = 0
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === '\\') { index += 1; continue }
    if (character === '{' || character === '}') {
      if (++braces > MAX_BRACE_DELIMITERS) throw new Error(`glob pattern exceeds ${MAX_BRACE_DELIMITERS} brace delimiters`)
    }
    if (character === '{') braceDepth += 1
    else if (character === '}') braceDepth = Math.max(0, braceDepth - 1)
    else if (character === '(') parenthesisDepth += 1
    else if (character === ')') parenthesisDepth = Math.max(0, parenthesisDepth - 1)
    if (parenthesisDepth > 2) throw new Error('glob pattern exceeds parenthesis nesting depth 2')
    if (braceDepth + parenthesisDepth > MAX_PATTERN_DEPTH) throw new Error(`glob pattern exceeds nesting depth ${MAX_PATTERN_DEPTH}`)
  }
  // The sentinel detects truncation while staying below the expansion library's aggregate character ceiling.
  const expanded = braceExpand(pattern, { braceExpandMax: MAX_EXPANSIONS + 1 })
  if (expanded.length > MAX_EXPANSIONS) throw new Error(`glob pattern exceeds ${MAX_EXPANSIONS} brace expansions`)
  return expanded
}

export function globFiles(patterns: string[], options: { cwd: string; absolute?: boolean; ignore?: string[] }): Promise<string[]> {
  return glob(patterns, { ...options, dot: true, nodir: true, follow: true, nocase: false, nobrace: true })
}
