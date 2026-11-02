import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { glob } from 'glob'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach } from 'vitest'
import type { AgentDriver, AgentRequest, AgentResult, EvalCase } from '../../evals/types.ts'
import { OPEN_SPEC_SKILLS } from '../../evals/types.ts'
import { integrationFiles } from '../../evals/integration.ts'
import type { IntegrationBaseline } from '../../evals/integration.ts'

export const roots: string[] = []

export const repository = fileURLToPath(new URL('../..', import.meta.url))

export const WORKFLOW_GUIDANCE = '# Authoritative workflow\n\nFollow the installed package guidance.\n'

export const change: EvalCase = {
  id: 'focused-test', description: 'deterministic gate fixture', source: 'openspec',
  changeName: 'add-auth', turns: [], prescribedScenarioId: 'auth.blocked',
  expectedEvidenceCount: 1, expectedSelectorFragments: ['target'],
}

export const brownfieldChange: EvalCase = {
  ...change,
  id: 'openspec-brownfield',
  prescribedScenarioId: 'auth.login.blocked-account',
  expectedEvidenceCount: 2,
  expectedSelectorFragments: ['TestBlockedAccountWithValidCredentials', 'test_blocked_account_with_valid_credentials'],
}

export async function openSpecSkillsFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-eval-openspec-skills-'))
  roots.push(root)
  await Promise.all(OPEN_SPEC_SKILLS.map(skill => put(root, `${skill}/SKILL.md`, `---\nname: ${skill}\ndescription: Test fixture for ${skill}.\n---\n`)))
  return root
}

export async function put(root: string, path: string, source: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, source)
}

export async function installFocusedPackage(root: string): Promise<void> {
  const packages = [
    ['core', 'focused-spec', ['guidance', 'skills']],
    ['formats/markdown', '@focused-spec/format-markdown', []],
    ['formats/inline', '@focused-spec/format-inline', []],
    ['formats/registry', '@focused-spec/format-registry', []],
    ['runners/go', '@focused-spec/runner-go', []],
    ['runners/pytest', '@focused-spec/runner-pytest', ['python']],
  ] as const
  await Promise.all(packages.map(async ([directory, name, assets]) => {
    const destination = join(root, 'node_modules', ...name.split('/'))
    await mkdir(destination, { recursive: true })
    await Promise.all([
      cp(join(repository, 'packages', directory, 'dist'), join(destination, 'dist'), { recursive: true }),
      cp(join(repository, 'packages', directory, 'package.json'), join(destination, 'package.json')),
      ...assets.map(asset => cp(join(repository, 'packages', directory, asset), join(destination, asset), { recursive: true })),
    ])
  }))
  for (const dependency of ['glob', 'minimatch', 'mdast-util-from-markdown', 'yaml']) {
    const link = join(root, 'node_modules', dependency)
    await mkdir(dirname(link), { recursive: true })
    await symlink(join(repository, 'node_modules', dependency), link, 'junction')
  }
}

export function skillReadTranscript(options: { readonly complete?: boolean; readonly failed?: boolean; readonly path?: string } = {}): string {
  const callId = 'skill-read'
  const events: object[] = [{ type: 'tool_execution_start', toolName: 'read', toolCallId: callId,
    args: { path: options.path ?? 'skill://focused-spec' } }]
  if (options.complete !== false) events.push({ type: 'tool_execution_end', toolName: 'read', toolCallId: callId,
    isError: options.failed === true, result: { isError: options.failed === true, content: [{ type: 'text', text: 'loader' }] } })
  return events.map(event => JSON.stringify(event)).join('\n')
}

export interface GuideTranscriptOptions {
  readonly command?: string
  readonly response?: unknown
  readonly rawOutput?: string
  readonly complete?: boolean
  readonly failed?: boolean
}

let guidanceCall = 0

export function guidanceTranscript(workspace: string, options: GuideTranscriptOptions = {}): string {
  const callId = `workflow-guide-${guidanceCall++}`
  const cli = join(workspace, 'node_modules', 'focused-spec', 'dist', 'cli.js')
  const command = options.command ?? `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} instructions --protocol 1 --topic workflow --json`
  const response = options.response ?? {
    protocolVersion: 1,
    package: { name: 'focused-spec', version: '0.6.0' },
    topic: 'workflow',
    content: WORKFLOW_GUIDANCE,
  }
  const output = options.rawOutput ?? `${JSON.stringify(response)}\n\nWall time: 0.01 seconds`
  const events: object[] = [{ type: 'tool_execution_start', toolName: 'bash', toolCallId: callId, args: { command } }]
  if (options.complete !== false) events.push({ type: 'tool_execution_end', toolName: 'bash', toolCallId: callId,
    isError: options.failed === true, result: { isError: options.failed === true,
      content: [{ type: 'text', text: output }], details: { exitCode: options.failed === true ? 1 : 0 } } })
  return events.map(event => JSON.stringify(event)).join('\n')
}

