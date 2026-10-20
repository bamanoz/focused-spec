import ts from 'typescript'
import { defineSuite, type JsonValue, type Scenario, type Suite } from '@focused-spec/scenarios-typescript'

export interface CatalogScenario {
  readonly scenario: Scenario
  readonly line: number
}
export interface Catalog {
  readonly suite: Suite
  readonly scenarios: readonly CatalogScenario[]
}
export class CatalogError extends Error {
  readonly line: number
  constructor(message: string, line: number) {
    super(message)
    this.name = 'CatalogError'
    this.line = line
  }
}

export function encodeSelector(path: string, id: string): string {
  return JSON.stringify([path, id])
}

export function decodeSelector(selector: string): readonly [string, string] {
  const value: unknown = JSON.parse(selector)
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string'
    || !value[1].trim() || /[\u0000-\u001f\u007f-\u009f]/u.test(value[1])) throw new Error('expected JSON [project-relative suite path, exact scenario ID]')
  const path = value[0]
  if (!path || /[\\\u0000-\u001f\u007f]/u.test(path) || /^[a-z]:/iu.test(path) || path.split('/').some(part => part === '' || part === '.' || part === '..')
    || !/\.(?:m?js|m?ts)$/u.test(path)) throw new Error('suite path must be a contained project-relative JS/TS file')
  return [path, value[1]]
}

export function readCatalog(path: string, source: string): Catalog {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const line = (node: ts.Node): number => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
  const fail = (node: ts.Node, message: string): never => { throw new CatalogError(message, line(node)) }
  const diagnostics = (file as ts.SourceFile & { readonly parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics
  if (diagnostics.length) {
    const diagnostic = diagnostics[0]!
    throw new CatalogError(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'), file.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1)
  }
  function unwrap(node: ts.Expression): ts.Expression {
    while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression
    return node
  }
  function literal(expression: ts.Expression): JsonValue {
    const node = unwrap(expression)
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
    if (ts.isNumericLiteral(node)) {
      const number = Number(node.text)
      if (!Number.isFinite(number)) return fail(node, 'numeric literal must be finite')
      return number
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
      const number = -Number(node.operand.text)
      if (!Number.isFinite(number)) return fail(node, 'numeric literal must be finite')
      return number
    }
    if (node.kind === ts.SyntaxKind.NullKeyword) return null
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.map(element => {
        if (ts.isOmittedExpression(element) || ts.isSpreadElement(element)) return fail(element, 'array holes and spreads are unsupported')
        return literal(element)
      })
    }
    if (ts.isObjectLiteralExpression(node)) {
      const value: Record<string, JsonValue> = {}
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) return fail(property, 'only explicit data properties are supported')
        if (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name) && !ts.isNumericLiteral(property.name)) {
          return fail(property.name, 'computed properties are unsupported')
        }
        const key = property.name.text
        if (key === '__proto__') return fail(property.name, 'prototype-setting __proto__ properties are unsupported')
        if (Object.hasOwn(value, key)) return fail(property.name, `duplicate property: ${key}`)
        value[key] = literal(property.initializer)
      }
      return value
    }
    return fail(node, 'expected literal JSON data; dynamic declarations are unsupported')
  }
  let binding: string | undefined
  let declaration: ts.ExportAssignment | undefined
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause
      if (clause?.isTypeOnly) continue
      const names = clause?.namedBindings
      if (clause?.name || !names || !ts.isNamedImports(names)) return fail(statement, 'only defineSuite and type-only imports are supported')
      const values = names.elements.filter(element => !element.isTypeOnly)
      if (values.length === 0) continue
      if (!ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== '@focused-spec/scenarios-typescript'
        || values.length !== 1 || (values[0]!.propertyName ?? values[0]!.name).text !== 'defineSuite' || binding !== undefined) {
        return fail(statement, 'expected one defineSuite import from @focused-spec/scenarios-typescript')
      }
      binding = values[0]!.name.text
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals && declaration === undefined) {
      declaration = statement
    } else {
      return fail(statement, 'only imports and one default defineSuite declaration are supported')
    }
  }
  if (!binding || !declaration) throw new CatalogError('expected a defineSuite import and one default suite declaration', 1)
  const call = unwrap(declaration.expression)
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || call.expression.text !== binding || call.arguments.length !== 1) {
    return fail(call, 'default export must call the imported defineSuite with one literal object')
  }
  const object = unwrap(call.arguments[0]!)
  if (!ts.isObjectLiteralExpression(object)) return fail(object, 'suite must be a literal object')
  const value = literal(object)
  let suite: Suite
  try {
    suite = defineSuite(value as unknown as Suite)
  } catch (error) {
    return fail(object, error instanceof Error ? error.message : String(error))
  }
  const property = object.properties.find(property => ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name) && property.name.text === 'scenarios')
  if (!property || !ts.isPropertyAssignment(property)) return fail(object, 'suite requires scenarios')
  const array = unwrap(property.initializer)
  if (!ts.isArrayLiteralExpression(array)) return fail(array, 'scenarios must be a literal array')
  return { suite, scenarios: suite.scenarios.map((scenario, index) => ({ scenario, line: line(unwrap(array.elements[index]! as ts.Expression)) })) }
}
