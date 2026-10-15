import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin'
import { IdGenerator } from '@cucumber/messages'
import type { FeatureChild, Scenario as GherkinScenario, Tag } from '@cucumber/messages'
import type { FormatDiagnostic, FormatPlugin, ParsedItem, ParseRequest } from 'focused-spec/format'

const validFocusedId = (id: string): boolean => id.trim() !== '' && !/\p{Cc}/u.test(id)

function parseGherkin(source: string): { items: ParsedItem[]; diagnostics: FormatDiagnostic[] } {
  const items: ParsedItem[] = []
  const diagnostics: FormatDiagnostic[] = []
  const inspectTags = (tags: readonly Tag[], scenario?: GherkinScenario): void => {
    const focused = tags.filter(tag => tag.name.startsWith('@focused.'))
    for (const tag of focused) {
      const id = tag.name.slice('@focused.'.length)
      if (scenario === undefined || !validFocusedId(id) || focused.length !== 1) {
        diagnostics.push({
          line: tag.location.line,
          focusedId: id,
          message: 'focused tag must uniquely bind a Scenario or Scenario Outline with a nonblank opaque ID',
        })
      }
    }
    if (scenario !== undefined) {
      items.push({
        line: scenario.location.line,
        name: scenario.name,
        nativeIds: tags.filter(tag => !tag.name.startsWith('@focused.')).map(tag => tag.name.slice(1)),
        ...(focused.length === 1 && validFocusedId(focused[0]!.name.slice('@focused.'.length))
          ? { markerId: focused[0]!.name.slice('@focused.'.length) }
          : {}),
      })
      for (const examples of scenario.examples) inspectTags(examples.tags)
    }
  }
  const visit = (children: readonly FeatureChild[]): void => {
    for (const child of children) {
      if (child.scenario !== undefined) inspectTags(child.scenario.tags, child.scenario)
      if (child.rule !== undefined) {
        inspectTags(child.rule.tags)
        visit(child.rule.children)
      }
    }
  }
  try {
    const document = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher()).parse(source)
    if (document.feature !== undefined) {
      inspectTags(document.feature.tags)
      visit(document.feature.children)
    }
  } catch (error) {
    diagnostics.push({ message: `invalid Gherkin: ${error instanceof Error ? error.message : String(error)}` })
  }
  return { items, diagnostics }
}

export default {
  apiVersion: 2,
  parse({ source }: ParseRequest) {
    return parseGherkin(source)
  },
} satisfies FormatPlugin
