import { delimiter, join } from 'node:path'
import type { AgentDriver, AgentRequest } from './types.ts'
import { runProcess } from './process.ts'

export function agentEnvironment(workspace: string): NodeJS.ProcessEnv {
  return { ...process.env, PATH: `${join(workspace, 'node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}` }
}

export class OmpAgentDriver implements AgentDriver {
  async run(request: AgentRequest) {
    const args = [
      '-p',
      '--cwd', request.workspace,
      ...(request.sessionDir === undefined ? ['--no-session'] : ['--session-dir', request.sessionDir]),
      ...(request.resume === undefined ? [] : ['--resume', request.resume]),
      '--no-extensions',
      '--no-rules',
      '--no-title',
      ...(request.skills.length === 0 ? ['--no-skills'] : ['--skills', request.skills.join(',')]),
      ...(request.tools === '' ? ['--no-tools'] : ['--tools', request.tools ?? 'read,bash,edit,write,grep,glob,todo']),
      ...(request.systemPrompt === undefined ? [] : ['--system-prompt', request.systemPrompt]),
      ...(request.appendSystemPrompt === undefined ? [] : ['--append-system-prompt', request.appendSystemPrompt]),
      '--auto-approve',
      '--max-time', `${Math.ceil(request.timeoutMs / 1_000)}s`,
      '--thinking', 'off',
      '--mode', 'json',
      ...(request.model === undefined ? [] : ['--model', request.model]),
      request.prompt,
    ]
    const result = await runProcess('omp', args, {
      cwd: request.workspace,
      timeoutMs: request.timeoutMs + 30_000,
      env: agentEnvironment(request.workspace),
    })
    return {
      success: result.code === 0,
      output: `${result.stdout}${result.stderr === '' ? '' : `\n[stderr]\n${result.stderr}`}`,
      exitCode: result.code,
      durationMs: result.durationMs,
    }
  }
}
