import type { JsonValue } from './runner-api.js'

export interface ParsedItem {
  readonly line: number
  readonly name: string
  readonly nativeIds: readonly string[]
  readonly markerId?: string
}

export interface FormatDiagnostic {
  readonly line?: number
  readonly message: string
  readonly focusedId?: string
}

export interface ParseResult {
  readonly items: readonly ParsedItem[]
  readonly diagnostics: readonly FormatDiagnostic[]
}

export interface ParseRequest {
  readonly path: string
  readonly source: string
  readonly options: JsonValue
  readonly signal: AbortSignal
}

export interface FormatPlugin {
  readonly apiVersion: 1
  parse(request: ParseRequest): ParseResult | Promise<ParseResult>
}
