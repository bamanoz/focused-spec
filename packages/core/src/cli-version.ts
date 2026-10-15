import process from 'node:process'
import { readFile, realpath } from 'node:fs/promises'

export interface VersionInformation {
  readonly package: {
    readonly name: string
    readonly version: string
  }
  readonly executable: string
  readonly runtime: {
    readonly node: string
  }
  readonly contracts: {
    readonly guidance: 1
    readonly configuration: 5
    readonly format: 2
    readonly runner: 1
  }
}

export async function readVersion(): Promise<VersionInformation> {
  let metadata: unknown
  let executable: string
  try {
    const [packageText, canonicalExecutable] = await Promise.all([
      readFile(new URL('../package.json', import.meta.url), 'utf8'),
      realpath(new URL('./cli.js', import.meta.url)),
    ])
    metadata = JSON.parse(packageText)
    executable = canonicalExecutable
  } catch (error) {
    throw new Error(`incomplete installed focused-spec package: cannot read package identity or canonical executable. Reinstall the package.\n${error instanceof Error ? error.message : String(error)}`)
  }
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)
    || !('name' in metadata) || metadata.name !== 'focused-spec'
    || !('version' in metadata) || typeof metadata.version !== 'string' || metadata.version.trim() === '') {
    throw new Error('incomplete installed focused-spec package: invalid package identity/version. Reinstall the package.')
  }
  return {
    package: { name: metadata.name, version: metadata.version },
    executable,
    runtime: { node: process.version },
    contracts: { guidance: 1, configuration: 5, format: 2, runner: 1 },
  }
}

export function displayVersion(info: VersionInformation, json: boolean): void {
  process.stdout.write(json ? `${JSON.stringify(info, null, 2)}\n` : `${info.package.name} ${info.package.version}\n`)
}
