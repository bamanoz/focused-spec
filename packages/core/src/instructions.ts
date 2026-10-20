import { readFile } from 'node:fs/promises'
import { argumentError } from './cli-error.js'

export const INSTRUCTIONS_HELP = `Read authoritative agent guidance from the installed focused-spec package.

Usage:
  focused-spec instructions [options]

Options:
  --protocol <version>  Loader protocol, independent of package/config/runner versions (default: 1)
  --topic <topic>       workflow, integration, formats or runners (default: workflow)
  --json                Print protocol, package identity, topic and complete Markdown as JSON
  -h, --help            Show this help

Works offline without project configuration, evidence or plugins; changes no project files.
Unsupported protocols fail without returning instructions. Use the project's installed CLI.
Guidance is not validation or executable evidence.

Examples:
  focused-spec instructions --protocol 1 --json
  focused-spec instructions --protocol 1 --topic integration --json
  focused-spec instructions --protocol 1 --topic formats --json
  focused-spec instructions --protocol 1 --topic runners --json
`

export async function instructions(argumentsList: readonly string[]): Promise<string> {
  let protocol = 1
  let topic: 'workflow' | 'integration' | 'formats' | 'runners' = 'workflow'
  let json = false
  const seen = new Set<string>()
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument !== undefined && argument.startsWith('-')) {
      if (seen.has(argument)) throw argumentError(`duplicate option ${argument}`, 'instructions')
      seen.add(argument)
    }
    if (argument === '--json') json = true
    else if (argument === '--protocol' || argument === '--topic') {
      const value = argumentsList[index + 1]
      if (value === undefined || value.startsWith('-')) throw argumentError(`missing value for ${argument}`, 'instructions')
      index += 1
      if (argument === '--protocol') {
        if (!/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
          throw argumentError('--protocol must be a positive decimal integer', 'instructions')
        }
        protocol = Number(value)
      } else {
        if (value !== 'workflow' && value !== 'integration' && value !== 'formats' && value !== 'runners') throw argumentError(`unknown guidance topic ${value}; choose workflow, integration, formats or runners`, 'instructions')
        topic = value
      }
    } else throw argumentError(`unknown argument ${String(argument)}`, 'instructions')
  }
  if (protocol !== 1) throw argumentError(`unsupported loader protocol ${protocol}; supported protocols: 1. Install a compatible CLI or loader.`, 'instructions')

  let metadata: unknown
  let content: string
  try {
    const [packageText, guidance] = await Promise.all([
      readFile(new URL('../package.json', import.meta.url), 'utf8'),
      readFile(new URL(`../guidance/${topic}.md`, import.meta.url), 'utf8'),
    ])
    metadata = JSON.parse(packageText)
    content = guidance
  } catch (error) {
    throw new Error(`incomplete installed focused-spec package: cannot read ${topic} guidance or package metadata. Reinstall the package.\n${error instanceof Error ? error.message : String(error)}`)
  }
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)
    || !('name' in metadata) || metadata.name !== 'focused-spec'
    || !('version' in metadata) || typeof metadata.version !== 'string' || metadata.version.trim() === '') {
    throw new Error('incomplete installed focused-spec package: invalid package identity/version. Reinstall the package.')
  }
  if (content.trim() === '') throw new Error(`incomplete installed focused-spec package: empty ${topic} guidance. Reinstall the package.`)
  const response = { protocolVersion: 1, package: { name: metadata.name, version: metadata.version }, topic, content }
  return json ? `${JSON.stringify(response, null, 2)}\n`
    : `focused-spec ${metadata.version} — loader protocol 1 — ${topic}\n\n${content}${content.endsWith('\n') ? '' : '\n'}`
}
