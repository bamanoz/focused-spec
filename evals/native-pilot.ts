#!/usr/bin/env node
/** Black-box authoring pilot using the same packed focused-spec CLI exposed to evaluated agents. */
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import { loadConfig, loadEvidenceRegistry, parseNativeDocument } from '../dist/index.js'
import type { NativeItem } from '../dist/index.js'
import { OmpAgentDriver } from './omp-agent.ts'
import { runProcess } from './process.ts'
import { guidanceActivationGate, skillActivationGate } from './judge.ts'
import { runAuthoringDialogue } from './dialogue.ts'
import type { DialogueResult } from './dialogue.ts'
import { runPlanningDialogue } from './acp-agent.ts'
import type { PlanningResult } from './acp-agent.ts'
import { interviewFailedAgent } from './diagnostic.ts'

export const nativePilotRoot = fileURLToPath(new URL('..', import.meta.url))
const root = nativePilotRoot
export function selectedKind(reference: string): 'go' | 'python' | undefined {
  if (/^[a-z0-9]+(?:[.-][a-z0-9]+)*::(?:\.\/auth|auth\/auth_test\.go)::TestBlockedAccount$/u.test(reference)) return 'go'
  if (/^[a-z0-9]+(?:[.-][a-z0-9]+)*::tests\/functional\/test_auth\.py::test_blocked_account$/u.test(reference)) return 'python'
  return undefined
}
function markers(source: string, name: NativeCase): { text: string; id: string }[] {
  const pattern = name === 'gherkin' ? /@focused\.([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+)/gu
    : /<!-- focused-spec:id=([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+) -->/gu
  return [...source.matchAll(pattern)].map(match => ({ text: match[0], id: match[1] ?? '' }))
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
export interface Outcome { status: Verdict; detail: string }
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
async function installPackedFocusedSpec(workspace: string, includeGherkin: boolean): Promise<void> {
  const cache = await mkdtemp(join(tmpdir(), 'focused-native-package-'))
  try {
    const packed = await runProcess('npm', ['pack', '--ignore-scripts', '--pack-destination', cache], { cwd: root, timeoutMs: 120_000 })
    if (packed.code !== 0) throw new Error(`focused-spec pack: ${packed.stderr || packed.stdout}`)
    const archive = packed.stdout.trim().split(/\r?\n/u).at(-1)
    if (archive === undefined || archive === '') throw new Error('focused-spec pack did not report an archive')
    const packages = [join(cache, archive), ...(includeGherkin ? ['@cucumber/gherkin', '@cucumber/messages'] : [])]
    await requireCommand('npm', ['install', '--ignore-scripts', '--no-save', ...packages], workspace, 180_000)
  } finally {
    await rm(cache, { recursive: true, force: true })
  }
}

async function provisionRunners(workspace: string): Promise<void> {
  await put(workspace, '.focused-spec/runners/go-test.mjs', `import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execute = promisify(execFile)
export default {
  apiVersion: 1,
  async resolve({ selectors }) {
    const targets = selectors.filter(selector => selector === './auth::TestBlockedAccount' || selector === 'auth/auth_test.go::TestBlockedAccount').map(selector => ({ selector, targetId: selector, displayName: selector }))
    const errors = selectors.filter(selector => !targets.some(target => target.selector === selector)).map(selector => ({ selector, message: 'unknown Go selector' }))
    return { targets, errors }
  },
  async run({ cwd, targets }) {
    const results = []
    for (const target of targets) {
      try {
        const output = await execute('go', ['test', './auth', '-run', '^TestBlockedAccount$', '-count=1', '-v'], { cwd })
        results.push({ targetId: target.targetId, status: output.stdout.includes('--- PASS: TestBlockedAccount') ? 'pass' : 'fail', diagnostic: output.stdout + output.stderr })
      } catch (error) {
        results.push({ targetId: target.targetId, status: 'fail', diagnostic: String(error) })
      }
    }
    return { results }
  },
}
`)
  await put(workspace, '.focused-spec/runners/pytest.mjs', `import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execute = promisify(execFile)
const selector = 'tests/functional/test_auth.py::test_blocked_account'
export default {
  apiVersion: 1,
  async resolve({ selectors }) {
    const targets = selectors.filter(value => value === selector).map(value => ({ selector: value, targetId: value, displayName: value }))
    const errors = selectors.filter(value => value !== selector).map(value => ({ selector: value, message: 'unknown pytest selector' }))
    return { targets, errors }
  },
  async run({ cwd, targets }) {
    const results = []
    for (const target of targets) {
      try {
        const output = await execute('uv', ['run', '--with', 'pytest', 'python', '-m', 'pytest', '-q', selector], { cwd })
        results.push({ targetId: target.targetId, status: output.stdout.includes('1 passed') ? 'pass' : 'fail', diagnostic: output.stdout + output.stderr })
      } catch (error) {
        results.push({ targetId: target.targetId, status: 'fail', diagnostic: String(error) })
      }
    }
    return { results }
  },
}
`)
}
export async function prepareNativeWorkspace(workspace: string, name: NativeCase, create: boolean): Promise<void> {
  await cp(join(root, 'evals/fixtures/polyglot'), workspace, { recursive: true })
  await installPackedFocusedSpec(workspace, name === 'gherkin')
  await provisionRunners(workspace)
  await put(workspace, '.focused-spec/config.yaml', [
    'version: 3',
    'specifications:',
    '  documents:',
    name === 'openspec' ? '    - match: openspec/changes/{scope}/specs/**/*.md'
      : `    - match: ${cases[name].path}`,
    ...(name === 'openspec' ? ['      exclude: [openspec/changes/archive/**]'] : ['      scope: current']),
    'runners:',
    '  go-test:',
    '    module: ./.focused-spec/runners/go-test.mjs',
    '    timeoutMs: 120000',
    '  pytest:',
    '    module: ./.focused-spec/runners/pytest.mjs',
    '    timeoutMs: 120000',
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
    const repo = 'bmad-code-org/BMAD-METHOD'
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

Provenance: host integration of the installed official \`.agents/skills/bmad-spec/SKILL.md\` from \`github:bmad-code-org/BMAD-METHOD/skills\` with the installed \`focused-spec\` skill. This supplements but does not replace or modify either workflow.

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
  const capability = source.match(/^- \*\*CAP-1\*\*\n  - \*\*intent:\*\* ([^\n]+)\n  - \*\*success:\*\* ([^\n]+)/mu)
  const intent = capability?.[1] ?? ''
  const success = capability?.[2] ?? ''
  return /block/iu.test(intent) && /valid/iu.test(success) && deniesAuthentication(success)
    && !/\b(active|unblocked|accepted)\b/iu.test(success)
}
export function nativeSingleSourceGate(name: NativeCase, source: string): Gate {
  const parsed = parseNativeDocument(cases[name].path, source, 'pilot')
  if (name === 'bmad') {
    const preserved = atomicBlockedOutcome(source)
    const nativeClaims = parsed.items.filter(item => item.nativeIds.includes('CAP-1'))
    const unmarked = parsed.items.every(item => item.markerId === undefined)
    const passed = parsed.violations.length === 0 && preserved && nativeClaims.length === 1 && unmarked
    return gate('native-item-single-source', passed,
      `native success criterion retained=${preserved}; native CAP-1 claims=${nativeClaims.length}; generated source unmarked=${unmarked}; parser violations=${parsed.violations.length}`)
  }
  const found = markers(source, name)
  const occurrences = found.length
  const boundItems = found[0] === undefined ? [] : parsed.items.filter(value => value.markerId === found[0]!.id)
  const outcomeText = boundItems[0] === undefined ? '' : boundNativeText(name, source, boundItems[0])
  const preserved = /block/iu.test(outcomeText) && /valid/iu.test(outcomeText) && deniesAuthentication(outcomeText)
  const attached = parsed.violations.length === 0 && boundItems.length === 1
  const noDuplicate = (name !== 'openspec' || (source.match(/^#### Scenario:/gmu) ?? []).length === 1)
    && (name !== 'spec-kit' || (source.match(/^\d+\. \*\*Given\*\*/gmu) ?? []).length === 1)
  const passed = parsed.violations.length === 0 && occurrences === 1 && boundItems.length === 1 && preserved && attached && noDuplicate
  return gate('native-item-single-source', passed,
    `markers=${occurrences} bound native items=${boundItems.length} native text preserved=${preserved} marker attached=${attached} extra scenario=${!noDuplicate} parser violations=${parsed.violations.length}`)
}
function boundNativeText(name: NativeCase, source: string, item: NativeItem): string {
  const lines = source.split('\n')
  const start = item.line - 1
  if (name === 'gherkin') {
    let end = item.line
    while (end < lines.length && !/^\s*(?:Feature|Rule|Background|Scenario(?: Outline)?):/u.test(lines[end]!)) end += 1
    return lines.slice(start, end).join('\n')
  }
  const heading = lines[start]?.match(/^(#{1,6})\s/u)?.[1]
  if (heading === undefined) return item.name
  let end = start + 1
  while (end < lines.length) {
    const nextHeading = lines[end]?.match(/^(#{1,6})\s/u)?.[1]
    if (nextHeading !== undefined && nextHeading.length <= heading.length) break
    end++
  }
  return lines.slice(start, end).join('\n')
}

export function creationGate(name: NativeCase, source: string): Gate {
  const parsed = parseNativeDocument(cases[name].path, source, 'pilot')
  const found = markers(source, name)
  const forms: Record<NativeCase, boolean> = {
    openspec: /^## ADDED Requirements$/mu.test(source) && /^### Requirement:/mu.test(source)
      && /^#### Scenario:/mu.test(source) && /^- \*\*WHEN\*\* /mu.test(source) && /^- \*\*THEN\*\* /mu.test(source),
    'spec-kit': /^### User Story /mu.test(source) && /\*\*Acceptance Scenarios\*\*/u.test(source)
      && /^\d+\. \*\*Given\*\* .*\*\*When\*\* .*\*\*Then\*\* /mu.test(source),
    kiro: /^ *(?:\d+\. )?WHEN [^\n]*?\s+THE [^\r\n]+? SHALL [^\r\n]+/imu.test(source),
    bmad: /^- \*\*CAP-1\*\*$/mu.test(source) && atomicBlockedOutcome(source)
      && ['## Why', '## Capabilities', '## Constraints', '## Non-goals', '## Success signal'].every(section => source.includes(section))
      && found.length === 0,
    gsd: /^- \[.\] \*\*AUTH-01\*\*:/mu.test(source),
    'agent-os': /^# [^\n]+$/mu.test(source) && /^## [^\n]+$/mu.test(source),
    gherkin: /^ *Scenario: [^\n]+/mu.test(source) && /^ *Given /mu.test(source)
      && /^ *When /mu.test(source) && /^ *Then /mu.test(source),
  }
  const identityCount = found.length
  const boundItems = name === 'bmad' ? parsed.items.filter(value => value.nativeIds.includes('CAP-1'))
    : found[0] === undefined ? [] : parsed.items.filter(value => value.markerId === found[0]!.id)
  const nativeIdentityValid = parsed.violations.length === 0 && boundItems.length === 1
  const attached = name === 'bmad' ? found.length === 0 && nativeIdentityValid : nativeIdentityValid
  const outcomeText = boundItems[0] === undefined ? '' : boundNativeText(name, source, boundItems[0])
  const semanticOutcome = name === 'bmad' ? atomicBlockedOutcome(source)
    : /block/iu.test(outcomeText) && /valid/iu.test(outcomeText) && deniesAuthentication(outcomeText)
  const noDuplicate = (name !== 'openspec' || (source.match(/^#### Scenario:/gmu) ?? []).length === 1)
    && (name !== 'spec-kit' || (source.match(/^\d+\. \*\*Given\*\*/gmu) ?? []).length === 1)
  const passed = forms[name] && semanticOutcome && attached && nativeIdentityValid && noDuplicate
    && (name === 'bmad' ? identityCount === 0 : identityCount === 1)
  return gate('native-item-created', passed,
    `native form=${forms[name]} blocked/valid/rejected outcome=${semanticOutcome} identity count=${identityCount} bound native items=${boundItems.length} marker attached=${attached} extra scenario=${!noDuplicate} parser violations=${parsed.violations.length}`)
}
export function hostWorkflowGate(name: NativeCase, transcript: string, create = false): Gate {
  const skill = name === 'openspec' ? create ? 'openspec-propose' : 'openspec-update-change'
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
  const paths = await fg([`${name === 'openspec' ? 'openspec' : 'agent-os'}/**`, '.focused-spec/**'], { cwd: workspace, onlyFiles: true, dot: true })
  const files = new Map<string, string>()
  for (const path of paths) files.set(path, await readFile(join(workspace, path), 'utf8'))
  return files
}
export async function infrastructureSnapshot(workspace: string): Promise<Map<string, string>> {
  const paths = await fg(['.focused-spec/runners/**', 'node_modules/focused-spec/**', '.omp/skills/**', '.omp/extensions/**', '.agents/**', '.pi/gsd-core/**'], {
    cwd: workspace, onlyFiles: true, dot: true,
  })
  const files = new Map<string, string>()
  for (const path of paths) files.set(path, await readFile(join(workspace, path), 'utf8'))
  return files
}

export async function infrastructureIntegrityGate(workspace: string, before: ReadonlyMap<string, string>): Promise<Gate> {
  const after = await infrastructureSnapshot(workspace)
  const paths = new Set([...before.keys(), ...after.keys()])
  const changed = [...paths].filter(path => before.get(path) !== after.get(path))
  return gate('pilot-infrastructure-integrity', changed.length === 0,
    changed.length === 0 ? 'packed CLI, project runners, installed host skills, and generated .agents copies unchanged' : `modified protected pilot infrastructure: ${changed.join(', ')}`)
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
  const registry = await loadEvidenceRegistry(workspace, loaded.config.evidence?.files)
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

async function regenerateBmad(workspace: string, model: string): Promise<{ gates: Gate[]; verdict: Outcome; transcript: string }> {
  const path = cases.bmad.path
  const before = await readFile(join(workspace, path), 'utf8')
  const registry = await registrySnapshot(workspace)
  const config = await readFile(join(workspace, '.focused-spec/config.yaml'), 'utf8')
  await rm(join(workspace, path))
  const agent = await new OmpAgentDriver().run({ workspace, model, sessionDir: join(workspace, '.omp-regeneration-sessions'), skills: ['focused-spec', 'bmad-spec'], timeoutMs: 600_000,
    prompt: `Regenerate the existing BMad specification at ${path} from its recorded decisions. No new behavior is requested.` })
  const focusedSkill = skillActivationGate(agent.output)
  const workflow = await guidanceActivationGate(workspace, [agent.output])
  const after = await readFile(join(workspace, path), 'utf8').catch(() => '')
  const binding = await evidenceGate(workspace, 'bmad', after)
  const cli = await focusedCliGates(workspace, binding)
  const registryPreserved = await registrySnapshot(workspace).then(after => JSON.stringify(after) === JSON.stringify(registry), () => false)
  const configPreserved = await readFile(join(workspace, '.focused-spec/config.yaml'), 'utf8').catch(() => '') === config
  const unique = (after.match(/^- \*\*CAP-1\*\*$/gmu) ?? []).length === 1 && !/^- \*\*CAP-2\*\*$/mu.test(after)
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

export async function companionGate(workspace: string, name: NativeCase): Promise<Gate> {
  const paths = await fg([
    '**/*.md', '**/*.feature',
    '!node_modules/**', '!.omp/**', '!.omp-*-sessions/**', '!.agents/**', '!.specify/**',
    '!.pi/gsd-core/**', '!.home/.npm/**',
  ], { cwd: workspace, onlyFiles: true, dot: true })
  const companions = paths.filter(path => /(?:^|\/)scenarios\.(?:md|feature)$/u.test(path)).sort()
  const matches: { path: string; count: number }[] = []
  const violations: string[] = []
  let occurrences = 0
  for (const path of paths) {
    const content = await readFile(join(workspace, path), 'utf8')
    const document = parseNativeDocument(path, content, 'current')
    let count = 0
    for (const item of document.items) {
      if (name === 'bmad' ? item.nativeIds.includes('CAP-1') : item.markerId !== undefined) count += 1
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
    blockedBy: 'evidence-only-registry', detail: 'not judged: no valid registry selection; this does not mean no test ran' }
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
    if (selectedKind(reference) === 'go') return /(?:^|&&|;)\s*go\s+test\b/u.test(command)
      && command.includes('TestBlockedAccount') && /(?:--- PASS: TestBlockedAccount\b|^ok\s)/mu.test(output)
    return /(?:^|&&|;)\s*(?:uv\s+run\s+[^;&]*|python(?:3)?\s+-m\s+)?pytest\b/u.test(command)
      && command.includes('test_blocked_account') && /\b\d+ passed\b/u.test(output)
  }))
  return gate('agent-executed-selected-evidence', executed, executed ? references.join(', ') : 'no completed matching test execution in agent transcript')
}
export async function sensitivityGate(workspace: string, references: string[]): Promise<Gate> {
  if (references.length === 0) return { name: 'selected-test-sensitivity', passed: null,
    blockedBy: 'evidence-only-registry', detail: 'not run: no valid registry selection for a sensitivity probe' }
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
}> {
  try {
    const loaded = await loadConfig(workspace)
    if (loaded.config === undefined) throw new Error(loaded.violations.map(item => item.message).join('; '))
    const registry = await loadEvidenceRegistry(workspace, loaded.config.evidence?.files, expectedScope)
    if (registry.violations.length > 0) throw new Error(registry.violations.map(item => `${item.path}${item.line === undefined ? '' : `:${item.line}`}: ${item.message}`).join('; '))
    const candidates = expectedScope === undefined ? registry.entries : registry.entries.filter(item => item.scope === expectedScope)
    if (candidates.length !== 1 || expectedScope === undefined && registry.entries.length !== 1) {
      throw new Error(`expected one${expectedScope === undefined ? '' : ` ${expectedScope}`} registry entry; found ${candidates.length}`)
    }
    const entry = candidates[0]!
    const parsed = parseNativeDocument(cases[name].path, sourceText, entry.scope)
    if (/^\s*- \*\*(?:ID|EVIDENCE)\*\*:/mu.test(sourceText)) throw new Error('native source contains legacy ID or EVIDENCE rows')
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
      if (entry.source !== undefined) throw new Error('marked native items must not use an external source binding')
      const bound = parsed.items.filter(item => item.markerId === entry.id)
      if (bound.length !== 1) throw new Error(`registry ID ${entry.id} must bind one native item; found ${bound.length}`)
    }
    const references = [...entry.evidence]
    if (references.length === 0 || references.length > 2) throw new Error('evidence must contain one or two exact test references')
    if (!references.every(value => selectedKind(value) !== undefined)) {
      throw new Error('evidence selector must identify TestBlockedAccount or test_blocked_account with a valid runner ID')
    }
    if (new Set(references.map(value => selectedKind(value))).size !== references.length) throw new Error('evidence repeats the same selected test')
    return { gate: gate('evidence-only-registry', true, `${entry.scope}/${entry.id}: ${references.join(', ')}`), references, scope: entry.scope, id: entry.id }
  } catch (error) {
    return { gate: gate('evidence-only-registry', false, `registry rejected: ${String(error)}`), references: [] }
  }
}

export async function focusedCliGates(workspace: string, selection: { scope?: string; id?: string; references: string[] }): Promise<Gate[]> {
  if (selection.scope === undefined || selection.id === undefined || selection.references.length === 0) {
    return [
      gate('focused-cli-validation', false, 'registry selection unavailable'),
      gate('focused-cli-execution', false, 'registry selection unavailable'),
    ]
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
  if (name === 'openspec') {
    const command = 'openspec validate link-blocked-account --strict --no-interactive'
    const result = await runProcess('openspec', ['validate', 'link-blocked-account', '--strict', '--no-interactive'], { cwd: workspace, timeoutMs: 60_000 })
    return { gate: gate('host-validation', result.code === 0, `${command}: ${(result.stderr || result.stdout).trim()}`),
      verdict: outcome(result.code === 0 ? 'passed' : 'failed', command) }
  }
  if (name === 'gherkin') {
    const source = `import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin'; import { IdGenerator } from '@cucumber/messages'; import { readFileSync } from 'node:fs'; const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher()); const feature = parser.parse(readFileSync('features/blocked_login.feature', 'utf8')).feature; if (feature?.children.length !== 1) process.exit(1);`
    const result = await runProcess(process.execPath, ['--input-type=module', '-e', source], { cwd: workspace, timeoutMs: 30_000 })
    return { gate: gate('host-validation', result.code === 0, result.code === 0 ? 'official Gherkin parser accepted one scenario' : (result.stderr || result.stdout).trim()),
      verdict: outcome(result.code === 0 ? 'passed' : 'failed', 'official @cucumber/gherkin parser (syntax only)') }
  }
  return { gate: null, verdict: outcome('unverified', `${name} has no runnable native format validator in this fixture`) }
}
export async function behaviorGate(workspace: string, references: string[]): Promise<Gate> {
  if (references.length === 0) return { name: 'selected-test-executes', passed: null,
    blockedBy: 'evidence-only-registry', detail: 'not run: no valid registry selection for evidence execution' }
  const results = []
  for (const reference of references) {
    const spec = testCommand(reference)
    const test = await runProcess(spec.command, spec.args, { cwd: workspace, timeoutMs: 60_000 })
    const passed = test.code === 0 && (selectedKind(reference) === 'go' ? test.stdout.includes('--- PASS: TestBlockedAccount') : test.stdout.includes('1 passed'))
    results.push({ reference, passed, output: (test.stderr || test.stdout).trim() })
  }
  return gate('selected-test-executes', results.every(result => result.passed), results.map(result => `${result.reference}: ${result.output}`).join('\n'))
}

export async function evaluateNativePilot(name: NativeCase, model: string, keep: boolean, create: boolean): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), `focused-native-${name}-`))
  const sessionDir = join(workspace, '.omp-eval-sessions')
  const gates: Gate[] = []
  let validation = outcome('unverified', 'native validation not attempted')
  let lifecycle = outcome('unverified', 'no independent host lifecycle transition exercised')
  let transcript = ''
  let regenerationTranscript = ''
  let dialogue: DialogueResult | null = null
  let planning: PlanningResult | null = null
  try {
    await prepareNativeWorkspace(workspace, name, create)
    const protectedInfrastructure = await infrastructureSnapshot(workspace)
    const fixture = cases[name]
    const prompt = create
      ? `Create a ${name} specification for this project at ${fixture.path}: an account blocked by an administrator must not log in even with valid credentials. The implementation and tests already exist.`
      : `Update the existing ${name} specification at ${fixture.path}: clarify that a blocked account must be rejected even when its credentials are valid. The implementation and tests already exist.`
    const skills = name === 'openspec' ? ['focused-spec', 'openspec-propose', 'openspec-update-change', 'openspec-explore']
      : name === 'spec-kit' ? ['focused-spec', 'speckit-specify']
        : name === 'bmad' ? ['focused-spec', 'bmad-spec', 'bmad-focused-spec-integration']
          : name === 'gsd' ? ['focused-spec', 'gsd-new-project', 'gsd-requirements']
            : name === 'kiro' ? ['focused-spec', 'kiro-requirements']
              : name === 'agent-os' ? ['focused-spec', 'agent-os-shape-spec'] : ['focused-spec']
    const driver = new OmpAgentDriver()
    const request = { workspace, sessionDir, prompt, skills, model, timeoutMs: 600_000 }
    if (name === 'agent-os') planning = await runPlanningDialogue(request, () => authoringSnapshot(workspace, name))
    const prerequisite = hostPrerequisiteGate(name, planning ?? undefined)
    if (prerequisite !== null) gates.push(prerequisite)
    if (planning !== null) gates.push(gate('host-write-constraints', planning.unauthorizedPaths.length === 0,
      planning.unauthorizedPaths.length === 0 ? 'each authored file followed explicit plan and path approval' : `files changed without approval: ${planning.unauthorizedPaths.join(', ')}`))
    if (name === 'openspec' || name === 'kiro') {
      dialogue = await runAuthoringDialogue(request, driver, () => authoringSnapshot(workspace, name), name === 'openspec' && !create)
      gates.push(gate('authoring-dialogue', dialogue.completed, dialogue.detail))
      if (name === 'openspec' && !create) gates.push(gate('host-write-constraints', dialogue.unauthorizedPaths.length === 0,
        dialogue.unauthorizedPaths.length === 0 ? 'each authored revision followed test-user approval' : `files changed before approval: ${dialogue.unauthorizedPaths.join(', ')}`))
    }
    const agent = planning?.agent ?? dialogue?.agent ?? await driver.run(request)
    transcript = agent.output
    gates.push(gate('agent-turn', agent.success, `exit=${agent.exitCode} durationMs=${agent.durationMs}`))
    if (agent.success) {
      gates.push(skillActivationGate(agent.output), await guidanceActivationGate(workspace, [agent.output]))
      gates.push(hostWorkflowGate(name, agent.output, create))
      if (prerequisite === null || prerequisite.passed === true) {
        const source = await readFile(join(workspace, fixture.path), 'utf8').catch(() => '')
        const evidence = await evidenceGate(workspace, name, source)
        gates.push(create ? creationGate(name, source) : nativeSingleSourceGate(name, source), evidence.gate, await companionGate(workspace, name))
        gates.push(...await focusedCliGates(workspace, evidence))
        const native = await nativeGate(workspace, name)
        validation = native.verdict
        if (native.gate) gates.push(native.gate)
        gates.push(agentEvidenceGate(agent.output, evidence.references), await behaviorGate(workspace, evidence.references), await sensitivityGate(workspace, evidence.references))
        if (name === 'bmad' && (create || source !== initialSpecification(name))) gates.push(await bmadLifecycleGate(workspace, agent.output, create))
      } else {
        for (const check of [create ? 'native-item-created' : 'native-item-single-source', 'one-behavior-source',
          'evidence-only-registry', 'focused-cli-validation', 'focused-cli-execution', 'agent-executed-selected-evidence', 'selected-test-executes', 'selected-test-sensitivity']) {
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
      const infrastructureBeforeLifecycle = await infrastructureIntegrityGate(workspace, protectedInfrastructure)
      if (name === 'bmad' && gates.every(item => item.passed) && infrastructureBeforeLifecycle.passed) {
        const regenerated = await regenerateBmad(workspace, model)
        gates.push(...regenerated.gates)
        lifecycle = regenerated.verdict
        regenerationTranscript = regenerated.transcript
      }
    }
    gates.push(await infrastructureIntegrityGate(workspace, protectedInfrastructure))
    const authoring = judged(gates, ['agent-turn', 'authoring-dialogue', 'focused-skill-loaded', 'focused-workflow-acquired', 'host-workflow-loaded', 'host-authoring-prerequisites', 'host-write-constraints', 'native-item-created', 'native-item-single-source', 'one-behavior-source', 'product-and-tests-preserved', 'pilot-infrastructure-integrity', 'bmad-memlog-workflow'])
    const evidence = agent.success ? judged(gates, ['evidence-only-registry', 'focused-cli-validation', 'focused-cli-execution', 'agent-executed-selected-evidence', 'selected-test-executes', 'selected-test-sensitivity'])
      : outcome('unverified', 'agent turn failed; downstream evidence was not judged')
    const certified = [authoring, evidence, validation, lifecycle].every(item => item.status === 'passed')
    const diagnostic = gates.some(item => item.passed === false)
      ? await interviewFailedAgent(request, gates, 'One native checkable item for blocked-account login, a stable focused ID tied to exact executable evidence, applicable host workflow and format checks, and successful validation and execution through the installed focused-spec CLI.', driver) : null
    const result = { caseId: name, mode: create ? 'create' : 'revise', certified, authoring, evidence, nativeValidation: validation, nativeLifecycle: lifecycle, workspace, model, gates, transcript, dialogue, planning, regenerationTranscript, diagnostic }
    await mkdir(join(root, 'evals/results'), { recursive: true })
    await writeFile(join(root, 'evals/results', `native-${create ? 'create-' : ''}${name}-${Date.now()}.json`), `${JSON.stringify(result, null, 2)}\n`)
    for (const item of gates) console.log(`${item.passed === null ? 'BLOCKED' : item.passed ? 'PASS' : 'FAIL'} ${name} ${item.name}: ${item.detail}`)
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
