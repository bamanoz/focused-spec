import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const destination = join(root, 'dist', 'go')
await mkdir(destination, { recursive: true })
await copyFile(join(root, 'go', 'catalog.go'), join(destination, 'catalog.go'))
await writeFile(join(destination, 'go.mod'), 'module focused-spec-go-catalog\n\ngo 1.23\n')
