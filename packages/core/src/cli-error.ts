import process from 'node:process'
import { safeText } from './terminal-text.js'

class CliArgumentError extends Error {
  readonly help: string

  constructor(message: string, command?: string) {
    super(message)
    this.name = 'CliArgumentError'
    this.help = `focused-spec ${command === undefined ? '' : `${command} `}--help`
  }
}

const ordinaryValueOptions: Readonly<Record<string, Readonly<Record<string, true>>>> = {
  validate: { '--root': true, '--config': true, '--scope': true },
  run: { '--root': true, '--config': true, '--scope': true },
  list: { '--root': true, '--config': true, '--scope': true },
  show: { '--root': true, '--config': true, '--scope': true },
  'plugin-docs': { '--root': true, '--config': true, '--format': true, '--runner': true, '--package': true },
  init: { '--tools': true },
  instructions: { '--protocol': true, '--topic': true },
}

const opaqueValueOptions: Readonly<Record<string, Readonly<Record<string, true>>>> = {
  validate: { '--scenario': true },
  run: { '--scenario': true },
  list: { '--scenario': true },
}

export function argumentError(message: string, command?: string): Error {
  return new CliArgumentError(message, command)
}

export function jsonRequested(argumentsList: readonly string[]): boolean {
  const command = argumentsList[0]
  const ordinary = command !== undefined && Object.hasOwn(ordinaryValueOptions, command) ? ordinaryValueOptions[command] : undefined
  const opaque = command !== undefined && Object.hasOwn(opaqueValueOptions, command) ? opaqueValueOptions[command] : undefined

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]!
    if (command === 'show' && argument === '--') return false
    if (opaque !== undefined && Object.hasOwn(opaque, argument)) {
      if (index + 1 < argumentsList.length) index += 1
      continue
    }
    if (ordinary !== undefined && Object.hasOwn(ordinary, argument)) {
      const value = argumentsList[index + 1]
      const rejected = command === 'validate' || command === 'run' ? value?.startsWith('--') : value?.startsWith('-')
      if (value !== undefined && rejected === false) index += 1
      continue
    }
    if (argument === '--json') return true
  }
  return false
}

export function printCliError(error: unknown, json: boolean): void {
  const message = error instanceof Error ? error.message : String(error)
  if (json) {
    const detail = error instanceof CliArgumentError
      ? { code: 'invalid_arguments' as const, message, help: error.help }
      : { code: 'command_failed' as const, message }
    process.stderr.write(`${JSON.stringify({ error: detail }, null, 2)}\n`)
    return
  }
  process.stderr.write(`${message.split('\n').map(safeText).join('\n')}\n`)
  if (error instanceof CliArgumentError) process.stderr.write(`Run '${safeText(error.help)}' for usage.\n`)
}
