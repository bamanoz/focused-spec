import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentDriver, AgentRequest, AgentResult } from './types.ts'

export async function runAgentTurn(driver: AgentDriver, request: AgentRequest): Promise<AgentResult> {
  const started = Date.now()
  try { return await driver.run(request) } catch (error) {
    const fields = error !== null && typeof error === 'object' ? error as Record<string, unknown> : {}
    const message = error instanceof Error ? error.message : String(error)
    const output = [fields.output, fields.stdout, fields.stderr, message].filter((value): value is string => typeof value === 'string').map(value => value.slice(-1_048_576)).join('\n')
    return { success: false, output, exitCode: null, durationMs: Date.now() - started }
  }
}

export async function saveEvalResult(directory: string, prefix: string, result: unknown): Promise<string> {
  await mkdir(directory, { recursive: true })
  const content = `${JSON.stringify(result, null, 2)}\n`
  for (;;) {
    const path = join(directory, `${prefix}-${Date.now()}-${randomUUID()}.json`)
    try { await writeFile(path, content, { flag: 'wx' }); return path } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
}
