import process from 'node:process'
import { safeText } from './terminal-text.js'
import { isOpaqueValueOption, isValueOption } from './cli-options.js'

class CliArgumentError extends Error {
  readonly help: string

  constructor(message: string, command?: string) {
    super(message)
    this.name = 'CliArgumentError'
    this.help = `focused-spec ${command === undefined ? '' : `${command} `}--help`
  }
}


export function argumentError(message: string, command?: string): Error {
  return new CliArgumentError(message, command)
}

export function jsonRequested(argumentsList: readonly string[]): boolean {
  const command = argumentsList[0]

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]!
    if (command === 'show' && argument === '--') return false
    if (command !== undefined && isOpaqueValueOption(command, argument)) {
      if (index + 1 < argumentsList.length) index += 1
      continue
    }
    if (command !== undefined && isValueOption(command, argument)) {
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