interface ArtifactTranscriptOptions {
  readonly command?: string
  readonly artifact?: string
  readonly cliComplete?: boolean
  readonly cliFailed?: boolean
  readonly readComplete?: boolean
  readonly readFailed?: boolean
  readonly readBeforeCommand?: boolean
  readonly omitCommand?: boolean
  readonly response?: unknown
  readonly rawCliOutput?: string
  readonly rawArtifactOutput?: string
}

export function artifactGuidanceTranscript(workspace: string, options: ArtifactTranscriptOptions = {}): string {
  const artifact = options.artifact ?? 'artifact://0'
  const linked = 'artifact://0'
  const cli = join(workspace, 'node_modules', 'focused-spec', 'dist', 'cli.js')
  const command = options.command ?? `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} instructions --protocol 1 --topic workflow --json`
  const response = options.response ?? {
    protocolVersion: 1,
    package: { name: 'focused-spec', version: '0.6.0' },
    topic: 'workflow',
    content: WORKFLOW_GUIDANCE,
  }
  const artifactOutput = options.rawArtifactOutput ?? JSON.stringify(response)
  const cliEvents: object[] = options.omitCommand === true ? [] : [
    { type: 'tool_execution_start', toolName: 'bash', toolCallId: 'artifact-cli', args: { command } },
    ...(options.cliComplete === false ? [] : [{ type: 'tool_execution_end', toolName: 'bash', toolCallId: 'artifact-cli',
      isError: options.cliFailed === true, result: { isError: options.cliFailed === true,
        content: [{ type: 'text', text: options.rawCliOutput ?? `{"protocolVersion":1,"package":{"name":"focused-spec","version":"0.6.0"},"topic":"workflow","content":"# Authoritative workflow…\n\n\nWall time: 0.36 seconds\n\n[Some lines truncated to 768 bytes. Read ${linked} for full output]` }],
        details: { exitCode: options.cliFailed === true ? 1 : 0 } } }]),
  ]
  const readEvents: object[] = [
    { type: 'tool_execution_start', toolName: 'read', toolCallId: 'artifact-read', args: { path: artifact } },
    ...(options.readComplete === false ? [] : [{ type: 'tool_execution_end', toolName: 'read', toolCallId: 'artifact-read',
      isError: options.readFailed === true, result: { isError: options.readFailed === true,
        content: [{ type: 'text', text: artifactOutput }] } }]),
  ]
  const events = options.readBeforeCommand === true ? [...readEvents, ...cliEvents] : [...cliEvents, ...readEvents]
  return events.map(event => JSON.stringify(event)).join('\n')
}

export async function activationFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-eval-activation-'))
  roots.push(root)
  await Promise.all([
    put(root, 'node_modules/focused-spec/package.json', JSON.stringify({ name: 'focused-spec', version: '0.6.0' })),
    put(root, 'node_modules/focused-spec/dist/cli.js', '#!/usr/bin/env node\n'),
    put(root, 'node_modules/focused-spec/guidance/workflow.md', WORKFLOW_GUIDANCE),
  ])
  await mkdir(join(root, 'node_modules/.bin'), { recursive: true })
  await symlink('../focused-spec/dist/cli.js', join(root, 'node_modules/.bin/focused-spec'))
  return root
}

interface BrownfieldFixtureOptions {
  readonly mainEvidence?: readonly string[]
  readonly workingEvidence?: readonly string[]
}

const nativeBlockedScenario = [
  '#### Scenario: Blocked account with valid credentials',
  '- **WHEN** a blocked account supplies valid credentials to either authentication function',
  '- **THEN** authentication is rejected',
].join('\n')

export const markedBlockedScenario = `<!-- focused-spec:id=auth.login.blocked-account -->\n${nativeBlockedScenario}`

export const revisedBlockedSpec = [
  '# Account authentication', '', '<!-- focused-spec:id=auth.login.blocked-account -->',
  '#### Scenario: Blocked account with valid credentials',
  '- **WHEN** a blocked account supplies valid credentials',
  '- **THEN** authentication is rejected', '',
].join('\n')

export function registry(mainScope: string, mainEvidence: readonly string[], workingEvidence: readonly string[]): string {
  const block = (scope: string, evidence: readonly string[]) => [
    `  ${scope}:`,
    '    auth.login.blocked-account:',
    '      evidence:',
    ...evidence.map(reference => `        - ${reference}`),
  ]
  return ['scopes:', ...block(mainScope, mainEvidence), ...block('add-auth', workingEvidence), ''].join('\n')
}

