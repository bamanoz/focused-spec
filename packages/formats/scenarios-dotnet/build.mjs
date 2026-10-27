import { mkdir, readdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const project = join(root, 'dotnet', 'FocusedSpec.Catalog', 'FocusedSpec.Catalog.csproj')
const destination = join(root, 'dist', 'dotnet')
await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
const published = spawnSync('dotnet', ['publish', project, '--configuration', 'Release', '--output', destination, '--nologo', '--self-contained', 'false', '-p:UseAppHost=false'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})
if (published.status !== 0) throw new Error(published.stderr || published.stdout || 'failed to build FocusedSpec.Catalog')
const files = new Set(await readdir(destination))
for (const required of ['FocusedSpec.Catalog.dll', 'FocusedSpec.Catalog.deps.json', 'FocusedSpec.Catalog.runtimeconfig.json', 'Microsoft.CodeAnalysis.dll', 'Microsoft.CodeAnalysis.CSharp.dll', 'THIRD-PARTY-NOTICES.txt']) {
  if (!files.has(required)) throw new Error(`published .NET catalog is missing ${required}`)
}
