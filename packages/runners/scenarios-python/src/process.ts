import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runBoundedProcess } from 'focused-spec/runner'

export const TRANSPORT_LIMIT = 4_000_000

export interface PythonProcessResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
  readonly report?: string
}

export async function executePythonWorker(
  command: string,
  worker: string,
  request: unknown,
  cwd: string,
  signal: AbortSignal,
): Promise<PythonProcessResult> {
  signal.throwIfAborted()
  const temporary = await mkdtemp(join(tmpdir(), 'focused-spec-python-worker-'))
  const reportPath = join(temporary, 'report.json')
  const cancelPath = join(temporary, 'cancel')
  const input = JSON.stringify({ ...(request as Record<string, unknown>), cancelPath })
  if (Buffer.byteLength(input) > TRANSPORT_LIMIT) {
    await rm(temporary, { recursive: true, force: true })
    throw new Error('Python worker input exceeds 4000000 bytes')
  }
  try {
    const result = await runBoundedProcess(command, ['-B', worker, reportPath], {
      cwd,
      signal,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      input,
      inputLimit: TRANSPORT_LIMIT,
      inputError: 'Python worker input exceeds 4000000 bytes',
      outputLimit: TRANSPORT_LIMIT,
      diagnosticLimit: TRANSPORT_LIMIT,
      diagnosticOverflow: true,
      capture: 'head',
      outputError: stream => `Python worker ${stream} exceeds 4000000 bytes`,
      onAbort: () => { void writeFile(cancelPath, 'cancelled', { flag: 'wx' }).catch(() => undefined) },
      terminateOnAbort: false,
      terminateAfterCompletion: true,
    })
    let report: string | undefined
    try {
      const info = await lstat(reportPath)
      if (!info.isFile()) throw new Error('Python execution report is not a regular file')
      if (info.size > TRANSPORT_LIMIT) throw new Error('Python execution report exceeds 4000000 bytes')
      report = await readFile(reportPath, 'utf8')
      if (Buffer.byteLength(report) > TRANSPORT_LIMIT) throw new Error('Python execution report exceeds 4000000 bytes')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return { ...result, ...(report === undefined ? {} : { report }) }
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}
