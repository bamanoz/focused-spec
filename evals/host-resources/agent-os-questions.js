/** Agent OS's user-question tool, backed by the runtime's real ACP UI transport. */

const interactionGuidance = `AskUserQuestion is available in this ACP session and sends questions to the connected user. When the active host workflow requires user interaction, those questions take precedence over generic plan-mode heuristics about minimizing questions, discovering facts, or recording assumptions. Ask the required questions and wait for their answers before completing the plan. Answers inform shaping but never grant write access: submit the completed plan through the runtime plan-proposal flow for separate explicit approval.`
export default function (api) {
  api.on('before_agent_start', async () => ({
    message: {
      customType: 'agent-os-question-transport',
      content: interactionGuidance,
      display: false,
      attribution: 'agent',
    },
  }))
  const z = api.zod
  api.registerTool({
    name: 'AskUserQuestion',
    label: 'Ask User Question',
    description: 'Ask the user questions and wait for their actual answers before continuing.',
    approval: 'read',
    loadMode: 'essential',
    parameters: z.object({
      questions: z.array(z.object({
        question: z.string(),
        header: z.string().optional(),
        options: z.array(z.object({ label: z.string(), description: z.string().optional() })).optional(),
        multiSelect: z.boolean().optional(),
      })),
    }),
    async execute(_id, params, signal, _update, context) {
      if (!context.hasUI || params.questions.length === 0) throw new Error('User-question transport is unavailable')
      const answers = []
      for (const question of params.questions) {
        const choices = (question.options ?? []).map(option => `${option.label}${option.description ? ` — ${option.description}` : ''}`)
        const answer = await context.ui.editor([question.question, ...choices].join('\n'), undefined, { signal })
        if (answer === undefined || answer.trim() === '') throw new Error('User cancelled the question')
        answers.push({ question: question.question, answer })
      }
      return { content: [{ type: 'text', text: JSON.stringify({ answers }) }], details: { answers } }
    },
  })
}
