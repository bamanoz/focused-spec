import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL(process.env.FOCUSED_SPEC_OPENSPEC_ROOT ?? '../', import.meta.url))
const changes = join(root, 'openspec/changes')
const completed = []
for (const entry of await readdir(changes, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'archive') continue
  const directory = join(changes, entry.name)
  let metadata = ''
  try { metadata = await readFile(join(directory, '.openspec.yaml'), 'utf8') } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  if (/^\s*skip_specs\s*:\s*true\s*$/imu.test(metadata)) continue
  let tasks
  try { tasks = await readFile(join(directory, 'tasks.md'), 'utf8') } catch (error) {
    if (error?.code === 'ENOENT') continue
    throw error
  }
  const checkboxes = [...tasks.matchAll(/^\s*-\s+\[([ xX])\]/gmu)]
  if (checkboxes.length > 0 && checkboxes.every(match => match[1].toLowerCase() === 'x')) {
    completed.push({ change: entry.name, path: `openspec/changes/${entry.name}`, signal: `${checkboxes.length} task(s) checked` })
  }
}
const report = { completed, count: completed.length, lifecycleChanged: false }
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
else if (completed.length === 0) console.log('No active changes have all task checkboxes complete.')
else {
  console.log('Active OpenSpec changes with all tracked tasks checked (report only):')
  for (const change of completed) console.log(`- ${change.path}: ${change.signal}`)
  console.log('Review with the explicit OpenSpec lifecycle workflow; no files were changed.')
}
