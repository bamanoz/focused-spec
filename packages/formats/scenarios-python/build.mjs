import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const destination = join(root, 'dist', 'python')
await mkdir(destination, { recursive: true })
await copyFile(join(root, 'python', 'catalog.py'), join(destination, 'catalog.py'))
