#!/usr/bin/env node
import process from 'node:process'
import { EVAL_CASES } from './cases.ts'
import { runEval } from './harness.ts'

const USAGE = `Usage:
  npm run eval:agent -- --case <id> [--model <model>] [--timeout <seconds>] [--openspec-skills <path>] [--competing-skills <path>] [--keep-workspace]
  npm run eval:agent -- --list
`

interface Options {
  readonly list: boolean
  readonly caseId?: string
  readonly model?: string
  readonly timeoutMs?: number
  readonly openspecSkillsDir?: string
  readonly competingSkillsDir?: string
  readonly keepWorkspace: boolean
}

function parse(argumentsList: readonly string[]): Options {
  let list = false
  let caseId: string | undefined
  let model: string | undefined
  let timeoutMs: number | undefined
  let openspecSkillsDir: string | undefined
  let competingSkillsDir: string | undefined
  let keepWorkspace = false
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === '--list') list = true
    else if (argument === '--keep-workspace') keepWorkspace = true
    else if (argument === '--case' || argument === '--model' || argument === '--timeout' || argument === '--openspec-skills' || argument === '--competing-skills') {
      const value = argumentsList[index + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${argument}\n${USAGE}`)
      index += 1
      if (argument === '--case') caseId = value
      else if (argument === '--model') model = value
      else if (argument === '--openspec-skills') openspecSkillsDir = value
      else if (argument === '--competing-skills') competingSkillsDir = value
      else {
        const seconds = Number(value)
        if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`--timeout must be positive seconds\n${USAGE}`)
        timeoutMs = Math.round(seconds * 1_000)
      }
    } else throw new Error(`unknown argument ${String(argument)}\n${USAGE}`)
  }
  return {
    list,
    ...(caseId === undefined ? {} : { caseId }),
    ...(model === undefined ? {} : { model }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(openspecSkillsDir === undefined ? {} : { openspecSkillsDir }),
    ...(competingSkillsDir === undefined ? {} : { competingSkillsDir }),
    keepWorkspace,
  }
}

try {
  const options = parse(process.argv.slice(2))
  if (options.list) {
    for (const item of EVAL_CASES) process.stdout.write(`${item.id}\t${item.description}\n`)
  } else {
    if (options.caseId === undefined) throw new Error(USAGE)
    const result = await runEval({
      caseId: options.caseId,
      ...(options.model === undefined ? {} : { model: options.model }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(options.openspecSkillsDir === undefined ? {} : { openspecSkillsDir: options.openspecSkillsDir }),
      ...(options.competingSkillsDir === undefined ? {} : { competingSkillsDir: options.competingSkillsDir }),
      keepWorkspace: options.keepWorkspace,
    })
    for (const gate of result.gates) process.stdout.write(`${gate.passed ? 'PASS' : 'FAIL'} ${gate.name}: ${gate.detail}\n`)
    for (const observation of result.observations) process.stdout.write(`OBSERVATION ${observation.name}: observed=${observation.passed}; ${observation.detail}\n`)
    process.stdout.write(`MEASUREMENTS ${JSON.stringify(result.measurements)}\n`)
    if (result.skillInventory !== undefined) process.stdout.write(`SKILLS ${result.skillInventory.map(skill => skill.name).join(', ')}\n`)
    if (result.diagnostic !== null) process.stdout.write(`DIAGNOSTIC ${result.caseId} ${result.diagnostic.status}: ${result.diagnostic.detail}\n`)
    process.stdout.write(`workspace: ${result.workspace}${options.keepWorkspace ? '' : ' (removed)'}\n`)
    process.exitCode = result.passed ? 0 : 1
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
