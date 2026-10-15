import type { JsonValue } from './runner-api.js'

export interface SourceLocation {
  readonly path: string
  readonly line: number
}

export interface ParsedItem {
  readonly line: number
  readonly name: string
  readonly nativeIds: readonly string[]
  readonly markerId?: string
  readonly evidence?: readonly string[]
  readonly evidenceLocations?: readonly SourceLocation[]
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
  readonly projectRoot: string
  readonly path: string
  readonly source: string
  readonly options: JsonValue
  readonly signal: AbortSignal
}

export interface CatalogDocument {
  readonly path: string
  readonly scope: string
  readonly items: readonly ParsedItem[]
}

export interface BindRequest {
  readonly projectRoot: string
  readonly documents: readonly CatalogDocument[]
  readonly selection: { readonly scope?: string; readonly scenarioId?: string }
  readonly options: JsonValue
  readonly signal: AbortSignal
}

export interface Enrollment {
  readonly document: number
  readonly item: number
  readonly id: string
  readonly evidence: readonly string[]
  readonly evidenceLocations?: readonly SourceLocation[]
  readonly location: SourceLocation
}

export interface SourceClaim {
  readonly key: string
  readonly location: SourceLocation
}

export interface BindDiagnostic {
  readonly location: SourceLocation
  readonly message: string
  readonly scope?: string
  readonly focusedId?: string
}

export interface BindResult {
  readonly enrollments: readonly Enrollment[]
  readonly diagnostics: readonly BindDiagnostic[]
  readonly sourceClaims: readonly SourceClaim[]
}

export interface FormatPlugin {
  readonly apiVersion: 2
  parse(request: ParseRequest): ParseResult | Promise<ParseResult>
  bind?(request: BindRequest): BindResult | Promise<BindResult>
}
