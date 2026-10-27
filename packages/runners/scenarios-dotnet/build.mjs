import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const destination = join(root, 'dist', 'dotnet')
await mkdir(destination, { recursive: true })
await copyFile(join(root, 'dotnet', 'Bridge.cs'), join(destination, 'Bridge.cs.txt'))
