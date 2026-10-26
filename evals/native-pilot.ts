#!/usr/bin/env node
/** Black-box authoring pilot using the same packed focused-spec CLI exposed to evaluated agents. */
import { createHash } from 'node:crypto'
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'glob'
import { discoverDocuments, loadConfig } from '../packages/core/dist/index.js'
import { OmpAgentDriver } from './omp-agent.ts'
import { runProcess } from './process.ts'
import { createGuidanceSession, guidanceActivationGate, skillActivationGate, inspectsImplementation, mutationGate } from './judge.ts'
import { runAuthoringDialogue } from './dialogue.ts'
import type { DialogueResult } from './dialogue.ts'
import { runPlanningDialogue } from './acp-agent.ts'
import type { PlanningResult } from './acp-agent.ts'
import { interviewFailedAgent } from './diagnostic.ts'
import { nativeItemText, parseTrustedNativeDocument } from './native-parse.ts'
import type { TrustedFormat } from './native-parse.ts'
import { runAgentTurn, saveEvalResult } from './result.ts'
import type { AgentDriver, AgentRequest, AgentResult } from './types.ts'
import type { EvalDiagnostic } from './types.ts'
import { loadConfiguredRegistries } from './evidence.ts'
import { measureAgentTurns } from './activation.ts'

export function nativeMeasurements(authoring: readonly AgentResult[], lifecycle: readonly AgentResult[] = []) {
  return {
    measurements: measureAgentTurns([...authoring, ...lifecycle]),
    phaseMeasurements: {
      ...(authoring.length === 0 ? {} : { authoring: measureAgentTurns(authoring) }),
      ...(lifecycle.length === 0 ? {} : { lifecycle: measureAgentTurns(lifecycle) }),
    },
  }
}

export const nativePilotRoot = fileURLToPath(new URL('..', import.meta.url))
const root = nativePilotRoot
export function selectedKind(reference: string): 'go' | 'python' | undefined {
  if (/^go::(?:\.\/auth|auth\/auth_test\.go)::TestBlockedAccount$/u.test(reference)) return 'go'
  if (/^pytest::tests\/functional\/test_auth\.py::test_blocked_account$/u.test(reference)) return 'python'
  return undefined
}
export const nativeCases = {
  openspec: {
    path: 'openspec/changes/link-blocked-account/specs/auth/spec.md',
    text: '## ADDED Requirements\n\n### Requirement: Blocked accounts cannot authenticate\nA blocked account SHALL be rejected independently of credential validity.\n\n#### Scenario: Blocked account submits valid credentials\n- **WHEN** a blocked account submits valid credentials\n- **THEN** authentication is rejected\n',
    item: '#### Scenario: Blocked account submits valid credentials',
  },
  'spec-kit': {
    path: 'specs/001-blocked-account/spec.md',
    text: '# Feature Specification: Blocked Account Login Protection\n\n## User Scenarios & Testing *(mandatory)*\n\n### User Story 1 - Reject a Blocked Account (Priority: P1)\n\nAs an operator, I need blocked accounts to be denied login.\n\n**Acceptance Scenarios**:\n\n1. **Given** an account is blocked and credentials are valid, **When** it attempts to log in, **Then** authentication is rejected.\n\n## Requirements *(mandatory)*\n\n### Functional Requirements\n\n- **FR-001**: The system MUST reject blocked accounts.\n\n## Success Criteria *(mandatory)*\n\n### Measurable Outcomes\n\n- **SC-001**: Blocked accounts cannot create authenticated sessions.\n',
    item: '1. **Given** an account is blocked and credentials are valid, **When** it attempts to log in, **Then** authentication is rejected.',
  },
  kiro: {
    path: '.kiro/specs/blocked-login/requirements.md',
    text: '# Requirements\n\n## User Story\nAs an operator, I want blocked accounts to be denied login.\n\n### Acceptance Criteria\n\nWHEN a blocked account submits valid credentials\nTHE SYSTEM SHALL reject authentication\n',
    item: 'THE SYSTEM SHALL reject authentication',
  },
  bmad: {
    path: '_bmad-output/specs/spec-blocked-login/spec-blocked-login.md',
    text: '---\nid: SPEC-blocked-login\ncompanions: []\nsources: []\n---\n\n> **Canonical contract.** This SPEC and the files in `companions:` are the complete contract for what to build, test, and validate.\n\n# Blocked Login\n\n## Why\n\nAdministrative blocks must prevent login.\n\n## Capabilities\n\n- **CAP-1**\n  - **intent:** The authentication service rejects login for a blocked account.\n  - **success:** A blocked account with valid credentials is denied login.\n\n## Constraints\n\n- A block takes precedence over valid credentials.\n\n## Non-goals\n\n- Changing credentials.\n\n## Success signal\n\nAuthentication rejects blocked accounts with valid credentials.\n',
    item: '  - **success:** A blocked account with valid credentials is denied login.',
  },
  gsd: {
    path: '.planning/REQUIREMENTS.md',
    text: '# Requirements: Authentication\n\n**Defined:** 2026-10-09\n**Core Value:** Blocked accounts cannot authenticate.\n\n## v1 Requirements\n\n### Authentication\n\n- [ ] **AUTH-01**: A blocked account with valid credentials is denied login.\n\n## Traceability\n\n| Requirement | Phase | Status |\n|-------------|-------|--------|\n| AUTH-01 | Phase 1 | Pending |\n',
    item: '- [ ] **AUTH-01**: A blocked account with valid credentials is denied login.',
  },
  'agent-os': {
    path: 'agent-os/specs/2026-10-09-1200-blocked-login/shape.md',
    text: '# Blocked Login — Shaping Notes\n\n## Scope\n\nDeny access to blocked accounts.\n\n## Acceptance\n\n- A blocked account with valid credentials is denied login.\n',
    item: '- A blocked account with valid credentials is denied login.',
  },
  gherkin: {
    path: 'features/blocked_login.feature',
    text: 'Feature: Login protection\n\n  Scenario: Blocked account submits valid credentials\n    Given an account is blocked\n    When it submits valid credentials\n    Then authentication is rejected\n',
    item: '  Scenario: Blocked account submits valid credentials',
  },
} as const
const cases = nativeCases

export type NativeCase = keyof typeof nativeCases
export interface Gate { name: string; passed: boolean | null; detail: string; blockedBy?: string }
export const gate = (name: string, passed: boolean | null, detail: string): Gate => ({ name, passed, detail })
export type Verdict = 'passed' | 'failed' | 'unverified'
export interface NativeCheckProvenance {
  source: string
  version: string | null
  installedAsset: string | null
  assetSha256: string | null
  operation: string | null
  executed: boolean
  runtime: 'available' | 'unavailable' | 'not-applicable'
  limitation: string
}
export interface Outcome { status: Verdict; detail: string; provenance?: NativeCheckProvenance }
export const outcome = (status: Verdict, detail: string): Outcome => ({ status, detail })
export function judged(gates: Gate[], names: string[]): Outcome {
  const selected = gates.filter(item => names.includes(item.name))
  const failures = selected.filter(item => item.passed === false)
  if (failures.length > 0) return outcome('failed', failures.map(item => item.name).join(', '))
  const blocked = selected.filter(item => item.passed === null)
  return outcome(blocked.length > 0 ? 'unverified' : 'passed', blocked.map(item => item.detail).join('; ') || 'all required gates passed')
}
export function initialSpecification(name: NativeCase): string {
  return cases[name].text
    .replaceAll('with valid credentials', 'with supplied credentials')
    .replaceAll('submits valid credentials', 'submits credentials')
    .replaceAll('credentials are valid', 'credentials are supplied')
    .replaceAll('valid credentials', 'credentials')
    .replace('independently of credential validity', 'when attempting to log in')
    .replace('A block takes precedence over credentials.', 'A block prevents login.')
}
async function put(workspace: string, path: string, content: string): Promise<void> {
  const target = join(workspace, path)
  await mkdir(join(target, '..'), { recursive: true })
  await writeFile(target, content)
}
async function requireCommand(command: string, args: string[], cwd: string, timeoutMs = 120_000): Promise<void> {
  const result = await runProcess(command, args, { cwd, timeoutMs })
  if (result.code !== 0) throw new Error(`${command} ${args.join(' ')}: ${result.stderr || result.stdout}`)
}
async function packWorkspacePackage(cache: string, packageRoot: string): Promise<string> {
  const packed = await runProcess('npm', ['pack', '--ignore-scripts', '--pack-destination', cache], { cwd: packageRoot, timeoutMs: 120_000 })
  if (packed.code !== 0) throw new Error(`npm pack ${packageRoot}: ${packed.stderr || packed.stdout}`)
  const archive = packed.stdout.trim().split(/\r?\n/u).at(-1)
  if (archive === undefined || archive === '') throw new Error(`npm pack ${packageRoot} did not report an archive`)
  return join(cache, archive)
}

