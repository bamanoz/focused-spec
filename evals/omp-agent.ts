import type { AgentDriver, AgentRequest } from './types.ts'
import { runProcess } from './process.ts'

export class OmpAgentDriver implements AgentDriver {
  async run(request: AgentRequest) {
    const args = [
      '-p',
      '--cwd', request.workspace,
      '--no-session',
      '--no-extensions',
      '--no-rules',
      '--no-title',
      '--skills', request.skills.join(','),
      '--tools', 'read,bash,edit,write,grep,glob,todo',
      '--auto-approve',
      '--max-time', `${Math.ceil(request.timeoutMs / 1_000)}s`,
      '--thinking', 'off',
      '--mode', 'json',
      ...(request.model === undefined ? [] : ['--model', request.model]),
      request.prompt,
    ]
    const result = await runProcess('omp', args, { cwd: request.workspace, timeoutMs: request.timeoutMs + 30_000 })
    return {
      success: result.code === 0,
      output: `${result.stdout}${result.stderr === '' ? '' : `\n[stderr]\n${result.stderr}`}`,
      exitCode: result.code,
      durationMs: result.durationMs,
    }
  }
}
