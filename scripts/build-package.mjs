import { spawnSync } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'

// npm runs each workspace script from its package root; dist is wholly generated.
await rm(join(process.cwd(), 'dist'), { recursive: true, force: true })
const compiler = createRequire(import.meta.url).resolve('typescript/bin/tsc')
const result = spawnSync(process.execPath, [compiler, '-p', 'tsconfig.json'], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