async function installPackedFocusedSpec(workspace: string, includeGherkin: boolean): Promise<void> {
  const cache = await mkdtemp(join(tmpdir(), 'focused-native-package-'))
  const packageNames = [
    'core',
    'formats/markdown',
    ...(includeGherkin ? ['formats/gherkin'] : []),
    'formats/inline',
    'formats/registry',
    'runners/go',
    'runners/pytest',
  ]
  try {
    const packages = await Promise.all(packageNames.map(name => packWorkspacePackage(cache, join(root, 'packages', name))))
    await requireCommand('npm', ['install', '--prefer-offline', '--ignore-scripts', '--no-save', ...packages], workspace, 180_000)
  } finally {
    await rm(cache, { recursive: true, force: true })
  }
}
export async function prepareNativeWorkspace(workspace: string, name: NativeCase, create: boolean): Promise<void> {
  await cp(join(root, 'evals/fixtures/polyglot'), workspace, { recursive: true })
  await installPackedFocusedSpec(workspace, name === 'gherkin')
  await put(workspace, '.focused-spec/config.yaml', [
    'version: 5',
    'specifications:',
    '  formats:',
    '    native:',
    "      package: '@focused-spec/format-registry'",
    '      options:',
    '        parser:',
    `          package: '@focused-spec/format-${name === 'gherkin' ? 'gherkin' : 'markdown'}'`,
    '  documents:',
    name === 'openspec' ? '    - match: openspec/changes/{scope}/specs/**/*.md'
      : `    - match: ${cases[name].path}`,
    '      format: native',
    ...(name === 'openspec' ? ['      exclude: [openspec/changes/archive/**]'] : ['      scope: current']),
    'runners:',
    '  go:',
    "    package: '@focused-spec/runner-go'",
    '    timeoutMs: 120000',
    '  pytest:',
    "    package: '@focused-spec/runner-pytest'",
    '    timeoutMs: 120000',
    '    options:',
    '      command: uv',
    '      commandArgs: [run, --with, pytest, python]',
    '',
  ].join('\n'))
  if (name === 'spec-kit') {
    await requireCommand('uvx', ['--from', 'specify-cli', 'specify', 'init', '--here', '--force', '--non-interactive', '--ignore-agent-tools', '--integration', 'generic', '--integration-options', '--commands-dir .omp/commands/'], workspace, 120_000)
    const commandPath = '.omp/commands/speckit.specify.md'
    const templatePath = '.specify/templates/spec-template.md'
    const [command, template, integration] = await Promise.all([
      readFile(join(workspace, commandPath), 'utf8'),
      readFile(join(workspace, templatePath), 'utf8'),
      readFile(join(workspace, '.specify/integration.json'), 'utf8'),
    ])
    if (!command.includes('## Outline') || !template.startsWith('# Feature Specification:')) {
      throw new Error('installed Spec Kit authoring assets do not contain the expected official workflow and template')
    }
    const metadata: unknown = JSON.parse(integration)
    if (metadata === null || typeof metadata !== 'object' || !('version' in metadata)
      || typeof metadata.version !== 'string' || metadata.version === '') {
      throw new Error('installed Spec Kit integration has no version provenance')
    }
    const version = metadata.version
    await put(workspace, '.omp/skills/speckit-specify/SKILL.md',
      `---\nname: speckit-specify\ndescription: ${JSON.stringify('Official installed Spec Kit workflow and template for creating or updating a feature specification. Use for Spec Kit specification authoring, not implementation or planning.')}\n---\n\n# Spec Kit Specify\n\nProvenance: specify-cli ${version}, installed locally at \`${commandPath}\` and \`${templatePath}\`. The official assets below are reproduced verbatim.\n\n## Official speckit.specify command\n\n${command}\n\n## Official specification template\n\n${template}`)
  }
  await mkdir(join(workspace, '.omp/skills'), { recursive: true })
  await cp(join(root, 'skills/focused-spec'), join(workspace, '.omp/skills/focused-spec'), { recursive: true })
  const fixture = cases[name]
  if (!create) await put(workspace, fixture.path, initialSpecification(name))
  if (name === 'openspec') {
    for (const skill of ['openspec-propose', 'openspec-update-change', 'openspec-apply-change', 'openspec-sync-specs', 'openspec-archive-change', 'openspec-explore']) {
      await cp(join(root, '.omp/skills', skill), join(workspace, '.omp/skills', skill), { recursive: true })
    }
    await put(workspace, 'openspec/config.yaml', 'schema: spec-driven\n')
    if (!create) {
      await put(workspace, 'openspec/changes/link-blocked-account/proposal.md', '## Why\nMake block precedence explicit for valid credentials.\n\n## What Changes\n- Clarify the existing blocked-login outcome and record exact evidence.\n')
      await put(workspace, 'openspec/changes/link-blocked-account/design.md', '## Context\nThe existing outcome does not specify the valid-credentials case.\n')
      await put(workspace, 'openspec/changes/link-blocked-account/tasks.md', '- [ ] 1. Clarify valid-credentials rejection and link evidence\n')
    }
  }
  if (name === 'kiro' || name === 'agent-os') {
    const guidance = name === 'kiro'
      ? { skill: 'kiro-requirements', url: 'https://kiro.dev/docs/specs/feature-specs/requirements-first.md',
        description: 'Official Kiro requirements-first workflow for creating or revising feature requirements in EARS format.' }
      : { skill: 'agent-os-shape-spec', url: 'https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/shape-spec.md',
        description: 'Official Agent OS shape-spec workflow for creating or revising specification planning artifacts. Requires plan mode.' }
    const response = await fetch(guidance.url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`host guidance ${guidance.url}: HTTP ${response.status}`)
    const document = await response.text()
    if (!/^#{1,6} /mu.test(document) || /<html[\s>]/iu.test(document)) throw new Error(`host guidance is not Markdown: ${guidance.url}`)
    await put(workspace, `.omp/skills/${guidance.skill}/SKILL.md`,
      `---\nname: ${guidance.skill}\ndescription: ${JSON.stringify(guidance.description)}\n---\n\nSource: ${guidance.url}\n\n${document}`)
  }
  if (name === 'agent-os') {
    await cp(join(root, 'evals/host-resources/agent-os-questions.js'), join(workspace, '.omp/extensions/agent-os-questions.js'), { recursive: true })
    await put(workspace, 'agent-os/standards/index.yml', '{}\n')
  }
  if (name === 'bmad') {
    const repo = 'https://codeload.github.com/bmad-code-org/BMAD-METHOD/tar.gz/48f0ce37e1fc378d6255c90e1b155f2212a6fe33'
    const skills = ['bmad', 'bmod-core-tools', 'bmod-method', 'bmad-spec']
    await requireCommand('npx', ['skills', 'add', repo, ...skills.flatMap(value => ['--skill', value]), '--agent', 'pi', '--copy', '-y'], workspace, 120_000)
    for (const value of skills) {
      await cp(join(workspace, '.agents/skills', value), join(workspace, '.omp/skills', value), { recursive: true })
    }
    await requireCommand('uv', ['run', '--no-cache', '.agents/skills/bmad/scripts/setup.py', '--project-root', '.', '--skill', '.agents/skills/bmad', '--root', '.agents/skills'], workspace, 120_000)
    const official = await readFile(join(workspace, '.agents/skills/bmad-spec/SKILL.md'), 'utf8')
    if (!official.includes('DERIVED from .memlog.md, never hand-edited')
      || !official.includes('Capability IDs are stable and unique.') || !official.includes('Never reused, never renumbered.')) {
      throw new Error('installed bmad-spec guidance does not contain the expected generated-kernel ownership contract')
    }
    await put(workspace, '.omp/skills/bmad-focused-spec-integration/SKILL.md', `---
name: bmad-focused-spec-integration
description: ${JSON.stringify('Host integration facts for applying focused-spec to BMad generated specification kernels. Use alongside the official bmad-spec workflow when evidence must bind to a BMad capability.')}
---

# BMad Focused-Spec Integration

Provenance: host integration of the installed official \`.agents/skills/bmad-spec/SKILL.md\` from \`${repo}\` with the installed \`focused-spec\` skill. This supplements but does not replace or modify either workflow.

- A BMad \`spec-<slug>.md\` kernel is generated from its canonical append-only \`.memlog.md\`; the official \`bmad-spec\` workflow is its single writer.
- A declared BMad \`CAP-N\` is the stable native capability identity. Preserve existing numbers; never reuse or renumber them.
- Keep the generated kernel free of focused-spec markers. Bind focused evidence externally to the generated kernel's project-relative path and its declared native \`CAP-N\`, following the installed \`focused-spec\` skill.
- Author or revise the capability only through the official \`bmad-spec\` workflow. External integration metadata must survive regeneration without becoming an input to the generated kernel.
`)
    if (!create) {
      const output = '_bmad-output/specs/spec-blocked-login'
      const script = '_bmad/scripts/memlog.py'
      await requireCommand('uv', ['run', script, 'init', '--workspace', output, '--field', 'topic=Blocked account login'], workspace)
      for (const [type, text] of [
        ['capability', 'CAP-1: A blocked account with supplied credentials is denied login.'],
        ['constraint', 'A block prevents login.'],
        ['direction', 'Changing credentials is out of scope.'],
      ] as const) await requireCommand('uv', ['run', script, 'append', '--workspace', output, '--type', type, '--text', text], workspace)
    }
  }
  if (name === 'gsd') {
    const home = join(workspace, '.home')
    await mkdir(home, { recursive: true })
    const result = await runProcess('npx', ['--yes', '@opengsd/gsd-core@1.16.0', '--local', '--pi'], {
      cwd: workspace, timeoutMs: 120_000,
      env: { ...process.env, HOME: home, npm_config_cache: join(home, '.npm') },
    })
    if (result.code !== 0) throw new Error(`GSD local install: ${result.stderr || result.stdout}`)
    for (const [skill, path, description] of [
      ['gsd-new-project', '.pi/gsd-core/workflows/new-project.md', 'GSD Core project initialization workflow installed for Pi.'],
      ['gsd-requirements', '.pi/gsd-core/templates/requirements.md', 'GSD Core requirements-format template for revising an initialized project. Initial project and requirements authoring uses the installed gsd-new-project workflow.'],
    ] as const) {
      const document = await readFile(join(workspace, path), 'utf8')
      if (/~\/\.claude\/gsd-core\//u.test(document)) throw new Error(`GSD Pi guidance contains a Claude home reference: ${path}`)
      const references = new Set([...document.matchAll(/gsd-core\/(?:references|workflows|templates)\/[a-zA-Z0-9_./-]+\.md/gu)].map(match => match[0]))
      for (const reference of references) await readFile(join(workspace, '.pi', reference), 'utf8')
      await put(workspace, `.omp/skills/${skill}/SKILL.md`,
        `---\nname: ${skill}\ndescription: ${JSON.stringify(description)}\n---\n\nSource: ${path}\n\n${document}`)
    }
  }
}
function deniesAuthentication(text: string): boolean {
  return /reject|den(?:y|ies|ied|ial)|cannot|prevent|returns false|(?:must|is|are) not (?:log\s*in|authenticated?)/iu.test(text)
}

function atomicBlockedOutcome(source: string): boolean {
  const capability = source.match(/^- \*\*CAP-1\*\*:?[ \t]*\r?\n  - \*\*intent:\*\* ([^\n]+)\n  - \*\*success:\*\* ([^\n]+)/mu)
  const intent = capability?.[1] ?? ''
  const success = capability?.[2] ?? ''
  return /block/iu.test(intent) && /valid/iu.test(success) && deniesAuthentication(success)
    && !/\b(active|unblocked|accepted)\b/iu.test(success)
}
export interface NativeBinding {
  readonly id: string
  readonly nativeId?: string
  readonly format?: TrustedFormat
}

function nativeIdentity(name: NativeCase, source: string, binding?: NativeBinding) {
  const format = binding?.format ?? (name === 'gherkin' ? 'gherkin' : 'markdown')
  const parsed = parseTrustedNativeDocument(format, cases[name].path, source, 'pilot')
  const marked = parsed.items.filter(item => item.markerId !== undefined)
  const nativeId = binding?.nativeId ?? (name === 'bmad' ? 'CAP-1' : undefined)
  const bound = nativeId !== undefined
    ? parsed.items.filter(item => item.nativeIds.includes(nativeId) && item.markerId === undefined)
    : binding === undefined ? marked : marked.filter(item => item.markerId === binding.id)
  const valid = parsed.violations.length === 0 && bound.length === 1
    && marked.length === (nativeId === undefined ? 1 : 0)
  const text = bound[0] === undefined ? '' : nativeItemText(format, source, bound[0])
  return { parsed, marked, bound, valid, text }
}

function boundNativeOutcome(name: NativeCase, source: string, text: string, boundItems: number): {
  matches: boolean
  status: 'unjudged' | 'match' | 'mismatch'
} {
  if (boundItems !== 1) return { matches: false, status: 'unjudged' }
  const matches = name === 'bmad' ? atomicBlockedOutcome(source)
    : /block/iu.test(text) && /valid/iu.test(text) && deniesAuthentication(text)
  return { matches, status: matches ? 'match' : 'mismatch' }
}

export function nativeSingleSourceGate(name: NativeCase, source: string, binding?: NativeBinding): Gate {
  const identity = nativeIdentity(name, source, binding)
  const boundOutcome = boundNativeOutcome(name, source, identity.text, identity.bound.length)
  const noDuplicate = (name !== 'openspec' || (source.match(/^#### Scenario:/gmu) ?? []).length === 1)
    && (name !== 'spec-kit' || (source.match(/^\d+\. \*\*Given\*\*/gmu) ?? []).length === 1)
  return gate('native-item-single-source', identity.valid && boundOutcome.matches && noDuplicate,
    `bound native items=${identity.bound.length} bound outcome=${boundOutcome.status} identity valid=${identity.valid} extra scenario=${!noDuplicate} parser violations=${identity.parsed.violations.length}`)
}

export function creationGate(name: NativeCase, source: string, binding?: NativeBinding): Gate {
  const identity = nativeIdentity(name, source, binding)
  const forms: Record<NativeCase, boolean> = {
    openspec: /^## ADDED Requirements$/mu.test(source) && /^### Requirement:/mu.test(source)
      && /^#### Scenario:/mu.test(source) && /^- \*\*WHEN\*\* /mu.test(source) && /^- \*\*THEN\*\* /mu.test(source),
    'spec-kit': /^### User Story /mu.test(source) && /\*\*Acceptance Scenarios\*\*/u.test(source)
      && /^\d+\. \*\*Given\*\* .*\*\*When\*\* .*\*\*Then\*\* /mu.test(source),
    kiro: /^(?:\d+\.\s+)?(?:[A-Za-z0-9][\w.-]*:\s*)?WHEN [^\n]*?\s+THE [^\r\n]+? SHALL [^\r\n]+/imu.test(identity.text),
    bmad: /^- \*\*CAP-1\*\*:?[ \t]*$/mu.test(source) && atomicBlockedOutcome(source)
      && ['## Why', '## Capabilities', '## Constraints', '## Non-goals', '## Success signal'].every(section => source.includes(section))
      && identity.marked.length === 0,
    gsd: /^- \[.\] \*\*AUTH-01\*\*:/mu.test(source),
    'agent-os': /^# [^\n]+$/mu.test(source) && /^## [^\n]+$/mu.test(source),
    gherkin: /^ *Scenario: [^\n]+/mu.test(source) && /^ *Given /mu.test(source)
      && /^ *When /mu.test(source) && /^ *Then /mu.test(source),
  }
  const boundOutcome = boundNativeOutcome(name, source, identity.text, identity.bound.length)
  const noDuplicate = (name !== 'openspec' || (source.match(/^#### Scenario:/gmu) ?? []).length === 1)
    && (name !== 'spec-kit' || (source.match(/^\d+\. \*\*Given\*\*/gmu) ?? []).length === 1)
  const passed = forms[name] && boundOutcome.matches && identity.valid && noDuplicate
  return gate('native-item-created', passed,
    `native form=${forms[name]} bound outcome=${boundOutcome.status} bound native items=${identity.bound.length} identity valid=${identity.valid} extra scenario=${!noDuplicate} parser violations=${identity.parsed.violations.length}`)
}
export function hostWorkflowGate(name: NativeCase, transcript: string, create = false, operation?: 'sync' | 'archive'): Gate {
  const skill = name === 'openspec' ? operation === 'sync' ? 'openspec-sync-specs' : operation === 'archive' ? 'openspec-archive-change' : create ? 'openspec-propose' : 'openspec-update-change'
    : name === 'spec-kit' ? 'speckit-specify'
      : name === 'kiro' ? 'kiro-requirements' : name === 'agent-os' ? 'agent-os-shape-spec'
        : name === 'gsd' ? create ? 'gsd-new-project' : 'gsd-requirements' : name === 'bmad' ? 'bmad-spec' : undefined
  const expected: Partial<Record<NativeCase, string[]>> = {
    'spec-kit': ['.specify/templates/spec-template.md', '.omp/commands/speckit.specify.md'],
    kiro: ['https://kiro.dev/docs/specs/feature-specs/requirements-first.md'],
    gsd: [create ? '.pi/gsd-core/workflows/new-project.md' : '.pi/gsd-core/templates/requirements.md'],
    'agent-os': ['https://github.com/buildermethods/agent-os/blob/main/commands/agent-os/shape-spec.md',
      'https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/shape-spec.md'],
  }
  const paths = expected[name] ?? []
  if (skill !== undefined) paths.push(`skill://${skill}`, `.omp/skills/${skill}/SKILL.md`, `.agents/skills/${skill}/SKILL.md`)
  if (name === 'gherkin') return gate('host-workflow-loaded', true, 'official Gherkin parser is the host tool')
  const reads = new Map<string, string>()
  for (const line of transcript.split('\n')) {
    try {
      const event = JSON.parse(line) as { type?: string; toolName?: string; toolCallId?: string; args?: { path?: string }; isError?: boolean; result?: { isError?: boolean } }
      if (event.type === 'tool_execution_start' && event.toolName === 'read' && event.toolCallId !== undefined && typeof event.args?.path === 'string') {
        const path = event.args.path.replace(/(?::(?:raw|-?\d+(?:[-+]\d*)?(?:,\d+(?:[-+]\d*)?)*))+$/u, '').replace(/^\.\//u, '')
        if (paths.some(candidate => path === candidate || !candidate.includes('://') && path.endsWith(`/${candidate}`))) reads.set(event.toolCallId, event.args.path)
      }
      if (event.type === 'tool_execution_end' && event.toolName === 'read' && event.toolCallId !== undefined
        && event.isError !== true && event.result?.isError !== true && reads.has(event.toolCallId)) {
        return gate('host-workflow-loaded', true, `applicable host guidance read: ${reads.get(event.toolCallId)}`)
      }
    } catch { continue }
  }
  return gate('host-workflow-loaded', false, `no successful read of applicable host guidance: ${paths.join(' or ')}`)
}

export function hostPrerequisiteGate(name: NativeCase, planning?: PlanningResult): Gate | null {
  if (name !== 'agent-os') return null
  if (planning === undefined || !planning.planModeEntered) return { name: 'host-authoring-prerequisites', passed: null,
    blockedBy: 'host-plan-mode-and-confirmation', detail: planning?.detail ?? 'unavailable: genuine ACP plan-mode and user-confirmation transport have not been established' }
  const questions = planning.interactions.some(({ question }) => question !== null && typeof question === 'object'
    && 'message' in question && typeof question.message === 'string' && !question.message.startsWith('Approve plan "'))
  return gate('host-authoring-prerequisites', planning.planApproved && questions,
    `genuine ACP plan mode entered; explicit plan approval=${planning.planApproved}; actual user questions=${questions}`)
}

export async function authoringSnapshot(workspace: string, name: NativeCase): Promise<Map<string, string>> {
  const paths = await glob([`${name === 'openspec' ? 'openspec' : 'agent-os'}/**`, '.focused-spec/**'], { cwd: workspace, nodir: true, dot: true, follow: true, nocase: false })
  const files = new Map<string, string>()
  for (const path of paths) files.set(path, await readFile(join(workspace, path), 'utf8'))
  return files
}
export async function infrastructureSnapshot(workspace: string): Promise<Map<string, string>> {
  const paths = await glob(['node_modules/focused-spec/**', 'node_modules/@focused-spec/**', '.omp/skills/**', '.omp/extensions/**', '.agents/**', '.pi/gsd-core/**'], { cwd: workspace, nodir: true, dot: true, follow: true, nocase: false })
  const files = new Map<string, string>()
  for (const path of paths) files.set(path, await readFile(join(workspace, path), 'utf8'))
  return files
}

export async function infrastructureIntegrityGate(workspace: string, before: ReadonlyMap<string, string>, transcripts: readonly string[] = []): Promise<Gate> {
  const after = await infrastructureSnapshot(workspace)
  const paths = new Set([...before.keys(), ...after.keys()])
  const changed = [...paths].filter(path => before.get(path) !== after.get(path))
  if (inspectsImplementation(workspace, transcripts)) return gate('pilot-infrastructure-integrity', false, 'agent inspected protected implementation')
  return gate('pilot-infrastructure-integrity', changed.length === 0,
    changed.length === 0 ? 'packed CLI, installed format/runner packages, host skills, and generated .agents copies unchanged' : `modified protected pilot infrastructure: ${changed.join(', ')}`)
}

export async function hostWriteConstraintGate(workspace: string, name: NativeCase, before: ReadonlyMap<string, string>): Promise<Gate> {
  const after = await authoringSnapshot(workspace, name)
  const paths = new Set([...before.keys(), ...after.keys()])
  const modified = [...paths].filter(path => before.get(path) !== after.get(path))
  return gate('host-write-constraints', modified.length === 0,
    modified.length === 0 ? 'no authoring files changed without required host approval' : `authoring files changed without required host approval: ${modified.join(', ')}`)
}
async function bmadLifecycleGate(workspace: string, transcript: string, create: boolean): Promise<Gate> {
  const memlog = await readFile(join(workspace, '_bmad-output/specs/spec-blocked-login/.memlog.md'), 'utf8').catch(() => '')
  const commands = transcript.split('\n').flatMap(line => {
    try {
      const event = JSON.parse(line) as { type?: string; toolName?: string; args?: { command?: string } }
      return event.type === 'tool_execution_start' && event.toolName === 'bash' ? [event.args?.command ?? ''] : []
    } catch { return [] }
  })
  const usedMemlog = commands.some(command => command.includes('memlog.py append'))
    && (!create || commands.some(command => command.includes('memlog.py init')))
  return gate('bmad-memlog-workflow', memlog.includes('CAP-1') && usedMemlog,
    `memlog has CAP-1=${memlog.includes('CAP-1')}; agent ${create ? 'initialized and appended' : 'appended'}=${usedMemlog}`)
}
export async function registrySnapshot(workspace: string): Promise<Readonly<Record<string, string>>> {
  const loaded = await loadConfig(workspace)
  if (loaded.config === undefined) throw new Error(loaded.violations.map(item => item.message).join('; '))
  const registry = await loadConfiguredRegistries(workspace, loaded.config)
  if (registry.violations.length > 0) throw new Error(registry.violations.map(item => `${item.path}: ${item.message}`).join('; '))
  return Object.fromEntries(await Promise.all(registry.files.map(async path => [path, await readFile(join(workspace, path), 'utf8')])))
}

export function canonicalMemlogReadGate(workspace: string, transcript: string): Gate {
  const memlog = resolve(workspace, '_bmad-output/specs/spec-blocked-login/.memlog.md')
  const kernel = resolve(workspace, cases.bmad.path)
  const pathOf = (path: string) => resolve(workspace, path.replace(/(?::(?:raw|-?\d+(?:[-+]\d*)?(?:,\d+(?:[-+]\d*)?)*))+$/u, ''))
  const reads = new Set<string>()
  let read = false
  for (const line of transcript.split('\n')) {
    try {
      const event = JSON.parse(line) as {
        type?: string; toolName?: string; toolCallId?: string
        args?: { path?: string; input?: string; command?: string }
        isError?: boolean; result?: { isError?: boolean }
      }
      if (event.type === 'tool_execution_start') {
        if (event.toolName === 'read' && event.toolCallId !== undefined && typeof event.args?.path === 'string'
          && pathOf(event.args.path) === memlog) reads.add(event.toolCallId)
        const writesKernel = event.toolName === 'write' && typeof event.args?.path === 'string' && pathOf(event.args.path) === kernel
          || event.toolName === 'edit' && typeof event.args?.input === 'string'
            && [cases.bmad.path, kernel].some(path => event.args!.input!.includes(`[${path}#`))
          || event.toolName === 'bash' && typeof event.args?.command === 'string'
            && event.args.command.includes(cases.bmad.path)
            && /(?:^|\s)(?:cp|mv|rm|touch|tee|python(?:3)?|node|bun|uv)\b|>/u.test(event.args.command)
        if (writesKernel) return gate('canonical-memlog-read', read, `canonical memlog successfully read before regeneration=${read}`)
      }
      if (event.type === 'tool_execution_end' && event.toolName === 'read' && event.toolCallId !== undefined
        && reads.has(event.toolCallId) && event.isError !== true && event.result !== undefined && event.result.isError !== true) read = true
    } catch { continue }
  }
  return gate('canonical-memlog-read', read, `canonical memlog successfully read before regeneration=${read}`)
}

async function regenerateBmad(workspace: string, model: string, driver: AgentDriver, attempted: (request: AgentRequest) => void, captured: (agent: AgentResult) => void): Promise<{ gates: Gate[]; verdict: Outcome; transcript: string }> {
  const path = cases.bmad.path
  const before = await readFile(join(workspace, path), 'utf8')
  const registry = await registrySnapshot(workspace)
  const config = await readFile(join(workspace, '.focused-spec/config.yaml'), 'utf8')
  await rm(join(workspace, path))
  const request = { workspace, model, sessionDir: join(workspace, '.omp-regeneration-sessions'), skills: ['focused-spec', 'bmad-spec'], timeoutMs: 600_000,
    prompt: `Regenerate the existing BMad specification at ${path} from its recorded decisions. No new behavior is requested.` }
  attempted(request)
  const agent = await runAgentTurn(driver, request)
  captured(agent)
  if (!agent.success) return { gates: [gate('bmad-regenerated-kernel', false, agent.output)], verdict: outcome('failed', 'regeneration agent failed'), transcript: agent.output }
  const focusedSkill = skillActivationGate(agent.output)
  const workflow = await guidanceActivationGate(workspace, [agent.output])
  const after = await readFile(join(workspace, path), 'utf8').catch(() => '')
  const binding = await evidenceGate(workspace, 'bmad', after)
  const cli = await focusedCliGates(workspace, binding)
  const registryPreserved = await registrySnapshot(workspace).then(after => JSON.stringify(after) === JSON.stringify(registry), () => false)
  const configPreserved = await readFile(join(workspace, '.focused-spec/config.yaml'), 'utf8').catch(() => '') === config
  const native = nativeIdentity('bmad', after)
  const unique = native.valid && native.parsed.items.filter(item => item.nativeIds.some(id => /^CAP-\d+$/u.test(id))).length === 1
  const hostLoaded = hostWorkflowGate('bmad', agent.output).passed
  const memlogRead = canonicalMemlogReadGate(workspace, agent.output).passed
  const singleSource = (await companionGate(workspace, 'bmad')).passed
  const productPreserved = (await Promise.all(['auth/auth.go', 'auth/auth_test.go', 'app/auth.py', 'tests/functional/test_auth.py'].map(async file =>
    await readFile(join(workspace, file), 'utf8') === await readFile(join(root, 'evals/fixtures/polyglot', file), 'utf8')))).every(Boolean)
  const cliPassed = cli.every(item => item.passed)
  const stable = agent.success && focusedSkill.passed && workflow.passed && hostLoaded && memlogRead && atomicBlockedOutcome(before) && atomicBlockedOutcome(after)
    && unique && binding.gate.passed && cliPassed && registryPreserved && configPreserved && singleSource && productPreserved
  const detail = `regeneration exit=${agent.exitCode}; focused skill=${focusedSkill.passed}; local workflow=${workflow.passed}; memlog read=${memlogRead}; CAP-1 outcome retained=${atomicBlockedOutcome(after)}; unique CAP-1=${unique}; registry unchanged=${registryPreserved}; config unchanged=${configPreserved}; binding valid=${binding.gate.passed}; CLI binding/execution=${cliPassed}; single source=${singleSource}; product preserved=${productPreserved}; host skill loaded=${hostLoaded}`
  const regeneration = gate('bmad-regenerated-kernel', stable, detail)
  return { gates: [focusedSkill, workflow, regeneration], verdict: outcome(stable ? 'passed' : 'failed', detail), transcript: agent.output }
}

export async function evaluateBmadLifecycle(workspace: string, model: string, driver: AgentDriver, authoringRequest: AgentRequest): Promise<{
  gates: Gate[]; verdict: Outcome; transcript: string; request: AgentRequest; diagnostic: EvalDiagnostic | null; turns: AgentResult[]
}> {
  let request = authoringRequest
  let transcript = ''
  const turns: AgentResult[] = []
  let phase: { gates: Gate[]; verdict: Outcome; transcript: string }
  try {
    phase = await regenerateBmad(workspace, model, driver, attempted => { request = attempted }, agent => { transcript = agent.output; turns.push(agent) })
  } catch (error) {
    const failed = await runAgentTurn({ async run() { throw error } }, request)
    phase = { gates: [gate('bmad-regenerated-kernel', false, failed.output)], verdict: outcome('failed', failed.output), transcript: [transcript, failed.output].join('\n') }
  }
  const diagnostic = phase.gates.some(item => item.passed === false)
    ? await interviewFailedAgent(request, phase.gates, 'Regenerate the existing BMad specification from its recorded decisions.', driver) : null
  return { ...phase, request, diagnostic, turns }
}

export async function companionGate(workspace: string, name: NativeCase, binding?: NativeBinding): Promise<Gate> {
  const paths = await glob(['**/*.md', '**/*.feature'], {
    cwd: workspace, nodir: true, dot: true, follow: true, nocase: false,
    ignore: ['node_modules/**', '.omp/**', '.omp-*-sessions/**', '.agents/**', '.specify/**', '.pi/gsd-core/**', '.home/.npm/**'],
  })
  const companions = paths.filter(path => /(?:^|\/)scenarios\.(?:md|feature)$/u.test(path)).sort()
  const matches: { path: string; count: number }[] = []
  const violations: string[] = []
  let occurrences = 0
  for (const path of paths) {
    const content = await readFile(join(workspace, path), 'utf8')
    const format = path.endsWith('.feature') ? 'gherkin' : binding?.format === 'inline' ? 'inline' : 'markdown'
    const document = parseTrustedNativeDocument(format, path, content, 'current', workspace)
    let count = 0
    for (const item of document.items) {
      if (item.markerId !== undefined || item.nativeIds.includes(binding?.nativeId ?? (name === 'bmad' ? 'CAP-1' : ''))) count += 1
    }
    for (const violation of document.violations) violations.push(`${path}:${violation.line ?? 1}: ${violation.message}`)
    occurrences += count
    if (count > 0) matches.push({ path, count })
  }
  const passed = companions.length === 0 && occurrences === 1 && violations.length === 0
  const matched = matches.sort((left, right) => left.path.localeCompare(right.path))
    .map(item => `${item.path} (${item.count})`).join(', ') || 'none'
  return gate('one-behavior-source', passed, `native item occurrences=${occurrences}; companion files=${companions.join(', ') || 'none'}${passed ? '' : `; matched behavior paths=${matched}; native violations=${violations.join('; ') || 'none'}`}`)
}

function testCommand(reference: string): { command: string; args: string[]; assertion: string } {
  return selectedKind(reference) === 'go'
    ? { command: 'go', args: ['test', './auth', '-run', '^TestBlockedAccount$', '-count=1', '-v'], assertion: 'blocked account authenticated' }
    : { command: 'uv', args: ['run', '--with', 'pytest', 'python', '-m', 'pytest', '-q', 'tests/functional/test_auth.py::test_blocked_account'], assertion: 'assert True is False' }
}
export function agentEvidenceGate(transcript: string, references: string[]): Gate {
  if (references.length === 0) return { name: 'agent-executed-selected-evidence', passed: null,
    blockedBy: 'normalized-evidence', detail: 'not judged: no valid normalized evidence selection; this does not mean no test ran' }
  const starts = new Map<string, string>()
  const completed: { command: string; output: string }[] = []
  for (const line of transcript.split('\n')) {
    try {
      const event = JSON.parse(line) as { type?: string; toolName?: string; toolCallId?: string; isError?: boolean;
        args?: { command?: string }; result?: { isError?: boolean; details?: { exitCode?: number }; content?: { type?: string; text?: string }[] } }
      if (event.toolName !== 'bash' || event.toolCallId === undefined) continue
      if (event.type === 'tool_execution_start' && event.args?.command !== undefined) starts.set(event.toolCallId, event.args.command)
      const command = starts.get(event.toolCallId)
      if (event.type === 'tool_execution_end' && command !== undefined && event.isError !== true && event.result?.isError !== true
        && (event.result?.details?.exitCode ?? 0) === 0) {
        completed.push({ command, output: (event.result?.content ?? []).filter(part => part.type === 'text').map(part => part.text ?? '').join('\n') })
      }
    } catch { /* Only structured tool events establish execution. */ }
  }
  const cliRun = /(?:^|&&|;)\s*(?:(?:(?:npx|npm exec)(?:\s+--[\w-]+)*\s+)?(?:\S*\/)?focused-spec\s+(?:run\b|transition\s+prepare\b)|node\s+\S*focused-spec\/dist\/cli\.js\s+(?:run\b|transition\s+prepare\b))/u
  const executed = references.every(reference => completed.some(({ command, output }) => {
    if (/^(?:\S*\/)?(?:python(?:3)?|node|bun)\s+\S+\.(?:py|[cm]?js|ts)(?:\s|$)/u.test(command)) {
      for (const match of output.matchAll(/(?:^|\n)[ \t]*(\{[^\n]*\}|\{\r?\n[\s\S]*?\r?\n\})/gu)) {
        try {
          const result: unknown = JSON.parse(match[1]!)
          if (result === null || typeof result !== 'object' || !('success' in result) || result.success !== true
            || !('executionStarted' in result) || result.executionStarted !== true
            || !('scenarios' in result) || !Array.isArray(result.scenarios)) continue
          if (result.scenarios.some(scenario => scenario !== null && typeof scenario === 'object'
            && typeof scenario.scope === 'string' && typeof scenario.id === 'string' && scenario.status === 'PASS'
            && Array.isArray(scenario.evidence) && scenario.evidence.some((evidence: unknown) => evidence !== null
              && typeof evidence === 'object' && 'reference' in evidence && evidence.reference === reference
              && 'status' in evidence && evidence.status === 'PASS'))) return true
        } catch { /* A wrapper must expose complete executed results, not previews or commands. */ }
      }
    }
    if (cliRun.test(command) && !/(?:^|\s)(?:--help|-h)(?:\s|$)/u.test(command)) {
      if (output.split('\n').some(line => line.trim() === `PASS ${reference}`)) return true
      try {
        const result = JSON.parse(output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1)) as {
          success?: boolean; executionStarted?: boolean
          scenarios?: { evidence?: { reference?: string; status?: string }[] }[]
          execution?: { scenarios?: { evidence?: { reference?: string; status?: string }[] }[] }
        }
        const scenarios = result.execution?.scenarios ?? result.scenarios
        if (result.success === true && result.executionStarted === true && scenarios?.some(scenario =>
          scenario.evidence?.some(evidence => evidence.reference === reference && evidence.status === 'PASS'))) return true
      } catch { /* Non-JSON CLI output is checked through exact evidence rows above. */ }
    }
    const [, target, selector] = reference.split('::')
    if (target === undefined || selector === undefined) return false
    const tokens = command.match(/'[^']*'|"[^"]*"|[^\s]+/gu)?.map(token => token.replace(/^['"]|['"]$/gu, '')) ?? []
    if (selectedKind(reference) === 'go') {
      const run = tokens.indexOf('-run')
      const exact = run >= 0 ? tokens[run + 1] : tokens.find(token => token.startsWith('-run='))?.slice(5)
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
      return /(?:^|&&|;)\s*go\s+test\b/u.test(command) && tokens.includes(target)
        && exact === `^${selector}$` && new RegExp(`^=== RUN\\s+${escaped}$`, 'mu').test(output)
        && new RegExp(`^--- PASS: ${escaped}(?: \\(|$)`, 'mu').test(output)
    }
    const node = `${target}::${selector}`
    return /(?:^|&&|;)\s*(?:uv\s+run\s+[^;&]*|python(?:3)?\s+-m\s+)?pytest\b/u.test(command)
      && tokens.includes(node) && output.split('\n').some(line => line.startsWith(`${node} PASSED`))
  }))
  return gate('agent-executed-selected-evidence', executed, executed ? references.join(', ') : 'no completed matching test execution in agent transcript')
}
export async function sensitivityGate(workspace: string, references: string[]): Promise<Gate> {
  if (references.length === 0) return { name: 'selected-test-sensitivity', passed: null,
    blockedBy: 'normalized-evidence', detail: 'not run: no valid normalized evidence selection for a sensitivity probe' }
  const results = []
  for (const reference of references) {
    const file = join(workspace, selectedKind(reference) === 'go' ? 'auth/auth.go' : 'app/auth.py')
    const original = await readFile(file, 'utf8')
    const mutated = selectedKind(reference) === 'go'
      ? original.replace('return credentialsValid && !blocked', 'return credentialsValid')
      : original.replace('return credentials_valid and not blocked', 'return credentials_valid')
    if (mutated === original) { results.push(`${reference}: mutation target missing`); continue }
    try {
      await writeFile(file, mutated)
      const spec = testCommand(reference)
      const test = await runProcess(spec.command, spec.args, { cwd: workspace, timeoutMs: 60_000 })
      results.push(`${reference}: ${test.code !== 0 && test.stdout.includes(spec.assertion) ? 'assertion failed as expected' : `not mutation-sensitive: ${(test.stderr || test.stdout).trim()}`}`)
    } finally { await writeFile(file, original) }
  }
  return gate('selected-test-sensitivity', results.length === references.length && results.every(result => result.endsWith('assertion failed as expected')), results.join('; '))
}
export async function evidenceGate(workspace: string, name: NativeCase, sourceText: string, expectedScope?: string): Promise<{
  gate: Gate
  references: string[]
  scope?: string
  id?: string
  binding?: NativeBinding
}> {
  try {
    const loaded = await loadConfig(workspace)
    if (loaded.config === undefined) throw new Error(loaded.violations.map(item => item.message).join('; '))
    const discovery = await discoverDocuments(workspace, loaded.config, expectedScope)
    if (discovery.violations.length > 0) throw new Error(discovery.violations.map(item => `${item.path}${item.line === undefined ? '' : `:${item.line}`}: ${item.message}`).join('; '))
    const candidates = [...discovery.scopes.values()].flat().flatMap(document => document.scenarios)
      .filter(item => expectedScope === undefined || item.scope === expectedScope)
    if (candidates.length !== 1) throw new Error(`expected one${expectedScope === undefined ? '' : ` ${expectedScope}`} normalized occurrence; found ${candidates.length}`)
    const scenario = candidates[0]!
    const registry = await loadConfiguredRegistries(workspace, loaded.config, scenario.scope, scenario.id)
    if (registry.violations.length > 0) throw new Error(registry.violations.map(item => `${item.path}${item.line === undefined ? '' : `:${item.line}`}: ${item.message}`).join('; '))
    const entries = registry.entries.filter(entry => entry.scope === scenario.scope && entry.id === scenario.id)
    if (entries.length > 1) throw new Error('normalized occurrence has competing registry entries')
    const entry = entries[0]
    const format = entry === undefined ? 'inline' : name === 'gherkin' ? 'gherkin' : 'markdown'
    const parsed = parseTrustedNativeDocument(format, scenario.path, sourceText, scenario.scope, workspace)
    if (entry !== undefined) {
      if (/^\s*- \*\*(?:ID|EVIDENCE)\*\*:/mu.test(sourceText)) throw new Error('registry-backed native source contains inline ID or EVIDENCE rows')
      if (parsed.violations.length > 0) throw new Error(parsed.violations.map(item => item.message).join('; '))
      if (name === 'bmad') {
        if (entry.source?.path !== cases.bmad.path || entry.source.nativeId !== 'CAP-1') {
          throw new Error('source binding must name the generated specification path and nativeId CAP-1')
        }
        const claims = parsed.items.filter(item => item.nativeIds.includes(entry.source!.nativeId))
        if (claims.length !== 1 || parsed.items.some(item => item.markerId !== undefined)) {
          throw new Error(`source binding requires one explicit native CAP-1 declaration and no focused marker; found ${claims.length}`)
        }
      } else {
        const bound = entry.source === undefined
          ? parsed.items.filter(item => item.markerId === scenario.id)
          : parsed.items.filter(item => item.nativeIds.includes(entry.source!.nativeId) && item.markerId === undefined)
        if (entry.source !== undefined && entry.source.path !== scenario.path) throw new Error('external binding must name the selected native source path')
        if (bound.length !== 1) throw new Error(`registry ID ${scenario.id} must bind one native item; found ${bound.length}`)
      }
    } else {
      const lines = sourceText.split(/\r?\n/u)
      if (name === 'gherkin' || lines.filter(line => line === `- **ID**: \`${scenario.id}\``).length !== 1
        || scenario.evidence.some(reference => !lines.includes(`- **EVIDENCE**: \`${reference}\``))) {
        throw new Error('inline occurrence does not preserve its exact ID and EVIDENCE rows')
      }
    }
    const references = [...scenario.evidence]
    if (references.length === 0 || references.length > 2) throw new Error('evidence must contain one or two exact test references')
    if (!references.every(value => selectedKind(value) !== undefined)) {
      throw new Error('evidence selector must identify TestBlockedAccount or test_blocked_account with a valid runner ID')
    }
    if (new Set(references.map(value => selectedKind(value))).size !== references.length) throw new Error('evidence repeats the same selected test')
    const representation = entry === undefined ? 'inline' : 'registry'
    const binding: NativeBinding = { id: scenario.id, format, ...(entry?.source === undefined ? {} : { nativeId: entry.source.nativeId }) }
    return { gate: gate('normalized-evidence', true, `${scenario.scope}/${scenario.id} (${representation}): ${references.join(', ')}`), references, scope: scenario.scope, id: scenario.id, binding }
  } catch (error) {
    return { gate: gate('normalized-evidence', false, `evidence rejected: ${String(error)}`), references: [] }
  }
}

export async function focusedCliGates(workspace: string, selection: { scope?: string; id?: string; references: string[] }): Promise<Gate[]> {
  if (selection.scope === undefined || selection.id === undefined || selection.references.length === 0) {
    return ['focused-cli-validation', 'focused-cli-execution'].map(name => ({
      name, passed: null, blockedBy: 'normalized-evidence', detail: 'not run: normalized evidence selection unavailable',
    }))
  }
  const cli = join(workspace, 'node_modules', 'focused-spec', 'dist', 'cli.js')
  const validation = await runProcess(process.execPath,
    [cli, 'validate', '--strict', '--scope', selection.scope, '--json'], { cwd: workspace, timeoutMs: 120_000 })
  let validationPayload: { valid?: boolean; scenarios?: number; plannedEvidence?: number; targets?: number } = {}
  try { validationPayload = JSON.parse(validation.stdout) as typeof validationPayload } catch { /* reported below */ }
  const validationPassed = validation.code === 0 && validationPayload.valid === true && validationPayload.scenarios === 1
    && validationPayload.plannedEvidence === 0 && validationPayload.targets === selection.references.length
  const execution = await runProcess(process.execPath,
    [cli, 'run', '--scope', selection.scope, '--scenario', selection.id, '--json'], { cwd: workspace, timeoutMs: 120_000 })
  let executionPayload: { executionStarted?: boolean; scenarios?: { scope: string; id: string; status: string; evidence: { reference: string; status: string }[] }[] } = {}
  try { executionPayload = JSON.parse(execution.stdout) as typeof executionPayload } catch { /* reported below */ }
  const matches = executionPayload.scenarios?.filter(item => item.scope === selection.scope && item.id === selection.id) ?? []
  const executionPassed = execution.code === 0 && executionPayload.executionStarted === true && matches.length === 1
    && matches[0]!.status === 'PASS' && matches[0]!.evidence.length === selection.references.length
    && selection.references.every(reference => matches[0]!.evidence.some(item => item.reference === reference && item.status === 'PASS'))
  return [
    gate('focused-cli-validation', validationPassed, (validation.stdout || validation.stderr).trim()),
    gate('focused-cli-execution', executionPassed, (execution.stdout || execution.stderr).trim()),
  ]
}
export async function nativeGate(workspace: string, name: NativeCase): Promise<{ gate: Gate | null; verdict: Outcome }> {
  const contracts = {
    openspec: { source: 'https://github.com/Fission-AI/OpenSpec', asset: '.omp/skills/openspec-archive-change/SKILL.md', limitation: 'Native change validation; publication/archive is independently judged.' },
    gherkin: { source: 'https://github.com/cucumber/gherkin', asset: 'node_modules/@cucumber/gherkin/package.json', limitation: 'Syntax only; no step definitions or Cucumber execution/lifecycle are provisioned.' },
    'spec-kit': { source: 'https://github.com/github/spec-kit', asset: '.specify/integration.json', limitation: 'Installed specify-cli authoring/templates expose no applicable standalone specification validator in this fixture; check installs tools, not specification validity.' },
    kiro: { source: 'https://kiro.dev/docs/specs/feature-specs/requirements-first.md', asset: '.omp/skills/kiro-requirements/SKILL.md', limitation: 'Only official requirements-first guidance is installed; no Kiro IDE/CLI spec runtime is provisioned.' },
    bmad: { source: 'https://github.com/bmad-code-org/BMAD-METHOD/tree/48f0ce37e1fc378d6255c90e1b155f2212a6fe33', asset: '.omp/skills/bmad-spec/SKILL.md', limitation: 'Official generated-kernel workflow and memlog tools provide no standalone format validator; real regeneration is a separate lifecycle check.' },
    gsd: { source: 'https://github.com/open-gsd/gsd-core', asset: '.omp/skills/gsd-requirements/SKILL.md', limitation: 'The pinned GSD Core 1.16.0 authoring assets do not provide an applicable standalone validator for this isolated REQUIREMENTS.md fixture; verify/ship needs its broader project runtime.' },
    'agent-os': { source: 'https://github.com/buildermethods/agent-os/blob/main/commands/agent-os/shape-spec.md', asset: '.omp/skills/agent-os-shape-spec/SKILL.md', limitation: 'Official shape-spec guidance runs with genuine ACP plan/approval transport; no standalone shape.md validator or publication command is installed.' },
  } satisfies Record<NativeCase, { source: string; asset: string; limitation: string }>
  const contract = contracts[name]
  const asset = await readFile(join(workspace, contract.asset), 'utf8').catch(() => undefined)
  const provenance: NativeCheckProvenance = { source: contract.source, version: null,
    installedAsset: asset === undefined ? null : contract.asset, assetSha256: asset === undefined ? null : createHash('sha256').update(asset).digest('hex'),
    operation: null, executed: false, runtime: 'not-applicable', limitation: contract.limitation }
  if ((name === 'spec-kit' || name === 'gherkin') && asset !== undefined) {
    try { const parsed = JSON.parse(asset) as { version?: unknown }; if (typeof parsed.version === 'string') provenance.version = parsed.version } catch { /* Unknown installed version remains unknown. */ }
  }
  if (name !== 'openspec' && name !== 'gherkin') {
    return { gate: null, verdict: { ...outcome('unverified', contract.limitation), provenance } }
  }
  try {
    if (name === 'openspec') {
      provenance.operation = 'openspec validate link-blocked-account --strict --no-interactive'
      const version = await runProcess('openspec', ['--version'], { cwd: workspace, timeoutMs: 30_000 })
      provenance.version = version.code === 0 ? version.stdout.trim() : null
      const result = await runProcess('openspec', ['validate', 'link-blocked-account', '--strict', '--no-interactive'], { cwd: workspace, timeoutMs: 60_000 })
      provenance.executed = true
      provenance.runtime = 'available'
      return { gate: gate('host-validation', result.code === 0, `${provenance.operation}: ${(result.stderr || result.stdout).trim()}`),
        verdict: { ...outcome(result.code === 0 ? 'passed' : 'failed', provenance.operation), provenance } }
    }
    provenance.operation = '@cucumber/gherkin Parser.parse(features/blocked_login.feature)'
    if (asset === undefined) return { gate: null, verdict: { ...outcome('unverified', 'official Gherkin parser package is unavailable in this fixture'), provenance: { ...provenance, runtime: 'unavailable' } } }
    const source = `import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin'; import { IdGenerator } from '@cucumber/messages'; import { readFileSync } from 'node:fs'; const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher()); const feature = parser.parse(readFileSync('features/blocked_login.feature', 'utf8')).feature; if (feature?.children.length !== 1) process.exit(1);`
    const result = await runProcess(process.execPath, ['--input-type=module', '-e', source], { cwd: workspace, timeoutMs: 30_000 })
    provenance.executed = true
    provenance.runtime = 'available'
    return { gate: gate('host-validation', result.code === 0, result.code === 0 ? 'official Gherkin parser accepted one scenario' : (result.stderr || result.stdout).trim()),
      verdict: { ...outcome(result.code === 0 ? 'passed' : 'failed', 'official @cucumber/gherkin parser (syntax only)'), provenance } }
  } catch (error) {
    const unavailable = error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
    provenance.runtime = unavailable ? 'unavailable' : 'available'
    provenance.executed = !unavailable
    return { gate: unavailable ? null : gate('host-validation', false, String(error)),
      verdict: { ...outcome(unavailable ? 'unverified' : 'failed', `${provenance.operation}: ${String(error)}`), provenance } }
  }
}
export async function behaviorGate(workspace: string, references: string[]): Promise<Gate> {
  if (references.length === 0) return { name: 'selected-test-executes', passed: null,
    blockedBy: 'normalized-evidence', detail: 'not run: no valid normalized evidence selection for evidence execution' }
  const results = []
  for (const reference of references) {
    const spec = testCommand(reference)
    const test = await runProcess(spec.command, spec.args, { cwd: workspace, timeoutMs: 60_000 })
    const passed = test.code === 0 && (selectedKind(reference) === 'go' ? test.stdout.includes('--- PASS: TestBlockedAccount') : test.stdout.includes('1 passed'))
    results.push({ reference, passed, output: (test.stderr || test.stdout).trim() })
  }
  return gate('selected-test-executes', results.every(result => result.passed), results.map(result => `${result.reference}: ${result.output}`).join('\n'))
}

export interface NativePublicationCheckpoint {
  readonly id: string
  readonly scope: string
  readonly references: string[]
}

export async function nativePublishedEvidence(workspace: string, checkpoint: NativePublicationCheckpoint): Promise<Gate[]> {
  const loaded = await loadConfig(workspace)
  if (loaded.config === undefined) return [gate('lifecycle-final-binding', false, loaded.violations.map(item => item.message).join('; '))]
  const discovery = await discoverDocuments(workspace, loaded.config)
  const documents = [...discovery.scopes.values()].flat()
  const final = documents.filter(document => document.path.startsWith('openspec/specs/') && document.scenarios.length > 0)
  if (discovery.violations.length > 0 || final.length !== 1 || documents.some(document => document.path.startsWith('openspec/changes/') && document.scenarios.length > 0)) {
    return [gate('lifecycle-final-binding', false, 'expected one independently enrolled final document and no selected working occurrence')]
  }
  const document = final[0]!
  const source = await readFile(join(workspace, document.path), 'utf8')
  const evidence = await evidenceGate(workspace, 'openspec', source, document.scope)
  const native = nativeSingleSourceGate('openspec', source, evidence.binding)
  const stable = evidence.gate.passed && native.passed && evidence.id === checkpoint.id
    && JSON.stringify(evidence.references) === JSON.stringify(checkpoint.references)
  const gates = [gate('lifecycle-final-binding', stable, `${evidence.gate.detail}; native=${native.detail}; frozen identity/references=${stable}`)]
  if (!stable) return gates
  gates.push(...(await focusedCliGates(workspace, evidence)).map(item => ({ ...item, name: `lifecycle-${item.name}` })))
  const host = await runProcess('openspec', ['validate', '--specs', '--strict', '--no-interactive'], { cwd: workspace, timeoutMs: 60_000 })
  gates.push(gate('lifecycle-host-validation', host.code === 0, `openspec validate --specs --strict --no-interactive: ${host.stdout || host.stderr}`))
  const completed = await runProcess(process.execPath,
    [join(workspace, 'node_modules/focused-spec/dist/cli.js'), 'run', '--scope', evidence.scope!, '--json'], { cwd: workspace, timeoutMs: 120_000 })
  let completedPayload: { success?: boolean; executionStarted?: boolean } = {}
  try { completedPayload = JSON.parse(completed.stdout) as typeof completedPayload } catch { /* Invalid output fails the completed-scope check. */ }
  gates.push(gate('lifecycle-completed-scope', completed.code === 0 && completedPayload.success === true && completedPayload.executionStarted === true,
    (completed.stdout || completed.stderr).trim()))
  const mutation = await mutationGate(workspace, {
    id: 'native-openspec-publication', description: 'native published blocked-login evidence', source: 'openspec', turns: [],
    expectedEvidenceCount: checkpoint.references.length, expectedSelectorFragments: [],
  }, evidence.scope, checkpoint.id)
  gates.push({ ...mutation, name: 'lifecycle-final-sensitivity' })
  return gates
}

function completedNativeArchive(transcript: string): boolean {
  const starts = new Set<string>()
  for (const line of transcript.split('\n')) {
    try {
      const event = JSON.parse(line) as { type?: string; toolName?: string; toolCallId?: string; args?: { command?: string }; isError?: boolean;
        result?: { isError?: boolean; details?: { exitCode?: number } } }
      if (event.toolName !== 'bash' || event.toolCallId === undefined) continue
      const command = event.args?.command
      if (event.type === 'tool_execution_start' && command !== undefined) {
        const tokens = command.match(/'[^']*'|"[^"]*"|[^\s]+/gu)?.map(token => token.replace(/^['"]|['"]$/gu, '')) ?? []
        const cli = /(?:^|&&|;)\s*(?:(?:npx(?:\s+--[\w-]+)*\s+)?(?:\S*\/)?openspec|node\s+\S*openspec(?:\.js|\/bin\/openspec\.js))\s+archive\b/u.test(command)
          && tokens.includes('link-blocked-account') && !tokens.some(token => ['--help', '-h', '--no-validate'].includes(token))
        const move = tokens.findIndex(token => token === 'mv' || token.endsWith('/mv'))
        const paths = move < 0 ? [] : tokens.slice(move + 1).filter(token => !token.startsWith('-'))
        const officialMove = paths.length === 2 && /(?:^|\/)openspec\/changes\/link-blocked-account\/?$/u.test(paths[0]!)
          && /(?:^|\/)openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-link-blocked-account\/?$/u.test(paths[1]!)
        if (cli || officialMove) starts.add(event.toolCallId)
      }
      if (event.type === 'tool_execution_end' && starts.has(event.toolCallId)
        && event.isError !== true && event.result?.isError !== true && (event.result?.details?.exitCode ?? 0) === 0) return true
    } catch { /* Only a completed host command establishes the archive operation. */ }
  }
  return false
}

export async function evaluateOpenSpecLifecycle(workspace: string, model: string, driver: AgentDriver) {
  const request: AgentRequest = { workspace, model, sessionDir: join(workspace, '.omp-lifecycle-sessions'),
    skills: ['focused-spec', 'openspec-sync-specs', 'openspec-archive-change'], timeoutMs: 600_000,
    prompt: 'Publish the completed link-blocked-account change into the main specifications and archive it through the OpenSpec workflow. Preserve its existing blocked-account outcome and complete the surviving project integration. No new behavior or changes to application code or tests are requested.' }
  const gates: Gate[] = []
  const turns: AgentResult[] = []
  const guidance = createGuidanceSession(workspace)
  const observations = () => guidance.observations.map(item => ({ ...item, name: `lifecycle-${item.name}` }))
  let transcript = ''
  let checkpoint: NativePublicationCheckpoint | undefined
  try {
    const source = await readFile(join(workspace, cases.openspec.path), 'utf8').catch(() => '')
    const selected = await evidenceGate(workspace, 'openspec', source)
    const native = nativeSingleSourceGate('openspec', source, selected.binding)
    const working = await focusedCliGates(workspace, selected)
    const valid = selected.gate.passed && native.passed && working.every(item => item.passed === true)
      && selected.scope !== undefined && selected.id !== undefined
    gates.push(gate('lifecycle-working-checkpoint', valid, `${selected.gate.detail}; ${native.detail}; ${working.map(item => `${item.name}=${item.passed}: ${item.detail}`).join('; ')}`))
    if (!valid) return { gates, observations: observations(), verdict: outcome('unverified', 'publication blocked by failed working checkpoint'), transcript, request, turns, checkpoint }
    checkpoint = { scope: selected.scope!, id: selected.id!, references: selected.references }
    const protectedFiles = await infrastructureSnapshot(workspace)
    const product = await Promise.all(['auth/auth.go', 'auth/auth_test.go', 'app/auth.py', 'tests/functional/test_auth.py']
      .map(async path => [path, await readFile(join(workspace, path), 'utf8')] as const))
    const dialogue = await runAuthoringDialogue(request, { async run(request) {
      const agent = await runAgentTurn(driver, request)
      if (agent.success && request.skills.length > 0) await guidance.record(request, agent.output)
      return agent
    } }, () => authoringSnapshot(workspace, 'openspec'), false)
    turns.push(...dialogue.turns.map(turn => turn.scoredAgent))
    transcript = dialogue.agent.output
    gates.push(gate('lifecycle-agent-turn', dialogue.agent.success && dialogue.completed, dialogue.detail))
    if (!dialogue.agent.success) return { gates, observations: observations(), verdict: outcome('failed', 'native publication agent failed'), transcript, request, turns, checkpoint }
    gates.push({ ...skillActivationGate(transcript), name: 'lifecycle-focused-skill-loaded' },
      { ...guidance.verdict(), name: 'lifecycle-focused-workflow-acquired' })
    gates.push(...(['sync', 'archive'] as const).map(operation => ({
      ...hostWorkflowGate('openspec', transcript, false, operation), name: `lifecycle-host-${operation}-guidance`,
    })))
    const archive = await glob('openspec/changes/archive/*-link-blocked-account/specs/**/spec.md', { cwd: workspace, nodir: true })
    const active = await glob('openspec/changes/link-blocked-account/specs/**/spec.md', { cwd: workspace, nodir: true })
    const version = await runProcess('openspec', ['--version'], { cwd: workspace, timeoutMs: 30_000 })
    gates.push(gate('lifecycle-host-archive', archive.length > 0 && active.length === 0 && completedNativeArchive(transcript),
      `OpenSpec ${version.stdout.trim()}; source=https://github.com/Fission-AI/OpenSpec; archived=${archive.join(', ')}; active=${active.length}; completed host archive=${completedNativeArchive(transcript)}`))
    gates.push(...await nativePublishedEvidence(workspace, checkpoint))
    const preserved = (await Promise.all(product.map(async ([path, original]) => await readFile(join(workspace, path), 'utf8') === original))).every(Boolean)
    gates.push(gate('lifecycle-product-preserved', preserved, 'application and selected test bytes compared with pre-transition snapshot'),
      { ...await infrastructureIntegrityGate(workspace, protectedFiles, [transcript]), name: 'lifecycle-infrastructure-integrity' })
    return { gates, observations: observations(), verdict: outcome(gates.every(item => item.passed === true) ? 'passed' : 'failed', gates.filter(item => item.passed !== true).map(item => item.name).join(', ') || 'working evidence, genuine archive and surviving evidence independently passed'), transcript, request, turns, checkpoint }
  } catch (error) {
    gates.push(gate('lifecycle-evaluation-error', false, String(error)))
    return { gates, observations: observations(), verdict: outcome('failed', String(error)), transcript, request, turns, checkpoint }
  }
}

export async function evaluateNativePilot(name: NativeCase, model: string, keep: boolean, create: boolean): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), `focused-native-${name}-`))
  const sessionDir = join(workspace, '.omp-eval-sessions')
  const gates: Gate[] = []
  const observations: Gate[] = []
  let validation = outcome('unverified', 'native validation not attempted')
  let lifecycle = outcome('unverified', 'no independent host lifecycle transition exercised')
  let transcript = ''
  let regenerationTranscript = ''
  let lifecycleTranscript = ''
  let publicationCheckpoint: NativePublicationCheckpoint | undefined
  const authoringTurns: AgentResult[] = []
  const lifecycleTurns: AgentResult[] = []
  let dialogue: DialogueResult | null = null
  let planning: PlanningResult | null = null
  let lastRequest: AgentRequest | undefined
  const driver = new OmpAgentDriver()
  const authoringGuidance = name === 'agent-os' ? null : createGuidanceSession(workspace)
  let lifecycleDiagnostic: EvalDiagnostic | null = null
  try {
    await prepareNativeWorkspace(workspace, name, create)
    const protectedInfrastructure = await infrastructureSnapshot(workspace)
    const fixture = cases[name]
    const prompt = create
      ? `Create a ${name} specification for this project at ${fixture.path}: an account blocked by an administrator must not log in even with valid credentials. The implementation and tests already exist.`
      : `Update the existing ${name} specification at ${fixture.path}: clarify that a blocked account must be rejected even when its credentials are valid. The implementation and tests already exist.`
    const skills = name === 'openspec' ? ['focused-spec', 'openspec-propose', 'openspec-update-change', 'openspec-apply-change', 'openspec-explore']
      : name === 'spec-kit' ? ['focused-spec', 'speckit-specify']
        : name === 'bmad' ? ['focused-spec', 'bmad-spec', 'bmad-focused-spec-integration']
          : name === 'gsd' ? ['focused-spec', 'gsd-new-project', 'gsd-requirements']
            : name === 'kiro' ? ['focused-spec', 'kiro-requirements']
              : name === 'agent-os' ? ['focused-spec', 'agent-os-shape-spec'] : ['focused-spec']
    const safeDriver: AgentDriver = { async run(request) {
      const agent = await runAgentTurn(driver, request)
      if (agent.success && request.skills.length > 0) await authoringGuidance?.record(request, agent.output)
      return agent
    } }
    const request = { workspace, sessionDir, prompt, skills, model, timeoutMs: 600_000 }
    lastRequest = request
    try {
    if (name === 'agent-os') planning = await runPlanningDialogue(request, () => authoringSnapshot(workspace, name))
    const prerequisite = hostPrerequisiteGate(name, planning ?? undefined)
    if (prerequisite !== null) gates.push(prerequisite)
    if (planning !== null) gates.push(gate('host-write-constraints', planning.unauthorizedPaths.length === 0,
      planning.unauthorizedPaths.length === 0 ? 'each authored file followed explicit plan and path approval' : `files changed without approval: ${planning.unauthorizedPaths.join(', ')}`))
    if (name !== 'agent-os') {
      dialogue = await runAuthoringDialogue(request, safeDriver, () => authoringSnapshot(workspace, name), name === 'openspec' && !create)
      gates.push(gate('authoring-dialogue', dialogue.completed, dialogue.detail))
      if (name === 'openspec' && !create) gates.push(gate('host-write-constraints', dialogue.unauthorizedPaths.length === 0,
        dialogue.unauthorizedPaths.length === 0 ? 'each authored revision followed test-user approval' : `files changed before approval: ${dialogue.unauthorizedPaths.join(', ')}`))
    }
    const agent = planning?.agent ?? dialogue?.agent ?? await runAgentTurn(driver, request)
    authoringTurns.push(...(planning === null ? dialogue === null ? [agent] : dialogue.turns.map(turn => turn.scoredAgent) : [planning.agent]))
    transcript = agent.output
    gates.push(gate('agent-turn', agent.success, `exit=${agent.exitCode} durationMs=${agent.durationMs}`))
    if (agent.success) {
      gates.push(skillActivationGate(agent.output), authoringGuidance?.verdict() ?? await guidanceActivationGate(workspace, [agent.output]))
      gates.push(hostWorkflowGate(name, agent.output, create))
      if (prerequisite === null || prerequisite.passed === true) {
        const source = await readFile(join(workspace, fixture.path), 'utf8').catch(() => '')
        const evidence = await evidenceGate(workspace, name, source)
        gates.push(create ? creationGate(name, source, evidence.binding) : nativeSingleSourceGate(name, source, evidence.binding), evidence.gate, await companionGate(workspace, name, evidence.binding))
        gates.push(...await focusedCliGates(workspace, evidence))
        const native = await nativeGate(workspace, name)
        validation = native.verdict
        if (native.gate) gates.push(native.gate)
        gates.push(agentEvidenceGate(agent.output, evidence.references), await behaviorGate(workspace, evidence.references), await sensitivityGate(workspace, evidence.references))
        if (name === 'bmad' && (create || source !== initialSpecification(name))) gates.push(await bmadLifecycleGate(workspace, agent.output, create))
      } else {
        for (const check of [create ? 'native-item-created' : 'native-item-single-source', 'one-behavior-source',
          'normalized-evidence', 'focused-cli-validation', 'focused-cli-execution', 'agent-executed-selected-evidence', 'selected-test-executes', 'selected-test-sensitivity']) {
          gates.push({ name: check, passed: null, blockedBy: prerequisite.name, detail: `not judged: ${prerequisite.detail}` })
        }
        validation = outcome('unverified', `not run: ${prerequisite.detail}`)
      }
      const protectedPaths = ['auth/auth.go', 'auth/auth_test.go', 'app/auth.py', 'tests/functional/test_auth.py']
      const modified = []
      for (const path of protectedPaths) {
        const actual = await readFile(join(workspace, path), 'utf8')
        const original = await readFile(join(root, 'evals/fixtures/polyglot', path), 'utf8')
        if (actual !== original) modified.push(path)
      }
      gates.push(gate('product-and-tests-preserved', modified.length === 0, modified.length === 0 ? 'product and selected tests unchanged' : modified.join(', ')))
      const infrastructureBeforeLifecycle = await infrastructureIntegrityGate(workspace, protectedInfrastructure, [transcript])
      if (name === 'bmad' && gates.every(item => item.passed) && infrastructureBeforeLifecycle.passed) {
        const regenerated = await evaluateBmadLifecycle(workspace, model, driver, request)
        lastRequest = regenerated.request
        lifecycleDiagnostic = regenerated.diagnostic
        gates.push(...regenerated.gates)
        lifecycle = regenerated.verdict
        regenerationTranscript = regenerated.transcript
        lifecycleTurns.push(...regenerated.turns)
      }
      if (name === 'openspec' && gates.every(item => item.passed === true) && infrastructureBeforeLifecycle.passed === true) {
        const published = await evaluateOpenSpecLifecycle(workspace, model, driver)
        lastRequest = published.request
        gates.push(...published.gates)
        observations.push(...published.observations)
        lifecycle = published.verdict
        lifecycleTranscript = published.transcript
        publicationCheckpoint = published.checkpoint
        lifecycleTurns.push(...published.turns)
      }
    }
    gates.push(await infrastructureIntegrityGate(workspace, protectedInfrastructure, [transcript, regenerationTranscript, lifecycleTranscript]))
    } catch (error) {
      const failed = await runAgentTurn({ async run() { throw error } }, lastRequest ?? request)
      if (lastRequest?.sessionDir === join(workspace, '.omp-regeneration-sessions')) {
        regenerationTranscript += failed.output
        lifecycle = outcome('failed', failed.output)
      } else transcript += failed.output
      gates.push(gate('evaluation-error', false, failed.output))
    }
    const authoring = judged(gates, ['agent-turn', 'authoring-dialogue', 'focused-skill-loaded', 'focused-workflow-acquired', 'host-workflow-loaded', 'host-authoring-prerequisites', 'host-write-constraints', 'native-item-created', 'native-item-single-source', 'one-behavior-source', 'product-and-tests-preserved', 'pilot-infrastructure-integrity', 'bmad-memlog-workflow', 'evaluation-error'])
    const evidence = gates.find(item => item.name === 'agent-turn')?.passed === true ? judged(gates, ['normalized-evidence', 'focused-cli-validation', 'focused-cli-execution', 'agent-executed-selected-evidence', 'selected-test-executes', 'selected-test-sensitivity', 'evaluation-error'])
      : outcome('unverified', 'agent turn failed; downstream evidence was not judged')
    const certified = [authoring, evidence, validation, lifecycle].every(item => item.status === 'passed')
    const diagnostic = lifecycleDiagnostic ?? (gates.some(item => item.passed === false)
      ? await interviewFailedAgent(lastRequest ?? request, gates, 'One native checkable item for blocked-account login, a stable focused ID tied to exact executable evidence, applicable host workflow and format checks, and successful validation and execution through the installed focused-spec CLI.', driver) : null)
    const allObservations = [...(authoringGuidance?.observations ?? []), ...observations]
    const result = { caseId: name, mode: create ? 'create' : 'revise', certified, authoring, evidence, nativeValidation: validation, nativeLifecycle: lifecycle, workspace, model, gates, observations: allObservations, transcript, dialogue, planning, regenerationTranscript, lifecycleTranscript, publicationCheckpoint, scoredTurns: { authoring: authoringTurns, lifecycle: lifecycleTurns }, ...nativeMeasurements(authoringTurns, lifecycleTurns), diagnostic }
    const resultPath = await saveEvalResult(join(root, 'evals/results'), `native-${create ? 'create-' : ''}${name}`, result)
    console.log(`result: ${resultPath}`)
    for (const item of gates) console.log(`${item.passed === null ? 'BLOCKED' : item.passed ? 'PASS' : 'FAIL'} ${name} ${item.name}: ${item.detail}`)
    for (const item of allObservations) console.log(`OBSERVATION ${name} ${item.name}: observed=${item.passed}; ${item.detail}`)
    for (const [aspect, verdict] of Object.entries({ authoring, evidence, nativeValidation: validation, nativeLifecycle: lifecycle })) console.log(`${verdict.status.toUpperCase()} ${name} ${aspect}: ${verdict.detail}`)
    if (diagnostic !== null) console.log(`DIAGNOSTIC ${name} ${diagnostic.status}: ${diagnostic.detail}`)
    console.log(`workspace: ${workspace}${keep ? '' : ' (removed)'}`)
    if (!certified) process.exitCode = [authoring, evidence, validation, lifecycle].some(item => item.status === 'failed') ? 1 : 2
  } finally {
    if (!keep) await rm(workspace, { recursive: true, force: true })
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const name = process.argv[2] as NativeCase | undefined
  if (name === undefined || !(name in nativeCases)) throw new Error(`Usage: node --experimental-strip-types evals/native-pilot.ts <${Object.keys(nativeCases).join('|')}> [model] [--create] [--keep-workspace]`)
  await evaluateNativePilot(name, process.argv[3]?.startsWith('--') ? 'externcash/gpt-6-sol' : process.argv[3] ?? 'externcash/gpt-6-sol', process.argv.includes('--keep-workspace'), process.argv.includes('--create'))
}
