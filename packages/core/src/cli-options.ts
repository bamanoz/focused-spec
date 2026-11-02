export type CliCommand = 'validate' | 'run' | 'list' | 'show' | 'plugin-docs' | 'init' | 'instructions' | 'version'
type OptionKind = 'flag' | 'value' | 'opaque-value'

const OPTIONS: Readonly<Record<CliCommand, Readonly<Record<string, OptionKind>>>> = {
  validate: { '--root': 'value', '--config': 'value', '--scope': 'value', '--scenario': 'opaque-value', '--strict': 'flag', '--syntax-only': 'flag', '--json': 'flag', '--timings': 'flag' },
  run: { '--root': 'value', '--config': 'value', '--scope': 'value', '--scenario': 'opaque-value', '--junit': 'value', '--allow-skip': 'flag', '--json': 'flag', '--timings': 'flag', '--details': 'flag' },
  list: { '--root': 'value', '--config': 'value', '--scope': 'value', '--scenario': 'opaque-value', '--json': 'flag' },
  show: { '--root': 'value', '--config': 'value', '--scope': 'value', '--json': 'flag' },
  'plugin-docs': { '--root': 'value', '--config': 'value', '--format': 'value', '--runner': 'value', '--package': 'value', '--json': 'flag' },
  init: { '--tools': 'value', '--dry-run': 'flag', '--json': 'flag', '--replace': 'flag', '--no-animation': 'flag' },
  instructions: { '--protocol': 'value', '--topic': 'value', '--json': 'flag' },
  version: { '--json': 'flag' },
}

export function optionKind(command: string | undefined, option: string): OptionKind | undefined {
  return command !== undefined && Object.hasOwn(OPTIONS, command)
    ? OPTIONS[command as CliCommand]![option]
    : undefined
}

export function isValueOption(command: string, option: string): boolean {
  const kind = optionKind(command, option)
  return kind === 'value' || kind === 'opaque-value'
}

export function isOpaqueValueOption(command: string, option: string): boolean {
  return optionKind(command, option) === 'opaque-value'
}