export async function brownfieldFixture(options: BrownfieldFixtureOptions = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-eval-brownfield-'))
  roots.push(root)
  await cp(join(repository, 'evals/fixtures/polyglot'), root, { recursive: true })
  await installFocusedPackage(root)
  await put(root, '.focused-spec/config.yaml', [
    'version: 5',
    'specifications:',
    '  formats:',
    '    markdown:',
    "      package: '@focused-spec/format-registry'",
    '      options:',
    '        parser:',
    "          package: '@focused-spec/format-markdown'",
    '  documents:',
    '    - match: openspec/specs/**/spec.md',
    '      exclude:',
    '        - openspec/specs/excluded/**',
    '      scope: current',
    '      format: markdown',
    '    - match: openspec/changes/{scope}/specs/**/spec.md',
    '      exclude:',
    '        - openspec/changes/archive/**',
    '      format: markdown',
    'runners:',
    '  go:',
    "    package: '@focused-spec/runner-go'",
    '  pytest:',
    "    package: '@focused-spec/runner-pytest'",
    '    options:',
    '      command: uv',
    '      commandArgs: [run, --with, pytest, python]',
  ].join('\n'))
  const goTest = await readFile(join(root, 'auth/auth_test.go'), 'utf8')
  await put(root, 'auth/auth_test.go', goTest.replace('TestBlockedAccount', 'TestBlockedAccountWithValidCredentials'))
  const pytest = await readFile(join(root, 'tests/functional/test_auth.py'), 'utf8')
  await put(root, 'tests/functional/test_auth.py', pytest.replace('test_blocked_account', 'test_blocked_account_with_valid_credentials'))
  const overlay = join(repository, 'evals/cases/openspec-brownfield/overlay/openspec')
  const native = await readFile(join(overlay, 'specs/account-authentication/spec.md'), 'utf8')
  if (!native.includes(nativeBlockedScenario)) throw new Error('bare OpenSpec fixture lost its blocked-account scenario')
  await cp(join(overlay, 'changes/archive/2026-09-26-reject-blocked-accounts'),
    join(root, 'openspec/changes/archive/2026-09-26-reject-blocked-accounts'), { recursive: true })
  const expected = ['go::./auth::TestBlockedAccountWithValidCredentials', 'pytest::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials']
  const mainEvidence = options.mainEvidence ?? expected
  const workingEvidence = options.workingEvidence ?? expected
  await put(root, '.focused-spec/evidence.yaml', registry('current', mainEvidence, workingEvidence))
  await put(root, 'openspec/specs/account-authentication/spec.md', native.replace(nativeBlockedScenario, markedBlockedScenario))
  await put(root, 'openspec/changes/add-auth/specs/account-authentication/spec.md', [
    '## MODIFIED Requirements',
    '### Requirement: Account authentication respects blocked status',
    native.replace(nativeBlockedScenario, markedBlockedScenario),
  ].join('\n'))
  return root
}

export async function boundaryFixture(packages: readonly string[], native: ReadonlyMap<string, string> = new Map(), config?: string): Promise<{ root: string; baseline: IntegrationBaseline }> {
  const root = await mkdtemp(join(tmpdir(), 'focused-eval-composition-'))
  roots.push(root)
  for (const name of packages) await put(root, `node_modules/${name}/package.json`, JSON.stringify({ name, version: '0.9.2' }))
  for (const [path, content] of native) await put(root, path, content)
  if (config !== undefined) await put(root, '.focused-spec/config.yaml', config)
  const candidates = new Map<string, ReadonlyMap<string, string>>()
  for (const name of packages) {
    const files = await glob('**/*', { cwd: join(root, 'node_modules', name), nodir: true })
    candidates.set(name, new Map(await Promise.all(files.map(async path => [path, createHash('sha256').update(await readFile(join(root, 'node_modules', name, path))).digest('hex')] as const))))
  }
  return { root, baseline: { files: await integrationFiles(root), protected: new Map(), candidates, native, packages: [...packages].sort(), establishedComposition: [...packages].sort(), ...(config === undefined ? {} : { config }) } }
}

export async function bankFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'focused-eval-bank-'))
  roots.push(root)
  await cp(join(repository, 'examples/scenarios/typescript'), root, { recursive: true, filter: path => !path.includes('node_modules') && !path.includes('.focused-spec') })
  const sdk = join(root, 'node_modules/@focused-spec/scenarios-typescript')
  await mkdir(sdk, { recursive: true })
  await cp(join(repository, 'packages/sdk/typescript/dist'), join(sdk, 'dist'), { recursive: true })
  await cp(join(repository, 'packages/sdk/typescript/package.json'), join(sdk, 'package.json'))
  return root
}

export function configurationWrite(): string {
  return JSON.stringify({ type: 'tool_execution_start', toolName: 'write', toolCallId: 'configuration', args: { path: '.focused-spec/config.yaml', content: 'version: 5' } })
}

export function contractTranscript(command: string, result: string, options: { complete?: boolean; failed?: boolean } = {}): string {
  const events: object[] = [{ type: 'tool_execution_start', toolName: 'bash', toolCallId: 'contract', args: { command } }]
  if (options.complete !== false) events.push({ type: 'tool_execution_end', toolName: 'bash', toolCallId: 'contract', isError: options.failed === true,
    result: { content: [{ type: 'text', text: result }], details: { exitCode: options.failed === true ? 1 : 0 } } })
  return events.map(event => JSON.stringify(event)).join('\n')
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

export class FakeDriver implements AgentDriver {
  async run(request: AgentRequest): Promise<AgentResult> {
    return {
      success: false,
      output: `fake agent rejected ${request.skills.join(',')}`,
      exitCode: 17,
      durationMs: 1,
    }
  }
}
